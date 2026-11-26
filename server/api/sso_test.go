package api

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/app"
	"github.com/mattermost/focalboard/server/auth"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"
	"github.com/mattermost/focalboard/server/services/auth/googlesso"
	"github.com/mattermost/focalboard/server/services/auth/googlesso/fakeidp"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/metrics"
	"github.com/mattermost/focalboard/server/services/store/mockstore"
	"github.com/mattermost/focalboard/server/services/webhook"
	"github.com/mattermost/focalboard/server/ws"

	"github.com/mattermost/focalboard/server/services/filestore/mocks"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	ssoClientID = "client-id.apps.googleusercontent.com"
	ssoDomain   = "example.com"
	ssoHost     = "http://boards.test"
)

type ssoHarness struct {
	router *mux.Router
	store  *mockstore.MockStore
	idp    *fakeidp.Server
	api    *API
}

// newSSOHarness builds the API with a real app on a mock store, wired to a fake Google.
// authService is the auth mode: "google" enables the sign-in routes, anything else does not.
func newSSOHarness(t *testing.T, authService, basePath string) *ssoHarness {
	t.Helper()

	ctrl := gomock.NewController(t)
	cfg := config.Configuration{AuthMode: authService}
	store := mockstore.NewMockStore(ctrl)
	logger := mlog.CreateConsoleTestLogger(t)
	authSvc := auth.New(&cfg, store, nil)

	application := app.New(&cfg, ws.NewServer(authSvc, "", false, logger, store), app.Services{
		Auth:             authSvc,
		Store:            store,
		FilesBackend:     &mocks.FileBackend{},
		Webhook:          webhook.NewClient(&cfg, logger),
		Metrics:          metrics.NewMetrics(metrics.InstanceInfo{}),
		Logger:           logger,
		SkipTemplateInit: true,
	})
	t.Cleanup(application.Shutdown)

	auditSvc, err := audit.NewAudit()
	require.NoError(t, err)
	t.Cleanup(func() { _ = auditSvc.Shutdown() })

	testAPI := NewAPI(application, "", authService, nil, logger, auditSvc)
	idp := fakeidp.New(t, ssoClientID, ssoDomain)

	if authService == googlesso.AuthService {
		provider, err2 := googlesso.New(googlesso.Config{
			ClientID:      ssoClientID,
			ClientSecret:  "secret",
			AllowedDomain: ssoDomain,
			RedirectURL:   ssoHost + basePath + ssoCallbackPath,
			CookiePath:    basePath + ssoCallbackPath,
			Issuer:        idp.URL,
		})
		require.NoError(t, err2)
		testAPI.SetGoogleSSO(provider, basePath)
	}

	// like web.NewServer, mount everything under the base path prefix when there is one
	router := mux.NewRouter()
	mounted := router
	if basePath != "" {
		mounted = router.PathPrefix(basePath).Subrouter()
	}
	testAPI.RegisterRoutes(mounted)

	return &ssoHarness{router: router, store: store, idp: idp, api: testAPI}
}

func (h *ssoHarness) do(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	return rec
}

// startSignIn calls the login route and returns the state cookie and the authorization query.
func (h *ssoHarness) startSignIn(t *testing.T, basePath, redirect string) (*http.Cookie, url.Values) {
	t.Helper()

	target := basePath + ssoLoginPath
	if redirect != "" {
		target += "?r=" + url.QueryEscape(redirect)
	}
	rec := h.do(httptest.NewRequest(http.MethodGet, target, nil))

	require.Equal(t, http.StatusFound, rec.Code)
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	require.True(t, strings.HasPrefix(rec.Header().Get("Location"), h.idp.URL+"/auth"), "got %q", rec.Header().Get("Location"))

	var cookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == googlesso.CookieName {
			cookie = c
		}
	}
	require.NotNil(t, cookie)

	return cookie, h.idp.Capture(rec.Header().Get("Location"))
}

func (h *ssoHarness) callback(basePath string, cookie *http.Cookie, query url.Values) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, basePath+ssoCallbackPath+"?"+query.Encode(), nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	return h.do(req)
}

func goodCallback(q url.Values) url.Values {
	return url.Values{"code": {fakeidp.GoodCode}, "state": {q.Get("state")}}
}

func TestGoogleSignInEndToEnd(t *testing.T) {
	for _, basePath := range []string{"", "/boards"} {
		t.Run("base path '"+basePath+"'", func(t *testing.T) {
			h := newSSOHarness(t, googlesso.AuthService, basePath)
			cookie, q := h.startSignIn(t, basePath, "/team/board-1?view=2")

			var created *model.User
			var session *model.Session
			h.store.EXPECT().GetUserByEmail("ana@example.com").Return(nil, model.NewErrNotFound("user"))
			h.store.EXPECT().GetUserByUsername("ana").Return(nil, model.NewErrNotFound("user"))
			h.store.EXPECT().CreateUser(gomock.Any()).DoAndReturn(func(u *model.User) (*model.User, error) {
				created = u
				return u, nil
			})
			h.store.EXPECT().CreateSession(gomock.Any()).DoAndReturn(func(s *model.Session) error {
				session = s
				return nil
			})

			rec := h.callback(basePath, cookie, goodCallback(q))

			require.Equal(t, http.StatusFound, rec.Code)
			assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
			assert.Equal(t, "no-referrer", rec.Header().Get("Referrer-Policy"))

			// the token travels in the URL fragment, which is never sent to any server
			loc, err := url.Parse(rec.Header().Get("Location"))
			require.NoError(t, err)
			assert.Equal(t, basePath+"/sso", loc.Path)
			assert.Empty(t, loc.RawQuery, "no token in the query string")
			frag, err := url.ParseQuery(loc.Fragment)
			require.NoError(t, err)
			require.NotNil(t, session)
			assert.Equal(t, session.Token, frag.Get("token"))
			assert.Equal(t, "/team/board-1?view=2", frag.Get("r"))

			require.NotNil(t, created)
			assert.Equal(t, "google", created.AuthService)
			assert.Equal(t, "1234567890", created.AuthData)
			assert.Equal(t, "google", session.AuthService)
		})
	}
}

func TestGoogleSignInNeverRedirectsOffsite(t *testing.T) {
	for _, evil := range []string{"//evil.example", "https://evil.example", "/\\evil.example"} {
		t.Run(evil, func(t *testing.T) {
			h := newSSOHarness(t, googlesso.AuthService, "")
			cookie, q := h.startSignIn(t, "", evil)

			h.store.EXPECT().GetUserByEmail(gomock.Any()).Return(&model.User{ID: "u1"}, nil)
			h.store.EXPECT().CreateSession(gomock.Any()).Return(nil)

			rec := h.callback("", cookie, goodCallback(q))

			loc, err := url.Parse(rec.Header().Get("Location"))
			require.NoError(t, err)
			assert.Empty(t, loc.Host, "must stay on this site")
			frag, err := url.ParseQuery(loc.Fragment)
			require.NoError(t, err)
			assert.Equal(t, "/", frag.Get("r"))
		})
	}
}

func TestGoogleSignInRejections(t *testing.T) {
	cases := map[string]struct {
		prepare func(h *ssoHarness)
		query   func(q url.Values) url.Values
		cookie  bool
		code    string
	}{
		"account outside the domain": {
			prepare: func(h *ssoHarness) { h.idp.Email, h.idp.HostedDomain = "ana@other.com", "other.com" },
			query:   goodCallback, cookie: true, code: "domain",
		},
		"personal account with a matching address": {
			prepare: func(h *ssoHarness) { h.idp.HostedDomain = "" },
			query:   goodCallback, cookie: true, code: "domain",
		},
		"email not verified": {
			prepare: func(h *ssoHarness) { h.idp.EmailVerified = false },
			query:   goodCallback, cookie: true, code: "unverified",
		},
		"user denied access": {
			query: func(q url.Values) url.Values {
				return url.Values{"error": {"access_denied"}, "state": {q.Get("state")}}
			},
			cookie: true, code: "denied",
		},
		"no state cookie": {query: goodCallback, cookie: false, code: "expired"},
		"state does not match": {
			query: func(url.Values) url.Values {
				return url.Values{"code": {fakeidp.GoodCode}, "state": {"forged"}}
			},
			cookie: true, code: "expired",
		},
		"provider rejects the code": {
			query: func(q url.Values) url.Values {
				return url.Values{"code": {"bad"}, "state": {q.Get("state")}}
			},
			cookie: true, code: "failed",
		},
	}

	for _, basePath := range []string{"", "/boards"} {
		for name, tc := range cases {
			t.Run(name+" base '"+basePath+"'", func(t *testing.T) {
				h := newSSOHarness(t, googlesso.AuthService, basePath)
				cookie, q := h.startSignIn(t, basePath, "")
				if tc.prepare != nil {
					tc.prepare(h)
				}
				if !tc.cookie {
					cookie = nil
				}

				// no store calls are expected: nobody is created or signed in
				rec := h.callback(basePath, cookie, tc.query(q))

				require.Equal(t, http.StatusFound, rec.Code)
				assert.Equal(t, basePath+"/login?error=sso_"+tc.code, rec.Header().Get("Location"))
				assert.NotContains(t, rec.Header().Get("Location"), "token")
			})
		}
	}
}

func TestGoogleSignInStateCookieIsSingleUse(t *testing.T) {
	h := newSSOHarness(t, googlesso.AuthService, "")
	cookie, q := h.startSignIn(t, "", "")

	h.store.EXPECT().GetUserByEmail(gomock.Any()).Return(&model.User{ID: "u1"}, nil)
	h.store.EXPECT().CreateSession(gomock.Any()).Return(nil)
	rec := h.callback("", cookie, goodCallback(q))
	require.Equal(t, http.StatusFound, rec.Code)

	var cleared bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == googlesso.CookieName && c.MaxAge < 0 {
			cleared = true
		}
	}
	assert.True(t, cleared, "the callback must clear the state cookie")
}

func TestPasswordRoutesAreDisabledInGoogleMode(t *testing.T) {
	h := newSSOHarness(t, googlesso.AuthService, "")

	for _, path := range []string{"/api/v2/login", "/api/v2/register"} {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"username":"ana","password":"secret123","type":"normal"}`))
		req.Header.Set(HeaderRequestedWith, HeaderRequestedWithXML)

		rec := h.do(req)

		assert.Equal(t, http.StatusNotImplemented, rec.Code, path)
		assert.Contains(t, rec.Body.String(), "disabled", path)
	}
}

func TestSessionsFromAnotherAuthModeAreRejectedInGoogleMode(t *testing.T) {
	h := newSSOHarness(t, googlesso.AuthService, "")

	// a session created while the server used passwords
	h.store.EXPECT().GetSession("old-token", gomock.Any()).Return(&model.Session{
		ID: "s1", Token: "old-token", UserID: "u1", AuthService: "native",
	}, nil)
	h.store.EXPECT().RefreshSession(gomock.Any()).Return(nil).AnyTimes()

	req := httptest.NewRequest(http.MethodGet, "/api/v2/users/me", nil)
	req.Header.Set(HeaderRequestedWith, HeaderRequestedWithXML)
	req.Header.Set("Authorization", "Bearer old-token")

	rec := h.do(req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestSSORoutesDoNotExistWhenDisabled(t *testing.T) {
	h := newSSOHarness(t, "native", "")

	for _, path := range []string{ssoLoginPath, ssoCallbackPath} {
		rec := h.do(httptest.NewRequest(http.MethodGet, path, nil))
		assert.Equal(t, http.StatusNotFound, rec.Code, path)
	}
}

func TestSSOErrorCode(t *testing.T) {
	assert.Equal(t, "denied", ssoErrorCode(googlesso.ErrAccessDenied))
	assert.Equal(t, "domain", ssoErrorCode(googlesso.ErrDomainNotAllowed))
	assert.Equal(t, "unverified", ssoErrorCode(googlesso.ErrEmailNotVerified))
	assert.Equal(t, "expired", ssoErrorCode(googlesso.ErrInvalidState))
	assert.Equal(t, "failed", ssoErrorCode(assert.AnError), "unknown errors must not leak details")
}
