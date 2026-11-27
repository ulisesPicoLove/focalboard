// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {changedEntries, changedProperties} from './changedProperties'

describe('changedProperties', () => {
    const from = {id: 'a', title: 'old', count: 1, fields: {x: 1}}

    test('returns only what changed, with the new value', () => {
        expect(changedProperties(from, {...from, title: 'new', count: 1})).toEqual({title: 'new'})
    })

    test('nothing changed gives an empty object', () => {
        expect(changedProperties(from, {...from})).toEqual({})
    })

    test('leaves out the ignored keys even when they changed', () => {
        const to = {...from, title: 'new', fields: {x: 2}}
        expect(changedProperties(from, to, ['fields'])).toEqual({title: 'new'})
    })

    test('compares objects by reference', () => {
        const same = {...from}
        expect(changedProperties(from, same)).toEqual({})
        expect(changedProperties(from, {...from, fields: {x: 1}})).toEqual({fields: {x: 1}})
    })
})

describe('changedEntries', () => {
    test('returns the entries whose value changed, or are new', () => {
        expect(changedEntries({a: '1', b: '2'}, {a: '1', b: '3', c: '4'})).toEqual({b: '3', c: '4'})
    })

    test('an entry removed from `to` is not reported (that is what deleted lists are for)', () => {
        expect(changedEntries({a: '1', b: '2'}, {a: '1'})).toEqual({})
    })
})
