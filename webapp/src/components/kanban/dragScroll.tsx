// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef} from 'react'
import {useDragDropManager} from 'react-dnd'
import throttle from 'lodash/throttle'

// Scrolls a container by itself while something from react-dnd is dragged near its edges.
// It replaces react-dnd-scrolling, which needed findDOMNode (gone in React 19). The logic
// is the same: a "strength" from -1 to 1 per axis says how close the pointer is to an
// edge, and the container moves in proportion to it.

export type Box = {x: number, y: number, w: number, h: number}
export type Point = {x: number, y: number}
export type Strength = (box: Box, point: Point) => number

export function createHorizontalStrength(buffer: number): Strength {
    return ({x, w, y, h}, point) => {
        const edge = Math.min(w / 2, buffer)
        const inBox = point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h
        if (inBox) {
            if (point.x < x + edge) {
                return (point.x - x - edge) / edge
            } else if (point.x > (x + w) - edge) {
                return -((x + w) - point.x - edge) / edge
            }
        }
        return 0
    }
}

export function createVerticalStrength(buffer: number): Strength {
    return ({y, h, x, w}, point) => {
        const edge = Math.min(h / 2, buffer)
        const inBox = point.y >= y && point.y <= y + h && point.x >= x && point.x <= x + w
        if (inBox) {
            if (point.y < y + edge) {
                return (point.y - y - edge) / edge
            } else if (point.y > (y + h) - edge) {
                return -((y + h) - point.y - edge) / edge
            }
        }
        return 0
    }
}

function intBetween(min: number, max: number, value: number): number {
    return Math.floor(Math.min(max, Math.max(min, value)))
}

function pointOf(event: Event): Point {
    if (event.type === 'touchmove') {
        const touch = (event as TouchEvent).changedTouches[0]
        return {x: touch.clientX, y: touch.clientY}
    }
    const mouse = event as MouseEvent
    return {x: mouse.clientX, y: mouse.clientY}
}

type Props = React.HTMLAttributes<HTMLDivElement> & {
    horizontalStrength: Strength
    verticalStrength: Strength
    strengthMultiplier?: number
}

export default function DragScrollContainer({horizontalStrength, verticalStrength, strengthMultiplier = 30, children, ...divProps}: Props): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null)
    const dragDropManager = useDragDropManager()

    // the listeners below are created once; they read the latest props from here
    const settings = useRef({horizontalStrength, verticalStrength, strengthMultiplier})
    settings.current = {horizontalStrength, verticalStrength, strengthMultiplier}

    useEffect(() => {
        const container = containerRef.current
        if (!container) {
            return undefined
        }

        let dragging = false
        let attached = false
        let frame: number | null = null
        let scaleX = 0
        let scaleY = 0

        const stopScrolling = () => {
            detach()
            scaleX = 0
            scaleY = 0
            if (frame !== null) {
                cancelAnimationFrame(frame)
                frame = null
            }
        }

        const startScrolling = () => {
            let i = 0
            const tick = () => {
                // stop when there is nothing to do
                if (settings.current.strengthMultiplier === 0 || scaleX + scaleY === 0) {
                    stopScrolling()
                    return
                }

                // Safari does not send mousemove from a container that scrolls in the same frame,
                // so the position is adjusted every other frame (30 fps) with a doubled step
                if (i++ % 2) {
                    const {scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight} = container
                    if (scaleX) {
                        container.scrollLeft = intBetween(0, scrollWidth - clientWidth, scrollLeft + (scaleX * settings.current.strengthMultiplier))
                    }
                    if (scaleY) {
                        container.scrollTop = intBetween(0, scrollHeight - clientHeight, scrollTop + (scaleY * settings.current.strengthMultiplier))
                    }
                }
                frame = requestAnimationFrame(tick)
            }
            tick()
        }

        // recompute the strength about every 100 ms and start scrolling if needed
        const updateScrolling = throttle((event: Event) => {
            const rect = container.getBoundingClientRect()
            const box = {x: rect.left, y: rect.top, w: rect.width, h: rect.height}
            const point = pointOf(event)
            scaleX = settings.current.horizontalStrength(box, point)
            scaleY = settings.current.verticalStrength(box, point)
            if (frame === null && (scaleX || scaleY)) {
                startScrolling()
            }
        }, 100, {trailing: false})

        function attach() {
            attached = true
            window.document.body.addEventListener('dragover', updateScrolling)
            window.document.body.addEventListener('touchmove', updateScrolling)
        }

        function detach() {
            attached = false
            window.document.body.removeEventListener('dragover', updateScrolling)
            window.document.body.removeEventListener('touchmove', updateScrolling)
        }

        const onEvent = (event: Event) => {
            if (dragging && !attached) {
                attach()
                updateScrolling(event)
            }
        }

        container.addEventListener('dragover', onEvent)

        // touchmove events do not reach siblings, so the listener goes on the body
        window.document.body.addEventListener('touchmove', onEvent)

        const monitor = dragDropManager.getMonitor()
        const unsubscribe = monitor.subscribeToStateChange(() => {
            const isDragging = monitor.isDragging()
            if (!dragging && isDragging) {
                dragging = true
            } else if (dragging && !isDragging) {
                dragging = false
                stopScrolling()
            }
        })

        return () => {
            container.removeEventListener('dragover', onEvent)
            window.document.body.removeEventListener('touchmove', onEvent)
            unsubscribe()
            stopScrolling()
        }
    }, [dragDropManager])

    return (
        <div
            ref={containerRef}
            {...divProps}
        >
            {children}
        </div>
    )
}
