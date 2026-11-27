// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import {Utils} from '../../utils'
import mutator from '../../mutator'
import {BoardView} from '../../blocks/boardView'

import {FilterClause} from '../../blocks/filterClause'
import {createFilterGroup, isAFilterGroupInstance} from '../../blocks/filterGroup'

import PersonSelector from '../personSelector'
import {IUser} from '../../user'

import './multiperson.scss'

type Props = {
    view: BoardView
    filter: FilterClause
}

const MultiPersonFilterValue = (props: Props): React.JSX.Element => {
    const {filter, view} = props
    const intl = useIntl()
    const emptyDisplayValue = intl.formatMessage({id: 'ConfirmPerson.search', defaultMessage: 'Search...'})

    return (
        <PersonSelector
            userIDs={filter.values}
            allowAddUsers={false}
            isMulti={true}
            readOnly={false}
            emptyDisplayValue={emptyDisplayValue}
            showMe={true}
            closeMenuOnSelect={false}
            onChange={(items, action) => {
                // this selector is multiple, so it reports a list; a single value is treated as a list of one
                let selected: readonly IUser[] = []
                if (Array.isArray(items)) {
                    selected = items
                } else if (items) {
                    selected = [items as IUser]
                }
                const filterIndex = view.fields.filter.filters.indexOf(filter)
                Utils.assert(filterIndex >= 0, "Can't find filter")

                const filterGroup = createFilterGroup(view.fields.filter)
                const newFilter = filterGroup.filters[filterIndex]
                Utils.assert(newFilter, `No filter at index ${filterIndex}`)
                if (!newFilter || isAFilterGroupInstance(newFilter)) {
                    return
                }

                if (action.action === 'select-option') {
                    newFilter.values = selected.map((a) => a.id)
                } else if (action.action === 'clear') {
                    newFilter.values = []
                } else if (action.action === 'remove-value') {
                    newFilter.values = selected.filter((a) => a.id !== action.removedValue.id).map((b) => b.id)
                }
                mutator.changeViewFilter(view.boardId, view.id, view.fields.filter, filterGroup)
            }}
        />
    )
}

export default MultiPersonFilterValue
