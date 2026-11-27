// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import mutator from './mutator'
import {TestBlockFactory} from './test/testBlockFactory'
import 'isomorphic-fetch'
import {FetchMock} from './test/fetchMock'
import {mockDOM} from './testUtils'
import undoManager from './undomanager'

global.fetch = FetchMock.fn

beforeEach(() => {
    FetchMock.fn.mockReset()
})

beforeAll(() => {
    mockDOM()
})

describe('Mutator', () => {
    test('changePropertyValue', async () => {
        const board = TestBlockFactory.createBoard()
        const card = TestBlockFactory.createCard()
        card.boardId = board.id
        card.fields.properties.property_1 = 'hello'

        await mutator.changePropertyValue(board.id, card, 'property_1', 'hello')

        // No API call should be made as property value DIDN'T CHANGE
        expect(FetchMock.fn).toBeCalledTimes(0)

        await mutator.changePropertyValue(board.id, card, 'property_1', 'hello world')

        // 1 API call should be made as property value DID CHANGE
        expect(FetchMock.fn).toBeCalledTimes(1)
    })

    test('duplicateCard', async () => {
        const board = TestBlockFactory.createBoard()
        const card = TestBlockFactory.createCard(board)

        FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify([card])))
        const [newBlocks, newCardID] = await mutator.duplicateCard(card.id, board.id)

        expect(newBlocks).toHaveLength(1)

        const duplicatedCard = newBlocks[0]
        expect(duplicatedCard.type).toBe('card')
        expect(duplicatedCard.id).toBe(newCardID)
        expect(duplicatedCard.fields.icon).toBe(card.fields.icon)
        expect(duplicatedCard.fields.contentOrder).toHaveLength(card.fields.contentOrder.length)
        expect(duplicatedCard.boardId).toBe(board.id)
    })

    test('undoing a duplicated card deletes the new card', async () => {
        undoManager.clear()
        const board = TestBlockFactory.createBoard()
        const card = TestBlockFactory.createCard(board)

        FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify([card])))
        const [, newCardID] = await mutator.duplicateCard(card.id, board.id)

        FetchMock.fn.mockClear()
        await undoManager.undo()

        // the card (not the whole list of blocks) is what gets deleted
        const deletes = FetchMock.fn.mock.calls.filter((call) => (call as unknown as [string, RequestInit])[1]?.method === 'DELETE')
        expect(deletes).toHaveLength(1)
        expect((deletes[0] as unknown as [string])[0]).toContain(`/boards/${board.id}/blocks/${newCardID}`)
    })

    test('duplicating a board the server did not create leaves nothing to undo', async () => {
        undoManager.clear()

        // an empty answer: no board came back
        FetchMock.fn.mockReturnValueOnce(Promise.resolve(new Response('', {status: 500})))
        const result = await mutator.duplicateBoard('board-id')
        expect(result).toBeUndefined()

        FetchMock.fn.mockClear()
        await expect(undoManager.undo()).resolves.not.toThrow()
        expect(FetchMock.fn).not.toBeCalled()
    })

    test('a change the server rejects is reported and not added to the undo history', async () => {
        const board = TestBlockFactory.createBoard()
        const card = TestBlockFactory.createCard(board)
        const edited = {...card, title: 'edited'}

        undoManager.clear()
        FetchMock.fn.mockReturnValueOnce(Promise.resolve(new Response('{}', {status: 403})))

        await expect(mutator.updateBlock(board.id, edited, card, 'rename')).rejects.toThrow('403')
        expect(undoManager.canUndo).toBe(false)
    })
})
