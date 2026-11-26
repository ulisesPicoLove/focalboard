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
    const realWebSocket = (global as any).WebSocket

    beforeEach(() => {
        jest.useFakeTimers()
        FakeWebSocket.instances = [];
        (global as any).WebSocket = FakeWebSocket
    })

    afterEach(() => {
        jest.useRealTimers();
        (global as any).WebSocket = realWebSocket
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
})
