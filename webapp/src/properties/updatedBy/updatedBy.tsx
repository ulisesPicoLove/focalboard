// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {Block} from '../../blocks/block'
import {isDefined} from '../../typeHelpers'
import {useAppSelector} from '../../store/hooks'
import {getLastCardContent} from '../../store/contents'
import {getLastCardComment} from '../../store/comments'
import Person from '../person/person'

import {PropertyProps} from '../types'

const LastModifiedBy = (props: PropertyProps): React.JSX.Element => {
    const lastContent = useAppSelector(getLastCardContent(props.card.id || ''))
    const lastComment = useAppSelector(getLastCardComment(props.card.id))

    let latestBlock: Block = props.card
    if (props.board) {
        const allBlocks: Block[] = [props.card, lastContent, lastComment].filter(isDefined)
        latestBlock = allBlocks.reduce((latest, block) => (block.updateAt > latest.updateAt ? block : latest), latestBlock)
    }

    return (
        <Person
            {...props}
            propertyValue={latestBlock.modifiedBy}
            readOnly={true} // created by is an immutable property, so will always be readonly
        />
    )
}

export default LastModifiedBy
