// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction, createSelector} from '@reduxjs/toolkit'

import {CommentBlock} from '../blocks/commentBlock'

import {loadBoardData, initialReadOnlyLoad} from './initialLoad'

import {RootState} from './index'

type CommentsState = {
    comments: {[key: string]: CommentBlock}
    commentsByCard: {[key: string]: CommentBlock[]}
}

const commentsSlice = createSlice({
    name: 'comments',
    initialState: {comments: {}, commentsByCard: {}} as CommentsState,
    reducers: {
        updateComments: (state, action: PayloadAction<CommentBlock[]>) => {
            for (const comment of action.payload) {
                if (comment.deleteAt === 0) {
                    state.comments[comment.id] = comment
                    const siblings = state.commentsByCard[comment.parentId]
                    if (!siblings) {
                        state.commentsByCard[comment.parentId] = [comment]
                        continue
                    }
                    const existing = siblings.findIndex((c) => c.id === comment.id)
                    if (existing === -1) {
                        siblings.push(comment)
                    } else {
                        siblings[existing] = comment
                    }
                } else {
                    const parentId = state.comments[comment.id]?.parentId
                    const siblings = parentId === undefined ? undefined : state.commentsByCard[parentId]
                    if (parentId !== undefined && siblings) {
                        state.commentsByCard[parentId] = siblings.filter((c) => c.id !== comment.id)
                    }
                    delete state.comments[comment.id]
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.comments = {}
            state.commentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'comment') {
                    state.comments[block.id] = block as CommentBlock
                    const siblings = state.commentsByCard[block.parentId] ?? []
                    siblings.push(block as CommentBlock)
                    state.commentsByCard[block.parentId] = siblings
                }
            }
            Object.values(state.commentsByCard).forEach((comment) => comment.sort((a, b) => a.createAt - b.createAt))
        })
        builder.addCase(loadBoardData.fulfilled, (state, action) => {
            state.comments = {}
            state.commentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'comment') {
                    state.comments[block.id] = block as CommentBlock
                    const siblings = state.commentsByCard[block.parentId] ?? []
                    siblings.push(block as CommentBlock)
                    state.commentsByCard[block.parentId] = siblings
                }
            }
            Object.values(state.commentsByCard).forEach((comment) => comment.sort((a, b) => a.createAt - b.createAt))
        })
    },
})

export const {updateComments} = commentsSlice.actions
export const {reducer} = commentsSlice

// Shared empty value: returning a new [] from a selector re-renders its subscribers on every store change
const noComments: CommentBlock[] = []

export function getCardComments(cardId: string): (state: RootState) => CommentBlock[] {
    return (state: RootState): CommentBlock[] => {
        return (state.comments?.commentsByCard && state.comments.commentsByCard[cardId]) || noComments
    }
}

export function getLastCardComment(cardId: string): (state: RootState) => CommentBlock|undefined {
    return (state: RootState): CommentBlock|undefined => {
        const comments = state.comments?.commentsByCard && state.comments.commentsByCard[cardId]
        return comments?.[comments.length - 1]
    }
}

export const getLastCommentByCard = createSelector(
    (state: RootState) => state.comments?.commentsByCard || null,
    (commentsByCard: {[key: string]: CommentBlock[]}|null): {[key: string]: CommentBlock} => {
        const lastCommentByCard: {[key: string]: CommentBlock} = {}
        Object.keys(commentsByCard || {}).forEach((cardId) => {
            const last = commentsByCard?.[cardId]?.at(-1)
            if (last) {
                lastCommentByCard[cardId] = last
            }
        })
        return lastCommentByCard
    },
)
