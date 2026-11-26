// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

const OPTION = '.menu-option'

// The mobile-only "Cancel" option is hidden by CSS on wide screens (see menu.scss), so it cannot take the focus there
function hiddenOnThisScreen(option: Element): boolean {
    return Boolean(option.closest('.hideOnWidescreen')) && typeof window.matchMedia === 'function' && window.matchMedia('not screen and (max-width: 430px)').matches
}

// The options of one menu level (a submenu is its own level)
function levelOptions(level: Element): HTMLElement[] {
    return Array.from(level.querySelectorAll<HTMLElement>(OPTION)).filter((option) => (
        option.closest('.Menu') === level && option.tabIndex >= 0 && option.getAttribute('aria-disabled') !== 'true' && !hiddenOnThisScreen(option)
    ))
}

export function focusFirstOption(root: Element | null): void {
    const menu = root?.querySelector('.Menu')
    if (menu) {
        levelOptions(menu)[0]?.focus()
    }
}

// Arrow keys, Home and End move between the options; Right opens a submenu and
// Left closes it. Text fields keep their own keys.
export function menuKeyDown(e: React.KeyboardEvent): void {
    const target = e.target as HTMLElement
    if (target.matches('input, textarea, select')) {
        return
    }
    const level = target.closest('.Menu')
    if (!level) {
        return
    }

    const options = levelOptions(level)
    const current = options.indexOf(target.closest<HTMLElement>(OPTION) as HTMLElement)

    let next: HTMLElement | undefined
    switch (e.key) {
    case 'ArrowDown':
        next = options[(current + 1) % options.length]
        break
    case 'ArrowUp':
        next = options[current <= 0 ? options.length - 1 : current - 1]
        break
    case 'Home':
        next = options[0]
        break
    case 'End':
        next = options[options.length - 1]
        break
    case 'ArrowRight': {
        const option = target.closest<HTMLElement>(OPTION)
        if (option && option === target && option.getAttribute('aria-haspopup') === 'true' && option.getAttribute('aria-expanded') !== 'true') {
            e.preventDefault()
            e.stopPropagation()
            option.click()
            setTimeout(() => {
                const submenu = option.querySelector('.Menu')
                if (submenu) {
                    levelOptions(submenu)[0]?.focus()
                }
            }, 0)
        }
        return
    }
    case 'ArrowLeft': {
        const parent = level.closest<HTMLElement>('.SubMenuOption')
        if (parent) {
            e.preventDefault()
            e.stopPropagation()
            parent.click()
            parent.focus()
        }
        return
    }
    default:
        return
    }

    if (next) {
        e.preventDefault()
        e.stopPropagation()
        next.focus()
    }
}
