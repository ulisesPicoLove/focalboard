package googlesso

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/mattermost/focalboard/server/services/auth/googlesso/fakeidp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testClientID = "client-id.apps.googleusercontent.com"
	testSecret   = "client-secret"
	testDomain   = "example.com"
)

func newTestProvider(t *testing.T, f *fakeidp.Server) *Provider {
	t.Helper()

	p, err := New(Config{
		ClientID:      testClientID,
		ClientSecret:  testSecret,
		AllowedDomain: testDomain,
		RedirectURL:   "https://boards.example.com/oauth/google/callback",
		CookiePath:    "/oauth/google/callback",
		SecureCookie:  true,
		Issuer:        f.URL,
	})
	require.NoError(t, err)

	return p
}

// begin runs the first step and returns the authorization URL parameters and the state cookie.
func begin(t *testing.T, p *Provider, f *fakeidp.Server, redirect string) (url.Values, *http.Cookie) {
	t.Helper()

	rec := httptest.NewRecorder()
	authURL, err := p.Begin(context.Background(), rec, redirect)
	require.NoError(t, err)

	q := f.Capture(authURL)

	var cookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName {
			cookie = c
		}
	}
	require.NotNil(t, cookie, "the state cookie must be set")

	return q, cookie
}

func callback(p *Provider, cookie *http.Cookie, query url.Values) (*Claims, string, error, *httptest.ResponseRecorder) { //nolint:staticcheck
	req := httptest.NewRequest(http.MethodGet, "/oauth/google/callback?"+query.Encode(), nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	claims, redirect, err := p.Complete(context.Background(), rec, req)
	return claims, redirect, err, rec
}

func goodQuery(q url.Values) url.Values {
	return url.Values{"code": {fakeidp.GoodCode}, "state": {q.Get("state")}}
}

func TestBeginBuildsTheAuthorizationRequest(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	p := newTestProvider(t, f)

	q, cookie := begin(t, p, f, "/boards/1")

	assert.Equal(t, testClientID, q.Get("client_id"))
	assert.Equal(t, "https://boards.example.com/oauth/google/callback", q.Get("redirect_uri"))
	assert.Equal(t, "code", q.Get("response_type"))
	assert.Equal(t, "openid email profile", q.Get("scope"))
	assert.Equal(t, "S256", q.Get("code_challenge_method"))
	assert.NotEmpty(t, q.Get("code_challenge"))
	assert.NotEmpty(t, q.Get("state"))
	assert.NotEmpty(t, q.Get("nonce"))
	assert.Equal(t, testDomain, q.Get("hd"))
	assert.Equal(t, "select_account", q.Get("prompt"))

	assert.True(t, cookie.HttpOnly)
	assert.True(t, cookie.Secure)
	assert.Equal(t, http.SameSiteLaxMode, cookie.SameSite)
	assert.Equal(t, "/oauth/google/callback", cookie.Path)
	assert.Positive(t, cookie.MaxAge)
}

func TestBeginUsesFreshValuesEachTime(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	p := newTestProvider(t, f)

	q1, c1 := begin(t, p, f, "/")
	q2, c2 := begin(t, p, f, "/")

	assert.NotEqual(t, q1.Get("state"), q2.Get("state"))
	assert.NotEqual(t, q1.Get("nonce"), q2.Get("nonce"))
	assert.NotEqual(t, q1.Get("code_challenge"), q2.Get("code_challenge"))
	assert.NotEqual(t, c1.Value, c2.Value)
}

func TestCompleteSuccess(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/boards/1?view=2")

	claims, redirect, err, rec := callback(p, cookie, goodQuery(q))

	require.NoError(t, err)
	assert.Equal(t, "1234567890", claims.Subject)
	assert.Equal(t, "ana@example.com", claims.Email)
	assert.Equal(t, "Ana Pérez", claims.Name)
	assert.Equal(t, "Ana", claims.GivenName)
	assert.Equal(t, "Pérez", claims.FamilyName)
	assert.Equal(t, "/boards/1?view=2", redirect)

	// the state cookie is cleared
	var cleared bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName && c.MaxAge < 0 {
			cleared = true
		}
	}
	assert.True(t, cleared, "the state cookie must be cleared")
}

func TestCompleteLowercasesTheEmail(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	f.Email = "Ana.Perez@Example.COM"
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	claims, _, err, _ := callback(p, cookie, goodQuery(q))

	require.NoError(t, err)
	assert.Equal(t, "ana.perez@example.com", claims.Email)
}

func TestCompleteRejectsAccountsOutsideTheDomain(t *testing.T) {
	cases := map[string]struct {
		email  string
		hd     string
		expect error
	}{
		"other workspace":          {email: "ana@other.com", hd: "other.com", expect: ErrDomainNotAllowed},
		"right hd, foreign email":  {email: "ana@evil.com", hd: testDomain, expect: ErrDomainNotAllowed},
		"right email, no hd":       {email: "ana@" + testDomain, hd: "", expect: ErrDomainNotAllowed},
		"right email, wrong hd":    {email: "ana@" + testDomain, hd: "other.com", expect: ErrDomainNotAllowed},
		"subdomain of the domain":  {email: "ana@sub." + testDomain, hd: testDomain, expect: ErrDomainNotAllowed},
		"domain as a local part":   {email: testDomain + "@evil.com", hd: testDomain, expect: ErrDomainNotAllowed},
		"suffix without the @ sep": {email: "ana@not" + testDomain, hd: testDomain, expect: ErrDomainNotAllowed},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			f := fakeidp.New(t, testClientID, testDomain)
			f.Email = tc.email
			f.HostedDomain = tc.hd
			p := newTestProvider(t, f)
			q, cookie := begin(t, p, f, "/")

			claims, _, err, _ := callback(p, cookie, goodQuery(q))

			assert.Nil(t, claims)
			assert.ErrorIs(t, err, tc.expect)
		})
	}
}

func TestCompleteAcceptsTheHostedDomainCaseInsensitively(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	f.HostedDomain = "EXAMPLE.com"
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	_, _, err, _ := callback(p, cookie, goodQuery(q))

	assert.NoError(t, err)
}

func TestCompleteRejectsAnUnverifiedEmail(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	f.EmailVerified = false
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	claims, _, err, _ := callback(p, cookie, goodQuery(q))

	assert.Nil(t, claims)
	assert.ErrorIs(t, err, ErrEmailNotVerified)
}

func TestCompleteRejectsABadState(t *testing.T) {
	t.Run("state does not match the cookie", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		p := newTestProvider(t, f)
		_, cookie := begin(t, p, f, "/")

		_, _, err, _ := callback(p, cookie, url.Values{"code": {fakeidp.GoodCode}, "state": {"another-state"}})

		assert.ErrorIs(t, err, ErrInvalidState)
		assert.Zero(t, f.TokenCalls, "the code must not be exchanged")
	})

	t.Run("no cookie", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		p := newTestProvider(t, f)
		q, _ := begin(t, p, f, "/")

		_, _, err, _ := callback(p, nil, goodQuery(q))

		assert.ErrorIs(t, err, ErrInvalidState)
		assert.Zero(t, f.TokenCalls)
	})

	t.Run("no state in the callback", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		p := newTestProvider(t, f)
		_, cookie := begin(t, p, f, "/")

		_, _, err, _ := callback(p, cookie, url.Values{"code": {fakeidp.GoodCode}})

		assert.ErrorIs(t, err, ErrInvalidState)
	})

	t.Run("no code in the callback", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		p := newTestProvider(t, f)
		q, cookie := begin(t, p, f, "/")

		_, _, err, _ := callback(p, cookie, url.Values{"state": {q.Get("state")}})

		assert.ErrorIs(t, err, ErrInvalidState)
	})

	t.Run("tampered cookie", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		p := newTestProvider(t, f)
		q, cookie := begin(t, p, f, "/")

		// an attacker re-encodes the payload with a redirect of their choice
		payload, sig, _ := splitOnce(cookie.Value)
		raw, err := base64.RawURLEncoding.DecodeString(payload)
		require.NoError(t, err)
		var st loginState
		require.NoError(t, json.Unmarshal(raw, &st))
		st.Redirect = "https://evil.example"
		forged, err := json.Marshal(st)
		require.NoError(t, err)
		bad := &http.Cookie{Name: CookieName, Value: base64.RawURLEncoding.EncodeToString(forged) + "." + sig}

		_, _, err, _ = callback(p, bad, goodQuery(q))

		assert.ErrorIs(t, err, ErrInvalidState)
		assert.Zero(t, f.TokenCalls)
	})

	t.Run("garbage cookie", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		p := newTestProvider(t, f)
		q, _ := begin(t, p, f, "/")

		for _, v := range []string{"", "x", "a.b", "....", "!!!.!!!"} {
			_, _, err, _ := callback(p, &http.Cookie{Name: CookieName, Value: v}, goodQuery(q))
			assert.ErrorIs(t, err, ErrInvalidState, "value %q", v)
		}
	})

	t.Run("cookie signed by another server instance", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		a := newTestProvider(t, f)
		b := newTestProvider(t, f)
		q, cookie := begin(t, a, f, "/")

		_, _, err, _ := callback(b, cookie, goodQuery(q))

		assert.ErrorIs(t, err, ErrInvalidState)
	})

	t.Run("expired cookie", func(t *testing.T) {
		f := fakeidp.New(t, testClientID, testDomain)
		p := newTestProvider(t, f)
		q, cookie := begin(t, p, f, "/")

		p.now = func() time.Time { return time.Now().Add(cookieTTL + time.Minute) }
		_, _, err, _ := callback(p, cookie, goodQuery(q))

		assert.ErrorIs(t, err, ErrInvalidState)
		assert.Zero(t, f.TokenCalls)
	})
}

func TestCompleteRejectsAMismatchedNonce(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	f.Nonce = "a-replayed-token"
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	claims, _, err, _ := callback(p, cookie, goodQuery(q))

	assert.Nil(t, claims)
	assert.ErrorIs(t, err, ErrInvalidState)
}

func TestCompleteRejectsATokenForAnotherClient(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	f.Audience = "someone-elses-client-id"
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	claims, _, err, _ := callback(p, cookie, goodQuery(q))

	assert.Nil(t, claims)
	assert.Error(t, err)
}

func TestCompleteReportsAccessDenied(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	_, _, err, _ := callback(p, cookie, url.Values{"error": {"access_denied"}, "state": {q.Get("state")}})

	assert.ErrorIs(t, err, ErrAccessDenied)
	assert.Zero(t, f.TokenCalls)
}

func TestCompleteFailsWhenTheCodeIsRejected(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	claims, _, err, _ := callback(p, cookie, url.Values{"code": {"bad-code"}, "state": {q.Get("state")}})

	assert.Nil(t, claims)
	assert.Error(t, err)
}

func TestCompleteClearsTheCookieEvenOnFailure(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	p := newTestProvider(t, f)
	q, cookie := begin(t, p, f, "/")

	_, _, err, rec := callback(p, cookie, url.Values{"code": {"bad-code"}, "state": {q.Get("state")}})
	require.Error(t, err)

	var cleared bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName && c.MaxAge < 0 {
			cleared = true
		}
	}
	assert.True(t, cleared)
}

func TestProviderIsReachedLazily(t *testing.T) {
	// New must not need the network: a server that is down only fails the first sign-in.
	p, err := New(Config{
		ClientID:      testClientID,
		ClientSecret:  testSecret,
		AllowedDomain: testDomain,
		RedirectURL:   "https://boards.example.com/oauth/google/callback",
		Issuer:        "http://127.0.0.1:1",
	})
	require.NoError(t, err)

	_, err = p.Begin(context.Background(), httptest.NewRecorder(), "/")
	assert.Error(t, err)
}

func TestNewRequiresAllSettings(t *testing.T) {
	full := Config{ClientID: "id", ClientSecret: "secret", AllowedDomain: "example.com", RedirectURL: "https://x/cb"}

	_, err := New(full)
	require.NoError(t, err)

	for name, mutate := range map[string]func(*Config){
		"client id":      func(c *Config) { c.ClientID = "" },
		"client secret":  func(c *Config) { c.ClientSecret = "" },
		"allowed domain": func(c *Config) { c.AllowedDomain = "" },
		"redirect url":   func(c *Config) { c.RedirectURL = "" },
	} {
		t.Run(name, func(t *testing.T) {
			cfg := full
			mutate(&cfg)
			_, err := New(cfg)
			assert.Error(t, err)
		})
	}
}

func TestNewNormalizesTheDomain(t *testing.T) {
	p, err := New(Config{ClientID: "id", ClientSecret: "s", AllowedDomain: " @Example.COM ", RedirectURL: "https://x/cb"})
	require.NoError(t, err)
	assert.Equal(t, "example.com", p.cfg.AllowedDomain)
}

func TestSafeRedirect(t *testing.T) {
	cases := map[string]string{
		"":                       "/",
		"/":                      "/",
		"/boards/1":              "/boards/1",
		"/boards/1?view=2#card":  "/boards/1?view=2#card",
		"//evil.example":         "/",
		"/\\evil.example":        "/",
		"https://evil.example":   "/",
		"http://evil.example/x":  "/",
		"javascript:alert(1)":    "/",
		"evil.example":           "/",
		"/ok\r\nSet-Cookie: a=b": "/",
		"/ok\tmore":              "/",
	}
	for in, want := range cases {
		assert.Equal(t, want, SafeRedirect(in), "input %q", in)
	}
}

func splitOnce(s string) (string, string, bool) {
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return s[:i], s[i+1:], true
		}
	}
	return s, "", false
}

func TestACallToGoogleThatNeverAnswersTimesOut(t *testing.T) {
	// a provider that accepts the connection and then says nothing
	release := make(chan struct{})
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	defer slow.Close()
	defer close(release)

	p, err := New(Config{
		ClientID:      testClientID,
		ClientSecret:  testSecret,
		AllowedDomain: testDomain,
		RedirectURL:   "https://boards.example.com/oauth/google/callback",
		Issuer:        slow.URL,
	})
	require.NoError(t, err)
	p.httpClient.Timeout = 150 * time.Millisecond

	start := time.Now()
	_, err = p.Begin(context.Background(), httptest.NewRecorder(), "/")

	require.Error(t, err)
	assert.Less(t, time.Since(start), 3*time.Second, "the sign-in must not wait for Google forever")

	// and it does not leave the provider stuck: a second sign-in also fails fast
	start = time.Now()
	_, err = p.Begin(context.Background(), httptest.NewRecorder(), "/")
	require.Error(t, err)
	assert.Less(t, time.Since(start), 3*time.Second)
}

func TestTheProviderRecoversWhenGoogleComesBack(t *testing.T) {
	f := fakeidp.New(t, testClientID, testDomain)
	p := newTestProvider(t, f)

	// first sign-in fails: the provider is unreachable
	good := p.cfg.Issuer
	p.cfg.Issuer = "http://127.0.0.1:1"
	_, err := p.Begin(context.Background(), httptest.NewRecorder(), "/")
	require.Error(t, err)

	// discovery is retried, a failure is not remembered
	p.cfg.Issuer = good
	q, cookie := begin(t, p, f, "/")
	_, _, err, _ = callback(p, cookie, goodQuery(q))
	assert.NoError(t, err)
}
