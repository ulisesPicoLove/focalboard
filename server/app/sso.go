package app

import (
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/auth"
	"github.com/mattermost/focalboard/server/utils"

	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/pkg/errors"
)

// SSOIdentity is a verified identity returned by a single sign-on provider.
type SSOIdentity struct {
	// Provider is the auth service name, also stored as the session's auth service.
	Provider string
	// Subject is the provider's stable, unique id for the account.
	Subject string
	// Email is the verified, lower-cased email address.
	Email string
}

const (
	maxUsernameLength  = 64
	usernameRetryCount = 5
)

var invalidUsernameChars = regexp.MustCompile(`[^a-z0-9._-]+`)

// LoginWithSSO signs in a user that was authenticated by a single sign-on provider and
// returns a new session token. The user is matched by email and created on first sign-in.
func (a *App) LoginWithSSO(identity SSOIdentity) (string, error) {
	email := strings.ToLower(strings.TrimSpace(identity.Email))
	if identity.Provider == "" || identity.Subject == "" || email == "" {
		a.metrics.IncrementLoginFailCount(1)
		return "", errors.New("incomplete single sign-on identity")
	}

	// Look up and create under one lock, so two simultaneous first sign-ins of the same
	// person cannot both find "no user" and create it twice (the users table has no unique
	// index on email). The server runs as a single instance.
	a.ssoLoginMu.Lock()
	defer a.ssoLoginMu.Unlock()

	user, err := a.store.GetUserByEmail(email)
	switch {
	case err == nil:
		// An account bound to this provider is tied to its subject: if the email now
		// belongs to a different provider account (a recycled address), do not hand over
		// the old user.
		if user.AuthService == identity.Provider && user.AuthData != "" && user.AuthData != identity.Subject {
			a.metrics.IncrementLoginFailCount(1)
			a.logger.Warn("SSO subject does not match the stored user", mlog.String("userID", user.ID))
			return "", errors.New("this email is linked to a different account")
		}

		// First sign-in of a user that existed before (for example a password account):
		// bind it to the provider's subject so the same check protects it from now on.
		if user.AuthService != identity.Provider || user.AuthData == "" {
			if err = a.store.UpdateUserAuth(user.ID, identity.Provider, identity.Subject); err != nil {
				a.metrics.IncrementLoginFailCount(1)
				return "", errors.Wrap(err, "unable to link the user to the provider account")
			}
			a.logger.Info("User linked to single sign-on", mlog.String("userID", user.ID), mlog.String("provider", identity.Provider))
		}
	case model.IsErrNotFound(err):
		user, err = a.createSSOUser(identity, email)
		if err != nil {
			a.metrics.IncrementLoginFailCount(1)
			return "", err
		}
	default:
		a.metrics.IncrementLoginFailCount(1)
		return "", errors.Wrap(err, "unable to look up the user")
	}

	session := model.Session{
		ID:          utils.NewID(utils.IDTypeSession),
		Token:       utils.NewID(utils.IDTypeToken),
		UserID:      user.ID,
		AuthService: identity.Provider,
		Props:       map[string]interface{}{},
	}
	if err = a.store.CreateSession(&session); err != nil {
		return "", errors.Wrap(err, "unable to create session")
	}

	a.metrics.IncrementLoginCount(1)

	return session.Token, nil
}

func (a *App) createSSOUser(identity SSOIdentity, email string) (*model.User, error) {
	// The account never signs in with a password, but the column is not empty: store the
	// hash of a random value nobody knows.
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, errors.Wrap(err, "unable to generate a placeholder password")
	}
	passwordHash := auth.HashPassword(hex.EncodeToString(secret))

	base := usernameFromEmail(email)
	username := base

	for attempt := 0; attempt < usernameRetryCount; attempt++ {
		if attempt > 0 {
			suffix := make([]byte, 2)
			if _, err := rand.Read(suffix); err != nil {
				return nil, errors.Wrap(err, "unable to generate a username suffix")
			}
			username = base + "-" + hex.EncodeToString(suffix)
		}

		taken, err := a.store.GetUserByUsername(username)
		if err != nil && !model.IsErrNotFound(err) {
			return nil, errors.Wrap(err, "unable to check the username")
		}
		if taken != nil {
			continue
		}

		user, err := a.store.CreateUser(&model.User{
			ID:          utils.NewID(utils.IDTypeUser),
			Username:    username,
			Email:       email,
			Password:    passwordHash,
			MfaSecret:   "",
			AuthService: identity.Provider,
			AuthData:    identity.Subject,
		})
		if err != nil {
			return nil, errors.Wrap(err, "unable to create the user")
		}

		a.logger.Info("User created through single sign-on", mlog.String("userID", user.ID), mlog.String("provider", identity.Provider))
		return user, nil
	}

	return nil, errors.New("unable to find a free username")
}

// usernameFromEmail derives a username from the local part of an email address.
func usernameFromEmail(email string) string {
	local, _, _ := strings.Cut(email, "@")
	name := strings.Trim(invalidUsernameChars.ReplaceAllString(strings.ToLower(local), "_"), "._-")
	if name == "" {
		name = "user"
	}
	if len(name) > maxUsernameLength {
		name = name[:maxUsernameLength]
	}
	return name
}
