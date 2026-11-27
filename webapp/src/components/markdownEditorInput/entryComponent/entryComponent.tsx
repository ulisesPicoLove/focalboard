// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {ReactElement} from 'react'
import {FormattedMessage} from 'react-intl'

import {IUser} from '../../../user'
import {IAppWindow} from '../../../types'
import GuestBadge from '../../../widgets/guestBadge'

import './entryComponent.scss'

const BotBadge = (window as IAppWindow).Components?.BotBadge

export type MentionUser = {
    user: IUser
    name: string
    avatar: string
    is_bot: boolean
    is_guest: boolean
    displayName: string
    isBoardMember: boolean
}

type Props = {
    mention: MentionUser
}

const Entry = ({mention}: Props): ReactElement => {
    return (
        <div className='EntryComponent'>
            <div className='EntryComponent__left'>
                <img
                    src={mention.avatar}
                    className='EntryComponent__avatar'
                    role='presentation'
                    alt=''
                />
                <div className='EntryComponent__name'>
                    {mention.name}
                    {BotBadge && mention.is_bot && <BotBadge/>}
                    <GuestBadge show={mention.is_guest}/>
                </div>
                <div className='EntryComponent__display-name'>
                    {mention.displayName}
                </div>
            </div>
            {!mention.isBoardMember &&
                <div className='EntryComponent__hint'>
                    <FormattedMessage
                        id='MentionSuggestion.is-not-board-member'
                        defaultMessage='(not board member)'
                    />
                </div>}
        </div>
    )
}

export default Entry
