// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {darkTheme, defaultTheme, lightTheme, picoTheme} from './theme'

function channel(value: number): number {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: string): number {
    const [r, g, b] = rgb.split(',').map((v) => parseInt(v.trim(), 10))
    return (0.2126 * channel(r!)) + (0.7152 * channel(g!)) + (0.0722 * channel(b!))
}

function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light! + 0.05) / (dark! + 0.05)
}

describe('theme contrast (WCAG AA, 4.5:1)', () => {
    const themes = {default: defaultTheme, dark: darkTheme, light: lightTheme, pico: picoTheme}

    test.each(Object.entries(themes))('%s: button text on the button background', (_name, theme) => {
        expect(contrast(theme.buttonFg, theme.buttonBg)).toBeGreaterThanOrEqual(4.5)
    })

    test.each(Object.entries(themes))('%s: main text on the page', (_name, theme) => {
        expect(contrast(theme.mainFg, theme.mainBg)).toBeGreaterThanOrEqual(4.5)
    })

    test.each(Object.entries(themes))('%s: accent colour used as text on the page', (_name, theme) => {
        expect(contrast(theme.buttonBg, theme.mainBg)).toBeGreaterThanOrEqual(4.5)
    })
})
