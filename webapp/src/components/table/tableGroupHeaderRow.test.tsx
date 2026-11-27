// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {fireEvent, render, act} from '@testing-library/react'
import '@testing-library/jest-dom'

import 'isomorphic-fetch'

import userEvent from '@testing-library/user-event'

import {wrapDNDIntl} from '../../testUtils'

import {TestBlockFactory} from '../../test/testBlockFactory'

import {ColumnResizeProvider} from './tableColumnResizeContext'
import TableGroupHeaderRowElement from './tableGroupHeaderRow'

const board = TestBlockFactory.createBoard()
const view = TestBlockFactory.createBoardView(board)

const view2 = TestBlockFactory.createBoardView(board)
view2.fields.sortOptions = []

const boardTreeNoGroup = {
    option: {
        id: '',
        value: '',
        color: 'propColorBrown',
    },
    cards: [],
}

const boardTreeGroup = {
    option: {
        id: 'value1',
        value: 'value 1',
        color: 'propColorBrown',
    },
    cards: [],
}

const Wrapper: React.FC<{children?: React.ReactNode}> = ({children}) => {
    return wrapDNDIntl(
        <ColumnResizeProvider
            columnWidths={{}}
            onResizeColumn={jest.fn()}
        >
            {children}
        </ColumnResizeProvider>,
    )
}

test('should match snapshot, no groups', async () => {
    const {container} = render(
        <Wrapper>
            <TableGroupHeaderRowElement
                board={board}
                activeView={view}
                group={boardTreeNoGroup}
                readonly={false}
                hideGroup={jest.fn()}
                addCard={jest.fn()}
                propertyNameChanged={jest.fn()}
                onDrop={jest.fn()}
                groupByProperty={{
                    id: '',
                    name: 'Property 1',
                    type: 'text',
                    options: [{id: 'property1', value: 'Property 1', color: ''}],
                }}
            />
        </Wrapper>,
    )
    expect(container).toMatchSnapshot()
})

test('should match snapshot with Group', async () => {
    const {container} = render(
        <Wrapper>
            <TableGroupHeaderRowElement
                board={board}
                activeView={view}
                group={boardTreeGroup}
                readonly={false}
                hideGroup={jest.fn()}
                addCard={jest.fn()}
                propertyNameChanged={jest.fn()}
                onDrop={jest.fn()}
            />
        </Wrapper>,
    )
    expect(container).toMatchSnapshot()
})

test('should match snapshot on read only', async () => {
    const {container} = render(
        <Wrapper>
            <TableGroupHeaderRowElement
                board={board}
                activeView={view}
                group={boardTreeGroup}
                readonly={true}
                hideGroup={jest.fn()}
                addCard={jest.fn()}
                propertyNameChanged={jest.fn()}
                onDrop={jest.fn()}
            />
        </Wrapper>,
    )
    expect(container).toMatchSnapshot()
})

test('should match snapshot, hide group', async () => {
    const hideGroup = jest.fn()

    const collapsedOptionsView = TestBlockFactory.createBoardView(board)
    collapsedOptionsView.fields.collapsedOptionIds = [boardTreeGroup.option.id]

    const {container} = render(
        <Wrapper>
            <TableGroupHeaderRowElement
                board={board}
                activeView={collapsedOptionsView}
                group={boardTreeGroup}
                readonly={false}
                hideGroup={hideGroup}
                addCard={jest.fn()}
                propertyNameChanged={jest.fn()}
                onDrop={jest.fn()}
            />
        </Wrapper>,
    )

    const triangle = container.querySelector('.octo-table-cell__expand')
    expect(triangle).not.toBeNull()

    act(() => {
        fireEvent.click(triangle as Element)
    })
    expect(hideGroup).toBeCalled()
    expect(container).toMatchSnapshot()
})

test('should match snapshot, add new', async () => {
    const addNew = jest.fn()

    const {container} = render(
        <Wrapper>
            <TableGroupHeaderRowElement
                board={board}
                activeView={view}
                group={boardTreeGroup}
                readonly={false}
                hideGroup={jest.fn()}
                addCard={addNew}
                propertyNameChanged={jest.fn()}
                onDrop={jest.fn()}
            />
        </Wrapper>,
    )

    const triangle = container.querySelector('i.AddIcon')
    expect(triangle).not.toBeNull()

    act(() => {
        fireEvent.click(triangle as Element)
    })
    expect(addNew).toBeCalled()
    expect(container).toMatchSnapshot()
})

test('should match snapshot, edit title', async () => {
    const {container, getByTitle} = render(
        <Wrapper>
            <TableGroupHeaderRowElement
                board={board}
                activeView={view}
                group={boardTreeGroup}
                readonly={false}
                hideGroup={jest.fn()}
                addCard={jest.fn()}
                propertyNameChanged={jest.fn()}
                onDrop={jest.fn()}
            />
        </Wrapper>,
    )

    const input = getByTitle(/value 1/)
    act(() => {
        userEvent.click(input)
        userEvent.keyboard('{enter}')
    })

    expect(container).toMatchSnapshot()
})

describe('the collapse button', () => {
    const renderHeader = (collapsed: boolean) => {
        const activeView = TestBlockFactory.createBoardView(board)
        activeView.fields.collapsedOptionIds = collapsed ? [boardTreeGroup.option.id] : []
        return render(
            <Wrapper>
                <TableGroupHeaderRowElement
                    board={board}
                    activeView={activeView}
                    group={boardTreeGroup}
                    readonly={false}
                    hideGroup={jest.fn()}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDrop={jest.fn()}
                />
            </Wrapper>,
        )
    }

    test('says it is expanded and offers to collapse', () => {
        const {getByRole} = renderHeader(false)
        const button = getByRole('button', {name: 'Collapse group'})
        expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    test('says it is collapsed and offers to expand', () => {
        const {getByRole} = renderHeader(true)
        const button = getByRole('button', {name: 'Expand group'})
        expect(button).toHaveAttribute('aria-expanded', 'false')
    })
})
