// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import {wrapIntl} from '../testUtils'

import Dialog from './dialog'
import {FlashMessages, sendFlashMessage} from './flashMessages'

const Opener = () => {
    const [open, setOpen] = useState(false)
    return (
        <>
            <button onClick={() => setOpen(true)}>{'Open it'}</button>
            {open &&
                <Dialog
                    title={<span>{'My dialog'}</span>}
                    onClose={() => setOpen(false)}
                >
                    <button>{'First'}</button>
                    <button>{'Last'}</button>
                </Dialog>}
        </>
    )
}

describe('components/dialog accessibility', () => {
    test('is a modal dialog named by its title', () => {
        render(wrapIntl(<Opener/>))
        userEvent.click(screen.getByText('Open it'))
        const dialog = screen.getByRole('dialog', {name: 'My dialog'})
        expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    test('moves focus into the dialog and gives it back when closed', () => {
        render(wrapIntl(<Opener/>))
        const opener = screen.getByText('Open it')
        opener.focus()
        userEvent.click(opener)

        const dialog = screen.getByRole('dialog')
        expect(dialog.contains(document.activeElement)).toBe(true)

        userEvent.click(screen.getByRole('button', {name: 'Close dialog'}))
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(document.activeElement).toBe(opener)
    })

    test('keeps Tab and Shift+Tab inside the dialog', () => {
        render(wrapIntl(<Opener/>))
        userEvent.click(screen.getByText('Open it'))
        const dialog = screen.getByRole('dialog')
        const last = screen.getByRole('button', {name: 'Last'})
        const closeButton = screen.getByRole('button', {name: 'Close dialog'})

        last.focus()
        fireEvent.keyDown(last, {key: 'Tab'})
        expect(dialog.contains(document.activeElement)).toBe(true)
        expect(document.activeElement).not.toBe(last)

        // Shift+Tab on the container itself goes to the last control
        dialog.focus()
        fireEvent.keyDown(dialog, {key: 'Tab', shiftKey: true})
        expect(document.activeElement).toBe(last)
        expect(closeButton).toBeInTheDocument()
    })
})

describe('components/flashMessages accessibility', () => {
    test('announces messages in a live region that is already in the page', () => {
        jest.useFakeTimers()
        render(<FlashMessages milliseconds={2000}/>)
        const region = screen.getByRole('status')
        expect(region).toHaveAttribute('aria-live', 'polite')
        expect(region).toBeEmptyDOMElement()

        act(() => {
            sendFlashMessage({content: 'Saved', severity: 'low'})
        })
        expect(region).toHaveTextContent('Saved')
        jest.useRealTimers()
    })

    test('interrupts the user for high severity messages', () => {
        jest.useFakeTimers()
        render(<FlashMessages milliseconds={2000}/>)
        act(() => {
            sendFlashMessage({content: 'It failed', severity: 'high'})
        })
        const alert = screen.getByRole('alert')
        expect(alert).toHaveAttribute('aria-live', 'assertive')
        expect(alert).toHaveTextContent('It failed')
        jest.useRealTimers()
    })
})
