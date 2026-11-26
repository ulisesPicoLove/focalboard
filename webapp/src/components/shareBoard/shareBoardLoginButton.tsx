// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react'
import {FormattedMessage} from 'react-intl'
import {generatePath, useRouteMatch, useHistory} from 'react-router-dom'

import Button from '../../widgets/buttons/button'
import {Utils} from '../../utils'

import './shareBoardLoginButton.scss'

const ShareBoardLoginButton = () => {
    const match = useRouteMatch<{teamId: string, boardId: string, viewId?: string, cardId?: string}>()
    const history = useHistory()

    let redirectQueryParam = 'r=' + encodeURIComponent(generatePath('/:boardId?/:viewId?/:cardId?', match.params))
    if (Utils.isFocalboardLegacy()) {
        redirectQueryParam = 'redirect_to=' + encodeURIComponent(generatePath('/boards/team/:teamId/:boardId?/:viewId?/:cardId?', match.params))
    }
    const loginPath = '/login?' + redirectQueryParam

    const onLoginClick = useCallback(() => {
        if (Utils.isFocalboardLegacy()) {
            location.assign(loginPath)
        } else {
            history.push(loginPath)
        }
    }, [history, loginPath])

    return (
        <div className='ShareBoardLoginButton'>
            <Button
                title='Login'
                size='medium'
                emphasis='primary'
                onClick={() => onLoginClick()}
            >
                <FormattedMessage
                    id='CenterPanel.Login'
                    defaultMessage='Login'
                />
            </Button>
        </div>
    )
}

export default React.memo(ShareBoardLoginButton)
