// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LocaleUtils} from 'react-day-picker'

function safeLocale(locale: string): string {
    try {
        return new Intl.Locale(locale).toString()
    } catch {
        return 'en'
    }
}

// Order of the numeric day, month and year fields of a locale, e.g. ['month', 'day', 'year'] for en-US
function dateFieldOrder(locale: string): Array<'day' | 'month' | 'year'> {
    const parts = new Intl.DateTimeFormat(locale, {year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(2001, 10, 22))
    const order: Array<'day' | 'month' | 'year'> = []
    for (const part of parts) {
        if (part.type === 'day' || part.type === 'month' || part.type === 'year') {
            order.push(part.type)
        }
    }
    return order
}

// Placeholder like "MM/DD/YYYY", built from the locale's own separators
export function datePlaceholder(locale: string): string {
    const loc = safeLocale(locale)
    const labels = {day: 'DD', month: 'MM', year: 'YYYY'}
    const parts = new Intl.DateTimeFormat(loc, {year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(2001, 10, 22))
    return parts.map((part) => {
        if (part.type === 'day' || part.type === 'month' || part.type === 'year') {
            return labels[part.type]
        }
        return part.value
    }).join('')
}

// Parses what the user typed in a date field (numbers separated by anything, in the
// locale's field order). Returns undefined when it is not a real calendar date.
export function parseInputDate(text: string, locale: string): Date | undefined {
    const numbers = text.trim().split(/\D+/).filter(Boolean)
    if (numbers.length !== 3) {
        return undefined
    }
    const order = dateFieldOrder(safeLocale(locale))
    const fields: Record<string, number> = {}
    order.forEach((field, i) => {
        fields[field] = parseInt(numbers[i] ?? '', 10)
    })
    const {day, month, year} = fields
    if (!day || !month || !year || year < 100) {
        return undefined
    }
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return undefined
    }
    return date
}

// 1 = Monday ... 7 = Sunday. Intl.Locale weekInfo is not available everywhere: fall back to CLDR region data.
const sundayFirstRegions = new Set(['US', 'CA', 'MX', 'BR', 'JP', 'IL', 'IN', 'AU', 'PH', 'ZA', 'KR', 'TW', 'HK', 'SA', 'AR', 'CO', 'PE', 'VE'])
const saturdayFirstRegions = new Set(['AE', 'AF', 'DZ', 'EG', 'IQ', 'IR', 'JO', 'KW', 'LY', 'OM', 'QA', 'SD', 'SY'])

function firstDayOfWeek(locale: string): number {
    const loc = new Intl.Locale(locale) as Intl.Locale & {weekInfo?: {firstDay: number}, getWeekInfo?: () => {firstDay: number}}
    const info = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo
    if (info) {
        return info.firstDay
    }
    const region = loc.maximize().region || ''
    if (sundayFirstRegions.has(region)) {
        return 7
    }
    if (saturdayFirstRegions.has(region)) {
        return 6
    }
    return 1
}

// react-day-picker v7 locale utils
export const dayPickerLocaleUtils: LocaleUtils = {
    formatDay: (day, locale = 'en') => new Intl.DateTimeFormat(safeLocale(locale), {dateStyle: 'full'}).format(day),
    formatMonthTitle: (month, locale = 'en') => new Intl.DateTimeFormat(safeLocale(locale), {month: 'long', year: 'numeric'}).format(month),
    formatWeekdayShort: (weekday, locale = 'en') => new Intl.DateTimeFormat(safeLocale(locale), {weekday: 'short'}).format(new Date(2001, 0, 7 + weekday)),
    formatWeekdayLong: (weekday, locale = 'en') => new Intl.DateTimeFormat(safeLocale(locale), {weekday: 'long'}).format(new Date(2001, 0, 7 + weekday)),
    getFirstDayOfWeek: (locale = 'en') => firstDayOfWeek(safeLocale(locale)) % 7,
    getMonths: (locale = 'en') => {
        const format = new Intl.DateTimeFormat(safeLocale(locale), {month: 'long'})
        return Array.from({length: 12}, (_, i) => format.format(new Date(2001, i, 1))) as ReturnType<NonNullable<LocaleUtils['getMonths']>>
    },
    formatDate: (date, _format, locale = 'en') => new Intl.DateTimeFormat(safeLocale(locale), {year: 'numeric', month: '2-digit', day: '2-digit'}).format(date),

    // react-day-picker only calls this from DayPickerInput; the app's own inputs use parseInputDate
    // (the typings say Date, the library accepts undefined for text that is not a date)
    parseDate: (text, _format, locale = 'en') => parseInputDate(text, locale) as Date,
}

const second = 1000
const minute = 60 * second
const hour = 60 * minute
const day = 24 * hour

type Unit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'

// Same thresholds moment used: 45 s, 45 min, 22 h, 26 d, 11 months
function bestUnit(ms: number): {unit: Unit, value: number} {
    const abs = Math.abs(ms)
    const sign = Math.sign(ms) || 1
    if (abs < 45 * second) {
        return {unit: 'second', value: 0}
    }
    if (abs < 90 * second) {
        return {unit: 'minute', value: sign}
    }
    if (abs < 45 * minute) {
        return {unit: 'minute', value: sign * Math.round(abs / minute)}
    }
    if (abs < 90 * minute) {
        return {unit: 'hour', value: sign}
    }
    if (abs < 22 * hour) {
        return {unit: 'hour', value: sign * Math.round(abs / hour)}
    }
    if (abs < 36 * hour) {
        return {unit: 'day', value: sign}
    }
    if (abs < 26 * day) {
        return {unit: 'day', value: sign * Math.round(abs / day)}
    }
    if (abs < 45 * day) {
        return {unit: 'month', value: sign}
    }
    if (abs < 320 * day) {
        return {unit: 'month', value: sign * Math.max(2, Math.round(abs / (30.4375 * day)))}
    }
    if (abs < 548 * day) {
        return {unit: 'year', value: sign}
    }
    return {unit: 'year', value: sign * Math.round(abs / (365.25 * day))}
}

// "3 hours ago", "in 2 days", "yesterday"
export function relativeTime(date: Date, locale: string, now = Date.now()): string {
    const format = new Intl.RelativeTimeFormat(safeLocale(locale), {numeric: 'auto'})
    const {unit, value} = bestUnit(date.getTime() - now)
    return format.format(value, unit)
}

// "3 hours", "2 days" (no direction), for the length of a date range
export function humanizeDuration(ms: number, locale: string): string {
    const loc = safeLocale(locale)
    const {unit, value} = bestUnit(ms)
    const amount = unit === 'second' ? Math.max(1, Math.round(Math.abs(ms) / second)) : Math.abs(value)
    return new Intl.NumberFormat(loc, {style: 'unit', unit, unitDisplay: 'long'}).format(amount)
}
