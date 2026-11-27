// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import DOMPurify from 'dompurify'

// What the markdown of a card, a comment or a block may turn into. The HTML of every `marked`
// render goes through here before React inserts it into the page, so a payload that gets past the
// markdown escaping (a block type that does not escape "<", a renderer bug) is still removed:
// scripts, event handlers (onclick=...), javascript: links, iframes, forms...
//
// Links keep target=_blank, and DOMPurify removes `target` unless it is allowed, so the hook below
// puts rel back on every link that opens a new tab (no window.opener, no referrer).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noreferrer noopener')
    }
})

// http, https and mailto links, plus relative links and anchors (no scheme)
const allowedUri = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

export function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ADD_ATTR: ['target'],
        ALLOWED_URI_REGEXP: allowedUri,
        FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'base', 'meta', 'link'],
    })
}
