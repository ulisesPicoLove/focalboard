// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package app

import (
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"

	"github.com/mattermost/focalboard/server/auth"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/metrics"
	"github.com/mattermost/focalboard/server/services/permissions/localpermissions"
	permissionsMocks "github.com/mattermost/focalboard/server/services/permissions/mocks"
	"github.com/mattermost/focalboard/server/services/store/mockstore"
	"github.com/mattermost/focalboard/server/services/webhook"
	"github.com/mattermost/focalboard/server/ws"

	"github.com/mattermost/focalboard/server/services/filestore/mocks"
	mmModel "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// fakePermissions behaves like the standalone permissions service, except for the results a
// test sets explicitly. Standalone mode never grants team or system admin rights, so tests
// that cover the code paths for those rights need a way to turn them on.
type fakePermissions struct {
	*localpermissions.Service

	mu      sync.Mutex
	results map[string]bool
}

func newFakePermissions(base *localpermissions.Service) *fakePermissions {
	return &fakePermissions{Service: base, results: map[string]bool{}}
}

func permKey(kind string, parts ...string) string {
	return kind + "|" + strings.Join(parts, "|")
}

func (f *fakePermissions) set(key string, value bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.results[key] = value
}

func (f *fakePermissions) get(key string) (value, ok bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	value, ok = f.results[key]
	return value, ok
}

func (f *fakePermissions) SetTeam(userID, teamID string, p *mmModel.Permission, v bool) {
	f.set(permKey("team", userID, teamID, p.Id), v)
}

func (f *fakePermissions) SetSystem(userID string, p *mmModel.Permission, v bool) {
	f.set(permKey("system", userID, p.Id), v)
}

func (f *fakePermissions) SetChannel(userID, channelID string, p *mmModel.Permission, v bool) {
	f.set(permKey("channel", userID, channelID, p.Id), v)
}

func (f *fakePermissions) HasPermissionToTeam(userID, teamID string, p *mmModel.Permission) bool {
	if v, ok := f.get(permKey("team", userID, teamID, p.Id)); ok {
		return v
	}
	return f.Service.HasPermissionToTeam(userID, teamID, p)
}

func (f *fakePermissions) HasPermissionTo(userID string, p *mmModel.Permission) bool {
	if v, ok := f.get(permKey("system", userID, p.Id)); ok {
		return v
	}
	return f.Service.HasPermissionTo(userID, p)
}

func (f *fakePermissions) HasPermissionToChannel(userID, channelID string, p *mmModel.Permission) bool {
	if v, ok := f.get(permKey("channel", userID, channelID, p.Id)); ok {
		return v
	}
	return f.Service.HasPermissionToChannel(userID, channelID, p)
}

type TestHelper struct {
	App          *App
	Store        *mockstore.MockStore
	FilesBackend *mocks.FileBackend
	logger       mlog.LoggerIFace
	Perms        *fakePermissions
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
	permissions := newFakePermissions(localpermissions.New(mockStore, mlog.CreateConsoleTestLogger(t)))

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
		Perms:        permissions,
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
