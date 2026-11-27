// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Block, createBlock} from './block'

type AttachmentBlockFields = {
    fileId: string
}

type AttachmentBlock = Block & {
    type: 'attachment'
    fields: AttachmentBlockFields
    isUploading: boolean
    uploadingPercent: number
}

function createAttachmentBlock(block?: Block): AttachmentBlock {
    // older blocks called the file id "attachmentId"
    const fields = (block?.fields ?? {}) as Partial<AttachmentBlockFields> & {attachmentId?: string}
    return {
        ...createBlock(block),
        type: 'attachment',
        fields: {
            fileId: fields.attachmentId || fields.fileId || '',
        },
        isUploading: false,
        uploadingPercent: 0,
    }
}

export {AttachmentBlock, createAttachmentBlock}
