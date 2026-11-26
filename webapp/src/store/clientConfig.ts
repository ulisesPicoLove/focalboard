// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit'

import {ClientConfig} from '../config/clientConfig'

import {default as client} from '../octoClient'

import {ShowUsername} from '../utils'

import {RootState} from './index'

export const fetchClientConfig = createAsyncThunk(
    'clientConfig/fetchClientConfig',
    async () => client.getClientConfig(),
)

const clientConfigSlice = createSlice({
    name: 'config',
    initialState: {value: {telemetry: false, telemetryid: '', enablePublicSharedBoards: false, teammateNameDisplay: ShowUsername, featureFlags: {}, maxFileSize: 0}} as {value: ClientConfig},
    reducers: {
        setClientConfig: (state, action: PayloadAction<ClientConfig>) => {
            state.value = action.payload
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchClientConfig.fulfilled, (state, action) => {
            // A server that does not report the sign-in mode (an older one) or a config that cannot
            // be loaded means password sign-in, rather than a blank login page.
            const config = action.payload || {telemetry: false, telemetryid: '', enablePublicSharedBoards: false, teammateNameDisplay: ShowUsername, featureFlags: {}, maxFileSize: 0}
            state.value = {...config, authMode: config.authMode || 'native'}
        })
    },
})

export const {setClientConfig} = clientConfigSlice.actions
export const {reducer} = clientConfigSlice

export function getClientConfig(state: RootState): ClientConfig {
    return state.clientConfig.value
}

export const googleAuthMode = 'google'

// The sign-in mode, or undefined while the client config has not been loaded yet.
export function getAuthMode(state: RootState): string | undefined {
    return state.clientConfig?.value?.authMode
}
