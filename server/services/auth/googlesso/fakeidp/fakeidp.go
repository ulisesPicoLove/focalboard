// Package fakeidp is a minimal OpenID Connect provider for tests: discovery, signing keys and
// a token endpoint that enforces PKCE and returns an ID token built from the exported fields.
// It is test support only and must not be used by production code.
package fakeidp

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
)

// GoodCode is the only authorization code the token endpoint accepts.
const GoodCode = "good-code"

// Server is the fake provider. Set the exported fields before the code is exchanged.
type Server struct {
	// URL is the issuer.
	URL string

	// What the next ID token says.
	Subject       string
	Email         string
	EmailVerified bool
	HostedDomain  string
	Audience      string
	// Nonce overrides the nonce of the ID token. When empty, the nonce from the last
	// authorization request is used.
	Nonce string

	// TokenCalls counts requests to the token endpoint.
	TokenCalls int

	t         *testing.T
	server    *httptest.Server
	key       *rsa.PrivateKey
	challenge string
	authNonce string
}

// New starts a provider that accepts the given client id as the token audience.
func New(t *testing.T, clientID, domain string) *Server {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	s := &Server{
		t:             t,
		key:           key,
		Subject:       "1234567890",
		Email:         "ana@" + domain,
		EmailVerified: true,
		HostedDomain:  domain,
		Audience:      clientID,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{
			"issuer":                                s.URL,
			"authorization_endpoint":                s.URL + "/auth",
			"token_endpoint":                        s.URL + "/token",
			"jwks_uri":                              s.URL + "/keys",
			"id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("/keys", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &s.key.PublicKey, KeyID: "k1", Algorithm: "RS256", Use: "sig"}}})
	})
	mux.HandleFunc("/token", s.handleToken)

	s.server = httptest.NewServer(mux)
	s.URL = s.server.URL
	t.Cleanup(s.server.Close)

	return s
}

// Capture records the PKCE challenge and nonce of an authorization URL built by the code
// under test. Call it with the URL the browser would be sent to.
func (s *Server) Capture(authURL string) url.Values {
	s.t.Helper()

	u, err := url.Parse(authURL)
	require.NoError(s.t, err)

	q := u.Query()
	s.challenge = q.Get("code_challenge")
	s.authNonce = q.Get("nonce")

	return q
}

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	s.TokenCalls++
	require.NoError(s.t, r.ParseForm())

	// PKCE: the verifier must hash to the challenge sent in the authorization request.
	sum := sha256.Sum256([]byte(r.PostForm.Get("code_verifier")))
	if base64.RawURLEncoding.EncodeToString(sum[:]) != s.challenge {
		http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
		return
	}
	if r.PostForm.Get("grant_type") != "authorization_code" || r.PostForm.Get("code") != GoodCode {
		http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
		return
	}

	nonce := s.Nonce
	if nonce == "" {
		nonce = s.authNonce
	}

	claims := map[string]any{
		"iss":            s.URL,
		"sub":            s.Subject,
		"aud":            s.Audience,
		"exp":            time.Now().Add(time.Hour).Unix(),
		"iat":            time.Now().Unix(),
		"nonce":          nonce,
		"email":          s.Email,
		"email_verified": s.EmailVerified,
		"name":           "Ana Pérez",
		"given_name":     "Ana",
		"family_name":    "Pérez",
	}
	if s.HostedDomain != "" {
		claims["hd"] = s.HostedDomain
	}

	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: jose.JSONWebKey{Key: s.key, KeyID: "k1"}},
		(&jose.SignerOptions{}).WithType("JWT"),
	)
	require.NoError(s.t, err)

	idToken, err := jwt.Signed(signer).Claims(claims).Serialize()
	require.NoError(s.t, err)

	writeJSON(w, map[string]any{"access_token": "at", "token_type": "Bearer", "expires_in": 3600, "id_token": idToken})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
