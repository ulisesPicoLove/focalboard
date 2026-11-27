// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The properties of `to` whose value differs from `from` (compared with ===), leaving out the
// ones in `ignore`. Used to build the patch that goes to the server and the one that undoes it.
export function changedProperties<T extends object>(from: T, to: T, ignore: ReadonlyArray<keyof T> = []): Partial<T> {
    const changed: Partial<T> = {}
    for (const key of Object.keys(to) as Array<keyof T>) {
        if (!ignore.includes(key) && from[key] !== to[key]) {
            changed[key] = to[key]
        }
    }
    return changed
}

// The same for a dictionary: the entries of `to` whose value differs from the one in `from`.
export function changedEntries<V>(from: Readonly<Record<string, V>>, to: Readonly<Record<string, V>>): Record<string, V> {
    const changed: Record<string, V> = {}
    for (const key of Object.keys(to)) {
        if (from[key] !== to[key]) {
            changed[key] = to[key]
        }
    }
    return changed
}
