// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import picoboardLogo from '../../../static/picoboard-logo.svg'

import './picoboardLogo.scss'

// The Pico.Love mark has cream letterforms, so it always sits on a dark tile
// to stay legible on every theme (including light sidebars).
export default function PicoboardLogo(): JSX.Element {
    return (
        <span className='PicoboardLogo Icon'>
            <img
                src={picoboardLogo}
                alt='Picoboard'
            />
        </span>
    )
}
