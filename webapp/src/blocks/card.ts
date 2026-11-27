// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Block, createBlock} from './block'

type CardFields = {
    icon?: string
    isTemplate?: boolean
    properties: Record<string, string | string[]>
    contentOrder: Array<string | string[]>
}

type Card = Block & {
    fields: CardFields
}

function createCard(block?: Block): Card {
    // What the server saved is not checked: read it as a partial card and fill the defaults below
    const fields = (block?.fields ?? {}) as Partial<CardFields>
    const contentOrder: Array<string|string[]> = []
    const contentIds = fields.contentOrder?.filter((id) => id !== null)

    if (contentIds && contentIds.length > 0) {
        for (const contentId of contentIds) {
            if (typeof contentId === 'string') {
                contentOrder.push(contentId)
            } else {
                contentOrder.push(contentId.slice())
            }
        }
    }
    return {
        ...createBlock(block),
        type: 'card',
        fields: {
            icon: fields.icon || '',
            properties: {...(fields.properties || {})},
            contentOrder,
            isTemplate: fields.isTemplate || false,
        },
    }
}

export {Card, CardFields, createCard}
