// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from 'cypress'

export default defineConfig({
    chromeWebSecurity: false,
    video: false,
    viewportWidth: 1600,
    viewportHeight: 1200,
    expose: {
        username: 'test-user',
        password: 'test-password',
        email: 'test@mail.com',
    },
    e2e: {
        baseUrl: 'http://localhost:8088',
        supportFile: 'cypress/support/index.ts',
        specPattern: [
            'cypress/integration/**/login*.ts',
            'cypress/integration/**/create*.ts',
            'cypress/integration/**/manage*.ts',
            'cypress/integration/**/group*.ts',
            'cypress/integration/**/card*.ts',
        ],
        setupNodeEvents(on) {
            on('task', {
                // eslint-disable-next-line global-require
                failed: require('cypress-failed-log/src/failed')(),
            })
        },
    },
})
