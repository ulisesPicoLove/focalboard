// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {PropertyProps} from '../types'
import BaseTextEditor from '../baseTextEditor'
import {asText} from '../../typeHelpers'

const Number = (props: PropertyProps): React.JSX.Element => {
    return (
        <BaseTextEditor
            {...props}
            validator={() => props.propertyValue === '' || !isNaN(parseInt(asText(props.propertyValue), 10))}
        />
    )
}
export default Number
