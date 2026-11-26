// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'

import wsClient from '../wsclient'
import {Utils} from '../utils'

type Props = {
    userId?: string
    children: React.ReactNode
}

// WithWebSockets component initialises the websocket connection if
// it's not yet running and subscribes to the current team
const WithWebSockets = (props: Props): React.ReactElement => {
    const queryString = new URLSearchParams(window.location.search)

    useEffect(() => {
        // if the websocket client was already connected, do nothing
        if (wsClient.state !== 'init') {
            return
        }

        // this is a temporary solution to disable websocket
        // connections on legacy routes, as there is no such thing as
        // an anonymous websocket connection
        if (Utils.isFocalboardLegacy()) {
            return
        }

        const token = localStorage.getItem('focalboardSessionId') || queryString.get('r') || ''
        if (token) {
            wsClient.authenticate(token)
        }
        wsClient.open()

    // Open the connection once; the token is read from storage and the URL at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!props.userId) {
            return
        }

        const token = localStorage.getItem('focalboardSessionId') || queryString.get('r') || ''
        if (wsClient.token !== token) {
            wsClient.authenticate(token)
        }

    // Re-authenticate only when the user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.userId])

    return (
        <>
            {props.children}
        </>
    )
}

export default WithWebSockets
