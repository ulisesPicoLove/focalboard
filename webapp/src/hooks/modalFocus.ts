// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useLayoutEffect} from 'react'

const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',')

// Focus handling for a modal overlay that cannot use the native <dialog>:
// - moves focus into the overlay when it opens (unless something inside already took it)
// - gives focus back to the element that opened it when it closes
// Returns a keydown handler for the overlay that keeps Tab and Shift+Tab inside it.
export function useModalFocus(containerRef: React.RefObject<HTMLElement>): (e: React.KeyboardEvent) => void {
    useLayoutEffect(() => {
        const opener = document.activeElement as HTMLElement | null
        const container = containerRef.current
        if (container && !container.contains(document.activeElement)) {
            container.focus()
        }
        return () => {
            if (opener && document.contains(opener) && typeof opener.focus === 'function') {
                opener.focus()
            }
        }
    }, [])

    return (e: React.KeyboardEvent) => {
        const container = containerRef.current
        if (e.key !== 'Tab' || !container) {
            return
        }

        // the innermost overlay handles Tab, so one nested in another does not fight it
        e.stopPropagation()

        const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        if (focusable.length === 0) {
            e.preventDefault()
            container.focus()
            return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === container)) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && active === last) {
            e.preventDefault()
            first.focus()
        }
    }
}
