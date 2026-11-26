// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useEffect} from 'react'

import wsClient, {WSClient} from '../wsclient'

export const useWebsockets = (teamId: string, fn: (wsClient: WSClient) => () => void, deps: any[] = []): void => {
    useEffect(() => {
        if (!teamId) {
            return () => {}
        }

        wsClient.subscribeToTeam(teamId)
        const teardown = fn(wsClient)

        return () => {
            teardown()
            wsClient.unsubscribeToTeam(teamId)
        }

    // `fn` is a new closure on every render: callers list in `deps` what should re-subscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamId, ...deps])
}
