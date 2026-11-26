// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type EmojiMatch = {
    id: string
    name: string
    native: string
}

type RawEmoji = {a: string, b: string, j?: string[]}

let cache: Promise<Array<EmojiMatch & {keywords: string[]}>> | null = null

// The emoji list is large, so it is only downloaded the first time someone types :something
function loadEmojis() {
    if (!cache) {
        cache = import('emoji-mart/data/all.json').then((module) => {
            const emojis = (module.default as unknown as {emojis: Record<string, RawEmoji>}).emojis
            return Object.entries(emojis).map(([id, emoji]) => ({
                id,
                name: emoji.a,
                native: emoji.b.split('-').map((code) => String.fromCodePoint(parseInt(code, 16))).join(''),
                keywords: emoji.j || [],
            }))
        })
    }
    return cache
}

export async function searchEmojis(query: string, limit = 8): Promise<EmojiMatch[]> {
    const term = query.toLowerCase()
    if (!term) {
        return []
    }
    const all = await loadEmojis()
    const starts: EmojiMatch[] = []
    const contains: EmojiMatch[] = []
    for (const emoji of all) {
        if (emoji.id.startsWith(term)) {
            starts.push(emoji)
        } else if (emoji.id.includes(term) || emoji.keywords.some((keyword) => keyword.startsWith(term))) {
            contains.push(emoji)
        }
        if (starts.length >= limit) {
            break
        }
    }
    return starts.concat(contains).slice(0, limit).map(({id, name, native}) => ({id, name, native}))
}
