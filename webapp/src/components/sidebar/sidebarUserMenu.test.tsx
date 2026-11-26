// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {MemoryRouter} from 'react-router-dom'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {mockStateStore, wrapIntl} from '../../testUtils'

import SidebarUserMenu from './sidebarUserMenu'

describe('components/sidebar/SidebarUserMenu', () => {
    const renderMenu = (authMode: string | undefined) => {
        const store = mockStateStore([], {
            users: {me: {id: 'user-1', username: 'ana'}, loggedIn: true},
            clientConfig: {value: {authMode}},
        })
        render(wrapIntl(
            <ReduxProvider store={store}>
                <MemoryRouter>
                    <SidebarUserMenu/>
                </MemoryRouter>
            </ReduxProvider>,
        ))
        userEvent.click(screen.getByText('Picoboard'))
    }

    test('with password sign-in it offers to change the password and invite users', () => {
        renderMenu('native')

        expect(screen.queryByText('Log out')).not.toBeNull()
        expect(screen.queryByText('Change password')).not.toBeNull()
        expect(screen.queryByText('Invite users')).not.toBeNull()
    })

    test('with Google sign-in there is no password to change and no invitations', () => {
        renderMenu('google')

        expect(screen.queryByText('Log out')).not.toBeNull()
        expect(screen.queryByText('Change password')).toBeNull()
        expect(screen.queryByText('Invite users')).toBeNull()
    })

    test('keeps the password entries while the sign-in mode is not known yet', () => {
        renderMenu(undefined)

        expect(screen.queryByText('Change password')).not.toBeNull()
    })
})
