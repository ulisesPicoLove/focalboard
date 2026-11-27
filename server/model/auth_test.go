package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidatePassword(t *testing.T) {
	require.Error(t, ValidatePassword(""))
	require.Error(t, ValidatePassword(strings.Repeat("a", MinimumPasswordLength-1)))
	require.NoError(t, ValidatePassword(strings.Repeat("a", MinimumPasswordLength)))
}
