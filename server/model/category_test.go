package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCategoryIsValidRejectsUnsafeID(t *testing.T) {
	base := Category{Name: "n", UserID: "u", TeamID: "t", Type: CategoryTypeCustom}

	ok := base
	ok.ID = "c7abcdefghijklmnopqrstuvwx"
	require.NoError(t, ok.IsValid())

	for _, id := range []string{"x' OR '1'='1", "a;DROP TABLE users", "with space", strings.Repeat("a", 37)} {
		bad := base
		bad.ID = id
		require.Error(t, bad.IsValid(), id)
	}
}
