// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CSSObject} from '@emotion/serialize'
import isEqual from 'lodash/isEqual'

let activeThemeName: string

import {UserSettings} from './userSettings'

export type Theme = {
    mainBg: string
    mainFg: string
    buttonBg: string
    buttonFg: string
    sidebarBg: string
    sidebarFg: string
    sidebarTextActiveBorder: string
    sidebarWhiteLogo: string

    link: string
    linkVisited: string

    propDefault: string
    propGray: string
    propBrown: string
    propOrange: string
    propYellow: string
    propGreen: string
    propBlue: string
    propPurple: string
    propPink: string
    propRed: string
}

export const systemThemeName = 'system-theme'

export const defaultThemeName = 'default-theme'

export const defaultTheme = {
    mainBg: '255, 255, 255',
    mainFg: '63, 67, 80',
    buttonBg: '28, 88, 217',
    buttonFg: '255, 255, 255',
    sidebarBg: '30, 50, 92',
    sidebarFg: '255, 255, 255',
    sidebarTextActiveBorder: '93, 137, 243',
    sidebarWhiteLogo: 'true',

    link: '93, 137, 234',
    linkVisited: '#551a8b',

    propDefault: '#fff',
    propGray: '#EDEDED',
    propBrown: '#F7DDC3',
    propOrange: '#ffd3c1',
    propYellow: '#f7f0b6',
    propGreen: '#c7eac3',
    propBlue: '#B1D1F6',
    propPurple: '#e6d0ff',
    propPink: '#ffd6e9',
    propRed: '#ffa9a9',
}

export const darkThemeName = 'dark-theme'

export const darkTheme = {
    ...defaultTheme,

    mainBg: '55, 53, 47',
    mainFg: '220, 220, 220',
    buttonBg: '80, 170, 221',

    // dark text: white on this light blue is only 2.6:1, this is 7.1:1
    buttonFg: '20, 20, 25',
    sidebarBg: '75, 73, 67',
    sidebarFg: '255, 255, 255',
    sidebarTextActiveBorder: '102, 185, 167',
    sidebarWhiteLogo: 'true',

    link: '#0090ff',
    linkVisited: 'hsla(270, 68%, 70%, 1.0)',

    propDefault: 'hsla(0, 100%, 100%, 0.08)',
    propGray: 'hsla(0, 0%, 70%, 0.4)',
    propBrown: 'hsla(25, 60%, 40%, 0.4)',
    propOrange: 'hsla(35, 100%, 50%, 0.4)',
    propYellow: 'hsla(48, 100%, 70%, 0.4)',
    propGreen: 'hsla(120, 100%, 70%, 0.4)',
    propBlue: 'hsla(240, 100%, 70%, 0.4)',
    propPurple: 'hsla(270, 100%, 64%, 0.4)',
    propPink: 'hsla(310, 100%, 80%, 0.4)',
    propRed: 'hsla(4, 100%, 70%, 0.4)',
}

export const picoThemeName = 'pico-theme'

// Pico.Love OS design system (dark only): void ground, mint accent.
export const picoTheme = {
    ...darkTheme,

    mainBg: '10, 9, 12', // void
    mainFg: '233, 235, 238', // ink
    buttonBg: '172, 251, 221', // mint
    buttonFg: '7, 7, 10', // on-mint
    sidebarBg: '15, 18, 22', // surface
    sidebarFg: '233, 235, 238', // ink
    sidebarTextActiveBorder: '172, 251, 221', // mint
    sidebarWhiteLogo: 'true',

    link: '168, 216, 240', // sky
    linkVisited: '#92d5bf', // mint-label
}

export const lightThemeName = 'light-theme'

export const lightTheme = {
    ...defaultTheme,

    mainBg: '255, 255, 255',
    mainFg: '55, 53, 47',

    // 5.4:1 against white, both as a button background and as text on the white page (the old 80, 170, 221 was 2.6:1)
    buttonBg: '0, 111, 170',
    buttonFg: '255, 255, 255',
    sidebarBg: '247, 246, 243',
    sidebarFg: '55, 53, 47',
    sidebarTextActiveBorder: '87, 158, 255',
    sidebarWhiteLogo: 'false',
}

// True when an 'r, g, b' string is closer to black than to white.
function isDarkRgb(rgb: string): boolean {
    const [r, g, b] = rgb.split(',').map((v) => parseInt(v.trim(), 10))
    return ((0.299 * r) + (0.587 * g) + (0.114 * b)) < 128
}

export function setTheme(theme: Theme | null): Theme {
    let consolidatedTheme = defaultTheme
    if (theme) {
        consolidatedTheme = {...defaultTheme, ...theme}
        UserSettings.theme = JSON.stringify(consolidatedTheme)
    } else {
        UserSettings.theme = ''
        const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
        if (darkThemeMq.matches) {
            consolidatedTheme = {...defaultTheme, ...darkTheme}
        }
    }

    setActiveThemeName(consolidatedTheme, theme)

    // for personal server and desktop, Focalboard is responsible for managing the theme,
    // so we set all the color variables here.
    document.documentElement.dataset.picoMode = isDarkRgb(consolidatedTheme.mainBg) ? 'dark' : 'light'
    document.documentElement.style.setProperty('--center-channel-bg-rgb', consolidatedTheme.mainBg)
    document.documentElement.style.setProperty('--center-channel-color-rgb', consolidatedTheme.mainFg)
    document.documentElement.style.setProperty('--button-bg-rgb', consolidatedTheme.buttonBg)
    document.documentElement.style.setProperty('--button-color-rgb', consolidatedTheme.buttonFg)
    document.documentElement.style.setProperty('--sidebar-bg-rgb', consolidatedTheme.sidebarBg)
    document.documentElement.style.setProperty('--sidebar-text-rgb', consolidatedTheme.sidebarFg)
    document.documentElement.style.setProperty('--link-color-rgb', consolidatedTheme.link)
    document.documentElement.style.setProperty('--sidebar-text-active-border-rgb', consolidatedTheme.sidebarTextActiveBorder)

    document.documentElement.style.setProperty('--sidebar-white-logo', consolidatedTheme.sidebarWhiteLogo)
    document.documentElement.style.setProperty('--link-visited-color-rgb', consolidatedTheme.linkVisited)

    document.documentElement.style.setProperty('--prop-default', consolidatedTheme.propDefault)
    document.documentElement.style.setProperty('--prop-gray', consolidatedTheme.propGray)
    document.documentElement.style.setProperty('--prop-brown', consolidatedTheme.propBrown)
    document.documentElement.style.setProperty('--prop-orange', consolidatedTheme.propOrange)
    document.documentElement.style.setProperty('--prop-yellow', consolidatedTheme.propYellow)
    document.documentElement.style.setProperty('--prop-green', consolidatedTheme.propGreen)
    document.documentElement.style.setProperty('--prop-blue', consolidatedTheme.propBlue)
    document.documentElement.style.setProperty('--prop-purple', consolidatedTheme.propPurple)
    document.documentElement.style.setProperty('--prop-pink', consolidatedTheme.propPink)
    document.documentElement.style.setProperty('--prop-red', consolidatedTheme.propRed)

    return consolidatedTheme
}

function setActiveThemeName(consolidatedTheme: Theme, theme: Theme | null) {
    if (theme === null) {
        activeThemeName = systemThemeName
    } else if (isEqual(consolidatedTheme, picoTheme)) {
        activeThemeName = picoThemeName
    } else if (isEqual(consolidatedTheme, darkTheme)) {
        activeThemeName = darkThemeName
    } else if (isEqual(consolidatedTheme, lightTheme)) {
        activeThemeName = lightThemeName
    } else {
        activeThemeName = defaultThemeName
    }
}

export function loadTheme(): Theme {
    const themeStr = UserSettings.theme
    if (themeStr === null) {
        // Never chosen: Pico.Love OS is the default theme. It is applied without
        // being saved as a choice, so "System theme" (saved as '') still works.
        const consolidatedTheme = setTheme(picoTheme)
        UserSettings.theme = null
        return consolidatedTheme
    }
    if (themeStr) {
        try {
            const theme = JSON.parse(themeStr)
            const consolidatedTheme = setTheme(theme)
            setActiveThemeName(consolidatedTheme, theme)
            return consolidatedTheme
        } catch (e) {
            return setTheme(null)
        }
    }

    // Saved as '': follow the system theme
    return setTheme(null)
}

export function initThemes(): void {
    const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
    const changeHandler = () => {
        // Only when "System theme" is chosen (saved as ''); never-chosen (null) stays Pico.Love OS
        if (UserSettings.theme === '') {
            setTheme(null)
        }
    }
    if (darkThemeMq.addEventListener) {
        darkThemeMq.addEventListener('change', changeHandler)
    } else if (darkThemeMq.addListener) {
        // Safari and Mac app support
        darkThemeMq.addListener(changeHandler)
    }
    loadTheme()
}

export function getSelectBaseStyle() {
    return {
        dropdownIndicator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none !important',
        }),
        indicatorSeparator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none',
        }),
        loadingIndicator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none',
        }),
        clearIndicator: (provided: CSSObject): CSSObject => ({
            ...provided,
            display: 'none',
        }),
        menu: (provided: CSSObject): CSSObject => ({
            ...provided,
            width: 'unset',
            background: 'rgb(var(--center-channel-bg-rgb))',
        }),
        option: (provided: CSSObject, state: { isFocused: boolean }): CSSObject => ({
            ...provided,
            background: state.isFocused ? 'rgba(var(--center-channel-color-rgb), 0.1)' : 'rgb(var(--center-channel-bg-rgb))',
            color: state.isFocused ? 'rgb(var(--center-channel-color-rgb))' : 'rgb(var(--center-channel-color-rgb))',
            padding: '2px 8px',
        }),
        control: (): CSSObject => ({
            border: 0,
            width: '100%',
            margin: '4px 0 0 0',

            // display: 'flex',
            // marginTop: 0,
        }),
        valueContainer: (provided: CSSObject): CSSObject => ({
            ...provided,
            padding: '0 5px',
            overflow: 'unset',
        }),
        singleValue: (provided: CSSObject): CSSObject => ({
            ...provided,
            color: 'rgb(var(--center-channel-color-rgb))',
            overflow: 'unset',
            maxWidth: 'calc(100% - 20px)',
        }),
        input: (provided: CSSObject): CSSObject => ({
            ...provided,
            paddingBottom: 0,
            paddingTop: 0,
            marginBottom: 0,
            marginTop: 0,
        }),
        menuList: (provided: CSSObject): CSSObject => ({
            ...provided,
            overflowY: 'auto',
            overflowX: 'hidden',
        }),
    }
}

export function getActiveThemeName(): string {
    return activeThemeName || picoThemeName
}
