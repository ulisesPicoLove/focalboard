package config

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRemoveSecurityDataHidesTheGoogleSecret(t *testing.T) {
	original := Configuration{
		ServerRoot:          "https://boards.example.com",
		GoogleClientID:      "id.apps.googleusercontent.com",
		GoogleClientSecret:  "super-secret-value",
		GoogleAllowedDomain: "example.com",
	}

	clean := removeSecurityData(original)

	require.Equal(t, redacted, clean.GoogleClientSecret)
	require.NotContains(t, fmt.Sprintf("%+v", clean), "super-secret-value", "this is what gets logged at startup")

	// the rest is kept, so the log is still useful, and the real config is untouched
	require.Equal(t, "id.apps.googleusercontent.com", clean.GoogleClientID)
	require.Equal(t, "example.com", clean.GoogleAllowedDomain)
	require.Equal(t, "https://boards.example.com", clean.ServerRoot)
	require.Equal(t, "super-secret-value", original.GoogleClientSecret)
}

func TestRemoveSecurityDataLeavesAnEmptySecretEmpty(t *testing.T) {
	require.Empty(t, removeSecurityData(Configuration{}).GoogleClientSecret)
}
