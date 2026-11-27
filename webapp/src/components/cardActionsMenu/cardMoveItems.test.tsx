// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import '@testing-library/jest-dom'
import {createIntl} from 'react-intl'

import {wrapIntl} from '../../testUtils'
import Menu from '../../widgets/menu'

import {cardMoveItems} from './cardMoveItems'

const intl = createIntl({locale: 'en'})

describe('components/cardActionsMenu/cardMoveItems', () => {
    test('"Move up" and "Move down" move the card and are reachable from the keyboard', () => {
        const onMove = jest.fn()
        render(wrapIntl(<Menu>{cardMoveItems({intl, onMove, canMoveBack: true, canMoveForward: true})}</Menu>))

        fireEvent.keyDown(screen.getByRole('button', {name: 'Move up'}), {key: 'Enter'})
        expect(onMove).toHaveBeenLastCalledWith(-1)

        fireEvent.keyDown(screen.getByRole('button', {name: 'Move down'}), {key: 'Enter'})
        expect(onMove).toHaveBeenLastCalledWith(1)
    })

    test('the first card can not go up and the last one can not go down', () => {
        const onMove = jest.fn()
        render(wrapIntl(<Menu>{cardMoveItems({intl, onMove, canMoveBack: false, canMoveForward: false})}</Menu>))

        expect(screen.getByRole('button', {name: 'Move up'})).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByRole('button', {name: 'Move down'})).toHaveAttribute('aria-disabled', 'true')
    })

    test('a gallery moves cards earlier and later', () => {
        render(wrapIntl(<Menu>{cardMoveItems({intl, inGrid: true, onMove: jest.fn(), canMoveBack: true, canMoveForward: true})}</Menu>))

        expect(screen.getByRole('button', {name: 'Move earlier'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Move later'})).toBeInTheDocument()
        expect(screen.queryByRole('button', {name: 'Move up'})).toBeNull()
    })

    test('without a manual order there is nothing to move up or down', () => {
        render(wrapIntl(<Menu>{cardMoveItems({intl, canMoveBack: true, canMoveForward: true})}</Menu>))

        expect(screen.queryByRole('button', {name: 'Move up'})).toBeNull()
    })

    test('"Move to" lists the groups and marks the one the card is in', () => {
        const onMoveToTarget = jest.fn()
        const targets = [{id: 'todo', name: 'To do'}, {id: 'done', name: 'Done'}]
        const {container} = render(wrapIntl(<Menu>{cardMoveItems({intl, canMoveBack: false, canMoveForward: false, targets, currentTargetId: 'todo', onMoveToTarget})}</Menu>))

        fireEvent.mouseEnter(screen.getByRole('button', {name: 'Move to'}))
        expect(container.ownerDocument.body).toHaveTextContent('Done')
    })

    test('a single group has nothing to move to', () => {
        render(wrapIntl(<Menu>{cardMoveItems({intl, canMoveBack: false, canMoveForward: false, targets: [{id: 'a', name: 'A'}], onMoveToTarget: jest.fn()})}</Menu>))

        expect(screen.queryByRole('button', {name: 'Move to'})).toBeNull()
    })
})
