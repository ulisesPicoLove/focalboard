package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"
)

func TestAdminSetPasswordRejectsPasswordsThatAreEmptyOrTooShort(t *testing.T) {
	logger, err := mlog.NewLogger()
	require.NoError(t, err)
	auditSvc, err := audit.NewAudit()
	require.NoError(t, err)

	// The app is left nil: the request must be refused before anything is changed.
	a := &API{logger: logger, audit: auditSvc}

	cases := map[string]string{
		"an empty password":     `{"password": ""}`,
		"no password at all":    `{}`,
		"a too short password":  `{"password": "` + strings.Repeat("a", model.MinimumPasswordLength-1) + `"}`,
		"a null password":       `{"password": null}`,
		"an unrelated property": `{"pass": "long enough password"}`,
	}

	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v2/admin/users/someone/password", strings.NewReader(body))
			req = mux.SetURLVars(req, map[string]string{"username": "someone"})
			rec := httptest.NewRecorder()

			a.handleAdminSetPassword(rec, req)

			require.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}
