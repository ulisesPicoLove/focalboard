// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// What the manager stores. Commands are of many kinds, so the value that redo returns and
// undo receives is kept as unknown here; perform() is generic and keeps each pair consistent.
interface UndoCommand {
    checkpoint: number
    undo: (value?: unknown) => Promise<void>
    redo: () => Promise<unknown>
    description?: string
    groupId?: string
    value?: unknown
}

//
// General-purpose undo manager
//
class UndoManager {
    onStateDidChange?: () => void

    private commands: UndoCommand[] = []
    private index = -1
    private limit = 200
    private isExecuting = false

    get currentCheckpoint() {
        if (this.index < 0) {
            return 0
        }
        return this.commands[this.index].checkpoint
    }

    get undoDescription(): string | undefined {
        const command = this.commands[this.index]
        if (!command) {
            return undefined
        }

        return command.description
    }

    get redoDescription(): string | undefined {
        const command = this.commands[this.index + 1]
        if (!command) {
            return undefined
        }

        return command.description
    }

    private async execute(command: UndoCommand, action: 'undo' | 'redo') {
        if (!command || typeof command[action] !== 'function') {
            return this
        }
        this.isExecuting = true

        // A failing undo/redo must not leave isExecuting stuck on true, which would disable
        // undo, redo and registering new commands until the page is reloaded.
        try {
            if (action === 'redo') {
                command.value = await command[action]()
            } else {
                await command[action](command.value)
            }
        } finally {
            this.isExecuting = false
        }

        return this
    }

    // Runs `redo` and remembers how to undo it. Whatever redo returns is what undo is given.
    async perform<ValueType = void>(
        redo: () => Promise<ValueType>,
        undo: (value: ValueType) => Promise<void>,
        description?: string,
        groupId?: string,
        isDiscardable = false,
    ): Promise<ValueType> {
        const value = await redo()

        // undo only ever receives the value that this same redo returned (see execute())
        this.registerUndo({undo: undo as (value?: unknown) => Promise<void>, redo}, description, groupId, value, isDiscardable)
        return value
    }

    registerUndo(
        command: {
            undo: (value?: unknown) => Promise<void>
            redo: () => Promise<unknown>
        },
        description?: string,
        groupId?: string,
        value?: unknown,
        isDiscardable = false,
    ): UndoManager {
        if (this.isExecuting) {
            return this
        }

        // If we are here after having called undo, invalidate items higher on the stack
        this.commands.splice(this.index + 1, this.commands.length - this.index)

        let checkpoint: number
        if (isDiscardable) {
            checkpoint =
                this.commands.length > 1 ? this.commands[this.commands.length - 1].checkpoint : 0
        } else {
            checkpoint = Date.now()
        }

        const internalCommand = {
            checkpoint,
            undo: command.undo,
            redo: command.redo,
            description,
            groupId,
            value,
        }
        this.commands.push(internalCommand)

        // If limit is set, drop the oldest items and keep the most recent ones
        if (this.limit && this.commands.length > this.limit) {
            this.commands = this.commands.slice(this.commands.length - this.limit)
        }

        // Set the current index to the end
        this.index = this.commands.length - 1

        if (this.onStateDidChange) {
            this.onStateDidChange()
        }

        return this
    }

    async undo() {
        if (this.isExecuting) {
            return this
        }
        let command = this.commands[this.index]
        if (!command) {
            return this
        }

        const currentGroupId = command.groupId
        if (currentGroupId) {
            do {
                // eslint-disable-next-line no-await-in-loop
                await this.execute(command, 'undo')
                this.index -= 1
                command = this.commands[this.index]
            } while (this.index >= 0 && currentGroupId === command.groupId)
        } else {
            await this.execute(command, 'undo')
            this.index -= 1
        }

        if (this.onStateDidChange) {
            this.onStateDidChange()
        }

        return this
    }

    async redo() {
        if (this.isExecuting) {
            return this
        }
        let command = this.commands[this.index + 1]
        if (!command) {
            return this
        }

        const currentGroupId = command.groupId
        if (currentGroupId) {
            do {
                // eslint-disable-next-line no-await-in-loop
                await this.execute(command, 'redo')
                this.index += 1
                command = this.commands[this.index + 1]
            } while (this.index < this.commands.length - 1 && currentGroupId === command.groupId)
        } else {
            await this.execute(command, 'redo')
            this.index += 1
        }

        if (this.onStateDidChange) {
            this.onStateDidChange()
        }

        return this
    }

    clear() {
        const prevSize = this.commands.length

        this.commands = []
        this.index = -1

        if (this.onStateDidChange && prevSize > 0) {
            this.onStateDidChange()
        }
    }

    get canUndo() {
        return this.index !== -1
    }

    get canRedo() {
        return this.index < this.commands.length - 1
    }
}

const undoManager = new UndoManager()
export default undoManager
