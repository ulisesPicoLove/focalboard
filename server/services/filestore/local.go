package filestore

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

const (
	localDirPerm  = 0o750
	localFilePerm = 0o600
	// Copies keep the default permissions of os.Create (before umask).
	localCopyPerm = 0o666
)

// localBackend stores the files in a directory. Every operation goes through
// an os.Root, so a path can never resolve outside of the directory (for
// example with ".." elements or symlinks).
type localBackend struct {
	root *os.Root
}

func newLocalBackend(directory string) (*localBackend, error) {
	if directory == "" {
		return nil, errors.New("the files directory is not set")
	}

	if err := os.MkdirAll(directory, localDirPerm); err != nil {
		return nil, fmt.Errorf("unable to create the files directory %s: %w", directory, err)
	}

	root, err := os.OpenRoot(directory)
	if err != nil {
		return nil, fmt.Errorf("unable to open the files directory %s: %w", directory, err)
	}

	return &localBackend{root: root}, nil
}

// rel turns a backend path into a path relative to the root directory.
func rel(path string) string {
	return filepath.Clean(strings.TrimLeft(path, "/"))
}

func (b *localBackend) Reader(path string) (ReadCloseSeeker, error) {
	f, err := b.root.Open(rel(path))
	if err != nil {
		return nil, fmt.Errorf("unable to open file %s: %w", path, err)
	}

	return f, nil
}

func (b *localBackend) FileExists(path string) (bool, error) {
	_, err := b.root.Stat(rel(path))
	if err == nil {
		return true, nil
	}

	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}

	return false, fmt.Errorf("unable to know if file %s exists: %w", path, err)
}

func (b *localBackend) CopyFile(oldPath, newPath string) error {
	src, err := b.root.Open(rel(oldPath))
	if err != nil {
		return fmt.Errorf("unable to copy file from %s to %s: %w", oldPath, newPath, err)
	}
	defer src.Close()

	if _, err = b.write(src, newPath, localCopyPerm); err != nil {
		return fmt.Errorf("unable to copy file from %s to %s: %w", oldPath, newPath, err)
	}

	return nil
}

func (b *localBackend) MoveFile(oldPath, newPath string) error {
	if err := b.root.MkdirAll(filepath.Dir(rel(newPath)), localDirPerm); err != nil {
		return fmt.Errorf("unable to create the destination directory of %s: %w", newPath, err)
	}

	if err := b.root.Rename(rel(oldPath), rel(newPath)); err != nil {
		return fmt.Errorf("unable to move file from %s to %s: %w", oldPath, newPath, err)
	}

	return nil
}

func (b *localBackend) WriteFile(fr io.Reader, path string) (int64, error) {
	return b.write(fr, path, localFilePerm)
}

func (b *localBackend) RemoveFile(path string) error {
	if err := b.root.Remove(rel(path)); err != nil {
		return fmt.Errorf("unable to remove file %s: %w", path, err)
	}

	return nil
}

// write creates (or truncates) the file at path with the data read from fr.
// A file that could not be completely written is removed.
func (b *localBackend) write(fr io.Reader, path string, perm os.FileMode) (int64, error) {
	p := rel(path)

	if err := b.root.MkdirAll(filepath.Dir(p), localDirPerm); err != nil {
		return 0, fmt.Errorf("unable to create the directory of %s: %w", path, err)
	}

	fw, err := b.root.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)
	if err != nil {
		return 0, fmt.Errorf("unable to open file %s to write the data: %w", path, err)
	}

	written, err := io.Copy(fw, fr)
	if cerr := fw.Close(); err == nil {
		err = cerr
	}

	if err != nil {
		_ = b.root.Remove(p)

		return written, fmt.Errorf("unable to write the data in file %s: %w", path, err)
	}

	return written, nil
}
