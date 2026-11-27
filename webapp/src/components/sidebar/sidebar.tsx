// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useState} from 'react'

import {FormattedMessage, useIntl} from 'react-intl'
import {DragDropContext, Droppable, DropResult} from '@hello-pangea/dnd'

import {keyboardActivation} from '../../keyboardActivation'

import {getActiveThemeName, loadTheme} from '../../theme'
import IconButton from '../../widgets/buttons/iconButton'
import HamburgerIcon from '../../widgets/icons/hamburger'
import HideSidebarIcon from '../../widgets/icons/hideSidebar'
import ShowSidebarIcon from '../../widgets/icons/showSidebar'
import {getCurrentBoard, getMySortedBoards} from '../../store/boards'
import {useAppDispatch, useAppSelector} from '../../store/hooks'
import {CategoryBoardsOrder, Utils} from '../../utils'
import {IUser} from '../../user'

import './sidebar.scss'

import {
    BoardCategoryWebsocketData,
    Category,
    CategoryBoards,
    fetchSidebarCategories,
    getSidebarCategories,
    updateBoardCategories,
    updateCategories,
    reorderCategoryBoards,
    updateCategoryBoardsOrder,
    updateCategoryOrder,
} from '../../store/sidebar'

import BoardsSwitcher from '../boardsSwitcher/boardsSwitcher'

import wsClient, {WSClient} from '../../wsclient'

import {getCurrentTeam, getCurrentTeamId} from '../../store/teams'

import {Constants} from '../../constants'

import {getMe} from '../../store/users'
import {getCurrentViewId} from '../../store/views'

import octoClient from '../../octoClient'

import {useWebsockets} from '../../hooks/websockets'

import mutator from '../../mutator'

import {Board} from '../../blocks/board'

import {displayedBoardIDs, insertIntoCategory, reorderWithinCategory} from './categoryBoardsOrder'

import SidebarCategory from './sidebarCategory'
import SidebarSettingsMenu from './sidebarSettingsMenu'
import SidebarUserMenu from './sidebarUserMenu'

type Props = {
    activeBoardId?: string
    onBoardTemplateSelectorOpen: () => void
    onBoardTemplateSelectorClose?: () => void
}

function getWindowDimensions() {
    const {innerWidth: width, innerHeight: height} = window
    return {
        width,
        height,
    }
}

const Sidebar = (props: Props) => {
    const intl = useIntl()
    const [isHidden, setHidden] = useState(false)
    const [userHidden, setUserHidden] = useState(false)
    const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions())
    const boards = useAppSelector(getMySortedBoards)
    const dispatch = useAppDispatch()
    const sidebarCategories = useAppSelector<CategoryBoards[]>(getSidebarCategories)
    const me = useAppSelector<IUser|null>(getMe)
    const activeViewID = useAppSelector(getCurrentViewId)
    const currentBoard = useAppSelector(getCurrentBoard)

    useEffect(() => {
        const categoryOnChangeHandler = (_: WSClient, categories: Category[]) => {
            dispatch(updateCategories(categories))
        }

        const blockCategoryOnChangeHandler = (_: WSClient, blockCategories: BoardCategoryWebsocketData[]) => {
            dispatch(updateBoardCategories(blockCategories))
        }

        wsClient.addOnChange(categoryOnChangeHandler, 'category')
        wsClient.addOnChange(blockCategoryOnChangeHandler, 'blockCategories')

        return function cleanup() {
            wsClient.removeOnChange(categoryOnChangeHandler, 'category')
            wsClient.removeOnChange(blockCategoryOnChangeHandler, 'blockCategories')
        }
    }, [dispatch])

    const teamId = useAppSelector(getCurrentTeamId)
    const team = useAppSelector(getCurrentTeam)

    const currentTeamID = team?.id
    useEffect(() => {
        if (currentTeamID) {
            dispatch(fetchSidebarCategories(currentTeamID))
        }
    }, [currentTeamID, dispatch])

    useEffect(() => {
        loadTheme()
    }, [])

    useEffect(() => {
        function handleResize() {
            setWindowDimensions(getWindowDimensions())
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        hideSidebar()

    // Close the sidebar when the window is resized; hideSidebar is recreated on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowDimensions])

    // This handles the case when a user opens a linked board from Channels RHS
    // and thats the first time that user is opening that board.
    // Here we check if that board has a associated category for the user. If not,
    // we assign it to the default "Boards" category.
    // We do this on the client side rather than the server side like for all other cases
    // because there is no good, explicit API call to add this logic to when opening
    // a board that you have implicit access to.
    useEffect(() => {
        if (!sidebarCategories || sidebarCategories.length === 0 || !currentBoard || !team || currentBoard.isTemplate) {
            return
        }

        // find the category the current board belongs to
        // const category = sidebarCategories.find((c) => c.boardIDs.indexOf(currentBoard.id) >= 0)
        const category = sidebarCategories.find((c) => c.boardMetadata.find((boardMetadata) => boardMetadata.boardID === currentBoard.id))
        if (category) {
            // Boards does belong to a category.
            // All good here. Nothing to do
            return
        }

        // if the board doesn't belong to a category
        // we need to move it to the default "Boards" category
        const boardsCategory = sidebarCategories.find((c) => c.name === 'Boards')
        if (!boardsCategory) {
            Utils.logError('Boards category not found for user')
            return
        }

        octoClient.moveBoardToCategory(team.id, currentBoard.id, boardsCategory.id, '')
    }, [sidebarCategories, currentBoard, team])

    useWebsockets(teamId, (websocketClient: WSClient) => {
        const onCategoryReorderHandler = (_: WSClient, newCategoryOrder: string[]): void => {
            dispatch(updateCategoryOrder(newCategoryOrder))
        }

        const onCategoryBoardsReorderHandler = (_: WSClient, orders: CategoryBoardsOrder[]): void => {
            for (const order of orders) {
                dispatch(reorderCategoryBoards(order))
            }
        }

        websocketClient.addOnChange(onCategoryReorderHandler, 'categoryOrder')
        websocketClient.addOnChange(onCategoryBoardsReorderHandler, 'categoryBoardsOrder')
        return () => {
            websocketClient.removeOnChange(onCategoryReorderHandler, 'categoryOrder')
            websocketClient.removeOnChange(onCategoryBoardsReorderHandler, 'categoryBoardsOrder')
        }
    }, [teamId])

    const hideSidebar = () => {
        if (!userHidden) {
            if (windowDimensions.width < 768) {
                setHidden(true)
            } else {
                setHidden(false)
            }
        }
    }

    const handleCategoryDND = useCallback(async (result: DropResult) => {
        const {destination, source} = result
        if (!team || !destination) {
            return
        }

        const categories = sidebarCategories

        // creating a mutable copy
        const newCategories = Array.from(categories)

        // remove category from old index
        newCategories.splice(source.index, 1)

        // add it to new index
        newCategories.splice(destination.index, 0, categories[source.index])

        const newCategoryOrder = newCategories.map((category) => category.id)

        // optimistically updating the store to produce a lag-free UI
        await dispatch(updateCategoryOrder(newCategoryOrder))
        await octoClient.reorderSidebarCategories(team.id, newCategoryOrder)
    }, [team, sidebarCategories, dispatch])

    const handleCategoryBoardDND = useCallback(async (result: DropResult) => {
        const {source, destination, draggableId} = result

        if (!team || !destination) {
            return
        }

        const fromCategoryID = source.droppableId
        const toCategoryID = destination.droppableId
        const boardID = draggableId

        if (fromCategoryID === toCategoryID) {
            // board re-arranged withing the same category
            const toSidebarCategory = sidebarCategories.find((category) => category.id === toCategoryID)
            if (!toSidebarCategory) {
                Utils.logError(`toCategoryID not found in list of sidebar categories. toCategoryID: ${toCategoryID}`)
                return
            }

            // the indexes are positions among the boards that are shown, not in the whole list of the category
            const categoryBoardMetadata = reorderWithinCategory(
                toSidebarCategory.boardMetadata,
                displayedBoardIDs(toSidebarCategory, boards),
                source.index,
                destination.index,
            )

            dispatch(updateCategoryBoardsOrder({categoryID: toCategoryID, boardsMetadata: categoryBoardMetadata}))

            const reorderedBoardIDs = categoryBoardMetadata.map((m) => m.boardID)
            await octoClient.reorderSidebarCategoryBoards(team.id, toCategoryID, reorderedBoardIDs)
        } else {
            // board moved to a different category
            const toSidebarCategory = sidebarCategories.find((category) => category.id === toCategoryID)
            const fromSidebarCategory = sidebarCategories.find((category) => category.id === fromCategoryID)

            if (!toSidebarCategory) {
                Utils.logError(`toCategoryID not found in list of sidebar categories. toCategoryID: ${toCategoryID}`)
                return
            }

            if (!fromSidebarCategory) {
                Utils.logError(`fromCategoryID not found in list of sidebar categories. fromCategoryID: ${fromCategoryID}`)
                return
            }

            const fromBoardID = displayedBoardIDs(fromSidebarCategory, boards)[source.index]
            const fromCategoryBoardMetadata = fromSidebarCategory.boardMetadata.find((metadata) => metadata.boardID === fromBoardID)
            if (!fromCategoryBoardMetadata) {
                Utils.logError(`dragged board not found in its category. boardID: ${fromBoardID}`)
                return
            }

            const categoryBoardMetadata = insertIntoCategory(
                toSidebarCategory.boardMetadata,
                displayedBoardIDs(toSidebarCategory, boards),
                fromCategoryBoardMetadata,
                destination.index,
            )

            // optimistically updating the store to create a lag-free UI.
            await dispatch(updateCategoryBoardsOrder({categoryID: toCategoryID, boardsMetadata: categoryBoardMetadata}))
            dispatch(updateBoardCategories([{...fromCategoryBoardMetadata, categoryID: toCategoryID}]))

            await mutator.moveBoardToCategory(team.id, boardID, toCategoryID, fromCategoryID)

            const reorderedBoardIDs = categoryBoardMetadata.map((m) => m.boardID)
            await octoClient.reorderSidebarCategoryBoards(team.id, toCategoryID, reorderedBoardIDs)
        }
    }, [team, sidebarCategories, boards, dispatch])

    const onDragEnd = useCallback(async (result: DropResult) => {
        const {destination, source, type} = result

        if (!team || !destination) {
            setDraggedItemID('')
            setIsCategoryBeingDragged(false)
            return
        }

        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            setDraggedItemID('')
            setIsCategoryBeingDragged(false)
            return
        }

        if (type === 'category') {
            handleCategoryDND(result)
        } else if (type === 'board') {
            handleCategoryBoardDND(result)
        } else {
            Utils.logWarn(`unknown drag type encountered, type: ${type}`)
        }

        setDraggedItemID('')
        setIsCategoryBeingDragged(false)
    }, [team, handleCategoryDND, handleCategoryBoardDND])

    const [draggedItemID, setDraggedItemID] = useState<string>('')
    const [isCategoryBeingDragged, setIsCategoryBeingDragged] = useState<boolean>(false)

    if (!boards) {
        return <div/>
    }

    if (!me) {
        return <div/>
    }

    if (isHidden) {
        return (
            <div className='Sidebar octo-sidebar hidden'>
                <div className='octo-sidebar-header show-button'>
                    <div className='hamburger-icon'>
                        <IconButton
                            icon={<HamburgerIcon/>}
                            onClick={() => {
                                setUserHidden(false)
                                setHidden(false)
                            }}
                        />
                    </div>
                    <div className='show-icon'>
                        <IconButton
                            icon={<ShowSidebarIcon/>}
                            onClick={() => {
                                setUserHidden(false)
                                setHidden(false)
                            }}
                        />
                    </div>
                </div>
            </div>
        )
    }

    const getSortedCategoryBoards = (category: CategoryBoards): Board[] => {
        const categoryBoardsByID = new Map<string, Board>()
        boards.forEach((board) => {
            if (!category.boardMetadata.find((m) => m.boardID === board.id)) {
                return
            }

            categoryBoardsByID.set(board.id, board)
        })

        const sortedBoards: Board[] = []
        category.boardMetadata.forEach((boardMetadata) => {
            const b = categoryBoardsByID.get(boardMetadata.boardID)
            if (b) {
                sortedBoards.push(b)
            }
        })
        return sortedBoards
    }

    return (
        <nav
            className='Sidebar octo-sidebar'
            aria-label={intl.formatMessage({id: 'Sidebar.navigation-label', defaultMessage: 'Boards'})}
        >
            <div className='octo-sidebar-header'>
                <div className='heading'>
                    <SidebarUserMenu/>
                </div>

                <div className='octo-spacer'/>
                <div className='sidebarSwitcher'>
                    <IconButton
                        onClick={() => {
                            setUserHidden(true)
                            setHidden(true)
                        }}
                        icon={<HideSidebarIcon/>}
                    />
                </div>
            </div>

            {team && team.id !== Constants.globalTeamId &&
                <div className='WorkspaceTitle'/>
            }

            <BoardsSwitcher/>

            <DragDropContext
                onDragEnd={onDragEnd}
            >
                <Droppable
                    droppableId='lhs-categories'
                    type='category'
                    key={sidebarCategories.length}
                >
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className='octo-sidebar-list'
                        >
                            {
                                sidebarCategories.map((category, index) => (
                                    <SidebarCategory
                                        hideSidebar={hideSidebar}
                                        key={category.id}
                                        activeBoardID={props.activeBoardId}
                                        activeViewID={activeViewID}
                                        categoryBoards={category}
                                        boards={getSortedCategoryBoards(category)}
                                        allCategories={sidebarCategories}
                                        index={index}
                                        onBoardTemplateSelectorClose={props.onBoardTemplateSelectorClose}
                                        draggedItemID={draggedItemID}
                                        forceCollapse={isCategoryBeingDragged}
                                    />
                                ))
                            }
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <div className='octo-spacer'/>

            <div
                className='add-board'
                role='button'
                onClick={props.onBoardTemplateSelectorOpen}
                {...keyboardActivation(props.onBoardTemplateSelectorOpen)}
            >
                <FormattedMessage
                    id='Sidebar.add-board'
                    defaultMessage='+ Add board'
                />
            </div>

            <SidebarSettingsMenu activeTheme={getActiveThemeName()}/>
        </nav>
    )
}

export default React.memo(Sidebar)
