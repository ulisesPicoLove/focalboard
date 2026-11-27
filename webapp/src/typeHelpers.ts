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
