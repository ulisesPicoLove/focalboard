// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {MemoryRouter, Route} from 'react-router-dom'
import {render, screen} from '@testing-library/react'

import {mockStateStore, wrapIntl} from '../testUtils'

import RegisterPage from './registerPage'

describe('pages/registerPage', () => {
    const renderRegister = (authMode: string) => {
        const store = mockStateStore([], {
            users: {me: null, loggedIn: false},
            clientConfig: {value: {authMode}},
        })
        return render(wrapIntl(
            <ReduxProvider store={store}>
                <MemoryRouter initialEntries={['/register']}>
                    <Route path='/register'><RegisterPage/></Route>
                    <Route path='/login'><div>{'login page'}</div></Route>
                </MemoryRouter>
            </ReduxProvider>,
        ))
    }

    test('with password sign-in it shows the registration form', () => {
        renderRegister('native')

        expect(screen.queryByText('login page')).toBeNull()
        expect(screen.queryByPlaceholderText('Enter password')).not.toBeNull()
    })

    test('with Google sign-in there is nothing to register: it goes to the login page', () => {
        renderRegister('google')

        expect(screen.queryByText('login page')).not.toBeNull()
        expect(screen.queryByPlaceholderText('Enter password')).toBeNull()
    })
})
