// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useEffect} from 'react'
import {useHistory} from 'react-router-dom'

import {useAppDispatch} from '../store/hooks'
import {fetchMe} from '../store/users'
import client from '../octoClient'

// Returns path if it is a local app path, or '/' otherwise, so a crafted link cannot
// send the user to another site after signing in.
export function safeRedirectPath(path: string | null | undefined): string {
    if (!path || path[0] !== '/' || path.startsWith('//') || (/[\\\r\n\t]/).test(path)) {
        return '/'
    }
    return path
}

// The server finishes the Google sign-in and sends the browser here with the session token in
// the URL fragment (#token=...&r=/path). The fragment is never sent to a server, and it is
// removed from the address bar before anything else happens.
const SSOPage = () => {
    const dispatch = useAppDispatch()
    const history = useHistory()

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const token = params.get('token')
        const redirect = safeRedirectPath(params.get('r'))

        window.history.replaceState(null, '', window.location.pathname + window.location.search)

        if (!token) {
            history.replace('/login?error=sso_failed')
            return
        }

        client.token = token
        dispatch(fetchMe()).then((result) => {
            const signedIn = fetchMe.fulfilled.match(result) && Boolean(result.payload.me)
            if (signedIn) {
                history.replace(redirect)
            } else {
                client.token = ''
                history.replace('/login?error=sso_failed')
            }
        })
    }, [])

    return null
}

export default SSOPage
