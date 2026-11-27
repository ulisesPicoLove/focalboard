// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useEffect} from 'react'

import * as contentBlocks from './blocks/'
import {ContentType, ContentValue, BlockData} from './blocks/types'
import RootInput from './rootInput'

import './editor.scss'

type Props = {
    boardId?: string
    onSave: (block: BlockData) => Promise<BlockData|null>
    id?: string
    initialValue?: ContentValue
    initialContentType?: string
}

export default function Editor(props: Props) {
    // text while typing, or a file or checkbox value once a block of that kind was chosen
    const [value, setValue] = useState<ContentValue>(props.initialValue ?? '')
    const [currentBlockType, setCurrentBlockType] = useState<ContentType<ContentValue>|null>(contentBlocks.get(props.initialContentType || '') || null)

    useEffect(() => {
        if (!currentBlockType && typeof value === 'string') {
            const block = contentBlocks.getByPrefix(value)
            if (block) {
                setValue('')
                setCurrentBlockType(block)
            } else if (value !== '' && !contentBlocks.isSubPrefix(value) && !value.startsWith('/')) {
                setCurrentBlockType(contentBlocks.get('text') ?? null)
            }
        }
    }, [value, currentBlockType])

    const CurrentBlockInput = currentBlockType?.Input

    return (
        <div className='Editor'>
            {currentBlockType === null &&
                <RootInput
                    onChange={setValue}
                    onChangeType={setCurrentBlockType}
                    value={typeof value === 'string' ? value : ''}
                    onSave={async (val: string, blockType: string) => {
                        if (blockType === null && val === '') {
                            return
                        }
                        await props.onSave({value: val, contentType: blockType, id: props.id})
                        setValue('')
                        setCurrentBlockType(null)
                    }}
                />}
            {CurrentBlockInput &&
                <CurrentBlockInput
                    onChange={setValue}
                    value={value}
                    onCancel={() => {
                        setValue('')
                        setCurrentBlockType(null)
                    }}
                    onSave={async (val: ContentValue) => {
                        const newBlock = await props.onSave({value: val, contentType: currentBlockType.name, id: props.id})
                        setValue('')
                        const createdContentType = contentBlocks.get(newBlock?.contentType || '')
                        setCurrentBlockType(contentBlocks.get(createdContentType?.nextType || '') || null)
                    }}
                    currentBoardId={props.boardId}
                />}
        </div>
    )
}
