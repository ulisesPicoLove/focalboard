package app

import (
	"github.com/mattermost/focalboard/server/model"
)

func (a *App) GetClientConfig() *model.ClientConfig {
	return &model.ClientConfig{
		EnablePublicSharedBoards: a.config.EnablePublicSharedBoards,
		TeammateNameDisplay:      a.config.TeammateNameDisplay,
		FeatureFlags:             a.config.FeatureFlags,
		MaxFileSize:              a.config.MaxFileSize,
		AuthMode:                 a.config.AuthMode,
	}
}
