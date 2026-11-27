// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useCallback, useMemo} from 'react'

import {useIntl} from 'react-intl'

import {ActivationEvent, keyboardActivation} from '../../keyboardActivation'

import {Board, IPropertyTemplate} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {useSortable} from '../../hooks/sortable'
import mutator from '../../mutator'
import {Utils} from '../../utils'
import MenuWrapper from '../../widgets/menuWrapper'
import Tooltip from '../../widgets/tooltip'
import PropertyValueElement from '../propertyValueElement'
import ConfirmationDialogBox, {ConfirmationDialogBoxProps} from '../confirmationDialogBox'
import './kanbanCard.scss'
import CardBadges from '../cardBadges'
import CardActionsMenu from '../cardActionsMenu/cardActionsMenu'
import CardActionsMenuIcon from '../cardActionsMenu/cardActionsMenuIcon'
import Menu from '../../widgets/menu'

export const OnboardingCardClassName = 'onboardingCard'

type Props = {
    card: Card
    board: Board
    visiblePropertyTemplates: IPropertyTemplate[]
    isSelected: boolean
    visibleBadges: boolean
    onClick?: (e: ActivationEvent, card: Card) => void
    readonly: boolean
    onDrop: (srcCard: Card, dstCard: Card) => void
    showCard: (cardId?: string) => void
    isManualSort: boolean

    // Columns this card can be moved to from its menu (the keyboard alternative to dragging)
    columnId?: string
    moveTargets?: MoveTarget[]
    onMoveToColumn?: (card: Card, optionId: string) => void
}

export type MoveTarget = {
    id: string
    name: string
}

const KanbanCard = (props: Props) => {
    const {card, board} = props
    const intl = useIntl()
    const [isDragging, isOver, cardRef] = useSortable('card', card, !props.readonly, props.onDrop)
    const visiblePropertyTemplates = props.visiblePropertyTemplates || []
    let className = props.isSelected ? 'KanbanCard selected' : 'KanbanCard'
    if (props.isManualSort && isOver) {
        className += ' dragover'
    }

    const [showConfirmationDialogBox, setShowConfirmationDialogBox] = useState<boolean>(false)
    const handleDeleteCard = useCallback(() => {
        if (!card) {
            Utils.assertFailure()
            return
        }
        mutator.deleteBlock(card, 'delete card')
    }, [card])

    const confirmDialogProps: ConfirmationDialogBoxProps = useMemo(() => {
        return {
            heading: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-heading', defaultMessage: 'Confirm card delete!'}),
            confirmButtonText: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-button-text', defaultMessage: 'Delete'}),
            onConfirm: handleDeleteCard,
            onClose: () => {
                setShowConfirmationDialogBox(false)
            },
        }
    }, [handleDeleteCard, intl])

    const handleDeleteButtonOnClick = useCallback(() => {
        // user trying to delete a card with blank name
        // but content present cannot be deleted without
        // confirmation dialog
        if (card?.title === '' && card?.fields?.contentOrder?.length === 0) {
            handleDeleteCard()
            return
        }
        setShowConfirmationDialogBox(true)
    }, [handleDeleteCard, card.title, card?.fields?.contentOrder?.length])

    const {onClick} = props
    const handleOnClick = useCallback((e: ActivationEvent) => {
        if (onClick) {
            onClick(e, card)
        }
    }, [onClick, card])

    return (
        <>
            <div
                ref={props.readonly ? undefined : cardRef}
                className={`${className}`}
                draggable={!props.readonly}
                style={{opacity: isDragging ? 0.5 : 1}}
                role='button'
                aria-label={card.title || intl.formatMessage({id: 'KanbanCard.untitled', defaultMessage: 'Untitled'})}
                onClick={handleOnClick}
                {...keyboardActivation(handleOnClick)}
            >
                {!props.readonly &&
                <MenuWrapper
                    className={'optionsMenu'}
                    stopPropagationOnToggle={true}
                >
                    <CardActionsMenuIcon/>
                    <CardActionsMenu
                        cardId={card.id}
                        boardId={card.boardId}
                        onClickDelete={handleDeleteButtonOnClick}
                        onClickDuplicate={() => {
                            mutator.duplicateCard(
                                card.id,
                                board.id,
                                false,
                                'duplicate card',
                                false,
                                {},
                                async (newCardId) => {
                                    props.showCard(newCardId)
                                },
                                async () => {
                                    props.showCard(undefined)
                                },
                            )
                        }}
                    >
                        {props.moveTargets && props.onMoveToColumn && props.moveTargets.length > 1 &&
                            <Menu.SubMenu
                                id='move-to'
                                name={intl.formatMessage({id: 'KanbanCard.move-to', defaultMessage: 'Move to'})}
                                position='left'
                            >
                                {props.moveTargets.map((target) => (
                                    <Menu.Text
                                        key={target.id || 'empty'}
                                        id={`move-to-${target.id || 'empty'}`}
                                        name={target.name}
                                        check={target.id === props.columnId}
                                        disabled={target.id === props.columnId}
                                        onClick={() => props.onMoveToColumn!(card, target.id)}
                                    />
                                ))}
                            </Menu.SubMenu>
                        }
                    </CardActionsMenu>
                </MenuWrapper>
                }

                <div className='octo-icontitle'>
                    { card.fields.icon ? <div className='octo-icon'>{card.fields.icon}</div> : undefined }
                    <div
                        key='__title'
                        className='octo-titletext'
                    >
                        {card.title || intl.formatMessage({id: 'KanbanCard.untitled', defaultMessage: 'Untitled'})}
                    </div>
                </div>
                {visiblePropertyTemplates.map((template) => (
                    <Tooltip
                        key={template.id}
                        title={template.name}
                    >
                        <PropertyValueElement
                            board={board}
                            readOnly={true}
                            card={card}
                            propertyTemplate={template}
                            showEmptyPlaceholder={false}
                        />
                    </Tooltip>
                ))}
                {props.visibleBadges && <CardBadges card={card}/>}
            </div>

            {showConfirmationDialogBox && <ConfirmationDialogBox dialogBox={confirmDialogProps}/>}

        </>
    )
}

export default React.memo(KanbanCard)
