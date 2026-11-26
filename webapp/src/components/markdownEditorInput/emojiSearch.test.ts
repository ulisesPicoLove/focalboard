// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {searchEmojis} from './emojiSearch'

describe('emojiSearch', () => {
    test('finds emojis by the start of their short name', async () => {
        const results = await searchEmojis('smile')
        expect(results.length).toBeGreaterThan(0)
        expect(results[0].id.startsWith('smile')).toBe(true)
        expect(results[0].native).toMatch(/\p{Emoji}/u)
    })

    test('builds the native character from the code points', async () => {
        const [hundred] = await searchEmojis('100')
        expect(hundred.native).toBe('💯')
    })

    test('an empty search finds nothing and the list is limited', async () => {
        expect(await searchEmojis('')).toEqual([])
        expect((await searchEmojis('a', 5)).length).toBeLessThanOrEqual(5)
    })
})
