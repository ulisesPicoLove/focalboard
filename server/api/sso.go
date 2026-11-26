package api

import (
	"errors"
	"net/http"
	"net/url"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/app"
	"github.com/mattermost/focalboard/server/services/audit"
	"github.com/mattermost/focalboard/server/services/auth/googlesso"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	ssoLoginPath    = "/oauth/google/login"
	ssoCallbackPath = "/oauth/google/callback"
)

// registerSSORoutes adds the Google sign-in routes when it is enabled. They live on the
// root router, outside /api/v2, because they are plain browser navigations.
func (a *API) registerSSORoutes(r *mux.Router) {
	if a.googleSSO == nil {
		return
	}

	r.HandleFunc(ssoLoginPath, a.handleGoogleLogin).Methods("GET")
	r.HandleFunc(ssoCallbackPath, a.handleGoogleCallback).Methods("GET")
}

// handleGoogleLogin sends the browser to Google. The optional "r" query parameter is a
// local path to open after signing in.
func (a *API) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if len(a.singleUserToken) > 0 {
		a.redirectToLoginError(w, r, "unavailable")
		return
	}

	authURL, err := a.googleSSO.Begin(r.Context(), w, r.URL.Query().Get("r"))
	if err != nil {
		a.logger.Error("Unable to start the Google sign-in", mlog.Err(err))
		a.redirectToLoginError(w, r, "unavailable")
		return
	}

	setNoStore(w)
	http.Redirect(w, r, authURL, http.StatusFound)
}

// handleGoogleCallback finishes the sign-in. On success the browser is sent to the web app's
// /sso page with the session token in the URL fragment, which is never sent to a server.
func (a *API) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	auditRec := a.makeAuditRecord(r, "ssoLogin", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)

	claims, redirect, err := a.googleSSO.Complete(r.Context(), w, r)
	if err != nil {
		code := ssoErrorCode(err)
		// Only the sentinel errors are expected; anything else carries provider details.
		if code == "failed" {
			a.logger.Error("Google sign-in failed", mlog.Err(err))
		} else {
			a.logger.Warn("Google sign-in rejected", mlog.String("reason", code))
		}
		auditRec.AddMeta("reason", code)
		a.redirectToLoginError(w, r, code)
		return
	}

	auditRec.AddMeta("email", claims.Email)

	token, err := a.app.LoginWithSSO(app.SSOIdentity{
		Provider: googlesso.AuthService,
		Subject:  claims.Subject,
		Email:    claims.Email,
	})
	if err != nil {
		a.logger.Error("Unable to sign in the Google user", mlog.Err(err))
		auditRec.AddMeta("reason", "login")
		a.redirectToLoginError(w, r, "failed")
		return
	}

	setNoStore(w)
	target := a.ssoBasePath + "/sso#token=" + url.QueryEscape(token) + "&r=" + url.QueryEscape(redirect)
	http.Redirect(w, r, target, http.StatusFound)
	auditRec.Success()
}

func (a *API) redirectToLoginError(w http.ResponseWriter, r *http.Request, code string) {
	setNoStore(w)
	http.Redirect(w, r, a.ssoBasePath+"/login?error=sso_"+url.QueryEscape(code), http.StatusFound)
}

// ssoErrorCode maps an error to a short code the login page can show. Details stay in the logs.
func ssoErrorCode(err error) string {
	switch {
	case errors.Is(err, googlesso.ErrAccessDenied):
		return "denied"
	case errors.Is(err, googlesso.ErrDomainNotAllowed):
		return "domain"
	case errors.Is(err, googlesso.ErrEmailNotVerified):
		return "unverified"
	case errors.Is(err, googlesso.ErrInvalidState):
		return "expired"
	default:
		return "failed"
	}
}

// setNoStore keeps these redirects (which may carry a token) out of caches and referrers.
func setNoStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
}
