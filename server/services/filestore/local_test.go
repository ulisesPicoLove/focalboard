package filestore

import (
	"bytes"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func newTestLocalBackend(t *testing.T) (FileBackend, string) {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "files")
	b, err := New(Settings{DriverName: DriverLocal, Directory: dir})
	require.NoError(t, err)

	return b, dir
}

func readAll(t *testing.T, b FileBackend, path string) string {
	t.Helper()

	r, err := b.Reader(path)
	require.NoError(t, err)

	defer r.Close()

	data, err := io.ReadAll(r)
	require.NoError(t, err)

	return string(data)
}

func TestNew(t *testing.T) {
	t.Run("unknown driver", func(t *testing.T) {
		_, err := New(Settings{DriverName: "ftp"})
		require.Error(t, err)
	})

	t.Run("local driver without directory", func(t *testing.T) {
		_, err := New(Settings{DriverName: DriverLocal})
		require.Error(t, err)
	})

	t.Run("local driver creates the directory", func(t *testing.T) {
		dir := filepath.Join(t.TempDir(), "a", "b")
		_, err := New(Settings{DriverName: DriverLocal, Directory: dir})
		require.NoError(t, err)
		require.DirExists(t, dir)
	})
}

func TestLocalBackend(t *testing.T) {
	t.Run("write, read and check a file", func(t *testing.T) {
		b, dir := newTestLocalBackend(t)

		n, err := b.WriteFile(strings.NewReader("hello"), "team/board/file.txt")
		require.NoError(t, err)
		require.EqualValues(t, 5, n)
		require.FileExists(t, filepath.Join(dir, "team", "board", "file.txt"))

		exists, err := b.FileExists("team/board/file.txt")
		require.NoError(t, err)
		require.True(t, exists)

		require.Equal(t, "hello", readAll(t, b, "team/board/file.txt"))
	})

	t.Run("a missing file does not exist", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)

		exists, err := b.FileExists("nope.txt")
		require.NoError(t, err)
		require.False(t, exists)

		_, err = b.Reader("nope.txt")
		require.Error(t, err)
	})

	t.Run("the reader can seek", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		_, err := b.WriteFile(strings.NewReader("0123456789"), "f.txt")
		require.NoError(t, err)

		r, err := b.Reader("f.txt")
		require.NoError(t, err)

		defer r.Close()

		_, err = r.Seek(4, io.SeekStart)
		require.NoError(t, err)

		data, err := io.ReadAll(r)
		require.NoError(t, err)
		require.Equal(t, "456789", string(data))
	})

	t.Run("writing again overwrites the file", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		_, err := b.WriteFile(strings.NewReader("a long content"), "f.txt")
		require.NoError(t, err)
		_, err = b.WriteFile(strings.NewReader("short"), "f.txt")
		require.NoError(t, err)

		require.Equal(t, "short", readAll(t, b, "f.txt"))
	})

	t.Run("a leading slash is relative to the directory", func(t *testing.T) {
		b, dir := newTestLocalBackend(t)
		_, err := b.WriteFile(strings.NewReader("x"), "/a/f.txt")
		require.NoError(t, err)
		require.FileExists(t, filepath.Join(dir, "a", "f.txt"))
	})

	t.Run("copy keeps the source", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		_, err := b.WriteFile(strings.NewReader("data"), "src/f.txt")
		require.NoError(t, err)

		require.NoError(t, b.CopyFile("src/f.txt", "dst/deep/f.txt"))
		require.Equal(t, "data", readAll(t, b, "src/f.txt"))
		require.Equal(t, "data", readAll(t, b, "dst/deep/f.txt"))
	})

	t.Run("copy of a missing file fails", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		require.Error(t, b.CopyFile("nope.txt", "dst.txt"))

		exists, err := b.FileExists("dst.txt")
		require.NoError(t, err)
		require.False(t, exists)
	})

	t.Run("move removes the source", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		_, err := b.WriteFile(strings.NewReader("data"), "src.txt")
		require.NoError(t, err)

		require.NoError(t, b.MoveFile("src.txt", "dst/deep/f.txt"))
		require.Equal(t, "data", readAll(t, b, "dst/deep/f.txt"))

		exists, err := b.FileExists("src.txt")
		require.NoError(t, err)
		require.False(t, exists)
	})

	t.Run("move of a missing file fails", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		require.Error(t, b.MoveFile("nope.txt", "dst.txt"))
	})

	t.Run("remove", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		_, err := b.WriteFile(strings.NewReader("data"), "f.txt")
		require.NoError(t, err)

		require.NoError(t, b.RemoveFile("f.txt"))

		exists, err := b.FileExists("f.txt")
		require.NoError(t, err)
		require.False(t, exists)

		require.Error(t, b.RemoveFile("f.txt"))
	})

	t.Run("a partially written file is removed", func(t *testing.T) {
		b, _ := newTestLocalBackend(t)
		failing := io.MultiReader(strings.NewReader("partial"), &errReader{})

		_, err := b.WriteFile(failing, "f.txt")
		require.Error(t, err)

		exists, err := b.FileExists("f.txt")
		require.NoError(t, err)
		require.False(t, exists)
	})
}

type errReader struct{}

func (*errReader) Read([]byte) (int, error) {
	return 0, errors.New("read failure")
}

func TestLocalBackendStaysInsideDirectory(t *testing.T) {
	b, dir := newTestLocalBackend(t)
	outside := filepath.Join(filepath.Dir(dir), "outside.txt")
	require.NoError(t, os.WriteFile(outside, []byte("secret"), 0o600))

	paths := []string{
		"../outside.txt",
		"a/../../outside.txt",
		"/../outside.txt",
	}

	for _, p := range paths {
		t.Run(p, func(t *testing.T) {
			_, err := b.Reader(p)
			require.Error(t, err)

			_, err = b.WriteFile(bytes.NewReader([]byte("x")), p+".new")
			require.Error(t, err)

			require.Error(t, b.CopyFile(p, "copy.txt"))
			require.Error(t, b.CopyFile("f.txt", p+".copy"))
			require.Error(t, b.MoveFile(p, "moved.txt"))
			require.Error(t, b.RemoveFile(p))
		})
	}

	// nothing was created or removed outside of the directory
	require.FileExists(t, outside)
	require.NoFileExists(t, outside+".new")
	require.NoFileExists(t, outside+".copy")

	t.Run("a symlink pointing outside is not followed", func(t *testing.T) {
		require.NoError(t, os.Symlink(outside, filepath.Join(dir, "link.txt")))

		_, err := b.Reader("link.txt")
		require.Error(t, err)
	})
}
