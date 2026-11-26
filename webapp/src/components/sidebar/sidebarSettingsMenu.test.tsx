// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render, act} from '@testing-library/react'

import userEvent from '@testing-library/user-event'
import configureStore from 'redux-mock-store'

import {wrapIntl} from '../../testUtils'

import {defaultThemeName} from '../../theme'

import SidebarSettingsMenu from './sidebarSettingsMenu'

describe('components/sidebar/SidebarSettingsMenu', () => {
    const mockStore = configureStore([])
    let store = mockStore({})
    beforeEach(() => {
        store = mockStore({
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: 'board_id',
                boards: {
                    board_id: {id: 'board_id'},
                },
                templates: [],
                myBoardMemberships: {
                    board_id: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
        })
    })
    test('settings menu closed should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <SidebarSettingsMenu activeTheme={defaultThemeName}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('settings menu open should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <SidebarSettingsMenu activeTheme={defaultThemeName}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        userEvent.click(container.querySelector('.menu-entry') as Element)
        expect(container).toMatchSnapshot()
    })

    test('theme menu open should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <SidebarSettingsMenu activeTheme={defaultThemeName}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        act(() => {
            userEvent.click(container.querySelector('.menu-entry') as Element)
        })
        act(() => {
            userEvent.hover(container.querySelector('#theme') as Element)
        })
        expect(container).toMatchSnapshot()
    })

    test('languages menu open should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <SidebarSettingsMenu activeTheme={defaultThemeName}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        act(() => {
            userEvent.click(container.querySelector('.menu-entry') as Element)
        })
        act(() => {
            userEvent.hover(container.querySelector('#lang') as Element)
        })
        expect(container).toMatchSnapshot()
    })

    test('imports menu open should match snapshot', () => {
        window.open = jest.fn()
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <SidebarSettingsMenu activeTheme={defaultThemeName}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        act(() => {
            userEvent.click(container.querySelector('.menu-entry') as Element)
        })
        act(() => {
            userEvent.hover(container.querySelector('#import') as Element)
        })
        expect(container).toMatchSnapshot()

        userEvent.click(container.querySelector('[aria-label="Asana"]') as Element)
    })
})
