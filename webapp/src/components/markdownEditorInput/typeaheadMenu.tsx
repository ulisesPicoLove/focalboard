// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {MutableRefObject, ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {MenuOption} from '@lexical/react/LexicalTypeaheadMenuPlugin'

import './typeaheadMenu.scss'

type Props<T extends MenuOption> = {
    anchorRef: MutableRefObject<HTMLElement | null>
    options: T[]
    selectedIndex: number | null
    label: string
    onSelect: (option: T) => void
    onHover: (index: number) => void
    renderOption: (option: T) => ReactNode
}

// The suggestion list that opens under the text cursor for @mentions and :emojis
export default function TypeaheadMenu<T extends MenuOption>(props: Props<T>): React.JSX.Element | null {
    const {anchorRef, options, selectedIndex, label, onSelect, onHover, renderOption} = props
    if (!anchorRef.current || options.length === 0) {
        return null
    }

    return createPortal(
        <ul
            className='TypeaheadMenu'
            role='listbox'
            aria-label={label}
        >
            {options.map((option, i) => (
                <li
                    key={option.key}
                    ref={(element) => option.setRefElement(element)}
                    id={`typeahead-option-${i}`}
                    role='option'
                    aria-selected={selectedIndex === i}
                    className={`TypeaheadMenu__option${selectedIndex === i ? ' selected' : ''}`}
                    onMouseEnter={() => onHover(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelect(option)}
                >
                    {renderOption(option)}
                </li>
            ))}
        </ul>,
        anchorRef.current,
    )
}
