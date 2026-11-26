// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {highlightMarkdown} from './markdownHighlight'

const texts = (lines: ReturnType<typeof highlightMarkdown>) => lines.map((line) => line.map((s) => s.text))
const styleOf = (lines: ReturnType<typeof highlightMarkdown>, text: string) => lines.flat().find((s) => s.text === text)?.style

describe('markdownHighlight', () => {
    test('plain text is one unstyled segment per line', () => {
        const result = highlightMarkdown('hello\nworld')
        expect(result).toEqual([[{text: 'hello', style: ''}], [{text: 'world', style: ''}]])
    })

    test('empty lines have no segments and the text is never changed', () => {
        const input = 'a **b** _c_\n\n# d'
        const result = highlightMarkdown(input)
        expect(result[1]).toEqual([])
        expect(result.map((line) => line.map((s) => s.text).join('')).join('\n')).toBe(input)
    })

    test('bold dims its delimiters', () => {
        const result = highlightMarkdown('a **b** c')
        expect(texts(result)[0]).toEqual(['a ', '**', 'b', '**', ' c'])
        expect(styleOf(result, 'b')).toContain('font-weight: bold')
        expect(styleOf(result, '**')).toContain('opacity: 0.4')
    })

    test('italic with asterisks and underscores', () => {
        const result = highlightMarkdown('*one* and _two_')
        expect(styleOf(result, 'one')).toContain('font-style: italic')
        expect(styleOf(result, 'two')).toContain('font-style: italic')
    })

    test('strikethrough hides the line on the text but not on the delimiters', () => {
        const result = highlightMarkdown('~~gone~~')
        expect(styleOf(result, 'gone')).toContain('line-through')
        expect(styleOf(result, '~~')).not.toContain('line-through')
    })

    test('inline code is monospace', () => {
        expect(styleOf(highlightMarkdown('use `npm test` now'), '`npm test`')).toContain('monospace')
    })

    test('headings get a size and a dimmed marker', () => {
        const result = highlightMarkdown('## Title')
        expect(styleOf(result, '## ')).toContain('opacity: 0.4')
        expect(styleOf(result, 'Title')).toContain('font-size: 1.5em')
        expect(styleOf(highlightMarkdown('not # heading'), 'not # heading')).toBe('')
    })

    test('quotes and list markers', () => {
        const quote = highlightMarkdown('> said')
        expect(styleOf(quote, 'said')).toContain('opacity: 0.75')
        expect(styleOf(quote, '> ')).toContain('opacity: 0.4')
        expect(styleOf(highlightMarkdown('* item'), '* ')).toContain('font-weight: bold')
        expect(styleOf(highlightMarkdown('12. item'), '12. ')).toContain('font-weight: bold')
    })

    test('a fenced block is code and its markdown is left alone', () => {
        const result = highlightMarkdown('```js\n**not bold**\n```\n**bold**')
        expect(styleOf(result, '**not bold**')).toContain('monospace')
        expect(styleOf(result, '**not bold**')).not.toContain('font-weight')
        expect(styleOf(result, 'bold')).toContain('font-weight: bold')
    })

    test('a fence that is never closed is not a code block', () => {
        expect(styleOf(highlightMarkdown('```js\ncode'), 'code')).toBe('')
    })

    test('mentions are marked', () => {
        const result = highlightMarkdown('hi @maria.lopez!')
        expect(styleOf(result, '@maria.lopez')).toContain('background')
    })
})
