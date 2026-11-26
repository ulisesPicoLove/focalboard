// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {loadMessages} from './i18n'

describe('i18n', () => {
    test('loads the messages of a supported language', async () => {
        const messages = await loadMessages('es')
        expect(Object.keys(messages).length).toBeGreaterThan(100)
    })

    test('loads languages whose file name differs from the code', async () => {
        expect(Object.keys(await loadMessages('pt-br')).length).toBeGreaterThan(0)
        expect(Object.keys(await loadMessages('zh-cn')).length).toBeGreaterThan(0)
    })

    test('English and unknown languages use the defaults in the code', async () => {
        expect(await loadMessages('en')).toEqual({})
        expect(await loadMessages('xx')).toEqual({})
    })
})
