// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The card order of a view after moving a card one place back or forward among the cards that are
// shown together (a column, a group, the whole gallery): it goes before or after its neighbour.
// This is what the "Move up" and "Move down" menu items do, the keyboard alternative to dragging.
// Returns undefined when the card has no neighbour on that side.
export function moveCardAmong(cardOrder: readonly string[], shownIds: readonly string[], cardId: string, offset: -1 | 1): string[] | undefined {
    const index = shownIds.indexOf(cardId)
    const neighbourId = index < 0 ? undefined : shownIds[index + offset]
    if (neighbourId === undefined) {
        return undefined
    }

    // cards that are not in the saved order yet go after the ones that are, as the drag handlers do
    const order = Array.from(new Set([...cardOrder, ...shownIds])).filter((id) => id !== cardId)
    const neighbourIndex = order.indexOf(neighbourId)
    order.splice(offset === -1 ? neighbourIndex : neighbourIndex + 1, 0, cardId)
    return order
}
