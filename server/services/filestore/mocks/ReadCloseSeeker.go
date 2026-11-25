package mocks

import (
	filestore "github.com/mattermost/focalboard/server/services/filestore"
	mock "github.com/stretchr/testify/mock"
)

// ReadCloseSeeker is a mock of filestore.ReadCloseSeeker.
type ReadCloseSeeker struct {
	mock.Mock
}

var _ filestore.ReadCloseSeeker = (*ReadCloseSeeker)(nil)

// Close provides a mock function with no fields.
func (_m *ReadCloseSeeker) Close() error {
	ret := _m.Called()

	if rf, ok := ret.Get(0).(func() error); ok {
		return rf()
	}

	return ret.Error(0)
}

// Read provides a mock function with given fields: p.
func (_m *ReadCloseSeeker) Read(p []byte) (int, error) {
	ret := _m.Called(p)

	if rf, ok := ret.Get(0).(func([]byte) (int, error)); ok {
		return rf(p)
	}

	var r0 int
	if rf, ok := ret.Get(0).(func([]byte) int); ok {
		r0 = rf(p)
	} else {
		r0 = ret.Get(0).(int)
	}

	var r1 error
	if rf, ok := ret.Get(1).(func([]byte) error); ok {
		r1 = rf(p)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}

// Seek provides a mock function with given fields: offset, whence.
func (_m *ReadCloseSeeker) Seek(offset int64, whence int) (int64, error) {
	ret := _m.Called(offset, whence)

	if rf, ok := ret.Get(0).(func(int64, int) (int64, error)); ok {
		return rf(offset, whence)
	}

	var r0 int64
	if rf, ok := ret.Get(0).(func(int64, int) int64); ok {
		r0 = rf(offset, whence)
	} else {
		r0 = ret.Get(0).(int64)
	}

	var r1 error
	if rf, ok := ret.Get(1).(func(int64, int) error); ok {
		r1 = rf(offset, whence)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}
