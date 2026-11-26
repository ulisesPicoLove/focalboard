// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {configureStore} from '@reduxjs/toolkit'
import {mocked} from 'jest-mock'

import client from '../octoClient'

import {reducer, fetchClientConfig, getAuthMode} from './clientConfig'

jest.mock('../octoClient')
const mockedClient = mocked(client, true)

describe('store/clientConfig authMode', () => {
    const load = async (response: unknown) => {
        mockedClient.getClientConfig.mockResolvedValue(response as never)
        const store = configureStore({reducer: {clientConfig: reducer}})
        await store.dispatch(fetchClientConfig())
        return getAuthMode(store.getState() as never)
    }

    test('is unknown until the config is loaded', () => {
        const store = configureStore({reducer: {clientConfig: reducer}})

        expect(getAuthMode(store.getState() as never)).toBeUndefined()
    })

    test('uses the mode the server reports', async () => {
        expect(await load({telemetry: false, authMode: 'google'})).toBe('google')
        expect(await load({telemetry: false, authMode: 'native'})).toBe('native')
    })

    test('an older server that does not report a mode means password sign-in', async () => {
        expect(await load({telemetry: true, telemetryid: '', enablePublicSharedBoards: false, featureFlags: {}, maxFileSize: 0})).toBe('native')
    })

    test('a config that cannot be loaded means password sign-in', async () => {
        expect(await load(null)).toBe('native')
    })
})
