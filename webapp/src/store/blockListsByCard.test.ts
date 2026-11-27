// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createAttachmentBlock} from '../blocks/attachmentBlock'
import {createCommentBlock} from '../blocks/commentBlock'
import {createTextBlock} from '../blocks/textBlock'

import {reducer as attachments, updateAttachments} from './attachments'
import {reducer as comments, updateComments} from './comments'
import {reducer as contents, updateContents} from './contents'

// The updates arrive from the websocket in batches: every block of a batch has to be applied,
// whichever card it belongs to.
describe('updating a batch of blocks that belong to different cards', () => {
    test('comments', () => {
        const a = {...createCommentBlock(), id: 'a', parentId: 'card-1'}
        const b = {...createCommentBlock(), id: 'b', parentId: 'card-2'}
        const state = comments(undefined, updateComments([a, b]))

        expect(Object.keys(state.comments).sort()).toEqual(['a', 'b'])
        expect(state.commentsByCard['card-1']).toEqual([a])
        expect(state.commentsByCard['card-2']).toEqual([b])

        const edited = {...a, title: 'edited'}
        const afterEdit = comments(state, updateComments([edited, {...b, deleteAt: 1}]))
        expect(afterEdit.commentsByCard['card-1']).toEqual([edited])
        expect(afterEdit.commentsByCard['card-2']).toEqual([])
        expect(afterEdit.comments.b).toBeUndefined()
    })

    test('contents', () => {
        const a = {...createTextBlock(), id: 'a', parentId: 'card-1'}
        const b = {...createTextBlock(), id: 'b', parentId: 'card-2'}
        const state = contents(undefined, updateContents([a, b]))

        expect(Object.keys(state.contents).sort()).toEqual(['a', 'b'])
        expect(state.contentsByCard['card-1']).toEqual([a])
        expect(state.contentsByCard['card-2']).toEqual([b])

        const afterDelete = contents(state, updateContents([{...a, deleteAt: 1}, {...b, deleteAt: 1}]))
        expect(afterDelete.contentsByCard['card-1']).toEqual([])
        expect(afterDelete.contentsByCard['card-2']).toEqual([])
        expect(Object.keys(afterDelete.contents)).toEqual([])
    })

    test('attachments', () => {
        const a = {...createAttachmentBlock(), id: 'a', parentId: 'card-1'}
        const b = {...createAttachmentBlock(), id: 'b', parentId: 'card-2'}
        const state = attachments(undefined, updateAttachments([a, b]))

        expect(Object.keys(state.attachments).sort()).toEqual(['a', 'b'])
        expect(state.attachmentsByCard['card-1']).toEqual([a])
        expect(state.attachmentsByCard['card-2']).toEqual([b])

        const afterDelete = attachments(state, updateAttachments([{...a, deleteAt: 1}, {...b, deleteAt: 1}]))
        expect(afterDelete.attachmentsByCard['card-1']).toEqual([])
        expect(afterDelete.attachmentsByCard['card-2']).toEqual([])
    })
})
