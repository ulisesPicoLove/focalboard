// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {act, fireEvent, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {mockDOM, wrapDNDIntl, mockStateStore} from '../testUtils'

import {TestBlockFactory} from '../test/testBlockFactory'

import {MarkdownEditor} from './markdownEditor'

jest.mock('../utils')
jest.useFakeTimers()
describe('components/markdownEditor', () => {
    beforeAll(mockDOM)
    beforeEach(jest.clearAllMocks)

    const board1 = TestBlockFactory.createBoard()
    board1.id = 'board-id-1'

    const state = {
        users: {
            boardUsers: {
                1: {username: 'abc'},
                2: {username: 'd'},
                3: {username: 'e'},
                4: {username: 'f'},
                5: {username: 'g'},
            },
        },
        boards: {
            current: 'board-id-1',
            boards: {
                [board1.id]: board1,
            },
        },
        clientConfig: {
            value: {},
        },
    }
    const store = mockStateStore([], state)
    test('should match snapshot', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <MarkdownEditor
                        id={'test-id'}
                        text={''}
                        placeholderText={'placeholder'}
                        className={'classname-test'}
                        readonly={false}
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with initial text', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>

                    <MarkdownEditor
                        id={'test-id'}
                        text={'some initial text already set'}
                        placeholderText={'placeholder'}
                        className={'classname-test'}
                        readonly={false}
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,

            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with on click on preview element', async () => {
        const result = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <MarkdownEditor
                    id={'test-id'}
                    text={'some initial text already set'}
                    placeholderText={'placeholder'}
                    className={'classname-test'}
                    readonly={false}
                    onChange={jest.fn()}
                    onFocus={jest.fn()}
                    onBlur={jest.fn()}
                />
            </ReduxProvider>,

        ))
        const {container} = result
        const previewElement = screen.getByTestId('preview-element')
        userEvent.click(previewElement)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with on click on preview element and then click out of it', async () => {
        const result = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <MarkdownEditor
                    id={'test-id'}
                    text={'some initial text already set'}
                    placeholderText={'placeholder'}
                    className={'classname-test'}
                    readonly={false}
                    onChange={jest.fn()}
                    onFocus={jest.fn()}
                    onBlur={jest.fn()}
                />
            </ReduxProvider>,

        ))
        const {container} = result
        const previewElement = screen.getByTestId('preview-element')
        userEvent.click(previewElement)
        fireEvent.keyDown(container, {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            charCode: 27,
        })
        expect(container).toMatchSnapshot()
    })

    test('the preview can be focused and opened for editing with the keyboard', async () => {
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <MarkdownEditor
                        text='some text'
                        placeholderText='placeholder'
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,
            ))
        })
        const previewElement = screen.getByTestId('preview-element')
        expect(previewElement).toHaveAttribute('tabindex', '0')

        await act(async () => {
            fireEvent.keyDown(previewElement, {key: 'Enter'})
        })
        expect(screen.queryByTestId('preview-element')).toBeNull()
    })

    test('a read-only preview is not a tab stop', async () => {
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <MarkdownEditor
                        readonly={true}
                        text='some text'
                        placeholderText='placeholder'
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,
            ))
        })
        expect(screen.getByTestId('preview-element')).not.toHaveAttribute('tabindex')
    })

    describe('the editor', () => {
        const renderEditing = async (text: string, onBlur = jest.fn(), onChange = jest.fn()) => {
            await act(async () => {
                render(wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <MarkdownEditor
                            text={text}
                            autofocus={true}
                            onChange={onChange}
                            onFocus={jest.fn()}
                            onBlur={onBlur}
                        />
                    </ReduxProvider>,
                ))
            })

            // Lexical commits its updates in a microtask after the first render
            await act(async () => {
                jest.runOnlyPendingTimers()
                for (let i = 0; i < 10; i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await Promise.resolve()
                }
            })
            return screen.getByRole('textbox', {name: 'Text editor'})
        }

        test('shows the text it was given, as a labelled text box', async () => {
            const editor = await renderEditing('hello\nsecond line')
            expect(editor).toHaveAttribute('contenteditable', 'true')
            expect(editor).toHaveAttribute('aria-multiline', 'true')
            expect(editor.textContent).toBe('hellosecond line')
        })

        test('styles the markdown without changing the text', async () => {
            const editor = await renderEditing('a **bold** word')
            const bold = Array.from(editor.querySelectorAll('span')).find((span) => span.textContent === 'bold')
            expect(bold?.getAttribute('style')).toContain('font-weight: bold')
            const delimiter = Array.from(editor.querySelectorAll('span')).find((span) => span.textContent === '**')
            expect(delimiter?.getAttribute('style')).toContain('opacity: 0.4')
            expect(editor.textContent).toBe('a **bold** word')
        })
    })
})
