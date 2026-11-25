// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"errors"
	"fmt"
	"testing"

	"github.com/mattermost/focalboard/server/model"
	"github.com/stretchr/testify/require"
)

// The history tables have a primary key that includes insert_at. On SQLite
// insert_at has a 1ms resolution, so consecutive writes to the same entity
// within a millisecond must not fail with a UNIQUE constraint error.
func TestHistoryInsertsInTheSameMillisecond(t *testing.T) {
	store, tearDown := SetupTests(t)
	defer tearDown()

	const iterations = 300

	t.Run("board history", func(t *testing.T) {
		board := &model.Board{
			ID:     "history-board",
			TeamID: "team-id",
			Type:   model.BoardTypeOpen,
		}

		for i := 0; i < iterations; i++ {
			board.Title = fmt.Sprintf("title %d", i)

			_, err := store.InsertBoard(board, "user-id")
			require.NoError(t, err, "iteration %d", i)
		}
	})

	t.Run("block history", func(t *testing.T) {
		block := &model.Block{
			ID:      "history-block",
			BoardID: "history-board",
			Type:    model.TypeCard,
		}

		for i := 0; i < iterations; i++ {
			block.Title = fmt.Sprintf("title %d", i)

			require.NoError(t, store.InsertBlock(block, "user-id"), "iteration %d", i)
		}
	})

	t.Run("board members history", func(t *testing.T) {
		member := &model.BoardMember{BoardID: "history-board", UserID: "member-id", SchemeEditor: true}

		for i := 0; i < iterations; i++ {
			_, err := store.SaveMember(member)
			require.NoError(t, err, "save %d", i)

			require.NoError(t, store.DeleteMember("history-board", "member-id"), "delete %d", i)
		}
	})
}

func TestIsHistoryKeyConflict(t *testing.T) {
	cases := []struct {
		err      string
		expected bool
	}{
		{"UNIQUE constraint failed: test_boards_history.id, test_boards_history.insert_at", true},
		{"UNIQUE constraint failed: test_blocks_history.id, test_blocks_history.insert_at", true},
		{"UNIQUE constraint failed: test_board_members_history.board_id, test_board_members_history.user_id, test_board_members_history.insert_at", true},
		{"UNIQUE constraint failed: test_boards.id", false},
		{"NOT NULL constraint failed: test_boards_history.title", false},
		{"database is locked", false},
	}

	for _, tc := range cases {
		require.Equal(t, tc.expected, isHistoryKeyConflict(errors.New(tc.err)), tc.err)
	}
}
