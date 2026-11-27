// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render} from '@testing-library/react'
import '@testing-library/jest-dom'

import {wrapDNDIntl} from '../../testUtils'

import DragScrollContainer, {createHorizontalStrength, createVerticalStrength} from './dragScroll'

describe('dragScroll strength', () => {
    const box = {x: 100, y: 100, w: 400, h: 300}

    test('is zero away from the edges and outside the box', () => {
        const horizontal = createHorizontalStrength(50)
        expect(horizontal(box, {x: 300, y: 200})).toBe(0)
        expect(horizontal(box, {x: 50, y: 200})).toBe(0)
        expect(horizontal(box, {x: 300, y: 50})).toBe(0)
    })

    test('is negative near the left edge, positive near the right, and grows toward the edge', () => {
        const horizontal = createHorizontalStrength(50)
        expect(horizontal(box, {x: 100, y: 200})).toBe(-1)
        expect(horizontal(box, {x: 125, y: 200})).toBeCloseTo(-0.5)
        expect(horizontal(box, {x: 500, y: 200})).toBe(1)
        expect(horizontal(box, {x: 475, y: 200})).toBeCloseTo(0.5)
    })

    test('works the same way vertically', () => {
        const vertical = createVerticalStrength(50)
        expect(vertical(box, {x: 200, y: 100})).toBe(-1)
        expect(vertical(box, {x: 200, y: 400})).toBe(1)
        expect(vertical(box, {x: 200, y: 250})).toBe(0)
    })

    test('the edge zone never takes more than half of a small box', () => {
        const horizontal = createHorizontalStrength(250)
        const small = {x: 0, y: 0, w: 100, h: 100}
        expect(horizontal(small, {x: 50, y: 50})).toBe(0)
        expect(horizontal(small, {x: 0, y: 50})).toBe(-1)
    })
})

describe('DragScrollContainer', () => {
    test('renders its children in a div with the given props', () => {
        const {container} = render(wrapDNDIntl(
            <DragScrollContainer
                className='Kanban'
                horizontalStrength={createHorizontalStrength(50)}
                verticalStrength={createVerticalStrength(50)}
            >
                <span>{'inside'}</span>
            </DragScrollContainer>,
        ))
        const div = container.querySelector('div.Kanban')
        expect(div).not.toBeNull()
        expect(div).toHaveTextContent('inside')
    })

    test('does not leave listeners on the page when it goes away', () => {
        const remove = jest.spyOn(window.document.body, 'removeEventListener')
        const {unmount} = render(wrapDNDIntl(
            <DragScrollContainer
                horizontalStrength={createHorizontalStrength(50)}
                verticalStrength={createVerticalStrength(50)}
            />,
        ))
        unmount()
        expect(remove.mock.calls.map((call) => call[0])).toContain('touchmove')
        remove.mockRestore()
    })
})
