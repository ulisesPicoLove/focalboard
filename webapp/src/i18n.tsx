// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserSettings} from './userSettings'

const supportedLanguages = ['ca', 'de', 'el', 'en', 'es', 'fr', 'id', 'it', 'ja', 'nl', 'oc', 'pt-br', 'ru', 'sv', 'tr', 'zh-cn', 'zh-tw']

type Messages = {[key: string]: string}

// One chunk per language: only the active one is downloaded. English needs no file,
// every message carries its English defaultMessage in the code.
const loaders: Record<string, () => Promise<{default: Messages}>> = {
    ca: () => import('../i18n/ca.json'),
    de: () => import('../i18n/de.json'),
    el: () => import('../i18n/el.json'),
    es: () => import('../i18n/es.json'),
    fr: () => import('../i18n/fr.json'),
    id: () => import('../i18n/id.json'),
    it: () => import('../i18n/it.json'),
    ja: () => import('../i18n/ja.json'),
    nl: () => import('../i18n/nl.json'),
    oc: () => import('../i18n/oc.json'),
    'pt-br': () => import('../i18n/pt_BR.json'),
    ru: () => import('../i18n/ru.json'),
    sv: () => import('../i18n/sv.json'),
    tr: () => import('../i18n/tr.json'),
    'zh-cn': () => import('../i18n/zh_Hans.json'),
    'zh-tw': () => import('../i18n/zh_Hant.json'),
}

export async function loadMessages(lang: string): Promise<Messages> {
    const load = loaders[lang]
    if (!load) {
        return {}
    }
    return (await load()).default
}

export function getCurrentLanguage(): string {
    let lang = UserSettings.language
    if (!lang) {
        const baseLanguage = navigator.language.split(/[-_]/)[0]
        if (supportedLanguages.includes(navigator.language)) {
            lang = navigator.language
        } else if (baseLanguage && supportedLanguages.includes(baseLanguage)) {
            lang = baseLanguage
        } else {
            lang = 'en'
        }
    }
    return lang
}

export function storeLanguage(lang: string): void {
    UserSettings.language = lang
}
