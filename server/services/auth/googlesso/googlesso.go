// Package googlesso implements "Sign in with Google" (OpenID Connect, authorization
// code flow with PKCE) restricted to a single Google Workspace domain.
//
// The flow is split in two calls so the HTTP layer stays thin:
//
//	Begin    builds the Google authorization URL and stores the per-browser
//	         state, nonce and PKCE verifier in a signed, short-lived cookie.
//	Complete checks the callback against that cookie, exchanges the code,
//	         verifies the ID token and the domain, and returns the identity.
package googlesso

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

const (
	// AuthService is the auth mode name, stored in sessions and users created through Google.
	AuthService = "google"

	// GoogleIssuer is the OpenID Connect issuer of Google accounts.
	GoogleIssuer = "https://accounts.google.com"

	// CookieName is the cookie that carries the signed login state.
	CookieName = "picoboard_sso"

	cookieTTL = 10 * time.Minute

	// requestTimeout bounds every call to Google (discovery, token exchange, signing keys),
	// so a slow or unreachable provider cannot hang sign-ins.
	requestTimeout = 10 * time.Second
)

var (
	// ErrInvalidState means the callback does not match a login started in this browser.
	ErrInvalidState = errors.New("invalid or expired sso state")
	// ErrAccessDenied means the user (or Google) refused the sign-in.
	ErrAccessDenied = errors.New("sign-in was denied")
	// ErrEmailNotVerified means Google did not verify the email address.
	ErrEmailNotVerified = errors.New("email address is not verified")
	// ErrDomainNotAllowed means the account does not belong to the allowed domain.
	ErrDomainNotAllowed = errors.New("account is not in the allowed domain")
)

// Config is the provider configuration.
type Config struct {
	ClientID     string
	ClientSecret string
	// AllowedDomain is the only Google Workspace domain that may sign in (e.g. "example.com").
	AllowedDomain string
	// RedirectURL is the absolute URL of the callback endpoint registered in Google Cloud.
	RedirectURL string
	// CookiePath is the path the state cookie is scoped to (the callback path).
	CookiePath string
	// SecureCookie marks the state cookie as Secure (use with HTTPS).
	SecureCookie bool
	// Issuer overrides GoogleIssuer. Only meant for tests.
	Issuer string
}

// Claims is the verified identity returned by Complete.
type Claims struct {
	Subject    string
	Email      string
	Name       string
	GivenName  string
	FamilyName string
}

// Provider runs the sign-in flow.
type Provider struct {
	cfg        Config
	key        []byte
	now        func() time.Time
	httpClient *http.Client

	mu       sync.Mutex
	oauth    *oauth2.Config
	verifier *oidc.IDTokenVerifier
}

type loginState struct {
	State    string `json:"s"`
	Nonce    string `json:"n"`
	Verifier string `json:"v"`
	Redirect string `json:"r"`
	Expires  int64  `json:"e"`
}

// New validates the configuration and creates a provider. It does not contact Google:
// discovery happens lazily on first use, so the server can start without network access.
func New(cfg Config) (*Provider, error) {
	var missing []string
	if cfg.ClientID == "" {
		missing = append(missing, "google_client_id")
	}
	if cfg.ClientSecret == "" {
		missing = append(missing, "google_client_secret")
	}
	if cfg.AllowedDomain == "" {
		missing = append(missing, "google_allowed_domain")
	}
	if cfg.RedirectURL == "" {
		missing = append(missing, "redirect URL")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("google sso is enabled but these settings are missing: %s", strings.Join(missing, ", "))
	}

	cfg.AllowedDomain = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(cfg.AllowedDomain), "@"))
	if cfg.Issuer == "" {
		cfg.Issuer = GoogleIssuer
	}

	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("unable to create the sso signing key: %w", err)
	}

	return &Provider{cfg: cfg, key: key, now: time.Now, httpClient: &http.Client{Timeout: requestTimeout}}, nil
}

// SafeRedirect returns path if it is a local path, or "/" otherwise, so a login
// link cannot be used to bounce the user to another site.
func SafeRedirect(path string) string {
	if path == "" || path[0] != '/' || strings.HasPrefix(path, "//") || strings.ContainsAny(path, "\\\r\n\t") {
		return "/"
	}
	return path
}

func (p *Provider) discover(ctx context.Context) (*oauth2.Config, *oidc.IDTokenVerifier, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.oauth != nil {
		return p.oauth, p.verifier, nil
	}

	provider, err := oidc.NewProvider(ctx, p.cfg.Issuer)
	if err != nil {
		return nil, nil, fmt.Errorf("unable to reach the sign-in provider: %w", err)
	}

	p.oauth = &oauth2.Config{
		ClientID:     p.cfg.ClientID,
		ClientSecret: p.cfg.ClientSecret,
		RedirectURL:  p.cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}
	p.verifier = provider.Verifier(&oidc.Config{ClientID: p.cfg.ClientID})

	return p.oauth, p.verifier, nil
}

// Begin starts a sign-in: it sets the signed state cookie on w and returns the URL to send
// the browser to. redirect is the local path to open after signing in.
func (p *Provider) Begin(ctx context.Context, w http.ResponseWriter, redirect string) (string, error) {
	ctx = oidc.ClientContext(ctx, p.httpClient)

	oauthCfg, _, err := p.discover(ctx)
	if err != nil {
		return "", err
	}

	state, err := randomString(32)
	if err != nil {
		return "", err
	}
	nonce, err := randomString(32)
	if err != nil {
		return "", err
	}

	verifier := oauth2.GenerateVerifier()

	value, err := p.sign(loginState{
		State:    state,
		Nonce:    nonce,
		Verifier: verifier,
		Redirect: SafeRedirect(redirect),
		Expires:  p.now().Add(cookieTTL).Unix(),
	})
	if err != nil {
		return "", err
	}

	http.SetCookie(w, p.cookie(value, int(cookieTTL.Seconds())))

	return oauthCfg.AuthCodeURL(
		state,
		oidc.Nonce(nonce),
		oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("hd", p.cfg.AllowedDomain),
		oauth2.SetAuthURLParam("prompt", "select_account"),
	), nil
}

// Complete handles the callback request. It always clears the state cookie. On success it
// returns the verified identity and the local path to redirect to.
func (p *Provider) Complete(ctx context.Context, w http.ResponseWriter, r *http.Request) (*Claims, string, error) {
	// A state cookie can only be used once, whatever the outcome.
	http.SetCookie(w, p.cookie("", -1))

	cookie, err := r.Cookie(CookieName)
	if err != nil {
		return nil, "", ErrInvalidState
	}

	st, err := p.verify(cookie.Value)
	if err != nil {
		return nil, "", ErrInvalidState
	}

	query := r.URL.Query()
	if subtle.ConstantTimeCompare([]byte(query.Get("state")), []byte(st.State)) != 1 {
		return nil, "", ErrInvalidState
	}

	if query.Get("error") != "" {
		return nil, "", ErrAccessDenied
	}

	code := query.Get("code")
	if code == "" {
		return nil, "", ErrInvalidState
	}

	// oidc.ClientContext also sets the client used by the OAuth2 token exchange.
	ctx = oidc.ClientContext(ctx, p.httpClient)

	oauthCfg, verifier, err := p.discover(ctx)
	if err != nil {
		return nil, "", err
	}

	token, err := oauthCfg.Exchange(ctx, code, oauth2.VerifierOption(st.Verifier))
	if err != nil {
		return nil, "", fmt.Errorf("unable to exchange the authorization code: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return nil, "", errors.New("the provider did not return an id_token")
	}

	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, "", fmt.Errorf("unable to verify the id_token: %w", err)
	}

	if subtle.ConstantTimeCompare([]byte(idToken.Nonce), []byte(st.Nonce)) != 1 {
		return nil, "", ErrInvalidState
	}

	var idClaims struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		HostedDomain  string `json:"hd"`
	}
	if err = idToken.Claims(&idClaims); err != nil {
		return nil, "", fmt.Errorf("unable to read the id_token claims: %w", err)
	}

	if idClaims.Subject == "" || idClaims.Email == "" {
		return nil, "", errors.New("the id_token has no subject or email")
	}

	if !idClaims.EmailVerified {
		return nil, "", ErrEmailNotVerified
	}

	// Both checks are required: "hd" identifies the Workspace, and the email suffix
	// guards against an account that merely lists a matching address.
	email := strings.ToLower(strings.TrimSpace(idClaims.Email))
	if !strings.EqualFold(idClaims.HostedDomain, p.cfg.AllowedDomain) || !strings.HasSuffix(email, "@"+p.cfg.AllowedDomain) {
		return nil, "", ErrDomainNotAllowed
	}

	return &Claims{
		Subject:    idClaims.Subject,
		Email:      email,
		Name:       idClaims.Name,
		GivenName:  idClaims.GivenName,
		FamilyName: idClaims.FamilyName,
	}, st.Redirect, nil
}

func (p *Provider) cookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     p.cfg.CookiePath,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   p.cfg.SecureCookie,
		// Lax is required: Google sends the browser back with a top-level GET.
		SameSite: http.SameSiteLaxMode,
	}
}

func (p *Provider) sign(st loginState) (string, error) {
	payload, err := json.Marshal(st)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	return encoded + "." + base64.RawURLEncoding.EncodeToString(p.mac(encoded)), nil
}

func (p *Provider) verify(value string) (*loginState, error) {
	encoded, sig, ok := strings.Cut(value, ".")
	if !ok {
		return nil, ErrInvalidState
	}

	gotSig, err := base64.RawURLEncoding.DecodeString(sig)
	if err != nil || !hmac.Equal(gotSig, p.mac(encoded)) {
		return nil, ErrInvalidState
	}

	payload, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, ErrInvalidState
	}

	var st loginState
	if err = json.Unmarshal(payload, &st); err != nil {
		return nil, ErrInvalidState
	}

	if st.State == "" || st.Nonce == "" || st.Verifier == "" || p.now().Unix() > st.Expires {
		return nil, ErrInvalidState
	}

	return &st, nil
}

func (p *Provider) mac(data string) []byte {
	m := hmac.New(sha256.New, p.key)
	m.Write([]byte(data))
	return m.Sum(nil)
}

func randomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("unable to generate a random value: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
