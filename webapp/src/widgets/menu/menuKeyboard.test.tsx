// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import {wrapIntl} from '../../testUtils'

import Menu from '.'

describe('widgets/menu keyboard support', () => {
    test('a text option can be reached with Tab and run with Enter or Space', () => {
        const onClick = jest.fn()
        render(wrapIntl(
            <Menu>
                <Menu.Text
                    id='first'
                    name='First'
                    onClick={onClick}
                />
            </Menu>,
        ))

        userEvent.tab()
        const option = screen.getByRole('button', {name: 'First'})
        expect(document.activeElement).toBe(option)

        fireEvent.keyDown(option, {key: 'Enter'})
        expect(onClick).toBeCalledTimes(1)
        expect(onClick).toBeCalledWith('first')

        fireEvent.keyDown(option, {key: ' '})
        fireEvent.keyUp(option, {key: ' '})
        expect(onClick).toBeCalledTimes(2)
    })

    test('a switch option exposes its state and toggles from the keyboard', () => {
        const onClick = jest.fn()
        render(wrapIntl(
            <Menu>
                <Menu.Switch
                    id='sw'
                    name='Show it'
                    isOn={true}
                    onClick={onClick}
                />
            </Menu>,
        ))
        const option = screen.getByRole('button', {name: 'Show it'})
        expect(option).toHaveAttribute('aria-pressed', 'true')
        fireEvent.keyDown(option, {key: 'Enter'})
        expect(onClick).toBeCalledWith('sw')
    })

    test('a submenu opens from the keyboard and reports its state', () => {
        render(wrapIntl(
            <Menu>
                <Menu.SubMenu
                    id='sub'
                    name='More'
                >
                    <Menu.Text
                        id='inner'
                        name='Inner'
                        onClick={jest.fn()}
                    />
                </Menu.SubMenu>
            </Menu>,
        ))
        const trigger = screen.getByRole('button', {name: 'More'})
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('button', {name: 'Inner'})).toBeNull()

        fireEvent.keyDown(trigger, {key: 'Enter'})
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('button', {name: 'Inner'})).toBeInTheDocument()
    })

    test('a disabled text option says so to assistive technology', () => {
        render(wrapIntl(
            <Menu>
                <Menu.Text
                    id='off'
                    name='Off'
                    disabled={true}
                    onClick={jest.fn()}
                />
            </Menu>,
        ))
        expect(screen.getByRole('button', {name: 'Off'})).toHaveAttribute('aria-disabled', 'true')
    })
})

describe('widgets/menu arrow keys', () => {
    beforeAll(() => {
        // a wide screen: the mobile Cancel option is hidden
        window.matchMedia = ((query: string) => ({matches: query.startsWith('not screen')})) as unknown as typeof window.matchMedia
    })

    const renderMenu = () => render(wrapIntl(
        <Menu>
            <Menu.Text
                id='a'
                name='Alpha'
                onClick={jest.fn()}
            />
            <Menu.Text
                id='b'
                name='Beta'
                disabled={true}
                onClick={jest.fn()}
            />
            <Menu.Text
                id='c'
                name='Gamma'
                onClick={jest.fn()}
            />
            <Menu.SubMenu
                id='sub'
                name='More'
            >
                <Menu.Text
                    id='inner1'
                    name='Inner one'
                    onClick={jest.fn()}
                />
                <Menu.Text
                    id='inner2'
                    name='Inner two'
                    onClick={jest.fn()}
                />
            </Menu.SubMenu>
        </Menu>,
    ))

    test('Down and Up move between options and wrap around', () => {
        renderMenu()
        const alpha = screen.getByRole('button', {name: 'Alpha'})
        alpha.focus()
        fireEvent.keyDown(alpha, {key: 'ArrowDown'})
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Gamma'}))
        fireEvent.keyDown(document.activeElement!, {key: 'ArrowDown'})
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'More'}))
        fireEvent.keyDown(document.activeElement!, {key: 'ArrowDown'})
        expect(document.activeElement).toBe(alpha)
        fireEvent.keyDown(alpha, {key: 'ArrowUp'})
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'More'}))
    })

    test('Home and End jump to the first and last option', () => {
        renderMenu()
        const gamma = screen.getByRole('button', {name: 'Gamma'})
        gamma.focus()
        fireEvent.keyDown(gamma, {key: 'End'})
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'More'}))
        fireEvent.keyDown(document.activeElement!, {key: 'Home'})
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Alpha'}))
    })

    test('Right opens a submenu and Left closes it, returning to the parent', async () => {
        renderMenu()
        const more = screen.getByRole('button', {name: 'More'})
        more.focus()
        fireEvent.keyDown(more, {key: 'ArrowRight'})
        expect(more).toHaveAttribute('aria-expanded', 'true')
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Inner one'})))

        fireEvent.keyDown(document.activeElement!, {key: 'ArrowDown'})
        expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Inner two'}))

        fireEvent.keyDown(document.activeElement!, {key: 'ArrowLeft'})
        expect(more).toHaveAttribute('aria-expanded', 'false')
        expect(document.activeElement).toBe(more)
    })
})
