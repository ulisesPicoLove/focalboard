// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {IntlShape} from 'react-intl'

import Menu from '../../widgets/menu'

export type MoveTarget = {
    id: string
    name: string
}

type Props = {
    intl: IntlShape

    // "Move up" / "Move down" (a gallery has no up and down: "Move earlier" / "Move later")
    onMove?: (offset: -1 | 1) => void
    canMoveBack: boolean
    canMoveForward: boolean
    inGrid?: boolean

    // "Move to" a column or a group
    targets?: MoveTarget[]
    currentTargetId?: string
    onMoveToTarget?: (targetId: string) => void
}

// The items of a card's menu that move it without dragging: the keyboard alternative to drag and
// drop. Returned as a list of menu options (not a component) because Menu reads its children.
export function cardMoveItems(props: Props): React.ReactElement[] {
    const {intl} = props
    const items: React.ReactElement[] = []

    if (props.onMove) {
        const onMove = props.onMove
        items.push(
            <Menu.Text
                key='move-back'
                id='move-back'
                name={props.inGrid ? intl.formatMessage({id: 'CardActions.move-earlier', defaultMessage: 'Move earlier'}) : intl.formatMessage({id: 'CardActions.move-up', defaultMessage: 'Move up'})}
                disabled={!props.canMoveBack}
                onClick={() => onMove(-1)}
            />,
            <Menu.Text
                key='move-forward'
                id='move-forward'
                name={props.inGrid ? intl.formatMessage({id: 'CardActions.move-later', defaultMessage: 'Move later'}) : intl.formatMessage({id: 'CardActions.move-down', defaultMessage: 'Move down'})}
                disabled={!props.canMoveForward}
                onClick={() => onMove(1)}
            />,
        )
    }

    const {targets, onMoveToTarget} = props
    if (targets && onMoveToTarget && targets.length > 1) {
        items.push(
            <Menu.SubMenu
                key='move-to'
                id='move-to'
                name={intl.formatMessage({id: 'KanbanCard.move-to', defaultMessage: 'Move to'})}
                position='left'
            >
                {targets.map((target) => (
                    <Menu.Text
                        key={target.id || 'empty'}
                        id={`move-to-${target.id || 'empty'}`}
                        name={target.name}
                        check={target.id === props.currentTargetId}
                        disabled={target.id === props.currentTargetId}
                        onClick={() => onMoveToTarget(target.id)}
                    />
                ))}
            </Menu.SubMenu>,
        )
    }

    return items
}
