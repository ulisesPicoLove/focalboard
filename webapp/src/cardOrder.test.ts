// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {moveCardAmong} from './cardOrder'

describe('moveCardAmong', () => {
    const order = ['a', 'b', 'c', 'd']

    test('moves a card before its previous neighbour', () => {
        expect(moveCardAmong(order, order, 'c', -1)).toEqual(['a', 'c', 'b', 'd'])
    })

    test('moves a card after its next neighbour', () => {
        expect(moveCardAmong(order, order, 'b', 1)).toEqual(['a', 'c', 'b', 'd'])
    })

    test('has nothing to do at the ends', () => {
        expect(moveCardAmong(order, order, 'a', -1)).toBeUndefined()
        expect(moveCardAmong(order, order, 'd', 1)).toBeUndefined()
    })

    test('only the cards that are shown together are neighbours', () => {
        // a column that shows b and d: moving d back goes before b, past the card c of another column
        expect(moveCardAmong(order, ['b', 'd'], 'd', -1)).toEqual(['a', 'd', 'b', 'c'])
        expect(moveCardAmong(order, ['b', 'd'], 'b', 1)).toEqual(['a', 'c', 'd', 'b'])
    })

    test('cards missing from the saved order are placed after the saved ones', () => {
        expect(moveCardAmong(['a'], ['a', 'x', 'y'], 'y', -1)).toEqual(['a', 'y', 'x'])
    })

    test('a card that is not shown can not be moved', () => {
        expect(moveCardAmong(order, ['a', 'b'], 'c', -1)).toBeUndefined()
    })
})
