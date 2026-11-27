// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CategoryBoards, reducer, reorderCategoryBoards} from './sidebar'

function category(id: string, boards: Array<[string, boolean]>): CategoryBoards {
    return {
        id,
        name: id,
        userID: 'u',
        teamID: 't',
        createAt: 0,
        updateAt: 0,
        deleteAt: 0,
        collapsed: false,
        sortOrder: 0,
        type: 'custom',
        boardMetadata: boards.map(([boardID, hidden]) => ({boardID, hidden})),
    } as CategoryBoards
}

describe('store/sidebar reorderCategoryBoards', () => {
    const initial = {categoryAttributes: [category('c1', [['a', false], ['b', true], ['c', false]]), category('c2', [['x', false]])], hiddenBoardIDs: []}

    test('puts the boards in the order the server sent', () => {
        const state = reducer(initial, reorderCategoryBoards({categoryID: 'c1', boardOrder: ['c', 'a', 'b']}))
        expect(state.categoryAttributes[0]!.boardMetadata.map((m) => m.boardID)).toEqual(['c', 'a', 'b'])
    })

    test('keeps the hidden flag of each board', () => {
        const state = reducer(initial, reorderCategoryBoards({categoryID: 'c1', boardOrder: ['b', 'c', 'a']}))
        expect(state.categoryAttributes[0]!.boardMetadata).toEqual([
            {boardID: 'b', hidden: true},
            {boardID: 'c', hidden: false},
            {boardID: 'a', hidden: false},
        ])
    })

    test('boards the message does not mention stay, at the end, and unknown ones are ignored', () => {
        const state = reducer(initial, reorderCategoryBoards({categoryID: 'c1', boardOrder: ['c', 'not-here']}))
        expect(state.categoryAttributes[0]!.boardMetadata.map((m) => m.boardID)).toEqual(['c', 'a', 'b'])
    })

    test('other categories are untouched and an unknown category changes nothing', () => {
        const state = reducer(initial, reorderCategoryBoards({categoryID: 'c1', boardOrder: ['c', 'b', 'a']}))
        expect(state.categoryAttributes[1]).toBe(initial.categoryAttributes[1])
        expect(reducer(initial, reorderCategoryBoards({categoryID: 'nope', boardOrder: ['a']}))).toEqual(initial)
    })

    test('gives redux a new reference so the sidebar renders again', () => {
        const state = reducer(initial, reorderCategoryBoards({categoryID: 'c1', boardOrder: ['c', 'b', 'a']}))
        expect(state.categoryAttributes).not.toBe(initial.categoryAttributes)
        expect(state.categoryAttributes[0]).not.toBe(initial.categoryAttributes[0])
    })
})
