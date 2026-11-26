// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {MemoryRouter, Route} from 'react-router-dom'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {mockStateStore, wrapIntl} from '../testUtils'

import LoginPage from './loginPage'

describe('pages/loginPage', () => {
    const renderLogin = (authMode: string | undefined, url = '/login') => {
        const store = mockStateStore([], {
            users: {me: null, loggedIn: false},
            clientConfig: {value: {authMode}},
        })
        return render(wrapIntl(
            <ReduxProvider store={store}>
                <MemoryRouter initialEntries={[url]}>
                    <Route path='/login'><LoginPage/></Route>
                </MemoryRouter>
            </ReduxProvider>,
        ))
    }

    const assign = jest.fn()
    const realLocation = window.location

    beforeEach(() => {
        assign.mockClear()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {...realLocation, origin: 'http://boards.test', assign},
        })
    })

    afterEach(() => {
        Object.defineProperty(window, 'location', {configurable: true, value: realLocation})
    })

    test('with password sign-in it shows the form and no Google button', () => {
        renderLogin('native')

        expect(screen.getByPlaceholderText('Enter username')).not.toBeNull()
        expect(screen.getByPlaceholderText('Enter password')).not.toBeNull()
        expect(screen.queryByText('Sign in with Google')).toBeNull()
    })

    test('with Google sign-in it shows only the Google button', () => {
        renderLogin('google')

        expect(screen.getByRole('button', {name: /Sign in with Google/})).not.toBeNull()
        expect(screen.queryByPlaceholderText('Enter username')).toBeNull()
        expect(screen.queryByPlaceholderText('Enter password')).toBeNull()
        expect(screen.queryByText(/create an account/)).toBeNull()
    })

    test('the Google button goes to the server route, keeping the page to return to', () => {
        renderLogin('google', '/login?r=%2Fteam%2F1%2Fboard-9')

        userEvent.click(screen.getByRole('button', {name: /Sign in with Google/}))

        expect(assign).toHaveBeenCalledTimes(1)
        expect(assign).toHaveBeenCalledWith('http://boards.test/oauth/google/login?r=%2Fteam%2F1%2Fboard-9')
    })

    test('the Google button works without a return page', () => {
        renderLogin('google')

        userEvent.click(screen.getByRole('button', {name: /Sign in with Google/}))

        expect(assign).toHaveBeenCalledWith('http://boards.test/oauth/google/login')
    })

    test.each([
        ['sso_domain', /not allowed here/],
        ['sso_denied', /cancelled/],
        ['sso_unverified', /not verified/],
        ['sso_expired', /expired/],
        ['sso_unavailable', /not available/],
        ['sso_failed', /Sign-in failed/],
        ['sso_something_new', /Sign-in failed/],
    ])('shows a message for %s', (code, message) => {
        renderLogin('google', `/login?error=${code}`)

        expect(screen.getByRole('alert').textContent).toMatch(message)
    })

    test('shows no error when there is none', () => {
        renderLogin('google')

        expect(screen.queryByRole('alert')).toBeNull()
    })

    test('shows nothing until the sign-in mode is known', () => {
        const {container} = renderLogin(undefined)

        expect(container.innerHTML).toBe('')
    })
})
