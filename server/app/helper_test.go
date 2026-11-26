// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package app

import (
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"

	"github.com/mattermost/focalboard/server/auth"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/metrics"
	"github.com/mattermost/focalboard/server/services/permissions/mmpermissions"
	mmpermissionsMocks "github.com/mattermost/focalboard/server/services/permissions/mmpermissions/mocks"
	permissionsMocks "github.com/mattermost/focalboard/server/services/permissions/mocks"
	"github.com/mattermost/focalboard/server/services/store/mockstore"
	"github.com/mattermost/focalboard/server/services/webhook"
	"github.com/mattermost/focalboard/server/ws"

	"github.com/mattermost/focalboard/server/services/filestore/mocks"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type TestHelper struct {
	App          *App
	Store        *mockstore.MockStore
	FilesBackend *mocks.FileBackend
	logger       mlog.LoggerIFace
	API          *mmpermissionsMocks.MockAPI
}

func SetupTestHelper(t *testing.T) (*TestHelper, func()) {
	ctrl := gomock.NewController(t)
	cfg := config.Configuration{}
	store := mockstore.NewMockStore(ctrl)
	filesBackend := &mocks.FileBackend{}
	auth := auth.New(&cfg, store, nil)
	logger, _ := mlog.NewLogger()
	sessionToken := "TESTTOKEN"
	wsserver := ws.NewServer(auth, sessionToken, false, logger, store)
	webhook := webhook.NewClient(&cfg, logger)
	metricsService := metrics.NewMetrics(metrics.InstanceInfo{})

	mockStore := permissionsMocks.NewMockStore(ctrl)
	mockAPI := mmpermissionsMocks.NewMockAPI(ctrl)
	permissions := mmpermissions.New(mockStore, mockAPI, mlog.CreateConsoleTestLogger(t))

	appServices := Services{
		Auth:             auth,
		Store:            store,
		FilesBackend:     filesBackend,
		Webhook:          webhook,
		Metrics:          metricsService,
		Logger:           logger,
		SkipTemplateInit: true,
		Permissions:      permissions,
	}
	app2 := New(&cfg, wsserver, appServices)

	tearDown := func() {
		app2.Shutdown()
		if logger != nil {
			_ = logger.Shutdown()
		}
	}

	return &TestHelper{
		App:          app2,
		Store:        store,
		FilesBackend: filesBackend,
		logger:       logger,
		API:          mockAPI,
	}, tearDown
}

// drainNotifier waits until every callback queued so far on the block change notifier has
// finished. The callbacks call the store mocks asynchronously: without waiting, a callback
// from one subtest can consume the expectations of the next one.
func (th *TestHelper) drainNotifier(t *testing.T) {
	t.Helper()

	var started, release sync.WaitGroup
	started.Add(blockChangeNotifierPoolSize)
	release.Add(1)

	// The queue is FIFO and has one worker per slot: when all of them are inside these
	// barrier callbacks, every earlier callback has completed.
	for i := 0; i < blockChangeNotifierPoolSize; i++ {
		th.App.blockChangeNotifier.Enqueue(func() error {
			started.Done()
			release.Wait()
			return nil
		})
	}

	done := make(chan struct{})
	go func() {
		started.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Error("timed out waiting for the block change notifier to drain")
	}
	release.Done()
}
