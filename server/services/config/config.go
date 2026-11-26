package config

import (
	"fmt"
	"log"

	"github.com/spf13/viper"
)

const (
	DefaultServerRoot = "http://localhost:8000"
	DefaultPort       = 8000
	DBPingAttempts    = 5

	// DefaultMaxFileSize is the upload limit in bytes (50 MiB) when none is configured.
	DefaultMaxFileSize = 50 << 20
)

type AmazonS3Config struct {
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	PathPrefix      string
	Region          string
	Endpoint        string
	SSL             bool
	SignV2          bool
	SSE             bool
	Trace           bool
	Timeout         int64
}

// Configuration is the app configuration stored in a json file.
type Configuration struct {
	ServerRoot               string            `json:"serverRoot" mapstructure:"serverRoot"`
	Port                     int               `json:"port" mapstructure:"port"`
	DBType                   string            `json:"dbtype" mapstructure:"dbtype"`
	DBConfigString           string            `json:"dbconfig" mapstructure:"dbconfig"`
	DBPingAttempts           int               `json:"dbpingattempts" mapstructure:"dbpingattempts"`
	DBTablePrefix            string            `json:"dbtableprefix" mapstructure:"dbtableprefix"`
	UseSSL                   bool              `json:"useSSL" mapstructure:"useSSL"`
	SecureCookie             bool              `json:"secureCookie" mapstructure:"secureCookie"`
	WebPath                  string            `json:"webpath" mapstructure:"webpath"`
	FilesDriver              string            `json:"filesdriver" mapstructure:"filesdriver"`
	FilesS3Config            AmazonS3Config    `json:"filess3config" mapstructure:"filess3config"`
	FilesPath                string            `json:"filespath" mapstructure:"filespath"`
	MaxFileSize              int64             `json:"maxfilesize" mapstructure:"maxfilesize"`
	Telemetry                bool              `json:"telemetry" mapstructure:"telemetry"`
	TelemetryID              string            `json:"telemetryid" mapstructure:"telemetryid"`
	PrometheusAddress        string            `json:"prometheusaddress" mapstructure:"prometheusaddress"`
	WebhookUpdate            []string          `json:"webhook_update" mapstructure:"webhook_update"`
	Secret                   string            `json:"secret" mapstructure:"secret"`
	SessionExpireTime        int64             `json:"session_expire_time" mapstructure:"session_expire_time"`
	SessionRefreshTime       int64             `json:"session_refresh_time" mapstructure:"session_refresh_time"`
	LocalOnly                bool              `json:"localonly" mapstructure:"localonly"`
	EnableLocalMode          bool              `json:"enableLocalMode" mapstructure:"enableLocalMode"`
	LocalModeSocketLocation  string            `json:"localModeSocketLocation" mapstructure:"localModeSocketLocation"`
	EnablePublicSharedBoards bool              `json:"enablePublicSharedBoards" mapstructure:"enablePublicSharedBoards"`
	FeatureFlags             map[string]string `json:"featureFlags" mapstructure:"featureFlags"`
	EnableDataRetention      bool              `json:"enable_data_retention" mapstructure:"enable_data_retention"`
	DataRetentionDays        int               `json:"data_retention_days" mapstructure:"data_retention_days"`
	TeammateNameDisplay      string            `json:"teammate_name_display" mapstructure:"teammateNameDisplay"`
	ShowEmailAddress         bool              `json:"show_email_address" mapstructure:"showEmailAddress"`
	ShowFullName             bool              `json:"show_full_name" mapstructure:"showFullName"`

	AuthMode string `json:"authMode" mapstructure:"authMode"`

	// Google Workspace sign-in, used when authMode is "google". These can also be set with
	// FOCALBOARD_GOOGLE_CLIENT_ID, FOCALBOARD_GOOGLE_CLIENT_SECRET and FOCALBOARD_GOOGLE_ALLOWED_DOMAIN.
	GoogleClientID      string `json:"google_client_id" mapstructure:"google_client_id"`
	GoogleClientSecret  string `json:"google_client_secret" mapstructure:"google_client_secret"`
	GoogleAllowedDomain string `json:"google_allowed_domain" mapstructure:"google_allowed_domain"`

	LoggingCfgFile string `json:"logging_cfg_file" mapstructure:"logging_cfg_file"`
	LoggingCfgJSON string `json:"logging_cfg_json" mapstructure:"logging_cfg_json"`

	AuditCfgFile string `json:"audit_cfg_file" mapstructure:"audit_cfg_file"`
	AuditCfgJSON string `json:"audit_cfg_json" mapstructure:"audit_cfg_json"`

	NotifyFreqCardSeconds  int `json:"notify_freq_card_seconds" mapstructure:"notify_freq_card_seconds"`
	NotifyFreqBoardSeconds int `json:"notify_freq_board_seconds" mapstructure:"notify_freq_board_seconds"`
}

// ReadConfigFile read the configuration from the filesystem.
func ReadConfigFile(configFilePath string) (*Configuration, error) {
	if configFilePath == "" {
		viper.SetConfigFile("./config.json")
	} else {
		viper.SetConfigFile(configFilePath)
	}

	viper.SetEnvPrefix("focalboard")
	viper.AutomaticEnv() // read config values from env like FOCALBOARD_SERVERROOT=...
	viper.SetDefault("ServerRoot", DefaultServerRoot)
	viper.SetDefault("DBPingAttempts", DBPingAttempts)
	viper.SetDefault("Port", DefaultPort)
	viper.SetDefault("DBType", "sqlite3")
	viper.SetDefault("DBConfigString", "./focalboard.db")
	viper.SetDefault("DBTablePrefix", "")
	viper.SetDefault("SecureCookie", false)
	viper.SetDefault("WebPath", "./pack")
	viper.SetDefault("FilesPath", "./files")
	viper.SetDefault("FilesDriver", "local")
	viper.SetDefault("Telemetry", true)
	viper.SetDefault("TelemetryID", "")
	viper.SetDefault("WebhookUpdate", nil)
	viper.SetDefault("SessionExpireTime", 60*60*24*30) // 30 days session lifetime
	viper.SetDefault("SessionRefreshTime", 60*60*5)    // 5 minutes session refresh
	viper.SetDefault("LocalOnly", false)
	viper.SetDefault("EnableLocalMode", false)
	viper.SetDefault("LocalModeSocketLocation", "/var/tmp/focalboard_local.socket")
	viper.SetDefault("EnablePublicSharedBoards", false)
	viper.SetDefault("AuthMode", "native")
	// Defaults are needed so these can be read from the environment (see AutomaticEnv above).
	viper.SetDefault("google_client_id", "")
	viper.SetDefault("google_client_secret", "")
	viper.SetDefault("google_allowed_domain", "")
	viper.SetDefault("NotifyFreqCardSeconds", 120)    // 2 minutes after last card edit
	viper.SetDefault("NotifyFreqBoardSeconds", 86400) // 1 day after last card edit
	viper.SetDefault("EnableDataRetention", false)
	viper.SetDefault("FeatureFlags", map[string]string{})
	viper.SetDefault("DataRetentionDays", 365) // 1 year is default
	viper.SetDefault("PrometheusAddress", "")
	viper.SetDefault("MaxFileSize", DefaultMaxFileSize)
	viper.SetDefault("TeammateNameDisplay", "username")
	viper.SetDefault("ShowEmailAddress", false)
	viper.SetDefault("ShowFullName", false)

	err := viper.ReadInConfig() // Find and read the config file
	if err != nil {             // Handle errors reading the config file
		return nil, err
	}

	configuration := Configuration{}

	err = viper.Unmarshal(&configuration)
	if err != nil {
		return nil, err
	}

	if err = validateAuthMode(configuration.AuthMode); err != nil {
		return nil, err
	}

	log.Println("readConfigFile")
	log.Printf("%+v", removeSecurityData(configuration))

	return &configuration, nil
}

// validateAuthMode rejects any auth mode this standalone server does not support. In
// particular "mattermost" trusts the Mattermost-User-Id header sent by the client, so
// accepting it here would let anyone impersonate any user.
func validateAuthMode(mode string) error {
	switch mode {
	case "native", "google":
		return nil
	default:
		return fmt.Errorf("unsupported authMode %q: must be \"native\" or \"google\"", mode)
	}
}

// redacted replaces a secret in the copy of the configuration that is written to the log.
const redacted = "[redacted]"

// removeSecurityData returns a copy of the configuration that is safe to log. The original
// is not modified.
func removeSecurityData(config Configuration) Configuration {
	clean := config
	if clean.GoogleClientSecret != "" {
		clean.GoogleClientSecret = redacted
	}
	if clean.Secret != "" {
		clean.Secret = redacted
	}
	if clean.FilesS3Config.SecretAccessKey != "" {
		clean.FilesS3Config.SecretAccessKey = redacted
	}
	if clean.FilesS3Config.AccessKeyID != "" {
		clean.FilesS3Config.AccessKeyID = redacted
	}
	// The connection string usually embeds the database password.
	if clean.DBConfigString != "" {
		clean.DBConfigString = redacted
	}
	return clean
}
