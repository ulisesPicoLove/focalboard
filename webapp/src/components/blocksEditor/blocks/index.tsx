// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ContentType, ContentValue} from './types'
import H1 from './h1'
import H2 from './h2'
import H3 from './h3'
import Image from './image'
import Text from './text'
import Divider from './divider'

// import Markdown from './markdown'
import ListItem from './list-item'
import Attachment from './attachment'
import Quote from './quote'
import Video from './video'
import Checkbox from './checkbox'

const blocks: {[key: string]: ContentType<ContentValue>} = {}
const blocksByPrefix: {[key: string]: ContentType<ContentValue>} = {}
const blocksBySlashCommand: {[key: string]: ContentType<ContentValue>} = {}

// The registry holds content types whose values differ (text, file info...) and hands them out by
// name, so each one is stored as the general type and callers handle the value they asked for.
export function register<ValueType>(contentType: ContentType<ValueType>) {
    const stored = contentType as unknown as ContentType<ContentValue>
    blocks[contentType.name] = stored
    if (contentType.prefix !== '') {
        blocksByPrefix[contentType.prefix] = stored
    }
    blocksBySlashCommand[contentType.slashCommand] = stored
}

export function list() {
    return Object.values(blocks)
}

export function get(name: string): ContentType<ContentValue> | undefined {
    return blocks[name]
}

export function getByPrefix(prefix: string): ContentType<ContentValue> | undefined {
    return blocksByPrefix[prefix]
}

export function isSubPrefix(text: string): boolean {
    for (const ct of list()) {
        if (ct.prefix !== '' && ct.prefix.startsWith(text)) {
            return true
        }
    }
    return false
}

export function getBySlashCommand(slashCommand: string): ContentType<ContentValue> | undefined {
    return blocksBySlashCommand[slashCommand]
}

export function getBySlashCommandPrefix(slashCommandPrefix: string): ContentType<ContentValue>|null {
    for (const ct of list()) {
        if (ct.slashCommand.startsWith(slashCommandPrefix)) {
            return ct
        }
    }
    return null
}

register(H1)
register(H2)
register(H3)
register(Image)
register(Text)
register(Divider)

// register(Markdown)
register(ListItem)
register(Attachment)
register(Quote)
register(Video)
register(Checkbox)
