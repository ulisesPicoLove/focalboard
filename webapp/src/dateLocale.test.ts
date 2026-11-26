// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {datePlaceholder, dayPickerLocaleUtils, humanizeDuration, parseInputDate, relativeTime} from './dateLocale'

describe('dateLocale', () => {
    test('parseInputDate follows the field order of the locale', () => {
        expect(parseInputDate('11/22/2001', 'en')).toEqual(new Date(2001, 10, 22))
        expect(parseInputDate('22/11/2001', 'es')).toEqual(new Date(2001, 10, 22))
        expect(parseInputDate('22.11.2001', 'de')).toEqual(new Date(2001, 10, 22))
        expect(parseInputDate('2001/11/22', 'ja')).toEqual(new Date(2001, 10, 22))
    })

    test('parseInputDate rejects things that are not dates', () => {
        expect(parseInputDate('', 'en')).toBeUndefined()
        expect(parseInputDate('hello', 'en')).toBeUndefined()
        expect(parseInputDate('13/40/2001', 'en')).toBeUndefined()
        expect(parseInputDate('02/30/2001', 'en')).toBeUndefined()
        expect(parseInputDate('1/2', 'en')).toBeUndefined()
    })

    test('datePlaceholder', () => {
        expect(datePlaceholder('en')).toBe('MM/DD/YYYY')
        expect(datePlaceholder('es')).toBe('DD/MM/YYYY')
        expect(datePlaceholder('not a locale')).toBe('MM/DD/YYYY')
    })

    test('relativeTime', () => {
        const now = new Date(2021, 5, 15, 12).getTime()
        expect(relativeTime(new Date(now - (10 * 1000)), 'en', now)).toBe('now')
        expect(relativeTime(new Date(now - (5 * 60 * 1000)), 'en', now)).toBe('5 minutes ago')
        expect(relativeTime(new Date(now - (3 * 60 * 60 * 1000)), 'en', now)).toBe('3 hours ago')
        expect(relativeTime(new Date(now - (24 * 60 * 60 * 1000)), 'en', now)).toBe('yesterday')
        expect(relativeTime(new Date(now - (3 * 24 * 60 * 60 * 1000)), 'en', now)).toBe('3 days ago')
        expect(relativeTime(new Date(now - (400 * 24 * 60 * 60 * 1000)), 'en', now)).toBe('last year')
        expect(relativeTime(new Date(now - (3 * 24 * 60 * 60 * 1000)), 'es', now)).toBe('hace 3 días')
    })

    test('humanizeDuration', () => {
        expect(humanizeDuration(10 * 1000, 'en')).toBe('10 seconds')
        expect(humanizeDuration(2 * 60 * 60 * 1000, 'en')).toBe('2 hours')
        expect(humanizeDuration(5 * 24 * 60 * 60 * 1000, 'en')).toBe('5 days')
        expect(humanizeDuration(90 * 24 * 60 * 60 * 1000, 'en')).toBe('3 months')
        expect(humanizeDuration(5 * 24 * 60 * 60 * 1000, 'es')).toBe('5 días')
    })

    test('day picker locale utils', () => {
        expect(dayPickerLocaleUtils.getFirstDayOfWeek?.('en')).toBe(0)
        expect(dayPickerLocaleUtils.getFirstDayOfWeek?.('es')).toBe(1)
        expect(dayPickerLocaleUtils.getMonths?.('en')[0]).toBe('January')
        expect(dayPickerLocaleUtils.formatWeekdayShort?.(0, 'en')).toBe('Sun')
        expect(dayPickerLocaleUtils.formatWeekdayLong?.(1, 'en')).toBe('Monday')
        expect(dayPickerLocaleUtils.formatMonthTitle?.(new Date(2001, 10, 1), 'en')).toBe('November 2001')
    })
})
