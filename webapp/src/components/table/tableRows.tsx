// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback} from 'react'

import {ActivationEvent} from '../../keyboardActivation'

import {Card} from '../../blocks/card'
import {Board} from '../../blocks/board'
import {BoardView} from '../../blocks/boardView'

import './table.scss'

import {MoveTarget} from '../cardActionsMenu/cardMoveItems'

import TableRow from './tableRow'

type Props = {
    board: Board
    activeView: BoardView
    cards: readonly Card[]
    selectedCardIds: string[]
    readonly: boolean
    cardIdToFocusOnRender: string
    showCard: (cardId?: string) => void
    addCard: (groupByOptionId?: string) => Promise<void>
    onCardClicked: (e: ActivationEvent, card: Card) => void
    onDrop: (srcCard: Card, dstCard: Card) => void

    // The keyboard alternative to dragging: "Move up", "Move down" and "Move to" a group
    onMove?: (card: Card, offset: -1 | 1, shownCards: readonly Card[]) => void
    moveTargets?: MoveTarget[]
    onMoveToGroup?: (card: Card, groupId: string) => void
}

const TableRows = (props: Props): React.JSX.Element => {
    const {board, cards, activeView} = props

    const {onCardClicked} = props
    const onClickRow = useCallback((e: React.MouseEvent<HTMLDivElement>, card: Card) => {
        onCardClicked(e, card)
    }, [onCardClicked])

    return (
        <>
            {cards.map((card, idx) => {
                return (
                    <TableRow
                        key={card.id + card.updateAt}
                        board={board}
                        columnWidths={activeView.fields.columnWidths}
                        isManualSort={activeView.fields.sortOptions.length === 0}
                        groupById={activeView.fields.groupById}
                        visiblePropertyIds={activeView.fields.visiblePropertyIds}
                        collapsedOptionIds={activeView.fields.collapsedOptionIds}
                        card={card}
                        addCard={props.addCard}
                        isSelected={props.selectedCardIds.includes(card.id)}
                        focusOnMount={props.cardIdToFocusOnRender === card.id}
                        isLastCard={idx === (cards.length - 1)}
                        onClick={onClickRow}
                        showCard={props.showCard}
                        readonly={props.readonly}
                        onDrop={props.onDrop}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < cards.length - 1}
                        onMove={(movedCard, offset) => props.onMove?.(movedCard, offset, cards)}
                        moveTargets={props.moveTargets}
                        onMoveToGroup={props.onMoveToGroup}
                    />)
            })}
        </>
    )
}

export default TableRows
