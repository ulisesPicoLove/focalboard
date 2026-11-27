// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {PropertyType, PropertyTypeEnum, FilterValueType} from '../types'

import CreatedBy from './createdBy'

export default class CreatedByProperty extends PropertyType {
    Editor = CreatedBy
    name = 'Created By'
    type: PropertyTypeEnum = 'createdBy'
    isReadOnly = true
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.CreatedBy', defaultMessage: 'Created by'})
    canFilter = true
    filterValueType: FilterValueType = 'person'
    canGroup = true
}
