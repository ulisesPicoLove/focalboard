// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CategoryBoardMetadata, CategoryBoards} from '../../store/sidebar'

import {displayedBoardIDs, insertIntoCategory, reorderWithinCategory} from './categoryBoardsOrder'

const meta = (...items: Array<string | [string, boolean]>): CategoryBoardMetadata[] => items.map((item) => (
    Array.isArray(item) ? {boardID: item[0], hidden: item[1]} : {boardID: item, hidden: false}
))
const ids = (m: CategoryBoardMetadata[]) => m.map((e) => e.boardID)

describe('sidebar/categoryBoardsOrder', () => {
    // 'hidden' is hidden by the person, 'tpl' is a template and 'ghost' is not in the store
    const boards = [{id: 'a'}, {id: 'b'}, {id: 'c'}, {id: 'hidden'}, {id: 'tpl', isTemplate: true}]
    const category = {boardMetadata: meta(['hidden', true], 'ghost', 'a', 'tpl', 'b', 'c')} as CategoryBoards

    test('displayed boards skip hidden ones, templates and boards not in the store', () => {
        expect(displayedBoardIDs(category, boards)).toEqual(['a', 'b', 'c'])
    })

    test('moving the second visible board above the first moves the right boards', () => {
        const displayed = displayedBoardIDs(category, boards)

        // the person drags "b" (index 1) to the top (index 0). The old code spliced
        // boardMetadata[1] ("ghost") instead, and the server sent the wrong order back.
        const result = reorderWithinCategory(category.boardMetadata, displayed, 1, 0)
        expect(displayedBoardIDs({boardMetadata: result} as CategoryBoards, boards)).toEqual(['b', 'a', 'c'])
    })

    test('entries that are not displayed keep their slot and nothing is lost', () => {
        const displayed = displayedBoardIDs(category, boards)
        const result = reorderWithinCategory(category.boardMetadata, displayed, 0, 2)
        expect(ids(result)).toEqual(['hidden', 'ghost', 'b', 'tpl', 'c', 'a'])
        expect([...ids(result)].sort()).toEqual([...ids(category.boardMetadata)].sort())
        expect(result.find((e) => e.boardID === 'hidden')?.hidden).toBe(true)
    })

    test('with everything displayed it is a plain move', () => {
        const plain = meta('a', 'b', 'c')
        expect(ids(reorderWithinCategory(plain, ['a', 'b', 'c'], 2, 0))).toEqual(['c', 'a', 'b'])
        expect(ids(reorderWithinCategory(plain, ['a', 'b', 'c'], 0, 2))).toEqual(['b', 'c', 'a'])
    })

    test('a bad source index changes nothing', () => {
        const plain = meta('a', 'b')
        expect(reorderWithinCategory(plain, ['a', 'b'], 5, 0)).toBe(plain)
    })

    test('inserting into another category goes before the board shown at that position', () => {
        const target = meta(['h', true], 'x', 'y')
        const entry = {boardID: 'new', hidden: false}
        expect(ids(insertIntoCategory(target, ['x', 'y'], entry, 1))).toEqual(['h', 'x', 'new', 'y'])
        expect(ids(insertIntoCategory(target, ['x', 'y'], entry, 0))).toEqual(['h', 'new', 'x', 'y'])
    })

    test('inserting past the last displayed board, or into an empty category, appends', () => {
        const entry = {boardID: 'new', hidden: false}
        expect(ids(insertIntoCategory(meta('x', 'y'), ['x', 'y'], entry, 2))).toEqual(['x', 'y', 'new'])
        expect(ids(insertIntoCategory([], [], entry, 0))).toEqual(['new'])
    })
})
