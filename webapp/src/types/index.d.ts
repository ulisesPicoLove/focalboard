// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType} from 'react'

// The window of the page, with what other hosts and the app itself add to it
export interface IAppWindow extends Window {

    // Optional pieces a host page can provide (avatar URLs, a bot badge)
    Components?: {
        imageURLForUser?: (userID: string) => string
        BotBadge?: ComponentType
    }
    baseURL?: string
    frontendBaseURL?: string
    getCurrentTeamId?: () => string
    msCrypto?: Crypto
    openInNewBrowser?: ((href: string) => void) | null
    webkit?: {messageHandlers: {nativeApp?: {postMessage: <T>(message: T) => void}}}
}
