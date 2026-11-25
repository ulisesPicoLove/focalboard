package filestore

import (
	"context"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/minio/minio-go/v7"
	"github.com/stretchr/testify/require"
)

// The S3 tests need an S3 compatible server. They are skipped unless
// FOCALBOARD_TEST_S3_ENDPOINT is set, for example with adobe/s3mock:
//
//	docker run --rm -p 127.0.0.1:19000:9090 -e initialBuckets=focalboard-test adobe/s3mock
//	FOCALBOARD_TEST_S3_ENDPOINT=127.0.0.1:19000 \
//	FOCALBOARD_TEST_S3_ACCESS_KEY=testkey \
//	FOCALBOARD_TEST_S3_SECRET_KEY=testsecret123 go test ./services/filestore
func newTestS3Backend(t *testing.T, prefix string) *s3Backend {
	t.Helper()

	endpoint := os.Getenv("FOCALBOARD_TEST_S3_ENDPOINT")
	if endpoint == "" {
		t.Skip("FOCALBOARD_TEST_S3_ENDPOINT is not set")
	}

	b, err := New(Settings{
		DriverName:                         DriverS3,
		AmazonS3AccessKeyID:                os.Getenv("FOCALBOARD_TEST_S3_ACCESS_KEY"),
		AmazonS3SecretAccessKey:            os.Getenv("FOCALBOARD_TEST_S3_SECRET_KEY"),
		AmazonS3Bucket:                     "focalboard-test",
		AmazonS3PathPrefix:                 prefix,
		AmazonS3Endpoint:                   endpoint,
		AmazonS3Region:                     "us-east-1",
		AmazonS3SSL:                        false,
		AmazonS3RequestTimeoutMilliseconds: 10000,
	})
	require.NoError(t, err)

	s3b, ok := b.(*s3Backend)
	require.True(t, ok)

	ctx := context.Background()

	exists, err := s3b.client.BucketExists(ctx, s3b.bucket)
	require.NoError(t, err)

	if !exists {
		require.NoError(t, s3b.client.MakeBucket(ctx, s3b.bucket, minio.MakeBucketOptions{Region: "us-east-1"}))
	}

	return s3b
}

func TestS3Backend(t *testing.T) {
	b := newTestS3Backend(t, "prefix/"+strings.ReplaceAll(t.Name(), "/", "_"))

	t.Run("a missing file does not exist", func(t *testing.T) {
		exists, err := b.FileExists("nope.txt")
		require.NoError(t, err)
		require.False(t, exists)
	})

	t.Run("write, check, read and seek", func(t *testing.T) {
		// a plain io.Reader has no known size and goes through a streaming upload
		n, err := b.WriteFile(io.MultiReader(strings.NewReader("0123456789")), "team/board/f.txt")
		require.NoError(t, err)
		require.EqualValues(t, 10, n)

		exists, err := b.FileExists("team/board/f.txt")
		require.NoError(t, err)
		require.True(t, exists)

		r, err := b.Reader("team/board/f.txt")
		require.NoError(t, err)

		defer r.Close()

		_, err = r.Seek(4, io.SeekStart)
		require.NoError(t, err)

		data, err := io.ReadAll(r)
		require.NoError(t, err)
		require.Equal(t, "456789", string(data))
	})

	t.Run("images get their content type", func(t *testing.T) {
		_, err := b.WriteFile(strings.NewReader("png"), "img.PNG")
		require.NoError(t, err)

		info, err := b.client.StatObject(context.Background(), b.bucket, b.key("img.PNG"), minio.StatObjectOptions{})
		require.NoError(t, err)
		require.Equal(t, "image/png", info.ContentType)

		_, err = b.WriteFile(strings.NewReader("x"), "file.bin")
		require.NoError(t, err)

		info, err = b.client.StatObject(context.Background(), b.bucket, b.key("file.bin"), minio.StatObjectOptions{})
		require.NoError(t, err)
		require.Equal(t, "binary/octet-stream", info.ContentType)
	})

	t.Run("copy keeps the source", func(t *testing.T) {
		_, err := b.WriteFile(strings.NewReader("data"), "src.txt")
		require.NoError(t, err)

		require.NoError(t, b.CopyFile("src.txt", "dst/copy.txt"))

		for _, p := range []string{"src.txt", "dst/copy.txt"} {
			exists, err := b.FileExists(p)
			require.NoError(t, err)
			require.True(t, exists, p)
		}
	})

	t.Run("move removes the source", func(t *testing.T) {
		_, err := b.WriteFile(strings.NewReader("data"), "mv-src.txt")
		require.NoError(t, err)

		require.NoError(t, b.MoveFile("mv-src.txt", "dst/moved.txt"))

		exists, err := b.FileExists("mv-src.txt")
		require.NoError(t, err)
		require.False(t, exists)

		exists, err = b.FileExists("dst/moved.txt")
		require.NoError(t, err)
		require.True(t, exists)
	})

	t.Run("copy of a missing file fails", func(t *testing.T) {
		require.Error(t, b.CopyFile("nope.txt", "x.txt"))
		require.Error(t, b.MoveFile("nope.txt", "x.txt"))
	})

	t.Run("remove", func(t *testing.T) {
		_, err := b.WriteFile(strings.NewReader("data"), "rm.txt")
		require.NoError(t, err)

		require.NoError(t, b.RemoveFile("rm.txt"))

		exists, err := b.FileExists("rm.txt")
		require.NoError(t, err)
		require.False(t, exists)
	})

	t.Run("objects are stored under the path prefix", func(t *testing.T) {
		_, err := b.WriteFile(strings.NewReader("data"), "keyed.txt")
		require.NoError(t, err)

		_, err = b.client.StatObject(context.Background(), b.bucket, b.pathPrefix+"/keyed.txt", minio.StatObjectOptions{})
		require.NoError(t, err)
	})
}

func TestS3BackendKey(t *testing.T) {
	b := &s3Backend{pathPrefix: "prefix"}
	require.Equal(t, "prefix/a/b.txt", b.key("a/b.txt"))
	require.Equal(t, "prefix/a/b.txt", b.key("/a/b.txt"))

	b = &s3Backend{}
	require.Equal(t, "a/b.txt", b.key("a/b.txt"))
}

func TestNewS3BackendTimeout(t *testing.T) {
	b, err := newS3Backend(Settings{AmazonS3Endpoint: "localhost:9000"})
	require.NoError(t, err)
	require.Equal(t, defaultS3Timeout, b.timeout)
}
