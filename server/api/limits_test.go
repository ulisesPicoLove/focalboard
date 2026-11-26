package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLimitRequestBody(t *testing.T) {
	a := &API{}
	var readErr error
	h := a.limitRequestBody(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
	}))

	big := strings.Repeat("a", maxRequestBodySize+1)

	t.Run("regular endpoints are capped", func(t *testing.T) {
		readErr = nil
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/v2/boards/b/blocks", strings.NewReader(big)))
		require.Error(t, readErr)
	})

	t.Run("small bodies pass", func(t *testing.T) {
		readErr = nil
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/v2/boards/b/blocks", strings.NewReader("{}")))
		require.NoError(t, readErr)
	})

	t.Run("uploads and imports apply their own limits", func(t *testing.T) {
		for _, path := range []string{"/api/v2/boards/b/files", "/api/v2/teams/t/archive/import"} {
			readErr = nil
			h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, path, strings.NewReader(big)))
			require.NoError(t, readErr, path)
		}
	})
}
