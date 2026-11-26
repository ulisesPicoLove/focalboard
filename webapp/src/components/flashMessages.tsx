// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useEffect, useRef, useCallback} from 'react'
import {createNanoEvents} from 'nanoevents'

import './flashMessages.scss'

export type FlashMessage = {
    content: React.ReactNode
    severity: 'low' | 'normal' | 'high'
}

const emitter = createNanoEvents()

export function sendFlashMessage(message: FlashMessage): void {
    emitter.emit('message', message)
}

type Props = {
    milliseconds: number
}

export const FlashMessages = React.memo((props: Props) => {
    const [message, setMessage] = useState<FlashMessage|null>(null)
    const [fadeOut, setFadeOut] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout>|null>(null)

    const clearTimer = useCallback((): void => {
        if (timer.current) {
            clearTimeout(timer.current)
            timer.current = null
        }
    }, [])

    const fadeOutNow = useCallback((): void => {
        setFadeOut(true)
        timer.current = setTimeout(() => {
            setMessage(null)
            setFadeOut(false)
        }, 200)
    }, [])

    const {milliseconds} = props
    useEffect(() => {
        const unsubscribe = emitter.on('message', (newMessage: FlashMessage) => {
            clearTimer()
            setFadeOut(false)
            timer.current = setTimeout(fadeOutNow, milliseconds - 200)
            setMessage(newMessage)
        })
        return () => {
            unsubscribe()
            clearTimer()
        }
    }, [milliseconds, clearTimer, fadeOutNow])

    const handleClick = (): void => {
        clearTimer()
        fadeOutNow()
    }

    // The live region stays in the page so screen readers announce a message when it appears;
    // errors interrupt (alert), the rest wait for a pause (status)
    return (
        <div
            role={message?.severity === 'high' ? 'alert' : 'status'}
            aria-live={message?.severity === 'high' ? 'assertive' : 'polite'}
        >
            {message &&
                <div
                    className={'FlashMessages ' + message.severity + (fadeOut ? ' flashOut' : ' flashIn')}
                    onClick={handleClick}
                >
                    {message.content}
                </div>}
        </div>
    )
})
