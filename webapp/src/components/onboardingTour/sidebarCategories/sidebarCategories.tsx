// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'

import {right} from '@popperjs/core'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from '../../tutorial_tour_tip/hooks'
import TourTipRenderer from '../tourTipRenderer/tourTipRenderer'
import {TOUR_BOARD, TOUR_SIDEBAR, SidebarTourSteps, FINISHED} from '../index'
import {useAppDispatch, useAppSelector} from '../../../store/hooks'
import {
    getMe,
    getOnboardingTourCategory,
    getOnboardingTourStep,
    patchProps,
} from '../../../store/users'
import {IUser, UserConfigPatch} from '../../../user'
import mutator from '../../../mutator'
import {Constants} from '../../../constants'

import './sidebarCategories.scss'

const SidebarCategoriesTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='SidebarTour.SidebarCategories.Title'
            defaultMessage='Sidebar categories'
        />
    )
    const screen = (
        <div>
            <FormattedMessage
                id='SidebarTour.SidebarCategories.Body'
                defaultMessage='All your boards are organized in the sidebar. Create custom categories to group them your way; categories are personal, so they do not affect other members.'
            />
        </div>
    )

    const punchout = useMeasurePunchouts(['.SidebarCategory'], [])

    const me = useAppSelector<IUser|null>(getMe)
    const dispatch = useAppDispatch()
    const onboardingTourCategory = useAppSelector(getOnboardingTourCategory)
    const onboardingTourStep = useAppSelector(getOnboardingTourStep)

    useEffect(() => {
        async function task() {
            if (!me) {
                return
            }

            const should = onboardingTourCategory === TOUR_BOARD &&
                           onboardingTourStep === FINISHED.toString()

            if (!should) {
                return
            }

            const patch: UserConfigPatch = {}
            patch.updatedFields = {}
            patch.updatedFields.tourCategory = TOUR_SIDEBAR
            patch.updatedFields.onboardingTourStep = SidebarTourSteps.SIDE_BAR.toString()
            patch.updatedFields.lastWelcomeVersion = Constants.versionString

            const updatedProps = await mutator.patchUserConfig(me.id, patch)
            if (updatedProps) {
                dispatch(patchProps(updatedProps))
            }
        }

        // this hack is needed to allow performing async task in useEffect
        task()

    // Start the tour once; re-running on user or tour state changes would patch the user config again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <TourTipRenderer
            key='SidebardCategoriesTourStep'
            requireCard={false}
            category={TOUR_SIDEBAR}
            step={SidebarTourSteps.SIDE_BAR}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='SidebarCategories'
            telemetryTag='tourPoint4a'
            placement={right}
            hideBackdrop={false}
            showForce={true}
        />
    )
}

export default SidebarCategoriesTourStep
