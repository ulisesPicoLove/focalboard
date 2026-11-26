// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react'

import {useIntl} from 'react-intl'

import {keyboardActivation} from '../../keyboardActivation'

import {IPropertyOption} from '../../blocks/board'

import Label from '../../widgets/label'
import {Utils, IDType} from '../../utils'
import mutator from '../../mutator'
import ValueSelector from '../../widgets/valueSelector'

import {PropertyProps} from '../types'

const SelectProperty = (props: PropertyProps) => {
    const {propertyValue, propertyTemplate, board, card} = props
    const intl = useIntl()

    const [open, setOpen] = useState(false)
    const isEditable = !props.readOnly && Boolean(board)

    const onCreate = useCallback((newValue) => {
        const option: IPropertyOption = {
            id: Utils.createGuid(IDType.BlockID),
            value: newValue,
            color: 'propColorDefault',
        }
        mutator.insertPropertyOption(board.id, board.cardProperties, propertyTemplate, option, 'add property option').then(() => {
            mutator.changePropertyValue(board.id, card, propertyTemplate.id, option.id)
        })
    }, [board.id, board.cardProperties, propertyTemplate, card])

    const emptyDisplayValue = props.showEmptyPlaceholder ? intl.formatMessage({id: 'PropertyValueElement.empty', defaultMessage: 'Empty'}) : ''

    const onChange = useCallback((newValue) => mutator.changePropertyValue(board.id, card, propertyTemplate.id, newValue), [board.id, card, propertyTemplate])
    const onChangeColor = useCallback((option: IPropertyOption, colorId: string) => mutator.changePropertyOptionColor(board.id, board.cardProperties, propertyTemplate, option, colorId), [board, propertyTemplate])
    const onDeleteOption = useCallback((option: IPropertyOption) => mutator.deletePropertyOption(board.id, board.cardProperties, propertyTemplate, option), [board, propertyTemplate])
    const onDeleteValue = useCallback(() => mutator.changePropertyValue(board.id, card, propertyTemplate.id, ''), [board.id, card, propertyTemplate.id])

    const option = propertyTemplate.options.find((o: IPropertyOption) => o.id === propertyValue)
    const propertyColorCssClassName = option?.color || ''
    const displayValue = option?.value
    const finalDisplayValue = displayValue || emptyDisplayValue

    if (!isEditable || !open) {
        return (
            <div
                className={props.property.valueClassName(!isEditable)}
                data-testid='select-non-editable'
                onClick={() => setOpen(true)}
                {...(isEditable ? {role: 'button', 'aria-haspopup': 'listbox' as const, ...keyboardActivation(() => setOpen(true))} : {tabIndex: 0})}
            >
                <Label color={displayValue ? propertyColorCssClassName : 'empty'}>
                    <span className='Label-text'>{finalDisplayValue}</span>
                </Label>
            </div>
        )
    }
    return (
        <ValueSelector
            emptyValue={emptyDisplayValue}
            options={propertyTemplate.options}
            value={propertyTemplate.options.find((p: IPropertyOption) => p.id === propertyValue)}
            onCreate={onCreate}
            onChange={onChange}
            onChangeColor={onChangeColor}
            onDeleteOption={onDeleteOption}
            onDeleteValue={onDeleteValue}
            onBlur={() => setOpen(false)}
        />
    )
}

export default React.memo(SelectProperty)
