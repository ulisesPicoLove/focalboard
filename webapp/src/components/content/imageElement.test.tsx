// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import '@testing-library/jest-dom'

import {act} from 'react-dom/test-utils'

import {mocked} from 'jest-mock'

import {ImageBlock} from '../../blocks/imageBlock'

import {wrapIntl} from '../../testUtils'

import octoClient from '../../octoClient'
import mutator from '../../mutator'

import ImageElement from './imageElement'

jest.mock('../../octoClient')
jest.mock('../../mutator')
const mockedOcto = mocked(octoClient, true)
mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.jpg'})

describe('components/content/ImageElement', () => {
    const defaultBlock: ImageBlock = {
        id: 'test-id',
        boardId: '1',
        parentId: '',
        modifiedBy: 'test-user-id',
        schema: 0,
        type: 'image',
        title: 'test-title',
        fields: {
            fileId: 'test.jpg',
        },
        createdBy: 'test-user-id',
        createAt: 0,
        updateAt: 0,
        deleteAt: 0,
    }

    test('should match snapshot', async () => {
        const component = wrapIntl(
            <ImageElement
                block={defaultBlock}
            />,
        )
        let imageContainer: Element | undefined
        await act(async () => {
            const {container} = render(component)
            imageContainer = container
        })
        expect(imageContainer).toMatchSnapshot()
    })

    test('archived file', async () => {
        mockedOcto.getFileAsDataUrl.mockResolvedValue({
            archived: true,
            name: 'Filename',
            extension: '.txt',
            size: 165002,
        })

        const component = wrapIntl(
            <ImageElement
                block={defaultBlock}
            />,
        )
        let imageContainer: Element | undefined
        await act(async () => {
            const {container} = render(component)
            imageContainer = container
        })
        expect(imageContainer).toMatchSnapshot()
    })

    describe('alternative text', () => {
        beforeEach(() => {
            mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.jpg'})
            jest.clearAllMocks()
        })

        test('is not editable when the card is read only or shown in the gallery', async () => {
            await act(async () => {
                render(wrapIntl(
                    <ImageElement block={defaultBlock}/>,
                ))
            })
            expect(screen.queryByRole('textbox')).toBeNull()
            expect(screen.getByRole('img')).toHaveAttribute('alt', 'test-title')
        })

        test('the editor can write it and it is saved when leaving the field', async () => {
            await act(async () => {
                render(wrapIntl(
                    <ImageElement
                        block={defaultBlock}
                        readonly={false}
                    />,
                ))
            })
            const field = screen.getByRole('textbox', {name: 'Alternative text for the image'})
            expect(field).toHaveValue('test-title')

            fireEvent.change(field, {target: {value: 'A red bicycle'}})
            fireEvent.blur(field)
            expect(mutator.changeBlockTitle).toBeCalledWith('1', 'test-id', 'test-title', 'A red bicycle', 'change image description')
        })

        test('nothing is saved when the text did not change', async () => {
            await act(async () => {
                render(wrapIntl(
                    <ImageElement
                        block={defaultBlock}
                        readonly={false}
                    />,
                ))
            })
            fireEvent.blur(screen.getByRole('textbox'))
            expect(mutator.changeBlockTitle).not.toBeCalled()
        })
    })
})
