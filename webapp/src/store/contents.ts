// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction, createSelector} from '@reduxjs/toolkit'

import {ContentBlock} from '../blocks/contentBlock'

import {getCards, getTemplates} from './cards'
import {loadBoardData, initialReadOnlyLoad} from './initialLoad'

import {RootState} from './index'

type ContentsState = {
    contents: {[key: string]: ContentBlock}
    contentsByCard: {[key: string]: ContentBlock[]}
}

const contentsSlice = createSlice({
    name: 'contents',
    initialState: {contents: {}, contentsByCard: {}} as ContentsState,
    reducers: {
        updateContents: (state, action: PayloadAction<ContentBlock[]>) => {
            for (const content of action.payload) {
                if (content.deleteAt === 0) {
                    state.contents[content.id] = content
                    const siblings = state.contentsByCard[content.parentId]
                    if (!siblings) {
                        state.contentsByCard[content.parentId] = [content]
                        continue
                    }
                    const existing = siblings.findIndex((c) => c.id === content.id)
                    if (existing === -1) {
                        siblings.push(content)
                    } else {
                        siblings[existing] = content
                    }
                } else {
                    const parentId = state.contents[content.id]?.parentId
                    const siblings = parentId === undefined ? undefined : state.contentsByCard[parentId]
                    if (parentId !== undefined && siblings) {
                        state.contentsByCard[parentId] = siblings.filter((c) => c.id !== content.id)
                    }
                    delete state.contents[content.id]
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.contents = {}
            state.contentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type !== 'board' && block.type !== 'view' && block.type !== 'comment') {
                    state.contents[block.id] = block as ContentBlock
                    const siblings = state.contentsByCard[block.parentId] ?? []
                    siblings.push(block as ContentBlock)
                    siblings.sort((a, b) => a.createAt - b.createAt)
                    state.contentsByCard[block.parentId] = siblings
                }
            }
        })
        builder.addCase(loadBoardData.fulfilled, (state, action) => {
            state.contents = {}
            state.contentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type !== 'board' && block.type !== 'view' && block.type !== 'comment') {
                    state.contents[block.id] = block as ContentBlock
                    const siblings = state.contentsByCard[block.parentId] ?? []
                    siblings.push(block as ContentBlock)
                    siblings.sort((a, b) => a.createAt - b.createAt)
                    state.contentsByCard[block.parentId] = siblings
                }
            }
        })
    },
})

export const {updateContents} = contentsSlice.actions
export const {reducer} = contentsSlice

export const getContentsById = (state: RootState): {[key: string]: ContentBlock} => state.contents.contents

export const getContents = createSelector(
    getContentsById,
    (contents) => Object.values(contents),
)

// Shared empty value: returning a new [] from a selector re-renders its subscribers on every store change
const noContents: ContentBlock[] = []

export function getCardContents(cardId: string): (state: RootState) => Array<ContentBlock|ContentBlock[]> {
    return createSelector(
        (state: RootState) => (state.contents?.contentsByCard && state.contents.contentsByCard[cardId]) || noContents,
        (state: RootState) => getCards(state)[cardId]?.fields?.contentOrder || getTemplates(state)[cardId]?.fields?.contentOrder,
        (contents, contentOrder): Array<ContentBlock|ContentBlock[]> => {
            const result: Array<ContentBlock|ContentBlock[]> = []
            if (!contents) {
                return []
            }
            if (contentOrder) {
                for (const contentId of contentOrder) {
                    if (typeof contentId === 'string') {
                        const content = contents.find((c) => c.id === contentId)
                        if (content) {
                            result.push(content)
                        }
                    } else if (typeof contentId === 'object' && contentId) {
                        const subResult: ContentBlock[] = []
                        for (const subContentId of contentId) {
                            if (typeof subContentId === 'string') {
                                const subContent = contents.find((c) => c.id === subContentId)
                                if (subContent) {
                                    subResult.push(subContent)
                                }
                            }
                        }
                        result.push(subResult)
                    }
                }
            }
            return result
        },
    )
}

export function getLastCardContent(cardId: string): (state: RootState) => ContentBlock|undefined {
    return (state: RootState): ContentBlock|undefined => {
        const contents = state.contents?.contentsByCard && state.contents?.contentsByCard[cardId]
        return contents?.[contents?.length - 1]
    }
}
