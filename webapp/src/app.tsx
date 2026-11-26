// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'
import {IntlProvider} from 'react-intl'
import {DndProvider} from 'react-dnd'
import {HTML5Backend} from 'react-dnd-html5-backend'
import {TouchBackend} from 'react-dnd-touch-backend'
import {History} from 'history'

import {getMessages} from './i18n'
import {FlashMessages} from './components/flashMessages'
import {Utils} from './utils'
import {fetchMe} from './store/users'
import {getLanguage, fetchLanguage} from './store/language'
import {useAppSelector, useAppDispatch} from './store/hooks'
import {fetchClientConfig} from './store/clientConfig'
import FocalboardRouter from './router'

type Props = {
    history?: History<unknown>
}

const App = (props: Props): JSX.Element => {
    const language = useAppSelector<string>(getLanguage)
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(fetchLanguage())
        dispatch(fetchMe())
        dispatch(fetchClientConfig())
    }, [dispatch])

    return (
        <IntlProvider
            locale={language.split(/[_]/)[0]}
            messages={getMessages(language)}
        >
            <DndProvider backend={Utils.isMobile() ? TouchBackend : HTML5Backend}>
                <FlashMessages milliseconds={2000}/>
                <div id='frame'>
                    <div id='main'>
                        <FocalboardRouter history={props.history}/>
                    </div>
                </div>
            </DndProvider>
        </IntlProvider>
    )
}

export default React.memo(App)
