// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {useIntl} from 'react-intl'

import {Card} from '../../../blocks/card'
import Button from '../../../widgets/buttons/button'
import './calculation.scss'
import {IPropertyTemplate} from '../../../blocks/board'

import Calculations from '../../calculations/calculations'

import {KanbanCalculationOptions} from './calculationOptions'

type Props = {
    cards: Card[]
    cardProperties: IPropertyTemplate[]
    menuOpen: boolean
    onMenuClose: () => void
    onMenuOpen: () => void
    onChange: (data: { calculation: string, propertyId: string }) => void
    value: string
    property: IPropertyTemplate
    readonly: boolean
}

function KanbanCalculation(props: Props): React.JSX.Element {
    const intl = useIntl()
    const calculate = Calculations[props.value]
    const calculated = calculate ? calculate(props.cards, props.property, intl) : ''

    return (
        <div className='KanbanCalculation'>
            <Button
                onClick={() => (props.menuOpen ? props.onMenuClose : props.onMenuOpen)()}
                onBlur={props.onMenuClose}
                title={calculated}
            >
                {calculated}
            </Button>

            {
                !props.readonly && props.menuOpen && (
                    <KanbanCalculationOptions
                        value={props.value}
                        property={props.property}
                        menuOpen={props.menuOpen}
                        onChange={(data: { calculation: string, propertyId: string }) => {
                            props.onChange(data)
                            props.onMenuClose()
                        }}
                        cardProperties={props.cardProperties}
                    />
                )
            }
        </div>
    )
}

export {
    KanbanCalculation,
}
