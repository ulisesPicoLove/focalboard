// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {CalculationOptions, CommonCalculationOptionProps, commonOptions, optionsByType} from '../../calculations/options'

export const TableCalculationOptions = (props: CommonCalculationOptionProps): React.JSX.Element => {
    const options = [...commonOptions]
    const typeOptions = props.property && optionsByType.get(props.property.type)
    if (typeOptions) {
        options.push(...typeOptions)
    }

    return (
        <CalculationOptions
            value={props.value}
            menuOpen={props.menuOpen}
            onClose={props.onClose}
            onChange={props.onChange}
            property={props.property}
            options={options}
        />
    )
}
