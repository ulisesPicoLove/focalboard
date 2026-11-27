// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Block, createBlock} from './block'
import {ContentBlock} from './contentBlock'

type ImageBlockFields = {
    fileId: string
}

type ImageBlock = ContentBlock & {
    type: 'image'
    fields: ImageBlockFields
}

function createImageBlock(block?: Block): ImageBlock {
    const fields = (block?.fields ?? {}) as Partial<ImageBlockFields>
    return {
        ...createBlock(block),
        type: 'image',
        fields: {
            fileId: fields.fileId || '',
        },
    }
}

export {ImageBlock, createImageBlock}
