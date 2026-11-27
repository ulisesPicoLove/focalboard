// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import {IntlShape, useIntl} from 'react-intl'

import {ContentBlock} from '../../blocks/contentBlock'
import {ImageBlock, createImageBlock} from '../../blocks/imageBlock'
import octoClient from '../../octoClient'
import mutator from '../../mutator'
import {Utils} from '../../utils'
import ImageIcon from '../../widgets/icons/image'
import {sendFlashMessage} from '../../components/flashMessages'

import {FileInfo} from '../../blocks/block'

import {contentRegistry} from './contentRegistry'
import ArchivedFile from './archivedFile/archivedFile'

type Props = {
    block: ContentBlock

    // Only the card editor passes false: it shows the field for the alternative text
    readonly?: boolean
}

const ImageElement = (props: Props): React.JSX.Element|null => {
    const [imageDataUrl, setImageDataUrl] = useState<string|null>(null)
    const [fileInfo, setFileInfo] = useState<FileInfo>({})

    const {block} = props
    const {fileId} = createImageBlock(block).fields
    const intl = useIntl()
    const [altText, setAltText] = useState(block.title)

    // keep the field in step with changes that come from another session
    useEffect(() => {
        setAltText(block.title)
    }, [block.title])

    useEffect(() => {
        if (!imageDataUrl) {
            const loadImage = async () => {
                const fileURL = await octoClient.getFileAsDataUrl(block.boardId, fileId)
                setImageDataUrl(fileURL.url || '')
                setFileInfo(fileURL)
            }
            loadImage()
        }
    }, [block.boardId, fileId, imageDataUrl])

    if (fileInfo.archived) {
        return (
            <ArchivedFile fileInfo={fileInfo}/>
        )
    }

    if (!imageDataUrl) {
        return null
    }

    const image = (
        <img
            className='ImageElement'
            src={imageDataUrl}
            alt={block.title}
        />
    )

    if (props.readonly !== false) {
        return image
    }

    // The block title holds the alternative text read by screen readers
    return (
        <div className='ImageElementWithAlt'>
            {image}
            <input
                type='text'
                className='ImageElement-altText'
                value={altText}
                aria-label={intl.formatMessage({id: 'ImageElement.alt-text', defaultMessage: 'Alternative text for the image'})}
                placeholder={intl.formatMessage({id: 'ImageElement.alt-text-placeholder', defaultMessage: 'Describe the image for people who cannot see it'})}
                onChange={(e) => setAltText(e.target.value)}
                onBlur={() => {
                    if (altText !== block.title) {
                        mutator.changeBlockTitle(block.boardId, block.id, block.title, altText, 'change image description')
                    }
                }}
            />
        </div>
    )
}

contentRegistry.registerContentType({
    type: 'image',
    getDisplayText: (intl: IntlShape) => intl.formatMessage({id: 'ContentBlock.image', defaultMessage: 'image'}),
    getIcon: () => <ImageIcon/>,
    createBlock: async (boardId: string, intl: IntlShape) => {
        return new Promise<ImageBlock>(
            (resolve) => {
                Utils.selectLocalFile(async (file) => {
                    const fileId = await octoClient.uploadFile(boardId, file)

                    if (fileId) {
                        const block = createImageBlock()
                        block.fields.fileId = fileId || ''
                        resolve(block)
                    } else {
                        sendFlashMessage({content: intl.formatMessage({id: 'createImageBlock.failed', defaultMessage: 'Unable to upload the file. File size limit reached.'}), severity: 'normal'})
                    }
                },
                '.jpg,.jpeg,.png,.gif')
            },
        )

        // return new ImageBlock()
    },
    createComponent: (block, readonly) => (
        <ImageElement
            block={block}
            readonly={readonly}
        />
    ),
})

export default React.memo(ImageElement)
