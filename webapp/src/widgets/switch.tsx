// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {keyboardActivation} from '../keyboardActivation'

import './switch.scss'

type Props = {
    onChanged: (isOn: boolean) => void
    isOn: boolean
    readOnly?: boolean
    size?: string

    // Name for assistive technology; a switch without a visible label needs one
    ariaLabel?: string

    // The switch only shows a state that a parent control already exposes (a menu option)
    decorative?: boolean
}

// Switch is an on-off style switch / checkbox
function Switch(props: Props): React.JSX.Element {
    const switchSize = `size--${props.size === 'medium' ? 'medium' : 'small'}`
    const switchIsOn = props.isOn ? ' on' : ''
    const switchIsReadonly = props.readOnly ? ' readonly' : ''
    const className = `Switch override-main ${switchSize}${switchIsOn}${switchIsReadonly}`
    const toggle = () => {
        if (!props.readOnly) {
            props.onChanged(!props.isOn)
        }
    }

    if (props.decorative) {
        return (
            <div
                className={className}
                aria-hidden='true'
            >
                <div className='octo-switch-inner'/>
            </div>
        )
    }

    return (
        <div
            className={className}
            role='switch'
            aria-checked={props.isOn}
            aria-readonly={props.readOnly || undefined}
            aria-label={props.ariaLabel}
            onClick={toggle}
            {...keyboardActivation(toggle)}
        >
            <div className='octo-switch-inner'/>
        </div>
    )
}

export default React.memo(Switch)
