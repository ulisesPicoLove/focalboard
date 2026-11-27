// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CategoryBoardMetadata, CategoryBoards} from '../../store/sidebar'

// What a category shows: its boards, in order, that are loaded, not hidden by the person and
// not templates. The index of a dragged board is a position in this list, NOT in
// category.boardMetadata, which can also hold hidden boards, templates and boards that are
// not in the store.
export function displayedBoardIDs(category: CategoryBoards, boards: Array<{id: string, isTemplate?: boolean}>): string[] {
    const byID = new Map(boards.map((board) => [board.id, board]))
    return category.boardMetadata.
        filter((metadata) => !metadata.hidden && byID.has(metadata.boardID) && !byID.get(metadata.boardID)?.isTemplate).
        map((metadata) => metadata.boardID)
}

// Moves a board inside its category. `from` and `to` are positions among the displayed boards;
// the entries that are not displayed stay where they were.
export function reorderWithinCategory(metadata: CategoryBoardMetadata[], displayed: string[], from: number, to: number): CategoryBoardMetadata[] {
    const shown = new Set(displayed)
    const slots: number[] = []
    metadata.forEach((entry, i) => {
        if (shown.has(entry.boardID)) {
            slots.push(i)
        }
    })

    const moved = slots.map((slot) => metadata[slot])
    if (from < 0 || from >= moved.length) {
        return metadata
    }
    const [item] = moved.splice(from, 1)
    moved.splice(Math.min(Math.max(to, 0), moved.length), 0, item)

    const result = [...metadata]
    slots.forEach((slot, k) => {
        const placed = moved[k]
        if (placed) {
            result[slot] = placed
        }
    })
    return result
}

// Puts an entry into a category at a displayed position (`to`); past the last displayed board it goes to the end.
export function insertIntoCategory(metadata: CategoryBoardMetadata[], displayed: string[], entry: CategoryBoardMetadata, to: number): CategoryBoardMetadata[] {
    const result = [...metadata]
    const before = to < displayed.length ? result.findIndex((m) => m.boardID === displayed[to]) : -1
    if (before >= 0) {
        result.splice(before, 0, entry)
    } else {
        result.push(entry)
    }
    return result
}
