package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/require"
)

func TestRateLimiterAllowsUpToTheLimitThenRecovers(t *testing.T) {
	now := time.Unix(1000, 0)
	l := newRateLimiter(3, time.Minute)
	l.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		ok, _ := l.allow("1.2.3.4")
		require.True(t, ok)
	}
	ok, retry := l.allow("1.2.3.4")
	require.False(t, ok)
	require.Greater(t, retry, time.Duration(0))

	// another address is not affected
	ok, _ = l.allow("5.6.7.8")
	require.True(t, ok)

	// once the window has passed the address can try again
	now = now.Add(61 * time.Second)
	ok, _ = l.allow("1.2.3.4")
	require.True(t, ok)
}

func TestRateLimitedHandlerAnswers429(t *testing.T) {
	logger, err := mlog.NewLogger()
	require.NoError(t, err)
	a := &API{logger: logger}
	calls := 0
	h := a.rateLimited(newRateLimiter(2, time.Minute), func(w http.ResponseWriter, r *http.Request) { calls++ })

	for i := 0; i < 4; i++ {
		req := httptest.NewRequest(http.MethodPost, "/login", nil)
		req.RemoteAddr = "9.9.9.9:5555"
		h(httptest.NewRecorder(), req)
	}
	require.Equal(t, 2, calls)

	req := httptest.NewRequest(http.MethodPost, "/login", nil)
	req.RemoteAddr = "9.9.9.9:6666" // same host, different source port
	rec := httptest.NewRecorder()
	h(rec, req)
	require.Equal(t, http.StatusTooManyRequests, rec.Code)
	require.NotEmpty(t, rec.Header().Get("Retry-After"))
}
