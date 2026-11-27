// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Declares a dictionary whose values must be of type V while keeping its exact keys, so that
// `dict.known` is a V and `dict.typo` does not compile (a `Record<string, V>` annotation would
// make every key look present).
export function dictionaryOf<V>() {
    return <T extends Record<string, V>>(dictionary: T): T => dictionary
}

// The value, or an error that says what was expected to exist. For lookups that must succeed
// (the item was just read from the same list): the error replaces a bare `value!`.
export function required<T>(value: T | null | undefined, what: string): T {
    if (value === null || value === undefined) {
        throw new Error(`Expected to find ${what}`)
    }
    return value
}

// Type guard for dropping the holes of a lookup: `ids.map((id) => byId[id]).filter(isDefined)`
export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}

// A property value is stored as text, a number (timestamps) or a list (multi-select, person...),
// whichever the property type says. These read it as the kind a caller needs, with an empty value
// when the stored one is of another kind or missing, instead of asserting the kind.
export function asText(value: unknown): string {
    if (typeof value === 'string') {
        return value
    }
    return typeof value === 'number' ? String(value) : ''
}

export function asList(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
    }
    return typeof value === 'string' && value !== '' ? [value] : []
}
