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

func TestRemoveSecurityDataHidesDatabaseAndStorageSecrets(t *testing.T) {
	cfg := Configuration{
		DBConfigString: "postgres://user:db-password@host/db",
		Secret:         "app-secret",
		FilesS3Config:  AmazonS3Config{AccessKeyID: "AKIA-key", SecretAccessKey: "s3-secret"},
	}

	logged := fmt.Sprintf("%+v", removeSecurityData(cfg))

	for _, secret := range []string{"db-password", "app-secret", "AKIA-key", "s3-secret"} {
		require.NotContains(t, logged, secret)
	}
}

func TestValidateAuthMode(t *testing.T) {
	require.NoError(t, validateAuthMode("native"))
	require.NoError(t, validateAuthMode("google"))
	require.Error(t, validateAuthMode("mattermost"))
	require.Error(t, validateAuthMode(""))
}
