// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useEffect} from 'react'
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext'
import {
    $createLineBreakNode,
    $createTextNode,
    $getRoot,
    $getSelection,
    $isLineBreakNode,
    $isRangeSelection,
    $isTextNode,
    LexicalNode,
    ParagraphNode,
    PointType,
} from 'lexical'

import {highlightMarkdown, Segment} from './markdownHighlight'

type Piece = {kind: 'text', text: string, style: string} | {kind: 'break'}

function piecesFromNodes(nodes: LexicalNode[]): Piece[] {
    return nodes.map((node): Piece => {
        if ($isLineBreakNode(node)) {
            return {kind: 'break'}
        }
        if ($isTextNode(node)) {
            return {kind: 'text', text: node.getTextContent(), style: node.getStyle()}
        }
        return {kind: 'text', text: node.getTextContent(), style: ''}
    })
}

function piecesFromSegments(lines: Segment[][]): Piece[] {
    const pieces: Piece[] = []
    lines.forEach((line, i) => {
        if (i > 0) {
            pieces.push({kind: 'break'})
        }
        line.forEach((segment) => pieces.push({kind: 'text', text: segment.text, style: segment.style}))
    })
    return pieces
}

function samePieces(a: Piece[], b: Piece[]): boolean {
    return a.length === b.length && a.every((piece, i) => {
        const other = b[i]
        if (piece.kind === 'break' || other.kind === 'break') {
            return piece.kind === other.kind
        }
        return piece.text === other.text && piece.style === other.style
    })
}

// Offset of a point in the paragraph text, counting each line break as one character
function offsetOf(nodes: LexicalNode[], point: PointType): number | null {
    let offset = 0
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (point.type === 'text' && node.getKey() === point.key) {
            return offset + point.offset
        }
        if (point.type === 'element' && i === point.offset) {
            return offset
        }
        offset += node.getTextContentSize()
    }
    return point.type === 'element' ? offset : null
}

// Where an offset of the paragraph text falls among the new nodes
function setPoint(point: PointType, paragraph: ParagraphNode, offset: number): void {
    const nodes = paragraph.getChildren()
    let position = 0
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if ($isTextNode(node)) {
            const length = node.getTextContentSize()
            if (offset >= position && offset <= position + length) {
                point.set(node.getKey(), offset - position, 'text')
                return
            }
            position += length
        } else {
            if (offset === position) {
                point.set(paragraph.getKey(), i, 'element')
                return
            }
            position += 1
        }
    }
    point.set(paragraph.getKey(), nodes.length, 'element')
}

// Keeps the styles of the (single) paragraph in step with its markdown. The text
// itself never changes, only how it is split into styled runs.
export default function MarkdownHighlightPlugin(): null {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        const removeTransform = editor.registerNodeTransform(ParagraphNode, (paragraph) => {
            // rebuilding nodes while an input method is composing would cancel the composition
            if (editor.isComposing()) {
                return
            }

            const nodes = paragraph.getChildren()
            const text = nodes.map((node) => node.getTextContent()).join('')
            const wanted = piecesFromSegments(highlightMarkdown(text))
            if (samePieces(piecesFromNodes(nodes), wanted)) {
                return
            }

            const selection = $getSelection()
            let anchor: number | null = null
            let focus: number | null = null
            if ($isRangeSelection(selection)) {
                anchor = offsetOf(nodes, selection.anchor)
                focus = offsetOf(nodes, selection.focus)
            }

            paragraph.clear()
            for (const piece of wanted) {
                if (piece.kind === 'break') {
                    paragraph.append($createLineBreakNode())
                } else {
                    paragraph.append($createTextNode(piece.text).setStyle(piece.style))
                }
            }

            if ($isRangeSelection(selection) && anchor !== null && focus !== null) {
                setPoint(selection.anchor, paragraph, anchor)
                setPoint(selection.focus, paragraph, focus)
            }
        })

        // The text that was there before this plugin started is styled too (history-merge keeps it out of undo)
        editor.update(() => {
            for (const child of $getRoot().getChildren()) {
                child.markDirty()
            }
        }, {tag: 'history-merge'})

        return removeTransform
    }, [editor])

    return null
}
