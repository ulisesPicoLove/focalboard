// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import Switch from './switch'

describe('widgets/switch accessibility', () => {
    test('is a named switch that exposes its state', () => {
        render(
            <Switch
                isOn={true}
                ariaLabel='Notifications'
                onChanged={jest.fn()}
            />,
        )
        const sw = screen.getByRole('switch', {name: 'Notifications'})
        expect(sw).toHaveAttribute('aria-checked', 'true')
    })

    test('can be toggled with the keyboard', () => {
        const onChanged = jest.fn()
        render(
            <Switch
                isOn={false}
                ariaLabel='Notifications'
                onChanged={onChanged}
            />,
        )
        userEvent.tab()
        const sw = screen.getByRole('switch')
        expect(document.activeElement).toBe(sw)

        fireEvent.keyDown(sw, {key: 'Enter'})
        expect(onChanged).toBeCalledWith(true)

        fireEvent.keyDown(sw, {key: ' '})
        fireEvent.keyUp(sw, {key: ' '})
        expect(onChanged).toBeCalledTimes(2)
    })

    test('a read-only switch does not change', () => {
        const onChanged = jest.fn()
        render(
            <Switch
                isOn={false}
                readOnly={true}
                ariaLabel='Notifications'
                onChanged={onChanged}
            />,
        )
        const sw = screen.getByRole('switch')
        expect(sw).toHaveAttribute('aria-readonly', 'true')
        fireEvent.keyDown(sw, {key: 'Enter'})
        userEvent.click(sw)
        expect(onChanged).not.toBeCalled()
    })

    test('a decorative switch is hidden from assistive technology', () => {
        const {container} = render(
            <Switch
                decorative={true}
                isOn={true}
                onChanged={jest.fn()}
            />,
        )
        expect(screen.queryByRole('switch')).toBeNull()
        expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    })
})
