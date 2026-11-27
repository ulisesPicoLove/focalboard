// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-script-url */
import {sanitizeHtml} from './sanitizeHtml'
import {Utils} from './utils'

describe('sanitizeHtml', () => {
    test('keeps what markdown produces', () => {
        const html = Utils.htmlFromMarkdown('# Title\n\n**bold** and _italic_ with [a link](https://example.com)\n\n- [x] done\n- [ ] todo\n\n`code`\n\n| a | b |\n|---|---|\n| 1 | 2 |')
        expect(html).toContain('<h1')
        expect(html).toContain('<strong>bold</strong>')
        expect(html).toContain('href="https://example.com"')
        expect(html).toContain('type="checkbox"')
        expect(html).toContain('<code>code</code>')
        expect(html).toContain('<table')
    })

    test('links that open a new tab can not reach the opener', () => {
        const html = Utils.htmlFromMarkdown('[a link](https://example.com)')
        expect(html).toContain('target="_blank"')
        expect(html).toContain('rel="noreferrer noopener"')
    })

    test.each([
        ['a script', '<script>alert(1)</script>ok', 'script'],
        ['an event handler', '<img src="x" onerror="alert(1)">', 'onerror'],
        ['an inline handler on a link', '<a href="https://example.com" onclick="alert(1)">x</a>', 'onclick'],
        ['a javascript: link', '<a href="javascript:alert(1)">x</a>', 'javascript:'],
        ['a data: link', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', 'data:text/html'],
        ['an iframe', '<iframe src="https://example.com"></iframe>', 'iframe'],
        ['a form', '<form action="https://evil.example"><input name="x"></form>', 'form'],
        ['an svg with a script', '<svg><script>alert(1)</script></svg>', 'script'],
        ['a style tag', '<style>body{display:none}</style>', 'style'],
    ])('removes %s', (_name, html, forbidden) => {
        expect(sanitizeHtml(html).toLowerCase()).not.toContain(forbidden)
    })
})

// The block types of the card editor render their text with markdown too.
describe('markdown in the page', () => {
    const parse = (html: string) => {
        const container = document.createElement('div')
        container.innerHTML = html
        return container
    }

    test.each(['# ', '## ', '### ', '> ', ''])('markdown of "%s<img onerror>" has no element and no handler', (prefix) => {
        const container = parse(Utils.htmlFromMarkdown(prefix + '<img src=x onerror=alert(1)>'))
        expect(container.querySelector('img')).toBeNull()
        const attributes = Array.from(container.querySelectorAll('*')).flatMap((el) => Array.from(el.attributes).map((a) => a.name))
        expect(attributes.filter((name) => name.startsWith('on'))).toEqual([])
    })

    test('a javascript: link in the markdown is inert', () => {
        const html = Utils.htmlFromMarkdown('[x](javascript:alert(1))')
        expect(html.toLowerCase()).not.toContain('javascript:')
    })
})
