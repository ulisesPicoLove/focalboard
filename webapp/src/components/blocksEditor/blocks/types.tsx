// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
export type BlockInputProps<ValueType = string> = {
    onChange: (value: ValueType) => void
    value: ValueType
    onCancel: () => void
    onSave: (val: ValueType) => void
    currentBoardId?: string
}

export type ContentType<ValueType = string> = {
    name: string
    displayName: string
    slashCommand: string
    prefix: string
    editable: boolean
    Input: React.FunctionComponent<BlockInputProps<ValueType>>
    Display: React.FunctionComponent<BlockInputProps<ValueType>>
    runSlashCommand: (changeType: (contentType: ContentType<ValueType>) => void, changeValue: (value: ValueType) => void, ...args: string[]) => void
    nextType?: string
}

export type BlockData<ValueType = ContentValue> = {
    id?: string
    value: ValueType
    contentType: string
}

// The values a content block can hold: text for most blocks, a file for image, attachment
// and video, and a text with a flag for a checkbox
export type FileValue = {
    file: string | File
    filename?: string
    width?: number
    align?: 'left' | 'center' | 'right'
}

export type CheckboxValue = {
    value: string
    checked: boolean
}

export type ContentValue = string | FileValue | CheckboxValue

export function isFileValue(value: ContentValue | undefined): value is FileValue {
    return typeof value === 'object' && value !== null && 'file' in value
}

export function isCheckboxValue(value: ContentValue | undefined): value is CheckboxValue {
    return typeof value === 'object' && value !== null && 'checked' in value
}

