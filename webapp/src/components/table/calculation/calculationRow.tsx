// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useMemo} from 'react'

import {Constants} from '../../../constants'

import './calculationRow.scss'
import {Board, IPropertyTemplate} from '../../../blocks/board'

import mutator from '../../../mutator'
import Calculation from '../../calculations/calculation'
import {BoardView} from '../../../blocks/boardView'
import {Card} from '../../../blocks/card'
import {Options} from '../../calculations/options'
import {isDefined} from '../../../typeHelpers'

import {TableCalculationOptions} from './tableCalculationOptions'

type Props = {
    board: Board
    cards: Card[]
    activeView: BoardView
    readonly: boolean
}

const CalculationRow = (props: Props): React.JSX.Element => {
    const {board, cards, activeView, readonly} = props
    const toggleOptions = (templateId: string, show: boolean) => {
        const newShowOptions = new Map<string, boolean>(showOptions)
        newShowOptions.set(templateId, show)
        setShowOptions(newShowOptions)
    }

    const [showOptions, setShowOptions] = useState<Map<string, boolean>>(new Map<string, boolean>())
    const visiblePropertyTemplates = useMemo(() => ([
        {id: Constants.titleColumnId} as IPropertyTemplate,
        ...activeView.fields.visiblePropertyIds.map((id) => board.cardProperties.find((t) => t.id === id)).filter(isDefined),
    ]), [activeView.fields.visiblePropertyIds, board.cardProperties])

    const selectedCalculations = activeView.fields.columnCalculations || []

    const [hovered, setHovered] = useState(false)

    return (
        <div
            className={'CalculationRow octo-table-row'}
            onMouseEnter={() => setHovered(!readonly)}
            onMouseLeave={() => setHovered(false)}
        >
            {
                visiblePropertyTemplates.map((template) => {
                    const defaultValue = template.id === Constants.titleColumnId ? Options.count.value : Options.none.value
                    const value = selectedCalculations[template.id] || defaultValue

                    return (
                        <Calculation
                            key={template.id}
                            class={`octo-table-cell ${readonly ? 'disabled' : ''}`}
                            value={value}
                            menuOpen={Boolean(readonly ? false : showOptions.get(template.id))}
                            onMenuClose={() => toggleOptions(template.id, false)}
                            onMenuOpen={() => toggleOptions(template.id, true)}
                            onChange={(v: string) => {
                                const calculations = {...selectedCalculations}
                                calculations[template.id] = v
                                mutator.changeViewColumnCalculations(board.id, activeView.id, selectedCalculations, calculations, 'change column calculation')
                                setHovered(false)
                            }}
                            cards={cards}
                            property={template}
                            hovered={hovered}
                            optionsComponent={TableCalculationOptions}
                        />
                    )
                })
            }
        </div>
    )
}

export default CalculationRow
