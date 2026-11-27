// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {AttachmentBlock} from '../blocks/attachmentBlock'

import {loadBoardData, initialReadOnlyLoad} from './initialLoad'

import {RootState} from './index'

type AttachmentsState = {
    attachments: {[key: string]: AttachmentBlock}
    attachmentsByCard: {[key: string]: AttachmentBlock[]}
}

const attachmentSlice = createSlice({
    name: 'attachments',
    initialState: {attachments: {}, attachmentsByCard: {}} as AttachmentsState,
    reducers: {
        updateAttachments: (state, action: PayloadAction<AttachmentBlock[]>) => {
            for (const attachment of action.payload) {
                if (attachment.deleteAt === 0) {
                    state.attachments[attachment.id] = attachment
                    const siblings = state.attachmentsByCard[attachment.parentId]
                    if (!siblings) {
                        state.attachmentsByCard[attachment.parentId] = [attachment]
                    } else if (!siblings.some((a) => a.id === attachment.id)) {
                        siblings.push(attachment)
                    }
                } else {
                    const parentId = state.attachments[attachment.id]?.parentId
                    const siblings = parentId === undefined ? undefined : state.attachmentsByCard[parentId]
                    if (parentId !== undefined && siblings) {
                        state.attachmentsByCard[parentId] = siblings.filter((a) => a.id !== attachment.id)
                    }
                    delete state.attachments[attachment.id]
                }
            }
        },
        updateUploadPrecent: (state, action: PayloadAction<{blockId: string, uploadPercent: number}>) => {
            const attachment = state.attachments[action.payload.blockId]
            if (attachment) {
                attachment.uploadingPercent = action.payload.uploadPercent
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.attachments = {}
            state.attachmentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'attachment') {
                    state.attachments[block.id] = block as AttachmentBlock
                    const siblings = state.attachmentsByCard[block.parentId] ?? []
                    siblings.push(block as AttachmentBlock)
                    state.attachmentsByCard[block.parentId] = siblings
                }
            }
            Object.values(state.attachmentsByCard).forEach((arr) => arr.sort((a, b) => a.createAt - b.createAt))
        })
        builder.addCase(loadBoardData.fulfilled, (state, action) => {
            state.attachments = {}
            state.attachmentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'attachment') {
                    state.attachments[block.id] = block as AttachmentBlock
                    const siblings = state.attachmentsByCard[block.parentId] ?? []
                    siblings.push(block as AttachmentBlock)
                    state.attachmentsByCard[block.parentId] = siblings
                }
            }
            Object.values(state.attachmentsByCard).forEach((arr) => arr.sort((a, b) => a.createAt - b.createAt))
        })
    },
})

export const {updateAttachments, updateUploadPrecent} = attachmentSlice.actions
export const {reducer} = attachmentSlice

export function getCardAttachments(cardId: string): (state: RootState) => AttachmentBlock[] {
    return (state: RootState): AttachmentBlock[] => {
        return (state.attachments?.attachmentsByCard && state.attachments.attachmentsByCard[cardId]) || []
    }
}

export function getUploadPercent(blockId: string): (state: RootState) => number {
    return (state: RootState): number => {
        return state.attachments.attachments[blockId]?.uploadingPercent ?? 0
    }
}
