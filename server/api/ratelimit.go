package api

import (
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/focalboard/server/model"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// rateLimiter is a small in-memory sliding-window limiter keyed by client address. It is
// meant for the few endpoints that check credentials, to make guessing passwords slow.
// The state lives in this process only, which matches how the server runs (one instance).
type rateLimiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string][]time.Time
	now    func() time.Time
}

func newRateLimiter(max int, window time.Duration) *rateLimiter {
	return &rateLimiter{max: max, window: window, hits: map[string][]time.Time{}, now: time.Now}
}

// allow records an attempt for key and reports whether it is within the limit. When it is
// not, retryAfter says how long until the oldest attempt leaves the window.
func (l *rateLimiter) allow(key string) (ok bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	cutoff := now.Add(-l.window)

	recent := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= l.max {
		l.hits[key] = recent
		return false, recent[0].Add(l.window).Sub(now)
	}

	l.hits[key] = append(recent, now)

	// keep the map from growing with every address ever seen
	if len(l.hits) > 10000 {
		for k, ts := range l.hits {
			if len(ts) == 0 || !ts[len(ts)-1].After(cutoff) {
				delete(l.hits, k)
			}
		}
	}

	return true, 0
}

// clientKey identifies the caller by the address of the TCP connection. Forwarding headers
// are ignored on purpose: a client can set them to dodge the limit.
func clientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// rateLimited wraps a handler so that each client address can call it only a limited
// number of times per window.
func (a *API) rateLimited(l *rateLimiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ok, retryAfter := l.allow(clientKey(r)); !ok {
			secs := int(retryAfter.Seconds()) + 1
			a.logger.Warn("Rate limit exceeded", mlog.String("path", r.URL.Path))
			w.Header().Set("Retry-After", strconv.Itoa(secs))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(model.ErrorResponse{Error: "too many attempts, try again later", ErrorCode: http.StatusTooManyRequests})
			return
		}
		next(w, r)
	}
}
