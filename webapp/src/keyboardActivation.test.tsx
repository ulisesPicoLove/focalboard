// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {keyboardActivation} from './keyboardActivation'

describe('keyboardActivation', () => {
    const setup = () => {
        const onActivate = jest.fn()
        render(
            <div
                role='button'
                aria-label='outer'
                {...keyboardActivation(onActivate)}
            >
                <input aria-label='inner'/>
            </div>,
        )
        return {onActivate, outer: screen.getByRole('button', {name: 'outer'})}
    }

    test('makes the element focusable', () => {
        const {outer} = setup()
        userEvent.tab()
        expect(document.activeElement).toBe(outer)
    })

    test('runs on Enter keydown', () => {
        const {onActivate, outer} = setup()
        fireEvent.keyDown(outer, {key: 'Enter'})
        expect(onActivate).toBeCalledTimes(1)
    })

    test('runs on Space keyup, not on keydown', () => {
        const {onActivate, outer} = setup()
        fireEvent.keyDown(outer, {key: ' '})
        expect(onActivate).not.toBeCalled()
        fireEvent.keyUp(outer, {key: ' '})
        expect(onActivate).toBeCalledTimes(1)
    })

    test('ignores other keys and keys pressed on children', () => {
        const {onActivate, outer} = setup()
        fireEvent.keyDown(outer, {key: 'a'})
        const inner = screen.getByLabelText('inner')
        fireEvent.keyDown(inner, {key: 'Enter'})
        fireEvent.keyUp(inner, {key: ' '})
        expect(onActivate).not.toBeCalled()
    })
})
