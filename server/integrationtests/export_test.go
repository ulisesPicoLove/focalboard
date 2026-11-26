package integrationtests

import (
	"archive/zip"
	"bytes"
	"testing"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/utils"
	"github.com/stretchr/testify/require"
)

func TestExportBoard(t *testing.T) {
	t.Run("export single board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board := &model.Board{
			ID:        utils.NewID(utils.IDTypeBoard),
			TeamID:    "test-team",
			Title:     "Export Test Board",
			CreatedBy: th.GetUser1().ID,
			Type:      model.BoardTypeOpen,
			CreateAt:  utils.GetMillis(),
			UpdateAt:  utils.GetMillis(),
		}

		block := &model.Block{
			ID:        utils.NewID(utils.IDTypeCard),
			ParentID:  board.ID,
			Type:      model.TypeCard,
			BoardID:   board.ID,
			Title:     "Test card # for export",
			CreatedBy: th.GetUser1().ID,
			CreateAt:  utils.GetMillis(),
			UpdateAt:  utils.GetMillis(),
		}

		babs := &model.BoardsAndBlocks{
			Boards: []*model.Board{board},
			Blocks: []*model.Block{block},
		}

		babs, resp := th.Client.CreateBoardsAndBlocks(babs)
		th.CheckOK(resp)

		// export the board to an in-memory archive file
		buf, resp := th.Client.ExportBoardArchive(babs.Boards[0].ID)
		th.CheckOK(resp)
		require.NotNil(t, buf)

		// import the archive file to team 0
		resp = th.Client.ImportArchive(model.GlobalTeamID, bytes.NewReader(buf))
		th.CheckOK(resp)
		require.NoError(t, resp.Error)

		// check for test card
		boardsImported, err := th.Server.App().GetBoardsForUserAndTeam(th.GetUser1().ID, model.GlobalTeamID, true)
		require.NoError(t, err)
		require.Len(t, boardsImported, 1)
		boardImported := boardsImported[0]
		blocksImported, err := th.Server.App().GetBlocksForBoard(boardImported.ID)
		require.NoError(t, err)
		require.Len(t, blocksImported, 1)
		require.Equal(t, block.Title, blocksImported[0].Title)
	})

	t.Run("export a board with an image whose file is missing", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board := &model.Board{
			ID:        utils.NewID(utils.IDTypeBoard),
			TeamID:    "test-team",
			Title:     "Export Test Board With Missing Image",
			CreatedBy: th.GetUser1().ID,
			Type:      model.BoardTypeOpen,
			CreateAt:  utils.GetMillis(),
			UpdateAt:  utils.GetMillis(),
		}

		image := &model.Block{
			ID:        utils.NewID(utils.IDTypeBlock),
			ParentID:  board.ID,
			Type:      model.TypeImage,
			BoardID:   board.ID,
			Fields:    map[string]interface{}{"fileId": "missing-image.png"},
			CreatedBy: th.GetUser1().ID,
			CreateAt:  utils.GetMillis(),
			UpdateAt:  utils.GetMillis(),
		}

		babs, resp := th.Client.CreateBoardsAndBlocks(&model.BoardsAndBlocks{
			Boards: []*model.Board{board},
			Blocks: []*model.Block{image},
		})
		th.CheckOK(resp)

		boardID := babs.Boards[0].ID

		// a missing image file must not prevent the export of the board. The
		// app is used directly because the API handler streams the archive, so
		// the status is 200 even if the export fails.
		var buf bytes.Buffer

		err := th.Server.App().ExportArchive(&buf, model.ExportArchiveOptions{
			TeamID:   board.TeamID,
			BoardIDs: []string{boardID},
		})
		require.NoError(t, err)

		zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
		require.NoError(t, err, "the exported archive is not a valid zip file")

		names := make([]string, 0, len(zr.File))
		for _, f := range zr.File {
			names = append(names, f.Name)
		}

		require.Contains(t, names, boardID+"/board.jsonl")
	})
}
