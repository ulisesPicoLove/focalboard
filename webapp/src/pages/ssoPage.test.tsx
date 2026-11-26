// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {Router} from 'react-router-dom'
import {createMemoryHistory, MemoryHistory} from 'history'
import {render, waitFor} from '@testing-library/react'
import thunk from 'redux-thunk'
import {mocked} from 'jest-mock'

import {mockStateStore} from '../testUtils'
import client from '../octoClient'

import SSOPage, {safeRedirectPath} from './ssoPage'

jest.mock('../octoClient')
const mockedClient = mocked(client, true)

describe('pages/ssoPage', () => {
    let history: MemoryHistory
    let tokenValue = ''

    const renderPage = () => {
        const store = mockStateStore([thunk], {users: {me: null, loggedIn: null}})
        return render(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SSOPage/>
                </Router>
            </ReduxProvider>,
        )
    }

    beforeEach(() => {
        jest.clearAllMocks()
        tokenValue = ''
        history = createMemoryHistory({initialEntries: ['/sso']})
        Object.defineProperty(mockedClient, 'token', {
            configurable: true,
            get: () => tokenValue,
            set: (value: string) => {
                tokenValue = value
            },
        })
        mockedClient.getMe.mockResolvedValue({id: 'user-1', username: 'ana'} as never)
        mockedClient.getMyConfig.mockResolvedValue({} as never)
        window.history.replaceState(null, '', '/sso')
    })

    afterEach(() => {
        window.history.replaceState(null, '', '/')
    })

    test('stores the token, removes it from the address bar and opens the requested page', async () => {
        window.history.replaceState(null, '', '/sso#token=session-token-123&r=%2Fteam%2F1%2Fboard-9%3Fview%3D2')

        renderPage()

        await waitFor(() => expect(history.location.pathname + history.location.search).toBe('/team/1/board-9?view=2'))
        expect(tokenValue).toBe('session-token-123')
        expect(window.location.hash).toBe('')
        expect(window.location.href).not.toContain('session-token-123')
    })

    test('goes to the login page with an error when there is no token', async () => {
        window.history.replaceState(null, '', '/sso#r=%2F')

        renderPage()

        await waitFor(() => expect(history.location.pathname + history.location.search).toBe('/login?error=sso_failed'))
        expect(tokenValue).toBe('')
        expect(mockedClient.getMe).not.toHaveBeenCalled()
    })

    test('goes to the login page and forgets the token when the server does not accept it', async () => {
        mockedClient.getMe.mockResolvedValue(undefined as never)
        window.history.replaceState(null, '', '/sso#token=rejected-token&r=%2F')

        renderPage()

        await waitFor(() => expect(history.location.pathname + history.location.search).toBe('/login?error=sso_failed'))
        expect(tokenValue).toBe('')
    })

    test('never redirects to another site', async () => {
        window.history.replaceState(null, '', '/sso#token=session-token-123&r=https%3A%2F%2Fevil.example%2F')

        renderPage()

        await waitFor(() => expect(history.location.pathname).toBe('/'))
        expect(history.location.pathname).not.toContain('evil')
    })

    test('safeRedirectPath keeps local paths only', () => {
        expect(safeRedirectPath('/team/1/board')).toBe('/team/1/board')
        expect(safeRedirectPath('/board?x=1#y')).toBe('/board?x=1#y')
        // eslint-disable-next-line no-script-url
        const scriptURL = 'javascript:alert(1)' // must be refused like any other non-local value
        for (const bad of [null, undefined, '', 'board', '//evil.example', 'https://evil.example', scriptURL, '/\\evil.example', '/a\nb', '/a\tb']) {
            expect(safeRedirectPath(bad)).toBe('/')
        }
    })
})
