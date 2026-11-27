package web

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
)

// newNonce returns a random value for the script-src nonce of one response.
func newNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

// contentSecurityPolicy is the policy of the page that loads the web app.
//
//   - Scripts only from this origin, plus the one inline script of the page (it sets
//     window.baseURL) through the nonce. Inline event handlers and eval are not allowed, so
//     injected markup can not run code even if it gets past the HTML sanitizer.
//   - Styles allow 'unsafe-inline' because the libraries of the web app (react-select,
//     FullCalendar) and the app's own style={{...}} write inline styles.
//   - Images may come from any https site (markdown images), data: and blob: (uploads).
//   - The web socket is the one of this host.
//   - The page can not be framed, embed plugins or change its base URL.
func contentSecurityPolicy(nonce, host string) string {
	connect := []string{"'self'"}
	if host != "" && !strings.ContainsAny(host, " ;,'\"") {
		connect = append(connect, "ws://"+host, "wss://"+host)
	}

	directives := []string{
		"default-src 'self'",
		"script-src 'self' 'nonce-" + nonce + "'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"media-src 'self' blob:",
		"font-src 'self' data:",
		"connect-src " + strings.Join(connect, " "),
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	}

	return strings.Join(directives, "; ")
}
