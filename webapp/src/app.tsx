// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import {IntlProvider} from 'react-intl'
import {DndProvider} from 'react-dnd'
import {HTML5Backend} from 'react-dnd-html5-backend'
import {TouchBackend} from 'react-dnd-touch-backend'
import {History} from 'history'

import {loadMessages} from './i18n'
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

const App = (props: Props): React.JSX.Element => {
    const language = useAppSelector<string>(getLanguage)
    const dispatch = useAppDispatch()
    const [messages, setMessages] = useState<{[key: string]: string}|null>(null)

    // Download the language file before showing the interface, so it never flashes in English
    useEffect(() => {
        let cancelled = false
        loadMessages(language).then((loaded) => {
            if (!cancelled) {
                setMessages(loaded)
            }
        }).catch(() => {
            // without the file the interface falls back to the English defaults
            if (!cancelled) {
                setMessages({})
            }
        })
        return () => {
            cancelled = true
        }
    }, [language])

    // Tell browsers and screen readers the language of the interface (BCP 47 uses '-', not '_')
    useEffect(() => {
        document.documentElement.lang = language.replace('_', '-')
    }, [language])

    useEffect(() => {
        dispatch(fetchLanguage())
        dispatch(fetchMe())
        dispatch(fetchClientConfig())
    }, [dispatch])

    if (!messages) {
        return <div id='frame'/>
    }

    return (
        <IntlProvider
            locale={language.split(/[_]/)[0]}
            messages={messages}
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
