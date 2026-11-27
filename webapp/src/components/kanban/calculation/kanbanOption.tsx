// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {OptionProps as SelectOptionProps} from 'react-select'

import {Option as SelectOption, typesByOptions} from '../../calculations/options'
import {IPropertyTemplate} from '../../../blocks/board'
import ChevronRight from '../../../widgets/icons/chevronRight'
import {Constants} from '../../../constants'

type OptionProps = SelectOption & {
    cardProperties: IPropertyTemplate[]
    onChange: (data: {calculation: string, propertyId: string}) => void
    activeValue: string
    activeProperty: IPropertyTemplate
}

// The select is typed with the plain option, but the options of this menu carry the extra fields
function isKanbanOption(option: SelectOption): option is OptionProps {
    return 'cardProperties' in option && 'onChange' in option && 'activeProperty' in option
}

// the only part of the select's props it reads is the option itself
const Option = (props: Pick<SelectOptionProps<SelectOption, false>, 'data'>): React.JSX.Element | null => {
    const [submenu, setSubmenu] = useState(false)
    const [height, setHeight] = useState(0)
    const [menuOptionRight, setMenuOptionRight] = useState(0)
    const [calculationToProperties, setCalculationToProperties] = useState<Map<string, IPropertyTemplate[]>>(new Map())

    const toggleOption = (e: React.MouseEvent<HTMLElement>) => {
        if (submenu) {
            setSubmenu(false)
        } else {
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            setHeight(rect.y)
            setMenuOptionRight(rect.x + rect.width)
            setSubmenu(true)
        }
    }

    const data = props.data
    if (!isKanbanOption(data)) {
        return null
    }

    if (!calculationToProperties.get(data.value)) {
        const supportedPropertyTypes = new Map<string, boolean>([])
        if (typesByOptions.get(data.value)) {
            (typesByOptions.get(data.value) || []).
                forEach((propertyType) => supportedPropertyTypes.set(propertyType, true))
        }

        const supportedProperties = data.cardProperties.
            filter((property) => supportedPropertyTypes.get(property.type) || supportedPropertyTypes.get('common'))

        calculationToProperties.set(data.value, supportedProperties)
        setCalculationToProperties(calculationToProperties)
    }

    return (
        <div
            className={`KanbanCalculationOptions_CustomOption ${data.activeValue === data.value ? 'active' : ''}`}
            onMouseEnter={toggleOption}
            onMouseLeave={toggleOption}
            onClick={() => {
                if (data.value !== 'count') {
                    return
                }

                data.onChange({
                    calculation: 'count',
                    propertyId: Constants.titleColumnId,
                })
            }}
        >
            <span>
                {data.label} {data.value !== 'count' && <ChevronRight/>}
            </span>

            {
                submenu && data.value !== 'count' && (
                    <div
                        className='dropdown-submenu'
                        style={{top: `${height - 10}px`, left: `${menuOptionRight}px`}}
                    >

                        {
                            calculationToProperties.get(data.value)?.map((property) => (
                                <div
                                    key={property.id}
                                    className={`drops ${data.activeProperty.id === property.id ? 'active' : ''}`}
                                    onClick={() => {
                                        data.onChange({
                                            calculation: data.value,
                                            propertyId: property.id,
                                        })
                                    }}
                                >
                                    <span>{property.name}</span>
                                </div>
                            ))
                        }
                    </div>
                )
            }
        </div>
    )
}

export {
    Option,
    OptionProps,
}
