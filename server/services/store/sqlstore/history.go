// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/focalboard/server/model"
)

const historyInsertMaxAttempts = 5

// isHistoryKeyConflict returns true if err is a primary key violation caused
// by two rows of the same entity getting the same insert_at.
func isHistoryKeyConflict(err error) bool {
	msg := err.Error()

	return strings.Contains(msg, "UNIQUE constraint failed") && strings.Contains(msg, "_history.")
}

// execHistoryInsert executes an insert into one of the history tables.
//
// The history tables have a primary key that includes insert_at, whose default
// value has a resolution of 1ms on SQLite (microseconds on the other
// databases). Two changes of the same entity within a millisecond would get
// the same key and fail, so on SQLite the insert is retried after waiting for
// the next millisecond, which gives the new row a different insert_at.
func (s *SQLStore) execHistoryInsert(query sq.InsertBuilder) (sql.Result, error) {
	for attempt := 1; ; attempt++ {
		result, err := query.Exec()
		if err == nil {
			return result, nil
		}

		if s.dbType != model.SqliteDBType || attempt >= historyInsertMaxAttempts || !isHistoryKeyConflict(err) {
			return result, err
		}

		time.Sleep(time.Millisecond)
	}
}
