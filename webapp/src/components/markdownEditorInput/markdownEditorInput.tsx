// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {ReactElement, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin'
import {LexicalComposer} from '@lexical/react/LexicalComposer'
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext'
import {PlainTextPlugin} from '@lexical/react/LexicalPlainTextPlugin'
import {ContentEditable} from '@lexical/react/LexicalContentEditable'
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin'
import {OnChangePlugin} from '@lexical/react/LexicalOnChangePlugin'
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary'
import {
    LexicalTypeaheadMenuPlugin,
    MenuOption,
    useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin'
import {
    $createLineBreakNode,
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    COMMAND_PRIORITY_LOW,
    COMMAND_PRIORITY_NORMAL,
    EditorState,
    KEY_BACKSPACE_COMMAND,
    KEY_ENTER_COMMAND,
    KEY_ESCAPE_COMMAND,
    LexicalEditor,
} from 'lexical'

import debounce from 'lodash/debounce'

import {useAppSelector} from '../../store/hooks'
import {IUser} from '../../user'
import {getBoardUsersList, getMe} from '../../store/users'
import {useHasPermissions} from '../../hooks/permissions'
import {Permission} from '../../constants'
import {BoardMember, BoardTypeOpen, MemberRole} from '../../blocks/board'
import mutator from '../../mutator'
import ConfirmAddUserForNotifications from '../confirmAddUserForNotifications'
import RootPortal from '../rootPortal'

import './markdownEditorInput.scss'

import {getCurrentBoard} from '../../store/boards'
import octoClient from '../../octoClient'

import {Utils} from '../../utils'
import {IAppWindow} from '../../types'
import {ClientConfig} from '../../config/clientConfig'
import {getClientConfig} from '../../store/clientConfig'

import Entry, {MentionUser} from './entryComponent/entryComponent'
import MarkdownHighlightPlugin from './markdownHighlightPlugin'
import TypeaheadMenu from './typeaheadMenu'
import {EmojiMatch, searchEmojis} from './emojiSearch'

const imageURLForUser = (window as IAppWindow).Components?.imageURLForUser

class MentionOption extends MenuOption {
    constructor(readonly mention: MentionUser) {
        super(mention.user.id)
    }
}

class EmojiOption extends MenuOption {
    constructor(readonly emoji: EmojiMatch) {
        super(emoji.id)
    }
}

type Props = {
    onChange?: (text: string) => void
    onFocus?: () => void
    onBlur?: (text: string) => void
    onEditorCancel?: () => void
    initialText?: string
    id?: string
    isEditing: boolean
    saveOnEnter?: boolean
}

// The text is stored as it is typed: one paragraph where each line is separated by a line break
function $setText(text: string): void {
    const root = $getRoot()
    root.clear()
    const paragraph = $createParagraphNode()
    text.split('\n').forEach((line, i) => {
        if (i > 0) {
            paragraph.append($createLineBreakNode())
        }
        if (line) {
            paragraph.append($createTextNode(line))
        }
    })
    root.append(paragraph)
    paragraph.selectEnd()
}

function $getText(): string {
    const lines: string[] = []
    for (const child of $getRoot().getChildren()) {
        lines.push(child.getTextContent())
    }
    return lines.join('\n')
}

type KeyCommandsProps = {
    saveOnEnter?: boolean
    onSave: () => void
    onCancelWhenEmpty?: () => void
}

// Enter saves (when asked to), Escape leaves the editor and Backspace on an empty one cancels it
function KeyCommandsPlugin({saveOnEnter, onSave, onCancelWhenEmpty}: KeyCommandsProps): null {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        const removeEnter = editor.registerCommand(KEY_ENTER_COMMAND, (event: KeyboardEvent | null) => {
            if (saveOnEnter && event && !event.shiftKey) {
                event.preventDefault()
                onSave()
                return true
            }
            return false
        }, COMMAND_PRIORITY_LOW)

        const removeEscape = editor.registerCommand(KEY_ESCAPE_COMMAND, () => {
            editor.blur()
            return true
        }, COMMAND_PRIORITY_LOW)

        const removeBackspace = editor.registerCommand(KEY_BACKSPACE_COMMAND, () => {
            if (onCancelWhenEmpty && editor.getEditorState().read($getText).length === 0) {
                onCancelWhenEmpty()
                return true
            }
            return false
        }, COMMAND_PRIORITY_LOW)

        return () => {
            removeEnter()
            removeEscape()
            removeBackspace()
        }
    }, [editor, saveOnEnter, onSave, onCancelWhenEmpty])

    return null
}

// The text may arrive after the editor opened; it is applied once, as long as nothing was typed
function InitialTextPlugin({initialText, onEditor}: {initialText?: string, onEditor: (editor: LexicalEditor) => void}): null {
    const [editor] = useLexicalComposerContext()
    const applied = useRef(Boolean(initialText))

    useEffect(() => {
        onEditor(editor)
    }, [editor, onEditor])

    useEffect(() => {
        if (!applied.current && initialText) {
            applied.current = true
            editor.update(() => $setText(initialText))
        }
    }, [editor, initialText])

    return null
}

const MarkdownEditorInput = (props: Props): ReactElement => {
    const {onChange, onFocus, onBlur, initialText} = props
    const intl = useIntl()
    const boardUsers = useAppSelector<IUser[]>(getBoardUsersList)
    const board = useAppSelector(getCurrentBoard)
    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)
    const allowManageBoardRoles = useHasPermissions(board?.teamId ?? '', board?.id ?? '', [Permission.ManageBoardRoles])
    const [confirmAddUser, setConfirmAddUser] = useState<IUser|null>(null)
    const me = useAppSelector<IUser|null>(getMe)

    const editorRef = useRef<LexicalEditor | null>(null)
    const textRef = useRef(initialText || '')
    const setEditor = useCallback((editor: LexicalEditor) => {
        editorRef.current = editor
    }, [])

    const [suggestions, setSuggestions] = useState<MentionUser[]>([])
    const [emojis, setEmojis] = useState<EmojiMatch[]>([])

    const loadSuggestions = async (term: string) => {
        let users: IUser[]

        if (!me?.is_guest && (allowManageBoardRoles || (board && board.type === BoardTypeOpen))) {
            const excludeBots = true
            users = await octoClient.searchTeamUsers(term, excludeBots)
        } else {
            users = boardUsers.
                filter((user) => {
                    // no search term
                    if (!term) {
                        return true
                    }

                    // does the search term occur anywhere in the display name?
                    return Utils.getUserDisplayName(user, clientConfig.teammateNameDisplay).includes(term)
                }).

                // first 10 results
                slice(0, 10)
        }

        const mentions: MentionUser[] = users.map(
            (user: IUser): MentionUser => ({
                name: user.username,
                avatar: `${imageURLForUser ? imageURLForUser(user.id) : ''}`,
                is_bot: user.is_bot,
                is_guest: user.is_guest,
                displayName: Utils.getUserDisplayName(user, clientConfig.teammateNameDisplay),
                isBoardMember: Boolean(boardUsers.find((u) => u.id === user.id)),
                user,
            }))
        setSuggestions(mentions)
    }

    // One debounce for the life of the editor, always calling the latest loader
    const loadSuggestionsRef = useRef(loadSuggestions)
    loadSuggestionsRef.current = loadSuggestions
    const debouncedLoadSuggestions = useMemo(() => debounce((term: string) => loadSuggestionsRef.current(term), 200), [])
    useEffect(() => {
        return () => debouncedLoadSuggestions.cancel()
    }, [debouncedLoadSuggestions])

    const addUser = useCallback(async (userId: string, role: string) => {
        if (!board) {
            return
        }
        const newRole = role || MemberRole.Viewer
        const newMember = {
            boardId: board.id,
            userId,
            roles: role,
            schemeAdmin: newRole === MemberRole.Admin,
            schemeEditor: newRole === MemberRole.Admin || newRole === MemberRole.Editor,
            schemeCommenter: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter,
            schemeViewer: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter || newRole === MemberRole.Viewer,
        } as BoardMember

        setConfirmAddUser(null)
        editorRef.current?.focus()
        await mutator.createBoardMember(newMember)
    }, [board])

    const onEditorChange = useCallback((editorState: EditorState) => {
        const newText = editorState.read($getText)
        textRef.current = newText
        onChange && onChange(newText)
    }, [onChange])

    const onEditorBlur = useCallback(() => {
        // the confirmation dialog takes the focus away while the person decides
        if (confirmAddUser) {
            return
        }
        onBlur && onBlur(textRef.current)
    }, [confirmAddUser, onBlur])

    const saveNow = useCallback(() => {
        onBlur && onBlur(textRef.current)
    }, [onBlur])

    const initialConfig = useMemo(() => ({
        namespace: 'MarkdownEditorInput',
        editorState: () => $setText(initialText || ''),
        onError: (error: Error) => Utils.logError(`MarkdownEditorInput: ${error}`),
        nodes: [],
        theme: {},
    }),

    // The initial text is read once, when the editor is created
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

    const mentionTrigger = useBasicTypeaheadTriggerMatch('@', {minLength: 0, maxLength: 40})
    const emojiTrigger = useBasicTypeaheadTriggerMatch(':', {minLength: 2, maxLength: 30})

    const mentionOptions = useMemo(() => suggestions.map((mention) => new MentionOption(mention)), [suggestions])
    const emojiOptions = useMemo(() => emojis.map((emoji) => new EmojiOption(emoji)), [emojis])

    return (
        <div className='MarkdownEditorInput'>
            <LexicalComposer initialConfig={initialConfig}>
                <PlainTextPlugin
                    contentEditable={
                        <ContentEditable
                            className='MarkdownEditorInput__content'
                            ariaLabel={intl.formatMessage({id: 'MarkdownEditor.label', defaultMessage: 'Text editor'})}
                            ariaMultiline={true}
                            onFocus={onFocus}
                            onBlur={onEditorBlur}
                        />
                    }
                    placeholder={null}
                    ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin/>

                {/* The editor replaces the preview the person just chose to edit, so it takes the focus */}
                <AutoFocusPlugin defaultSelection='rootEnd'/>
                <OnChangePlugin
                    onChange={onEditorChange}
                    ignoreSelectionChange={true}
                />
                <MarkdownHighlightPlugin/>
                <InitialTextPlugin
                    initialText={initialText}
                    onEditor={setEditor}
                />
                <KeyCommandsPlugin
                    saveOnEnter={props.saveOnEnter}
                    onSave={saveNow}
                    onCancelWhenEmpty={props.onEditorCancel}
                />

                <LexicalTypeaheadMenuPlugin<MentionOption>
                    triggerFn={mentionTrigger}
                    options={mentionOptions}
                    commandPriority={COMMAND_PRIORITY_NORMAL}
                    anchorClassName='typeahead-popover'
                    onQueryChange={(query) => {
                        if (query !== null) {
                            debouncedLoadSuggestions(query)
                        }
                    }}
                    onSelectOption={(option, nodeToReplace, closeMenu) => {
                        editorRef.current?.update(() => {
                            nodeToReplace?.setTextContent(`@${option.mention.name} `).select()
                        })
                        closeMenu()
                        if (!option.mention.isBoardMember) {
                            setConfirmAddUser(option.mention.user)
                        }
                    }}
                    menuRenderFn={(anchorRef, {options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex}) => (
                        <TypeaheadMenu
                            anchorRef={anchorRef}
                            options={options}
                            selectedIndex={selectedIndex}
                            label={intl.formatMessage({id: 'MarkdownEditor.mentions', defaultMessage: 'People to mention'})}
                            onSelect={selectOptionAndCleanUp}
                            onHover={setHighlightedIndex}
                            renderOption={(option) => <Entry mention={option.mention}/>}
                        />
                    )}
                />

                <LexicalTypeaheadMenuPlugin<EmojiOption>
                    triggerFn={emojiTrigger}
                    options={emojiOptions}
                    commandPriority={COMMAND_PRIORITY_NORMAL}
                    anchorClassName='typeahead-popover'
                    onQueryChange={(query) => {
                        if (query === null) {
                            setEmojis([])
                            return
                        }
                        searchEmojis(query).then(setEmojis)
                    }}
                    onSelectOption={(option, nodeToReplace, closeMenu) => {
                        editorRef.current?.update(() => {
                            nodeToReplace?.setTextContent(option.emoji.native).select()
                        })
                        closeMenu()
                    }}
                    menuRenderFn={(anchorRef, {options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex}) => (
                        <TypeaheadMenu
                            anchorRef={anchorRef}
                            options={options}
                            selectedIndex={selectedIndex}
                            label={intl.formatMessage({id: 'MarkdownEditor.emojis', defaultMessage: 'Emoji'})}
                            onSelect={selectOptionAndCleanUp}
                            onHover={setHighlightedIndex}
                            renderOption={(option) => (
                                <>
                                    <span
                                        className='TypeaheadMenu__emoji'
                                        aria-hidden='true'
                                    >{option.emoji.native}</span>
                                    <span className='TypeaheadMenu__emoji-name'>{`:${option.emoji.id}:`}</span>
                                </>
                            )}
                        />
                    )}
                />
            </LexicalComposer>

            {confirmAddUser &&
                <RootPortal>
                    <ConfirmAddUserForNotifications
                        allowManageBoardRoles={allowManageBoardRoles}
                        minimumRole={board?.minimumRole ?? MemberRole.None}
                        user={confirmAddUser}
                        onConfirm={addUser}
                        onClose={() => {
                            setConfirmAddUser(null)
                            editorRef.current?.focus()
                        }}
                    />
                </RootPortal>}
        </div>
    )
}

export default MarkdownEditorInput
