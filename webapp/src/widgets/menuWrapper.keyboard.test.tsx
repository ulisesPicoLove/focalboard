// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {wrapIntl} from '../testUtils'

import Menu from './menu'
import MenuWrapper from './menuWrapper'

describe('widgets/menuWrapper keyboard', () => {
    const renderWrapper = () => render(wrapIntl(
        <MenuWrapper>
            <button>{'Open'}</button>
            <Menu>
                <Menu.Text
                    id='a'
                    name='Alpha'
                    onClick={jest.fn()}
                />
                <Menu.Text
                    id='b'
                    name='Beta'
                    onClick={jest.fn()}
                />
            </Menu>
        </MenuWrapper>,
    ))

    test('opening with the keyboard moves the focus to the first option', () => {
        renderWrapper()
        const trigger = screen.getByText('Open')
        trigger.focus()

        // a click without detail is what Enter or Space on a button produces
        fireEvent.click(trigger, {detail: 0})
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Alpha'}))
    })

    test('opening with the mouse leaves the focus alone', () => {
        renderWrapper()
        userEvent.click(screen.getByText('Open'))
        expect(screen.getByRole('button', {name: 'Alpha'})).toBeDefined()
        expect(document.activeElement).not.toBe(screen.getByRole('button', {name: 'Alpha'}))
    })

    test('Escape closes the menu and returns the focus to the trigger', () => {
        renderWrapper()
        const trigger = screen.getByText('Open')
        fireEvent.click(trigger, {detail: 0})
        fireEvent.keyUp(document.activeElement!, {key: 'Escape'})
        expect(screen.queryByRole('button', {name: 'Alpha'})).toBeNull()
        expect(document.activeElement).toBe(trigger)
    })
})
