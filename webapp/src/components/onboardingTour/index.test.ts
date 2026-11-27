// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TourCategoriesMapToSteps} from './index'

// "Next" moves a tour to the following step number: a number that no tip renders would leave the
// tour stalled (it happened with a "copy link" step that had been removed).
describe('onboarding tour steps', () => {
    for (const [category, steps] of Object.entries(TourCategoriesMapToSteps)) {
        test(`the steps of "${category}" are numbered 0, 1, 2... without gaps`, () => {
            const numbers = Object.values(steps).sort((a, b) => a - b)
            expect(numbers).toEqual(numbers.map((_, i) => i))
        })
    }
})
