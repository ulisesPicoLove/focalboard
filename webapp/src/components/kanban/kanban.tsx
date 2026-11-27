// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable max-lines */
import React, {useCallback, useState, useMemo, useEffect} from 'react'

import {FormattedMessage, injectIntl, IntlShape} from 'react-intl'

import {ActivationEvent} from '../../keyboardActivation'

import {useAppSelector} from '../../store/hooks'

import {Position} from '../cardDetail/cardDetailContents'

import {Board, IPropertyOption, IPropertyTemplate, BoardGroup} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {BoardView} from '../../blocks/boardView'
import mutator from '../../mutator'
import {Utils, IDType} from '../../utils'
import {isDefined} from '../../typeHelpers'
import Button from '../../widgets/buttons/button'
import {Constants, Permission} from '../../constants'

import {dragAndDropRearrange} from '../cardDetail/cardDetailContentsUtility'

import {getCurrentBoardTemplates} from '../../store/cards'
import BoardPermissionGate from '../permissions/boardPermissionGate'

import {moveCardAmong} from '../../cardOrder'

import DragScrollContainer, {createHorizontalStrength, createVerticalStrength} from './dragScroll'

import KanbanCard from './kanbanCard'
import KanbanColumn from './kanbanColumn'
import KanbanColumnHeader from './kanbanColumnHeader'
import KanbanHiddenColumnItem from './kanbanHiddenColumnItem'

import './kanban.scss'

type Props = {
    board: Board
    activeView: BoardView
    cards: Card[]
    groupByProperty?: IPropertyTemplate
    visibleGroups: BoardGroup[]
    hiddenGroups: BoardGroup[]
    selectedCardIds: string[]
    intl: IntlShape
    readonly: boolean
    onCardClicked: (e: ActivationEvent, card: Card) => void
    addCard: (groupByOptionId?: string, show?: boolean) => Promise<void>
    addCardFromTemplate: (cardTemplateId: string, groupByOptionId?: string) => void
    showCard: (cardId?: string) => void
}

const hStrength = createHorizontalStrength(Utils.isMobile() ? 60 : 250)
const vStrength = createVerticalStrength(Utils.isMobile() ? 60 : 250)

const Kanban = (props: Props) => {
    const cardTemplates: Card[] = useAppSelector(getCurrentBoardTemplates)
    const {board, activeView, cards, groupByProperty, visibleGroups, hiddenGroups, selectedCardIds} = props
    const [defaultTemplateID, setDefaultTemplateID] = useState<string>()

    useEffect(() => {
        if (activeView.fields.defaultTemplateId) {
            if (cardTemplates.find((ct) => ct.id === activeView.fields.defaultTemplateId)) {
                setDefaultTemplateID(activeView.fields.defaultTemplateId)
            }
        }

    // Only re-check the default template when the view setting changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView.fields.defaultTemplateId])

    const propertyValues = groupByProperty?.options || []
    Utils.log(`${propertyValues.length} propertyValues`)

    const visiblePropertyTemplates = useMemo(() => {
        return board.cardProperties.filter(
            (template: IPropertyTemplate) => activeView.fields.visiblePropertyIds.includes(template.id),
        )
    }, [board.cardProperties, activeView.fields.visiblePropertyIds])
    const isManualSort = activeView.fields.sortOptions.length === 0
    const visibleBadges = activeView.fields.visiblePropertyIds.includes(Constants.badgesColumnId)

    const propertyNameChanged = useCallback(async (option: IPropertyOption, text: string): Promise<void> => {
        if (!groupByProperty) {
            return
        }
        await mutator.changePropertyOptionValue(board.id, board.cardProperties, groupByProperty, option, text)
    }, [board, groupByProperty])

    const addGroupClicked = useCallback(async () => {
        Utils.log('onAddGroupClicked')
        if (!groupByProperty) {
            return
        }

        const option: IPropertyOption = {
            id: Utils.createGuid(IDType.BlockID),
            value: 'New group',
            color: 'propColorDefault',
        }

        await mutator.insertPropertyOption(board.id, board.cardProperties, groupByProperty, option, 'add group')
    }, [board, groupByProperty])

    const orderAfterMoveToColumn = useCallback((cardIds: string[], columnId?: string): string[] => {
        let cardOrder = activeView.fields.cardOrder.slice()
        const columnGroup = visibleGroups.find((g) => g.option.id === columnId)
        const columnCards = columnGroup?.cards
        if (!columnCards || columnCards.length === 0) {
            return cardOrder
        }
        const lastCardId = columnCards[columnCards.length - 1]?.id
        if (lastCardId === undefined) {
            return cardOrder
        }
        const setOfIds = new Set(cardIds)
        cardOrder = cardOrder.filter((id) => !setOfIds.has(id))
        const lastCardIndex = cardOrder.indexOf(lastCardId)
        cardOrder.splice(lastCardIndex + 1, 0, ...cardIds)
        return cardOrder
    }, [activeView, visibleGroups])

    const onDropToColumn = useCallback(async (option: IPropertyOption, card?: Card, dstOption?: IPropertyOption) => {
        const optionId = option ? option.id : undefined
        if (!groupByProperty) {
            return
        }
        const groupById = groupByProperty.id

        let draggedCardIds = selectedCardIds
        if (card) {
            draggedCardIds = Array.from(new Set(selectedCardIds).add(card.id))
        }

        if (draggedCardIds.length > 0) {
            await mutator.performAsUndoGroup(async () => {
                const cardsById: { [key: string]: Card } = cards.reduce((acc: { [key: string]: Card }, c: Card): { [key: string]: Card } => {
                    acc[c.id] = c
                    return acc
                }, {})
                const draggedCards: Card[] = draggedCardIds.map((o: string) => cardsById[o]).filter(isDefined)
                const description = draggedCards.length > 1 ? `drag ${draggedCards.length} cards` : 'drag card'
                const awaits = []
                for (const draggedCard of draggedCards) {
                    Utils.log(`ondrop. Card: ${draggedCard.title}, column: ${optionId}`)
                    const oldValue = draggedCard.fields.properties[groupById]
                    if (optionId !== oldValue) {
                        awaits.push(mutator.changePropertyValue(board.id, draggedCard, groupById, optionId, description))
                    }
                }
                const newOrder = orderAfterMoveToColumn(draggedCardIds, optionId)
                awaits.push(mutator.changeViewCardOrder(board.id, activeView.id, activeView.fields.cardOrder, newOrder, description))
                await Promise.all(awaits)
            })
        } else if (dstOption) {
            Utils.log(`ondrop. Header option: ${dstOption.value}, column: ${option?.value}`)

            const visibleOptionIds = visibleGroups.map((o) => o.option.id)
            const srcBlockX = visibleOptionIds.indexOf(option.id)
            const dstBlockX = visibleOptionIds.indexOf(dstOption.id)

            // Here aboveRow means to the left while belowRow means to the right
            const moveTo: Position = srcBlockX > dstBlockX ? 'aboveRow' : 'belowRow'

            const visibleOptionIdsRearranged = dragAndDropRearrange({
                contentOrder: visibleOptionIds,
                srcBlockX,
                srcBlockY: -1,
                dstBlockX,
                dstBlockY: -1,
                srcBlockId: option.id,
                dstBlockId: dstOption.id,
                moveTo,
            }).flat()

            await mutator.changeViewVisibleOptionIds(board.id, activeView.id, activeView.fields.visibleOptionIds, visibleOptionIdsRearranged)
        }
    }, [selectedCardIds, cards, orderAfterMoveToColumn, activeView.id, activeView.fields.cardOrder, activeView.fields.visibleOptionIds, groupByProperty, visibleGroups, board.id])

    // The "Move to" menu of a card: the visible columns, marking the one it is in
    const moveTargets = useMemo(() => visibleGroups.map((group) => ({id: group.option.id, name: group.option.value})), [visibleGroups])
    const onMoveCardToColumn = useCallback((card: Card, optionId: string) => {
        const option = visibleGroups.find((group) => group.option.id === optionId)?.option
        if (option) {
            onDropToColumn(option, card)
        }
    }, [visibleGroups, onDropToColumn])

    // "Move up" and "Move down" in the menu of a card: one place inside its column
    const onMoveCard = useCallback((card: Card, offset: -1 | 1, shownCards: readonly Card[]) => {
        const savedOrder = Array.from(new Set([...activeView.fields.cardOrder, ...cards.map((c) => c.id)]))
        const cardOrder = moveCardAmong(savedOrder, shownCards.map((c) => c.id), card.id, offset)
        if (!cardOrder) {
            return
        }
        mutator.performAsUndoGroup(async () => {
            await mutator.changeViewCardOrder(board.id, activeView.id, activeView.fields.cardOrder, cardOrder, 'move card')
        })
    }, [activeView.fields.cardOrder, activeView.id, cards, board.id])

    const onDropToCard = useCallback(async (srcCard: Card, dstCard: Card) => {
        if (srcCard.id === dstCard.id || !groupByProperty) {
            return
        }
        Utils.log(`onDropToCard: ${dstCard.title}`)
        const groupById = groupByProperty.id
        const optionId = dstCard.fields.properties[groupById]

        const draggedCardIds = Array.from(new Set(selectedCardIds).add(srcCard.id))

        const description = draggedCardIds.length > 1 ? `drag ${draggedCardIds.length} cards` : 'drag card'

        // Update dstCard order
        const cardsById: { [key: string]: Card } = cards.reduce((acc: { [key: string]: Card }, card: Card): { [key: string]: Card } => {
            acc[card.id] = card
            return acc
        }, {})
        const draggedCards: Card[] = draggedCardIds.map((o: string) => cardsById[o]).filter(isDefined)
        let cardOrder = cards.map((o) => o.id)
        const isDraggingDown = cardOrder.indexOf(srcCard.id) <= cardOrder.indexOf(dstCard.id)
        cardOrder = cardOrder.filter((id) => !draggedCardIds.includes(id))
        let destIndex = cardOrder.indexOf(dstCard.id)
        if (srcCard.fields.properties[groupById] === optionId && isDraggingDown) {
            // If the cards are in the same column and dragging down, drop after the target dstCard
            destIndex += 1
        }
        cardOrder.splice(destIndex, 0, ...draggedCardIds)

        await mutator.performAsUndoGroup(async () => {
            // Update properties of dragged cards
            const awaits = []
            for (const draggedCard of draggedCards) {
                Utils.log(`draggedCard: ${draggedCard.title}, column: ${optionId}`)
                const oldOptionId = draggedCard.fields.properties[groupById]
                if (optionId !== oldOptionId) {
                    awaits.push(mutator.changePropertyValue(board.id, draggedCard, groupById, optionId, description))
                }
            }
            await Promise.all(awaits)
            await mutator.changeViewCardOrder(board.id, activeView.id, activeView.fields.cardOrder, cardOrder, description)
        })
    }, [groupByProperty, selectedCardIds, cards, activeView.id, activeView.fields.cardOrder, board.id])

    const [showCalculationsMenu, setShowCalculationsMenu] = useState<Map<string, boolean>>(new Map<string, boolean>())
    const toggleOptions = (templateId: string, show: boolean) => {
        const newShowOptions = new Map<string, boolean>(showCalculationsMenu)
        newShowOptions.set(templateId, show)
        setShowCalculationsMenu(newShowOptions)
    }

    if (!groupByProperty) {
        Utils.assertFailure('Board views must have groupByProperty set')
        return <div/>
    }

    return (
        <DragScrollContainer
            className='Kanban'
            horizontalStrength={hStrength}
            verticalStrength={vStrength}
        >
            <div
                className='octo-board-header'
                id='mainBoardHeader'
            >
                {/* Column headers */}

                {visibleGroups.map((group) => (
                    <KanbanColumnHeader
                        key={group.option.id}
                        group={group}
                        board={board}
                        activeView={activeView}
                        intl={props.intl}
                        groupByProperty={groupByProperty}
                        addCard={props.addCard}
                        readonly={props.readonly}
                        propertyNameChanged={propertyNameChanged}
                        onDropToColumn={onDropToColumn}
                        calculationMenuOpen={showCalculationsMenu.get(group.option.id) || false}
                        onCalculationMenuOpen={() => toggleOptions(group.option.id, true)}
                        onCalculationMenuClose={() => toggleOptions(group.option.id, false)}
                    />
                ))}

                {/* Hidden column header */}

                {hiddenGroups.length > 0 &&
                    <div className='octo-board-header-cell narrow'>
                        <FormattedMessage
                            id='BoardComponent.hidden-columns'
                            defaultMessage='Hidden columns'
                        />
                    </div>
                }

                {!props.readonly &&
                    <BoardPermissionGate permissions={[Permission.ManageBoardProperties]}>
                        <div className='octo-board-header-cell narrow'>
                            <Button
                                onClick={addGroupClicked}
                            >
                                <FormattedMessage
                                    id='BoardComponent.add-a-group'
                                    defaultMessage='+ Add a group'
                                />
                            </Button>
                        </div>
                    </BoardPermissionGate>
                }
            </div>

            {/* Main content */}

            <div
                className='octo-board-body'
                id='mainBoardBody'
            >
                {/* Columns */}

                {visibleGroups.map((group) => (
                    <KanbanColumn
                        key={group.option.id || 'empty'}
                        onDrop={(card: Card) => onDropToColumn(group.option, card)}
                    >
                        {group.cards.map((card, index) => (
                            <KanbanCard
                                card={card}
                                board={board}
                                visiblePropertyTemplates={visiblePropertyTemplates}
                                visibleBadges={visibleBadges}
                                key={card.id}
                                readonly={props.readonly}
                                isSelected={props.selectedCardIds.includes(card.id)}
                                onClick={props.onCardClicked}
                                onDrop={onDropToCard}
                                showCard={props.showCard}
                                isManualSort={isManualSort}
                                columnId={group.option.id}
                                moveTargets={moveTargets}
                                onMoveToColumn={onMoveCardToColumn}
                                canMoveUp={index > 0}
                                canMoveDown={index < group.cards.length - 1}
                                onMove={(movedCard, offset) => onMoveCard(movedCard, offset, group.cards)}
                            />
                        ))}
                        {!props.readonly &&
                            <BoardPermissionGate permissions={[Permission.ManageBoardCards]}>
                                <Button
                                    onClick={() => {
                                        if (defaultTemplateID) {
                                            props.addCardFromTemplate(defaultTemplateID, group.option.id)
                                        } else {
                                            props.addCard(group.option.id, true)
                                        }
                                    }}
                                >
                                    <FormattedMessage
                                        id='BoardComponent.new'
                                        defaultMessage='+ New'
                                    />
                                </Button>
                            </BoardPermissionGate>
                        }
                    </KanbanColumn>
                ))}

                {/* Hidden columns */}

                {hiddenGroups.length > 0 &&
                    <div className='octo-board-column narrow'>
                        {hiddenGroups.map((group) => (
                            <KanbanHiddenColumnItem
                                key={group.option.id}
                                group={group}
                                activeView={activeView}
                                intl={props.intl}
                                readonly={props.readonly}
                                onDrop={(card: Card) => onDropToColumn(group.option, card)}
                            />
                        ))}
                    </div>}
            </div>
        </DragScrollContainer>
    )
}

export default injectIntl(Kanban)
