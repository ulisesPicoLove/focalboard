package filestore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/encrypt"
)

const (
	defaultS3Timeout   = 20 * time.Second
	defaultContentType = "binary/octet-stream"
)

var imageMimeTypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".gif":  "image/gif",
	".bmp":  "image/bmp",
	".png":  "image/png",
	".tiff": "image/tiff",
	".tif":  "image/tif",
}

// s3Backend stores the files in an S3 compatible bucket.
type s3Backend struct {
	client     *minio.Client
	bucket     string
	pathPrefix string
	encrypt    bool
	timeout    time.Duration
}

// traceWriter sends the S3 client trace to stderr.
type traceWriter struct{}

func (traceWriter) Write(p []byte) (int, error) {
	return os.Stderr.Write(p)
}

func newS3Backend(settings Settings) (*s3Backend, error) {
	var creds *credentials.Credentials

	switch {
	case settings.AmazonS3AccessKeyID == "" && settings.AmazonS3SecretAccessKey == "":
		creds = credentials.NewIAM("")
	case settings.AmazonS3SignV2:
		creds = credentials.NewStatic(settings.AmazonS3AccessKeyID, settings.AmazonS3SecretAccessKey, "", credentials.SignatureV2)
	default:
		creds = credentials.NewStatic(settings.AmazonS3AccessKeyID, settings.AmazonS3SecretAccessKey, "", credentials.SignatureV4)
	}

	client, err := minio.New(settings.AmazonS3Endpoint, &minio.Options{
		Creds:  creds,
		Secure: settings.AmazonS3SSL,
		Region: settings.AmazonS3Region,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to create the S3 client: %w", err)
	}

	if settings.AmazonS3Trace {
		client.TraceOn(traceWriter{})
	}

	timeout := time.Duration(settings.AmazonS3RequestTimeoutMilliseconds) * time.Millisecond
	if timeout <= 0 {
		timeout = defaultS3Timeout
	}

	return &s3Backend{
		client:     client,
		bucket:     settings.AmazonS3Bucket,
		pathPrefix: settings.AmazonS3PathPrefix,
		encrypt:    settings.AmazonS3SSE,
		timeout:    timeout,
	}, nil
}

// key returns the object key of a backend path.
func (b *s3Backend) key(p string) string {
	return path.Join(b.pathPrefix, filepath.ToSlash(p))
}

func (b *s3Backend) sse() encrypt.ServerSide {
	if b.encrypt {
		return encrypt.NewSSE()
	}

	return nil
}

// s3Reader cancels the request context when it is closed, or when the request
// timeout expires.
type s3Reader struct {
	*minio.Object
	timer  *time.Timer
	cancel context.CancelFunc
}

func (r *s3Reader) Close() error {
	r.timer.Stop()
	r.cancel()

	return r.Object.Close()
}

func (b *s3Backend) Reader(p string) (ReadCloseSeeker, error) {
	ctx, cancel := context.WithCancel(context.Background())

	obj, err := b.client.GetObject(ctx, b.bucket, b.key(p), minio.GetObjectOptions{})
	if err != nil {
		cancel()

		return nil, fmt.Errorf("unable to open file %s: %w", p, err)
	}

	return &s3Reader{Object: obj, timer: time.AfterFunc(b.timeout, cancel), cancel: cancel}, nil
}

func (b *s3Backend) FileExists(p string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.client.StatObject(ctx, b.bucket, b.key(p), minio.StatObjectOptions{})
	if err == nil {
		return true, nil
	}

	if minio.ToErrorResponse(err).Code == minio.NoSuchKey {
		return false, nil
	}

	return false, fmt.Errorf("unable to know if file %s exists: %w", p, err)
}

func (b *s3Backend) copyObject(oldPath, newPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	src := minio.CopySrcOptions{Bucket: b.bucket, Object: b.key(oldPath), Encryption: b.sse()}
	dst := minio.CopyDestOptions{Bucket: b.bucket, Object: b.key(newPath), Encryption: b.sse()}

	if _, err := b.client.CopyObject(ctx, dst, src); err != nil {
		return err
	}

	return nil
}

func (b *s3Backend) CopyFile(oldPath, newPath string) error {
	if err := b.copyObject(oldPath, newPath); err != nil {
		return fmt.Errorf("unable to copy file from %s to %s: %w", oldPath, newPath, err)
	}

	return nil
}

func (b *s3Backend) MoveFile(oldPath, newPath string) error {
	if err := b.copyObject(oldPath, newPath); err != nil {
		return fmt.Errorf("unable to copy file from %s to %s: %w", oldPath, newPath, err)
	}

	if err := b.RemoveFile(oldPath); err != nil {
		return fmt.Errorf("unable to remove the old file %s: %w", oldPath, err)
	}

	return nil
}

func (b *s3Backend) WriteFile(fr io.Reader, p string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	contentType := defaultContentType
	if mime, ok := imageMimeTypes[strings.ToLower(filepath.Ext(p))]; ok {
		contentType = mime
	}

	// A known size avoids buffering the whole upload in memory.
	size := int64(-1)

	switch t := fr.(type) {
	case *bytes.Buffer:
		size = int64(t.Len())
	case *os.File:
		if stat, err := t.Stat(); err == nil {
			size = stat.Size()
		}
	}

	info, err := b.client.PutObject(ctx, b.bucket, b.key(p), fr, size, minio.PutObjectOptions{
		ContentType:          contentType,
		ServerSideEncryption: b.sse(),
	})
	if err != nil {
		return info.Size, fmt.Errorf("unable to write the data in file %s: %w", p, err)
	}

	return info.Size, nil
}

func (b *s3Backend) RemoveFile(p string) error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	if err := b.client.RemoveObject(ctx, b.bucket, b.key(p), minio.RemoveObjectOptions{}); err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return fmt.Errorf("timeout removing file %s: %w", p, err)
		}

		return fmt.Errorf("unable to remove file %s: %w", p, err)
	}

	return nil
}
