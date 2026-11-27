// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from '../../tutorial_tour_tip/hooks'

import './shareBoard.scss'

import {BoardTourSteps, TOUR_BOARD} from '../index'
import TourTipRenderer from '../tourTipRenderer/tourTipRenderer'

const ShareBoardTourStep = (): React.JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='OnboardingTour.ShareBoard.Title'
            defaultMessage='Share board'
        />
    )
    const screen = (
        <FormattedMessage
            id='OnboardingTour.ShareBoard.Body'
            defaultMessage='Share your board with your teammates: add them as members and copy the link to send it to them.'
        />
    )

    const punchout = useMeasurePunchouts(['.ShareBoardButton > button'], [])

    return (
        <TourTipRenderer
            key='ShareBoardTourStep'
            requireCard={false}
            category={TOUR_BOARD}
            step={BoardTourSteps.SHARE_BOARD}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='ShareBoardTourStep'
            telemetryTag='tourPoint2b'
            placement={'bottom-end'}
            hideBackdrop={true}
        />
    )
}

export default ShareBoardTourStep
