package server

import (
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/focalboard/server/api"
	"github.com/mattermost/focalboard/server/app"
	"github.com/mattermost/focalboard/server/auth"
	appModel "github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"
	"github.com/mattermost/focalboard/server/services/auth/googlesso"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/metrics"
	"github.com/mattermost/focalboard/server/services/notify"
	"github.com/mattermost/focalboard/server/services/notify/notifylogger"
	"github.com/mattermost/focalboard/server/services/scheduler"
	"github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/services/store/sqlstore"
	"github.com/mattermost/focalboard/server/services/webhook"
	"github.com/mattermost/focalboard/server/utils"
	"github.com/mattermost/focalboard/server/web"
	"github.com/mattermost/focalboard/server/ws"

	"github.com/mattermost/focalboard/server/services/filestore"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	cleanupSessionTaskFrequency = 10 * time.Minute
	updateMetricsTaskFrequency  = 15 * time.Minute

	minSessionExpiryTime = int64(60 * 60 * 24 * 31) // 31 days

	MattermostAuthMod = "mattermost"
)

type Server struct {
	config                 *config.Configuration
	wsAdapter              ws.Adapter
	webServer              *web.Server
	store                  store.Store
	filesBackend           filestore.FileBackend
	logger                 mlog.LoggerIFace
	cleanUpSessionsTask    *scheduler.ScheduledTask
	metricsServer          *metrics.Service
	metricsService         *metrics.Metrics
	metricsUpdaterTask     *scheduler.ScheduledTask
	auditService           *audit.Audit
	notificationService    *notify.Service
	servicesStartStopMutex sync.Mutex

	localRouter     *mux.Router
	localModeServer *http.Server
	api             *api.API
	app             *app.App
}

func New(params Params) (*Server, error) {
	if err := params.CheckValid(); err != nil {
		return nil, err
	}

	authenticator := auth.New(params.Cfg, params.DBStore, params.PermissionsService)

	// if no ws adapter is provided, we spin up a websocket server
	wsAdapter := params.WSAdapter
	if wsAdapter == nil {
		wsAdapter = ws.NewServer(authenticator, params.SingleUserToken, params.Cfg.AuthMode == MattermostAuthMod, params.Logger, params.DBStore)
	}

	filesBackendSettings := filestore.Settings{}
	filesBackendSettings.DriverName = params.Cfg.FilesDriver
	filesBackendSettings.Directory = params.Cfg.FilesPath
	filesBackendSettings.AmazonS3AccessKeyID = params.Cfg.FilesS3Config.AccessKeyID
	filesBackendSettings.AmazonS3SecretAccessKey = params.Cfg.FilesS3Config.SecretAccessKey
	filesBackendSettings.AmazonS3Bucket = params.Cfg.FilesS3Config.Bucket
	filesBackendSettings.AmazonS3PathPrefix = params.Cfg.FilesS3Config.PathPrefix
	filesBackendSettings.AmazonS3Region = params.Cfg.FilesS3Config.Region
	filesBackendSettings.AmazonS3Endpoint = params.Cfg.FilesS3Config.Endpoint
	filesBackendSettings.AmazonS3SSL = params.Cfg.FilesS3Config.SSL
	filesBackendSettings.AmazonS3SignV2 = params.Cfg.FilesS3Config.SignV2
	filesBackendSettings.AmazonS3SSE = params.Cfg.FilesS3Config.SSE
	filesBackendSettings.AmazonS3Trace = params.Cfg.FilesS3Config.Trace
	filesBackendSettings.AmazonS3RequestTimeoutMilliseconds = params.Cfg.FilesS3Config.Timeout

	filesBackend, appErr := filestore.New(filesBackendSettings)
	if appErr != nil {
		params.Logger.Error("Unable to initialize the files storage", mlog.Err(appErr))

		return nil, errors.New("unable to initialize the files storage")
	}

	webhookClient := webhook.NewClient(params.Cfg, params.Logger)

	// Init metrics
	instanceInfo := metrics.InstanceInfo{
		Version:        appModel.CurrentVersion,
		BuildNum:       appModel.BuildNumber,
		Edition:        appModel.Edition,
		InstallationID: os.Getenv("MM_CLOUD_INSTALLATION_ID"),
	}
	metricsService := metrics.NewMetrics(instanceInfo)

	// Init audit
	auditService, errAudit := audit.NewAudit()
	if errAudit != nil {
		return nil, fmt.Errorf("unable to create the audit service: %w", errAudit)
	}
	if err := auditService.Configure(params.Cfg.AuditCfgFile, params.Cfg.AuditCfgJSON); err != nil {
		return nil, fmt.Errorf("unable to initialize the audit service: %w", err)
	}

	// Init notification services
	notificationService, errNotify := initNotificationService(params.NotifyBackends, params.Logger)
	if errNotify != nil {
		return nil, fmt.Errorf("cannot initialize notification service(s): %w", errNotify)
	}

	appServices := app.Services{
		Auth:             authenticator,
		Store:            params.DBStore,
		FilesBackend:     filesBackend,
		Webhook:          webhookClient,
		Metrics:          metricsService,
		Notifications:    notificationService,
		Logger:           params.Logger,
		Permissions:      params.PermissionsService,
		ServicesAPI:      params.ServicesAPI,
		SkipTemplateInit: utils.IsRunningUnitTests(),
	}
	app := app.New(params.Cfg, wsAdapter, appServices)

	focalboardAPI := api.NewAPI(app, params.SingleUserToken, params.Cfg.AuthMode, params.PermissionsService, params.Logger, auditService)

	if params.Cfg.AuthMode == googlesso.AuthService {
		provider, basePath, err := newGoogleSSO(params.Cfg)
		if err != nil {
			params.Logger.Error("Invalid Google sign-in configuration", mlog.Err(err))
			return nil, err
		}
		focalboardAPI.SetGoogleSSO(provider, basePath)
	}

	// Local router for admin APIs
	localRouter := mux.NewRouter()
	focalboardAPI.RegisterAdminRoutes(localRouter)

	// Init team
	if _, err := app.GetRootTeam(); err != nil {
		params.Logger.Error("Unable to get root team", mlog.Err(err))
		return nil, err
	}

	webServer := web.NewServer(params.Cfg.WebPath, params.Cfg.ServerRoot, params.Cfg.Port,
		params.Cfg.UseSSL, params.Cfg.LocalOnly, params.Logger)
	// if the adapter is a routed service, register it before the API
	if routedService, ok := wsAdapter.(web.RoutedService); ok {
		webServer.AddRoutes(routedService)
	}
	webServer.AddRoutes(focalboardAPI)

	server := Server{
		config:              params.Cfg,
		wsAdapter:           wsAdapter,
		webServer:           webServer,
		store:               params.DBStore,
		filesBackend:        filesBackend,
		metricsServer:       metrics.NewMetricsServer(params.Cfg.PrometheusAddress, metricsService, params.Logger),
		metricsService:      metricsService,
		auditService:        auditService,
		notificationService: notificationService,
		logger:              params.Logger,
		localRouter:         localRouter,
		api:                 focalboardAPI,
		app:                 app,
	}

	server.initHandlers()

	return &server, nil
}

// newGoogleSSO builds the Google sign-in provider from the configuration. The callback URL
// registered in Google Cloud must be <serverRoot>/oauth/google/callback.
func newGoogleSSO(cfg *config.Configuration) (*googlesso.Provider, string, error) {
	root, err := url.Parse(cfg.ServerRoot)
	if err != nil || root.Scheme == "" || root.Host == "" {
		return nil, "", fmt.Errorf("serverRoot %q must be an absolute URL for Google sign-in", cfg.ServerRoot)
	}

	basePath := strings.TrimRight(root.Path, "/")
	callbackPath := basePath + "/oauth/google/callback"

	provider, err := googlesso.New(googlesso.Config{
		ClientID:      cfg.GoogleClientID,
		ClientSecret:  cfg.GoogleClientSecret,
		AllowedDomain: cfg.GoogleAllowedDomain,
		RedirectURL:   strings.TrimRight(cfg.ServerRoot, "/") + "/oauth/google/callback",
		CookiePath:    callbackPath,
		SecureCookie:  root.Scheme == "https" || cfg.SecureCookie,
	})
	if err != nil {
		return nil, "", err
	}

	return provider, basePath, nil
}

func NewStore(config *config.Configuration, isSingleUser bool, logger mlog.LoggerIFace) (store.Store, error) {
	sqlDB, err := sql.Open(config.DBType, config.DBConfigString)
	if err != nil {
		logger.Error("connectDatabase failed", mlog.Err(err))
		return nil, err
	}

	err = sqlDB.Ping()
	if err != nil {
		logger.Error(`Database Ping failed`, mlog.Err(err))
		return nil, err
	}

	storeParams := sqlstore.Params{
		DBType:           config.DBType,
		DBPingAttempts:   config.DBPingAttempts,
		ConnectionString: config.DBConfigString,
		TablePrefix:      config.DBTablePrefix,
		Logger:           logger,
		DB:               sqlDB,
		IsSingleUser:     isSingleUser,
	}

	var db store.Store
	db, err = sqlstore.New(storeParams)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func (s *Server) Start() error {
	s.logger.Info("Server.Start")

	s.webServer.Start()

	s.servicesStartStopMutex.Lock()
	defer s.servicesStartStopMutex.Unlock()

	if s.config.EnableLocalMode {
		if err := s.startLocalModeServer(); err != nil {
			return err
		}
	}

	if s.config.AuthMode != MattermostAuthMod {
		s.cleanUpSessionsTask = scheduler.CreateRecurringTask("cleanUpSessions", func() {
			secondsAgo := minSessionExpiryTime
			if secondsAgo < s.config.SessionExpireTime {
				secondsAgo = s.config.SessionExpireTime
			}

			if err := s.store.CleanUpSessions(secondsAgo); err != nil {
				s.logger.Error("Unable to clean up the sessions", mlog.Err(err))
			}
		}, cleanupSessionTaskFrequency)
	}

	metricsUpdater := func() {
		blockCounts, err := s.store.GetBlockCountsByType()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "blocks"), mlog.Err(err))
			return
		}
		s.logger.Debug("Block metrics collected", mlog.Map("block_counts", blockCounts))
		for blockType, count := range blockCounts {
			s.metricsService.ObserveBlockCount(blockType, count)
		}
		boardCount, err := s.store.GetBoardCount()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "boards"), mlog.Err(err))
			return
		}
		s.logger.Debug("Board metrics collected", mlog.Int("board_count", boardCount))
		s.metricsService.ObserveBoardCount(boardCount)
		teamCount, err := s.store.GetTeamCount()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "teams"), mlog.Err(err))
			return
		}
		s.logger.Debug("Team metrics collected", mlog.Int("team_count", teamCount))
		s.metricsService.ObserveTeamCount(teamCount)
	}
	// metricsUpdater()   Calling this immediately causes integration unit tests to fail.
	s.metricsUpdaterTask = scheduler.CreateRecurringTask("updateMetrics", metricsUpdater, updateMetricsTaskFrequency)

	if s.config.PrometheusAddress != "" {
		// The metrics server must not block Start: main installs its signal handler
		// only after Start returns, and Shutdown needs the mutex held here.
		go func() {
			if err := s.metricsServer.Run(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				s.logger.Error("Prometheus server stopped", mlog.Err(err))
			}
		}()
	}
	return nil
}

func (s *Server) Shutdown() error {
	if err := s.webServer.Shutdown(); err != nil {
		return err
	}

	s.stopLocalModeServer()

	if s.config.PrometheusAddress != "" {
		if err := s.metricsServer.Shutdown(); err != nil {
			s.logger.Warn("Error occurred when shutting down the metrics server", mlog.Err(err))
		}
	}

	s.servicesStartStopMutex.Lock()
	defer s.servicesStartStopMutex.Unlock()

	if s.cleanUpSessionsTask != nil {
		s.cleanUpSessionsTask.Cancel()
	}

	if s.metricsUpdaterTask != nil {
		s.metricsUpdaterTask.Cancel()
	}

	if err := s.auditService.Shutdown(); err != nil {
		s.logger.Warn("Error occurred when shutting down audit service", mlog.Err(err))
	}

	if err := s.notificationService.Shutdown(); err != nil {
		s.logger.Warn("Error occurred when shutting down notification service", mlog.Err(err))
	}

	s.app.Shutdown()

	defer s.logger.Info("Server.Shutdown")

	return s.store.Shutdown()
}

func (s *Server) Config() *config.Configuration {
	return s.config
}

func (s *Server) Logger() mlog.LoggerIFace {
	return s.logger
}

func (s *Server) App() *app.App {
	return s.app
}

func (s *Server) Store() store.Store {
	return s.store
}

func (s *Server) UpdateAppConfig() {
	s.app.SetConfig(s.config)
}

// Local server

func (s *Server) startLocalModeServer() error {
	s.localModeServer = &http.Server{ //nolint:gosec
		Handler:     s.localRouter,
		ConnContext: api.SetContextConn,
	}

	// TODO: Close and delete socket file on shutdown
	// Delete existing socket if it exists
	if _, err := os.Stat(s.config.LocalModeSocketLocation); err == nil {
		if err := syscall.Unlink(s.config.LocalModeSocketLocation); err != nil {
			s.logger.Error("Unable to unlink socket.", mlog.Err(err))
		}
	}

	socket := s.config.LocalModeSocketLocation
	unixListener, err := net.Listen("unix", socket)
	if err != nil {
		return err
	}
	if err = os.Chmod(socket, 0600); err != nil {
		return err
	}

	go func() {
		s.logger.Info("Starting unix socket server")
		err = s.localModeServer.Serve(unixListener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.logger.Error("Error starting unix socket server", mlog.Err(err))
		}
	}()

	return nil
}

func (s *Server) stopLocalModeServer() {
	if s.localModeServer != nil {
		_ = s.localModeServer.Close()
		s.localModeServer = nil
	}
}

func (s *Server) GetRootRouter() *mux.Router {
	return s.webServer.Router()
}

func initNotificationService(backends []notify.Backend, logger mlog.LoggerIFace) (*notify.Service, error) {
	loggerBackend := notifylogger.New(logger, mlog.LvlDebug)

	backends = append(backends, loggerBackend)

	service, err := notify.New(logger, backends...)
	return service, err
}
