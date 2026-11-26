// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Live markdown highlighting for the card editor. The text stays exactly what the
// person typed; this only says which stretches should look bold, italic, dimmed...
// It is a pure function so it can be tested without an editor.

export type Segment = {
    text: string
    style: string
}

const BOLD = 1
const ITALIC = 2
const STRIKE = 4
const CODE = 8
const DIM = 16
const QUOTE = 32
const MARKER = 64
const MENTION = 128
const STRIKE_DELIMITER = 256

const HEADING_SIZES = ['2em', '1.5em', '1.25em', '1.1em', '1em', '0.9em']

type Range = [number, number]

// Start and end (inclusive) of every match
function findRanges(text: string, regex: RegExp): Range[] {
    const ranges: Range[] = []
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
    let match = re.exec(text)
    while (match) {
        if (match[0].length === 0) {
            re.lastIndex++
        } else {
            ranges.push([match.index, (match.index + match[0].length) - 1])
        }
        match = re.exec(text)
    }
    return ranges
}

// The delimiters at the start and end of each styled range (the ** of **bold**)
function findDelimiters(text: string, styleRanges: Range[], delimiterRegex: RegExp): Range[] {
    const result: Range[] = []
    for (const [start, end] of styleRanges) {
        for (const [from, to] of findRanges(text.substring(start, end + 1), delimiterRegex)) {
            result.push([from + start, to + start])
        }
    }
    return result
}

function mark(flags: number[], ranges: Range[], flag: number): void {
    for (const [start, end] of ranges) {
        for (let i = start; i <= end && i < flags.length; i++) {
            flags[i] |= flag
        }
    }
}

const asteriskBold = '(\\*\\*\\*)(.+?)(\\*\\*\\*)|(\\*\\*)(.+?)(\\*\\*)(?!\\*)'
const underscoreBold = '(___)(.+?)(___)|(__)(.+?)(__)(?!_)'
const boldRegex = new RegExp(`${asteriskBold}|${underscoreBold}`, 'g')
const boldDelimiterRegex = /^(\*\*\*|\*\*|___|__)|(\*\*\*|\*\*|___|__)$/g

const strongEmphasis = '(\\*\\*\\*|___)(.+?)(\\*\\*\\*|___)'
function buildItalicRegex(): RegExp {
    try {
        const asterisk = '(?<!\\*)(\\*)(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)'
        const underscore = '(?<!_)(_)(?!_)(.+?)(?<!_)_(?!_)'
        const boldWrappedAsterisk = '(?<=\\*\\*)(\\*)(?!\\*)(.*?[^\\*]+)(?<!\\*)\\*(?![^\\*]\\*)|(?<!\\*)(\\*)(?!\\*)(.*?[^\\*]+)(?<!\\*)\\*(?=\\*\\*)'
        const boldWrappedUnderscore = '(?<=__)(_)(?!_)(.*?[^_]+)(?<!_)_(?![^_]_)|(?<!_)(_)(?!_)(.*?[^_]+)(?<!_)_(?=__)'
        return new RegExp(`${asterisk}|${underscore}|${strongEmphasis}|${boldWrappedAsterisk}|${boldWrappedUnderscore}`, 'g')
    } catch {
        // browsers without lookbehind
        return new RegExp(`([^\\*]|^)(\\*)([^\\*]+)(\\*)(?!\\*)|([^_]|^)(_)([^_]+)(_)(?!_)|${strongEmphasis}`, 'g')
    }
}
const italicRegex = buildItalicRegex()
const italicDelimiterRegex = /^(\*\*\*|\*|___|_)|(\*\*\*|\*|___|_)$/g

const strikeRegex = /(~~)(.+?)(~~)/g
const strikeDelimiterRegex = /^(~~)|(~~)$/g
const inlineCodeRegex = /(`)([^\n\r`]+?)(`)/g
const headingRegex = /^(#{1,6})\s/
const quoteRegex = /^> (.*)/g
const quoteDelimiterRegex = /^> /g
const ulRegex = /^\* /g
const olRegex = /^\d{1,3}\. /g
const mentionRegex = /@[\w.-]+/g
const fenceRegex = /^```/

// Lines between an opening and a closing ``` fence (an unclosed fence is not a code block)
function codeBlockLines(lines: string[]): boolean[] {
    const inCode = lines.map(() => false)
    let i = 0
    while (i < lines.length) {
        if (fenceRegex.test(lines[i])) {
            let close = -1
            for (let j = i + 1; j < lines.length; j++) {
                if (fenceRegex.test(lines[j])) {
                    close = j
                    break
                }
            }
            if (close >= 0) {
                for (let k = i; k <= close; k++) {
                    inCode[k] = true
                }
                i = close + 1
                continue
            }
        }
        i++
    }
    return inCode
}

function cssFor(flags: number, line: {heading: number, code: boolean}): string {
    const css: string[] = []
    if (line.code) {
        css.push('font-family: monospace', 'background: rgba(var(--center-channel-color-rgb), 0.06)')
    }
    if (line.heading > 0) {
        css.push(`font-size: ${HEADING_SIZES[line.heading - 1]}`)
    }
    if (flags & CODE) {
        css.push('font-family: monospace')
    }
    if ((flags & (BOLD | MARKER)) || line.heading > 0) {
        css.push(`font-weight: ${line.heading > 0 && !(flags & (BOLD | MARKER)) ? '600' : 'bold'}`)
    }
    if (flags & ITALIC) {
        css.push('font-style: italic')
    }
    if ((flags & STRIKE) && !(flags & STRIKE_DELIMITER)) {
        css.push('text-decoration: line-through')
    }
    if (flags & DIM) {
        css.push('opacity: 0.4')
    } else if (flags & QUOTE) {
        css.push('opacity: 0.75')
    }
    if (flags & MENTION) {
        css.push('background: rgba(var(--button-bg-rgb), 0.16)', 'border-radius: 4px')
    }
    return css.join('; ')
}

function highlightLine(text: string, line: {heading: number, code: boolean}): Segment[] {
    if (text.length === 0) {
        return []
    }
    const flags = new Array<number>(text.length).fill(0)

    if (!line.code) {
        const bold = findRanges(text, boldRegex)
        mark(flags, bold, BOLD)
        mark(flags, findDelimiters(text, bold, boldDelimiterRegex), DIM)

        const italic = findRanges(text, italicRegex)
        mark(flags, italic, ITALIC)
        mark(flags, findDelimiters(text, italic, italicDelimiterRegex), DIM)

        const strike = findRanges(text, strikeRegex)
        mark(flags, strike, STRIKE)
        const strikeDelimiters = findDelimiters(text, strike, strikeDelimiterRegex)
        mark(flags, strikeDelimiters, DIM | STRIKE_DELIMITER)

        mark(flags, findRanges(text, inlineCodeRegex), CODE)

        const quote = findRanges(text, quoteRegex)
        mark(flags, quote, QUOTE)
        mark(flags, findDelimiters(text, quote, quoteDelimiterRegex), DIM)

        mark(flags, findRanges(text, ulRegex), MARKER)
        mark(flags, findRanges(text, olRegex), MARKER)

        if (line.heading > 0) {
            const delimiter = headingRegex.exec(text)
            if (delimiter) {
                mark(flags, [[0, delimiter[0].length - 1]], DIM)
            }
        }

        mark(flags, findRanges(text, mentionRegex), MENTION)
    }

    const segments: Segment[] = []
    let start = 0
    for (let i = 1; i <= text.length; i++) {
        if (i === text.length || flags[i] !== flags[start]) {
            segments.push({text: text.substring(start, i), style: cssFor(flags[start], line)})
            start = i
        }
    }
    return segments
}

// One list of segments per line of the text
export function highlightMarkdown(text: string): Segment[][] {
    const lines = text.split('\n')
    const inCode = codeBlockLines(lines)
    return lines.map((lineText, i) => {
        const heading = inCode[i] ? 0 : (headingRegex.exec(lineText)?.[1].length || 0)
        return highlightLine(lineText, {heading, code: inCode[i]})
    })
}
