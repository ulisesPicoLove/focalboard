// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

// An action started by a click or by Enter/Space on a focused element
export type ActivationEvent = React.MouseEvent | React.KeyboardEvent

// Props that let a non-native element (a div with an onClick) be reached and
// operated with the keyboard, like a <button>: it becomes focusable, Enter runs
// the action on keydown and Space runs it on keyup. Prefer a real <button>
// whenever the markup allows it; use this where the element has to stay a div.
//
// Keys pressed on children (inputs, nested buttons) are ignored, so only the
// element itself reacts.
export function keyboardActivation<T extends HTMLElement = HTMLElement>(onActivate: (e: React.KeyboardEvent<T>) => void) {
    return {
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent<T>) => {
            if (e.target !== e.currentTarget) {
                return
            }
            if (e.key === 'Enter') {
                e.preventDefault()
                onActivate(e)
            } else if (e.key === ' ') {
                // keep the page from scrolling; the action runs on keyup
                e.preventDefault()
            }
        },
        onKeyUp: (e: React.KeyboardEvent<T>) => {
            if (e.target === e.currentTarget && e.key === ' ') {
                onActivate(e)
            }
        },
    }
}
