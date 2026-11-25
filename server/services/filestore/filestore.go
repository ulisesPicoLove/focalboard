// Package filestore stores the files uploaded to boards, either on the local
// filesystem or in an S3 compatible bucket.
package filestore

import (
	"fmt"
	"io"
)

const (
	// DriverLocal stores files in a directory of the local filesystem.
	DriverLocal = "local"
	// DriverS3 stores files in an S3 compatible bucket.
	DriverS3 = "amazons3"
)

// ReadCloseSeeker is the reader returned by FileBackend.Reader.
type ReadCloseSeeker interface {
	io.ReadCloser
	io.Seeker
}

// FileBackend is the storage used for the files uploaded to boards. All the
// paths are relative to the root of the backend (the local directory, or the
// path prefix in the S3 bucket).
type FileBackend interface {
	Reader(path string) (ReadCloseSeeker, error)
	FileExists(path string) (bool, error)
	CopyFile(oldPath, newPath string) error
	MoveFile(oldPath, newPath string) error
	WriteFile(fr io.Reader, path string) (int64, error)
	RemoveFile(path string) error
}

// Settings configures the backend created by New.
type Settings struct {
	DriverName string

	// Directory is the root directory of the local driver.
	Directory string

	AmazonS3AccessKeyID                string
	AmazonS3SecretAccessKey            string
	AmazonS3Bucket                     string
	AmazonS3PathPrefix                 string
	AmazonS3Region                     string
	AmazonS3Endpoint                   string
	AmazonS3SSL                        bool
	AmazonS3SignV2                     bool
	AmazonS3SSE                        bool
	AmazonS3Trace                      bool
	AmazonS3RequestTimeoutMilliseconds int64
}

// New creates the backend selected by settings.DriverName.
func New(settings Settings) (FileBackend, error) {
	switch settings.DriverName {
	case DriverS3:
		return newS3Backend(settings)
	case DriverLocal:
		return newLocalBackend(settings.Directory)
	default:
		return nil, fmt.Errorf("unsupported files driver %q", settings.DriverName)
	}
}
