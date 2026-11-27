// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {useIntl} from 'react-intl'

import {Block} from '../../blocks/block'
import {Utils, isDefined} from '../../utils'
import {useAppSelector} from '../../store/hooks'
import {getLastCardContent} from '../../store/contents'
import {getLastCardComment} from '../../store/comments'
import './updatedTime.scss'

import {PropertyProps} from '../types'

const UpdatedTime = (props: PropertyProps): React.JSX.Element => {
    const intl = useIntl()
    const lastContent = useAppSelector(getLastCardContent(props.card.id || ''))
    const lastComment = useAppSelector(getLastCardComment(props.card.id))

    let latestBlock: Block = props.card
    if (props.card) {
        const allBlocks: Block[] = [props.card, lastContent, lastComment].filter(isDefined)
        latestBlock = allBlocks.reduce((latest, block) => (block.updateAt > latest.updateAt ? block : latest), latestBlock)
    }

    return (
        <div className={`UpdatedTime ${props.property.valueClassName(true)}`}>
            {Utils.displayDateTime(new Date(latestBlock.updateAt), intl)}
        </div>
    )
}

export default UpdatedTime
