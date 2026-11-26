package app

import (
	"strings"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/auth"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func ssoIdentity() SSOIdentity {
	return SSOIdentity{Provider: "google", Subject: "sub-1", Email: "ana.perez@example.com"}
}

func TestLoginWithSSOCreatesTheUserOnFirstSignIn(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	var created *model.User
	var session *model.Session

	th.Store.EXPECT().GetUserByEmail("ana.perez@example.com").Return(nil, model.NewErrNotFound("user"))
	th.Store.EXPECT().GetUserByUsername("ana.perez").Return(nil, model.NewErrNotFound("user"))
	th.Store.EXPECT().CreateUser(gomock.Any()).DoAndReturn(func(u *model.User) (*model.User, error) {
		created = u
		return u, nil
	})
	th.Store.EXPECT().CreateSession(gomock.Any()).DoAndReturn(func(s *model.Session) error {
		session = s
		return nil
	})

	token, err := th.App.LoginWithSSO(SSOIdentity{Provider: "google", Subject: "sub-1", Email: "  Ana.Perez@Example.COM "})

	require.NoError(t, err)
	require.NotEmpty(t, token)

	require.NotNil(t, created)
	require.Equal(t, "ana.perez", created.Username)
	require.Equal(t, "ana.perez@example.com", created.Email)
	require.Equal(t, "google", created.AuthService)
	require.Equal(t, "sub-1", created.AuthData)
	require.NotEmpty(t, created.ID)
	require.NotEmpty(t, created.Password, "the password column must not be empty")
	require.False(t, auth.ComparePassword(created.Password, ""), "no empty password may unlock the account")

	require.NotNil(t, session)
	require.Equal(t, created.ID, session.UserID)
	require.Equal(t, "google", session.AuthService, "the API rejects sessions whose auth service differs from the mode")
	require.Equal(t, token, session.Token)
}

func TestLoginWithSSOUsesTheExistingUserByEmail(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	existing := &model.User{ID: "user-1", Username: "ana", Email: "ana.perez@example.com", AuthService: "native"}
	var session *model.Session

	th.Store.EXPECT().GetUserByEmail("ana.perez@example.com").Return(existing, nil)
	// a pre-existing (password) account is bound to the Google subject on first sign-in
	th.Store.EXPECT().UpdateUserAuth("user-1", "google", "sub-1").Return(nil)
	// no CreateUser: the existing account is reused
	th.Store.EXPECT().CreateSession(gomock.Any()).DoAndReturn(func(s *model.Session) error {
		session = s
		return nil
	})

	token, err := th.App.LoginWithSSO(ssoIdentity())

	require.NoError(t, err)
	require.NotEmpty(t, token)
	require.Equal(t, "user-1", session.UserID)
	require.Equal(t, "google", session.AuthService)
}

func TestLoginWithSSOKeepsASubjectBoundToItsAccount(t *testing.T) {
	t.Run("same subject signs in", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		existing := &model.User{ID: "user-1", Email: "ana.perez@example.com", AuthService: "google", AuthData: "sub-1"}
		th.Store.EXPECT().GetUserByEmail("ana.perez@example.com").Return(existing, nil)
		th.Store.EXPECT().CreateSession(gomock.Any()).Return(nil)

		token, err := th.App.LoginWithSSO(ssoIdentity())

		require.NoError(t, err)
		require.NotEmpty(t, token)
	})

	t.Run("a different Google account with the same email is refused", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		// the address was reassigned to another person: it must not open the old account
		existing := &model.User{ID: "user-1", Email: "ana.perez@example.com", AuthService: "google", AuthData: "sub-OLD-OWNER"}
		th.Store.EXPECT().GetUserByEmail("ana.perez@example.com").Return(existing, nil)
		// no CreateSession

		token, err := th.App.LoginWithSSO(ssoIdentity())

		require.Error(t, err)
		require.Empty(t, token)
	})
}

func TestLoginWithSSORejectsAnIncompleteIdentity(t *testing.T) {
	for name, identity := range map[string]SSOIdentity{
		"no provider": {Subject: "s", Email: "a@example.com"},
		"no subject":  {Provider: "google", Email: "a@example.com"},
		"no email":    {Provider: "google", Subject: "s"},
		"blank email": {Provider: "google", Subject: "s", Email: "   "},
	} {
		t.Run(name, func(t *testing.T) {
			th, tearDown := SetupTestHelper(t)
			defer tearDown()

			token, err := th.App.LoginWithSSO(identity)

			require.Error(t, err)
			require.Empty(t, token)
		})
	}
}

func TestLoginWithSSOFailsWhenTheStoreFails(t *testing.T) {
	t.Run("user lookup", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.Store.EXPECT().GetUserByEmail(gomock.Any()).Return(nil, errors.New("db down"))
		// a failed lookup must not fall through to creating a user

		_, err := th.App.LoginWithSSO(ssoIdentity())
		require.Error(t, err)
	})

	t.Run("user creation", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.Store.EXPECT().GetUserByEmail(gomock.Any()).Return(nil, model.NewErrNotFound("user"))
		th.Store.EXPECT().GetUserByUsername(gomock.Any()).Return(nil, model.NewErrNotFound("user"))
		th.Store.EXPECT().CreateUser(gomock.Any()).Return(nil, errors.New("unique violation"))

		token, err := th.App.LoginWithSSO(ssoIdentity())
		require.Error(t, err)
		require.Empty(t, token)
	})

	t.Run("session creation", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.Store.EXPECT().GetUserByEmail(gomock.Any()).Return(&model.User{ID: "u"}, nil)
		th.Store.EXPECT().UpdateUserAuth("u", "google", gomock.Any()).Return(nil)
		th.Store.EXPECT().CreateSession(gomock.Any()).Return(errors.New("db down"))

		token, err := th.App.LoginWithSSO(ssoIdentity())
		require.Error(t, err)
		require.Empty(t, token)
	})
}

func TestLoginWithSSOPicksAFreeUsername(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	var created *model.User

	th.Store.EXPECT().GetUserByEmail(gomock.Any()).Return(nil, model.NewErrNotFound("user"))
	gomock.InOrder(
		th.Store.EXPECT().GetUserByUsername("ana.perez").Return(&model.User{ID: "other"}, nil),
		th.Store.EXPECT().GetUserByUsername(gomock.Any()).Return(nil, model.NewErrNotFound("user")),
	)
	th.Store.EXPECT().CreateUser(gomock.Any()).DoAndReturn(func(u *model.User) (*model.User, error) {
		created = u
		return u, nil
	})
	th.Store.EXPECT().CreateSession(gomock.Any()).Return(nil)

	_, err := th.App.LoginWithSSO(ssoIdentity())

	require.NoError(t, err)
	require.NotEqual(t, "ana.perez", created.Username)
	require.True(t, strings.HasPrefix(created.Username, "ana.perez-"), "got %q", created.Username)
}

func TestLoginWithSSOGivesUpWhenUsernamesAreTaken(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	th.Store.EXPECT().GetUserByEmail(gomock.Any()).Return(nil, model.NewErrNotFound("user"))
	th.Store.EXPECT().GetUserByUsername(gomock.Any()).Return(&model.User{ID: "other"}, nil).Times(usernameRetryCount)
	// no CreateUser, no CreateSession

	token, err := th.App.LoginWithSSO(ssoIdentity())

	require.Error(t, err)
	require.Empty(t, token)
}

func TestUsernameFromEmail(t *testing.T) {
	cases := map[string]string{
		"ana@example.com":                         "ana",
		"ana.perez@example.com":                   "ana.perez",
		"Ana_Perez@example.com":                   "ana_perez",
		"ana+boards@example.com":                  "ana_boards",
		"ana perez@example.com":                   "ana_perez",
		"josé@example.com":                        "jos",
		"...@example.com":                         "user",
		"@example.com":                            "user",
		"-ana-@example.com":                       "ana",
		strings.Repeat("a", 100) + "@example.com": strings.Repeat("a", maxUsernameLength),
	}
	for email, want := range cases {
		require.Equal(t, want, usernameFromEmail(email), "email %q", email)
	}
}

func TestLoginWithSSOFailsIfTheUserCannotBeLinked(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	existing := &model.User{ID: "user-1", Email: "ana.perez@example.com", AuthService: "native"}
	th.Store.EXPECT().GetUserByEmail("ana.perez@example.com").Return(existing, nil)
	th.Store.EXPECT().UpdateUserAuth("user-1", "google", "sub-1").Return(errors.New("db down"))
	// no CreateSession

	token, err := th.App.LoginWithSSO(ssoIdentity())

	require.Error(t, err)
	require.Empty(t, token)
}
