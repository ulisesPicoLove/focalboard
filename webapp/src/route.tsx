// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {
    Redirect,
    Route,
    RouteChildrenProps,
    RouteComponentProps,
    match as RouteMatch,
} from 'react-router-dom'

import {Utils} from './utils'
import {getLoggedIn} from './store/users'
import {useAppSelector} from './store/hooks'

type RouteProps = {
    path: string|string[]
    exact?: boolean
    render?: (props: RouteComponentProps) => React.ReactElement
    component?: React.ComponentType
    children?: React.ReactElement
    getOriginalPath?: (match: RouteMatch<Record<string, string | undefined>>) => string
    loginRequired?: boolean
}

function FBRoute(props: RouteProps) {
    const loggedIn = useAppSelector<boolean|null>(getLoggedIn)
    let redirect: ((routeProps: RouteChildrenProps<Record<string, string | undefined>>) => React.ReactElement | null) | null = null

    if (loggedIn === false && props.loginRequired) {
        // eslint-disable-next-line react/prop-types -- a render callback of the router, not a component with props
        redirect = ({match}) => {
            // inside a Switch only the route that matches is rendered, so there is always a match
            if (!match) {
                return null
            }
            if (props.getOriginalPath) {
                let redirectUrl = '/' + Utils.buildURL(props.getOriginalPath(match))
                if (redirectUrl.indexOf('//') === 0) {
                    redirectUrl = redirectUrl.slice(1)
                }
                const loginUrl = `/error?id=not-logged-in&r=${encodeURIComponent(redirectUrl)}`
                return <Redirect to={loginUrl}/>
            }
            return <Redirect to='/error?id=not-logged-in'/>
        }
    }

    return (
        <Route
            path={props.path}
            render={props.render}
            component={props.component}
            exact={props.exact}
        >
            {redirect || props.children}
        </Route>
    )
}

export default React.memo(FBRoute)
