// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useEffect} from 'react'

import {Utils} from '../../utils'
import {getCurrentBoard} from '../../store/boards'
import {getCurrentView} from '../../store/views'
import {useAppSelector} from '../../store/hooks'

const SetWindowTitleAndIcon = (): null => {
    const board = useAppSelector(getCurrentBoard)
    const activeView = useAppSelector(getCurrentView)

    useEffect(() => {
        Utils.setFavicon(board?.icon)
    }, [board?.icon])

    const hasBoard = Boolean(board)
    const boardTitle = board?.title
    const viewTitle = activeView?.title
    useEffect(() => {
        if (hasBoard) {
            let title = `${boardTitle}`
            if (viewTitle) {
                title += ` | ${viewTitle}`
            }
            document.title = title
        } else {
            document.title = 'Picoboard'
        }
    }, [hasBoard, boardTitle, viewTitle])

    return null
}

export default SetWindowTitleAndIcon
