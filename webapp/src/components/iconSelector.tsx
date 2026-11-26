// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {Suspense} from 'react'
import {useIntl} from 'react-intl'

import RandomIcon from '../widgets/icons/random'
import DeleteIcon from '../widgets/icons/delete'
import EmojiIcon from '../widgets/icons/emoji'
import Menu from '../widgets/menu'
import MenuWrapper from '../widgets/menuWrapper'
import './iconSelector.scss'

// The emoji picker (emoji-mart and its data) is only needed when the menu is opened
const EmojiPicker = React.lazy(() => import('../widgets/emojiPicker'))

type Props = {
    readonly?: boolean
    iconElement: any
    onAddRandomIcon: any
    onSelectEmoji: any
    onRemoveIcon: any
}

const IconSelector = React.memo((props: Props) => {
    const intl = useIntl()

    return (
        <div className='IconSelector'>
            {props.readonly && props.iconElement}
            {!props.readonly &&
                <MenuWrapper>
                    {props.iconElement}
                    <Menu>
                        <Menu.Text
                            id='random'
                            icon={<RandomIcon/>}
                            name={intl.formatMessage({id: 'ViewTitle.random-icon', defaultMessage: 'Random'})}
                            onClick={props.onAddRandomIcon}
                        />
                        <Menu.SubMenu
                            id='pick'
                            icon={<EmojiIcon/>}
                            name={intl.formatMessage({id: 'ViewTitle.pick-icon', defaultMessage: 'Pick icon'})}
                        >
                            <Suspense fallback={null}>
                                <EmojiPicker onSelect={props.onSelectEmoji}/>
                            </Suspense>
                        </Menu.SubMenu>
                        <Menu.Text
                            id='remove'
                            icon={<DeleteIcon/>}
                            name={intl.formatMessage({id: 'ViewTitle.remove-icon', defaultMessage: 'Remove icon'})}
                            onClick={props.onRemoveIcon}
                        />
                    </Menu>
                </MenuWrapper>
            }
        </div>
    )
})

export default IconSelector
