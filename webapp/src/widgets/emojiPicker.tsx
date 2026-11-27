// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {FC} from 'react'

import 'emoji-mart/css/emoji-mart.css'
import {Picker, BaseEmoji, store as emojiMartStore} from 'emoji-mart'

import {UserSettings} from '../userSettings'
import './emojiPicker.scss'

import emojiSpirit from '../../static/emoji_spirit.png'

// The picker is loaded on demand, so its storage hooks are set here and not at startup
emojiMartStore.setHandlers({getter: UserSettings.getEmojiMartSetting, setter: UserSettings.setEmojiMartSetting})

type Props = {
    onSelect: (emoji: string) => void
}

const EmojiPicker: FC<Props> = (props: Props): React.JSX.Element => (
    <div
        className='EmojiPicker'
        onClick={(e) => e.stopPropagation()}
    >
        <Picker
            onSelect={(emoji: BaseEmoji) => props.onSelect(emoji.native)}
            backgroundImageFn={() => emojiSpirit}
        />
    </div>
)

export default EmojiPicker
