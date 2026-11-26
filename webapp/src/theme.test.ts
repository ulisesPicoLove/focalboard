// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    darkTheme,
    defaultTheme,
    getActiveThemeName,
    loadTheme,
    picoTheme,
    picoThemeName,
    setTheme,
    systemThemeName,
    initThemes,
} from './theme'

function mockPrefersDark(dark: boolean) {
    window.matchMedia = jest.fn().mockImplementation(() => ({
        matches: dark,
        addEventListener: jest.fn(),
        addListener: jest.fn(),
    }))
}

describe('theme loading', () => {
    beforeEach(() => {
        localStorage.clear()
        mockPrefersDark(false)
    })

    test('with nothing saved, Pico.Love OS is the default and is not saved as a choice', () => {
        const theme = loadTheme()

        expect(theme).toEqual(picoTheme)
        expect(getActiveThemeName()).toBe(picoThemeName)
        expect(localStorage.getItem('theme')).toBeNull()
        expect(document.documentElement.style.getPropertyValue('--button-bg-rgb')).toBe(picoTheme.buttonBg)
    })

    test('"System theme" is kept across reloads and follows the OS', () => {
        setTheme(null)
        expect(localStorage.getItem('theme')).toBe('')
        expect(getActiveThemeName()).toBe(systemThemeName)

        expect(loadTheme()).toEqual(defaultTheme)

        mockPrefersDark(true)
        expect(loadTheme()).toEqual({...defaultTheme, ...darkTheme})
        expect(getActiveThemeName()).toBe(systemThemeName)
    })

    test('a saved theme wins over the default', () => {
        setTheme(defaultTheme)
        expect(loadTheme()).toEqual(defaultTheme)
        expect(document.documentElement.style.getPropertyValue('--button-bg-rgb')).toBe(defaultTheme.buttonBg)
    })

    test('an OS colour-scheme change does not replace the default theme', () => {
        let handler: () => void = () => {}
        window.matchMedia = jest.fn().mockImplementation(() => ({
            matches: false,
            addEventListener: (_: string, h: () => void) => {
                handler = h
            },
        }))

        initThemes()
        handler()

        expect(localStorage.getItem('theme')).toBeNull()
        expect(document.documentElement.style.getPropertyValue('--button-bg-rgb')).toBe(picoTheme.buttonBg)
    })
})
