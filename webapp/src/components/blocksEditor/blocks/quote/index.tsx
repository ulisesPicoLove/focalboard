// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useRef, useEffect} from 'react'

import {Utils} from '../../../../utils'

import {BlockInputProps, ContentType} from '../types'

import './quote.scss'

const Quote: ContentType = {
    name: 'quote',
    displayName: 'Quote',
    slashCommand: '/quote',
    prefix: '> ',
    Display: (props: BlockInputProps) => {
        const html = Utils.htmlFromMarkdown('> ' + props.value)
        return (
            <div
                className='Quote'
                data-testid='quote'
                dangerouslySetInnerHTML={{__html: html}}
            />
        )
    },
    runSlashCommand: (): void => {},
    editable: true,
    Input: (props: BlockInputProps) => {
        const ref = useRef<HTMLInputElement|null>(null)
        useEffect(() => {
            ref.current?.focus()
        }, [])
        return (
            <blockquote
                className='Quote'
            >
                <input
                    ref={ref}
                    data-testid='quote'
                    onChange={(e) => props.onChange(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (props.value === '' && e.key === 'Backspace') {
                            props.onCancel()
                        }
                        if (e.key === 'Enter') {
                            props.onSave(props.value)
                        }
                    }}
                    onBlur={() => props.onSave(props.value)}
                    value={props.value}
                />
            </blockquote>
        )
    },
}

Quote.runSlashCommand = (changeType: (contentType: ContentType) => void, changeValue: (value: string) => void, ...args: string[]): void => {
    changeType(Quote)
    changeValue(args.join(' '))
}

export default Quote
