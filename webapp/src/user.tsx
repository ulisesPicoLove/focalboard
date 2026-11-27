// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

interface IUser {
    id: string
    username: string
    email: string
    nickname: string
    firstname: string
    lastname: string

    // extra settings of the person; the only one the app reads is how names are shown
    props: {teammateNameDisplay?: string, [key: string]: unknown}
    create_at: number
    update_at: number
    is_bot: boolean
    is_guest: boolean
    permissions?: string[]
    roles: string
}

interface UserWorkspace {
    id: string
    title: string
    boardCount: number
}

interface UserConfigPatch {
    updatedFields?: Record<string, string>
    deletedFields?: string[]
}

function parseUserProps(props: UserPreference[]): Record<string, UserPreference> {
    const processedProps: Record<string, UserPreference> = {}

    props.forEach((prop) => {
        const processedProp = prop
        if (prop.name === 'hiddenBoardIDs') {
            const hiddenBoardIDs: string[] = JSON.parse(processedProp.value as string)
            const hidden: Record<string, boolean> = {}
            hiddenBoardIDs.forEach((boardID) => {
                hidden[boardID] = true
            })
            processedProp.value = hidden
        }
        processedProps[processedProp.name] = processedProp
    })

    return processedProps
}

interface UserPreference {
    user_id: string
    category: string
    name: string

    // a string as the server keeps it; for hiddenBoardIDs it is turned into a map of board id to true
    value: string | Record<string, boolean>
}

export {
    IUser,
    UserWorkspace,
    UserConfigPatch,
    parseUserProps,
    UserPreference,
}
