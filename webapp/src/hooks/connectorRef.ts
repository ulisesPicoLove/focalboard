// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useCallback} from 'react'
import type {ConnectableElement} from 'react-dnd'

// react-dnd connectors (drag, drop, preview) can be used as a ref, but they return the
// element and React 19's ref types only accept callbacks that return nothing.
// The connectors react-dnd gives out are stable, so the ref is too.
export function useConnectorRef<T extends HTMLElement>(connector: (element: ConnectableElement) => unknown): (element: T | null) => void {
    return useCallback((element: T | null) => {
        connector(element)
    }, [connector])
}
