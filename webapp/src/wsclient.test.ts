// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WSClient} from './wsclient'

class FakeWebSocket {
    static instances: FakeWebSocket[] = []
    onopen?: () => void
    onclose?: (e: {code: number, reason: string}) => void
    onerror?: (e: unknown) => void
    onmessage?: (e: {data: string}) => void
    send = jest.fn()
    close = jest.fn()

    constructor(public url: string) {
        FakeWebSocket.instances.push(this)
    }
}

describe('WSClient reconnection', () => {
    const realWebSocket = globalThis.WebSocket

    beforeEach(() => {
        jest.useFakeTimers()
        FakeWebSocket.instances = []
        globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
    })

    afterEach(() => {
        jest.useRealTimers()
        globalThis.WebSocket = realWebSocket
    })

    const last = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]

    test('keeps retrying with a growing delay and never gives up', () => {
        const client = new WSClient('http://localhost:8000')
        client.open()

        // far more than the 10 attempts it used to stop after
        for (let i = 0; i < 25; i++) {
            const before = FakeWebSocket.instances.length
            last().onclose?.({code: 1006, reason: ''})
            jest.advanceTimersByTime(30000)
            expect(FakeWebSocket.instances.length).toBe(before + 1)
        }

        client.close()
    })

    test('reloads (onReconnect) only when the connection is really open again', () => {
        const client = new WSClient('http://localhost:8000')
        const onReconnect = jest.fn()
        client.addOnReconnect(onReconnect)
        client.open()
        last().onopen?.()
        expect(onReconnect).not.toHaveBeenCalled() // first connection is not a reconnection

        last().onclose?.({code: 1006, reason: ''})
        jest.advanceTimersByTime(3000)
        expect(FakeWebSocket.instances.length).toBe(2)
        expect(onReconnect).not.toHaveBeenCalled() // retry started, still not connected

        last().onopen?.()
        expect(onReconnect).toHaveBeenCalledTimes(1)

        client.close()
    })

    test('reconnects right away when the network comes back', () => {
        const client = new WSClient('http://localhost:8000')
        client.open()
        last().onclose?.({code: 1006, reason: ''})
        expect(FakeWebSocket.instances.length).toBe(1)

        window.dispatchEvent(new Event('online'))
        expect(FakeWebSocket.instances.length).toBe(2)

        client.close()
    })

    describe('category boards order', () => {
        const send = (message: object) => last().onmessage?.({data: JSON.stringify(message)})

        test('a REORDER_CATEGORY_BOARDS message reaches the handler', () => {
            const client = new WSClient('http://localhost:8000')
            client.teamId = '0'
            client.open()
            const handler = jest.fn()
            client.addOnChange(handler, 'categoryBoardsOrder')

            send({action: 'REORDER_CATEGORY_BOARDS', CategoryId: 'c1', BoardOrder: ['b2', 'b1'], teamId: '0'})
            jest.advanceTimersByTime(200)

            expect(handler).toBeCalledTimes(1)
            expect(handler.mock.calls[0][1]).toEqual([{categoryID: 'c1', boardOrder: ['b2', 'b1']}])
            client.close()
        })

        test('only the latest order of each category is delivered', () => {
            const client = new WSClient('http://localhost:8000')
            client.teamId = '0'
            client.open()
            const handler = jest.fn()
            client.addOnChange(handler, 'categoryBoardsOrder')

            send({action: 'REORDER_CATEGORY_BOARDS', CategoryId: 'c1', BoardOrder: ['a', 'b'], teamId: '0'})
            send({action: 'REORDER_CATEGORY_BOARDS', CategoryId: 'c2', BoardOrder: ['x', 'y'], teamId: '0'})
            send({action: 'REORDER_CATEGORY_BOARDS', CategoryId: 'c1', BoardOrder: ['b', 'a'], teamId: '0'})
            jest.advanceTimersByTime(200)

            expect(handler).toBeCalledTimes(1)
            const orders = handler.mock.calls[0][1] as Array<{categoryID: string, boardOrder: string[]}>
            expect(orders).toHaveLength(2)
            expect(orders.find((o) => o.categoryID === 'c1')?.boardOrder).toEqual(['b', 'a'])
            expect(orders.find((o) => o.categoryID === 'c2')?.boardOrder).toEqual(['x', 'y'])
            client.close()
        })

        test('a removed handler is no longer called', () => {
            const client = new WSClient('http://localhost:8000')
            client.teamId = '0'
            client.open()
            const handler = jest.fn()
            client.addOnChange(handler, 'categoryBoardsOrder')
            client.removeOnChange(handler, 'categoryBoardsOrder')

            send({action: 'REORDER_CATEGORY_BOARDS', CategoryId: 'c1', BoardOrder: ['a'], teamId: '0'})
            jest.advanceTimersByTime(200)

            expect(handler).not.toBeCalled()
            client.close()
        })
    })
})
