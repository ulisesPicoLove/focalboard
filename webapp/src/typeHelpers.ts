// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Declares a dictionary whose values must be of type V while keeping its exact keys, so that
// `dict.known` is a V and `dict.typo` does not compile (a `Record<string, V>` annotation would
// make every key look present).
export function dictionaryOf<V>() {
    return <T extends Record<string, V>>(dictionary: T): T => dictionary
}
