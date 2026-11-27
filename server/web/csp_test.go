package web

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestContentSecurityPolicy(t *testing.T) {
	t.Run("only this origin and the nonce may run scripts", func(t *testing.T) {
		policy := contentSecurityPolicy("abc123", "boards.example.com")

		require.Contains(t, policy, "script-src 'self' 'nonce-abc123'")
		require.NotContains(t, policy, "unsafe-eval")
		require.NotContains(t, policy, "script-src 'self' 'nonce-abc123' 'unsafe-inline'")
		require.Contains(t, policy, "object-src 'none'")
		require.Contains(t, policy, "frame-ancestors 'none'")
		require.Contains(t, policy, "base-uri 'self'")
	})

	t.Run("the web socket is the one of the host", func(t *testing.T) {
		policy := contentSecurityPolicy("n", "boards.example.com:8000")

		require.Contains(t, policy, "connect-src 'self' ws://boards.example.com:8000 wss://boards.example.com:8000")
	})

	t.Run("a host that could add directives is ignored", func(t *testing.T) {
		policy := contentSecurityPolicy("n", "evil.example; script-src *")

		require.Contains(t, policy, "connect-src 'self';")
		require.NotContains(t, policy, "evil.example")
	})

	t.Run("each nonce is different", func(t *testing.T) {
		a, err := newNonce()
		require.NoError(t, err)
		b, err := newNonce()
		require.NoError(t, err)

		require.NotEqual(t, a, b)
		require.GreaterOrEqual(t, len(a), 22)
	})
}

func TestIndexPageHasTheNonceOfItsPolicy(t *testing.T) {
	root := t.TempDir()
	page := `<html><head><script nonce="{{.Nonce}}">window.baseURL = '{{.BaseURL}}'</script></head></html>`
	require.NoError(t, os.WriteFile(filepath.Join(root, "index.html"), []byte(page), 0o600))

	ws := NewServer(root, "http://boards.example.com", 0, false, false, mlog.CreateConsoleTestLogger(t))
	ws.registerRoutes()

	request := httptest.NewRequest(http.MethodGet, "/team/0/some-board", nil)
	request.Host = "boards.example.com"
	response := httptest.NewRecorder()
	ws.Router().ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	policy := response.Header().Get("Content-Security-Policy")
	require.NotEmpty(t, policy)

	nonce := regexp.MustCompile(`nonce="([^"]+)"`).FindStringSubmatch(response.Body.String())
	require.Len(t, nonce, 2)
	require.Contains(t, policy, "'nonce-"+nonce[1]+"'")
	require.Equal(t, "nosniff", response.Header().Get("X-Content-Type-Options"))
}
