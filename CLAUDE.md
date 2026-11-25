# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Standalone Focalboard (open-source Trello/Notion/Asana alternative): a Go server (`server/`) that serves a React/TypeScript SPA (`webapp/`). The README notes this repo is unmaintained and does not contain the Mattermost plugin (that lives in `mattermost/mattermost-plugin-boards`). Desktop apps (`mac/`, `linux/`, `win-wpf/`) wrap the same server + webapp running against SQLite.

## Commands

Setup: create a `.env` in the repo root with `EXCLUDE_ENTERPRISE="1"`, then `make prebuild` (runs `npm install` in `webapp/`).

- Build server: `make server` → `bin/focalboard-server` (build tags `json1 sqlite3`). Run `./bin/focalboard-server`; it reads `config.json` and serves on http://localhost:8000.
- Build webapp: `make webapp` (`npm run pack` → `webapp/pack/`, which the server serves). Rebuilding only the webapp doesn't need a server restart; reload the browser.
- Watch both (needs [modd](https://github.com/cortesi/modd)): `make watch` (or `make watch-single-user`).
- Server tests (SQLite): `make server-test-sqlite`. Other DBs spin up Docker containers: `make server-test-mysql|mariadb|postgres`. `make server-test` runs all four.
  - Single Go test: `cd server && FOCALBOARD_UNIT_TESTING=1 go test -tags 'json1 sqlite3' -run TestName ./path/to/pkg`
  - Store tests run against a DB chosen by `FOCALBOARD_STORE_TEST_DB_TYPE` (sqlite default; mysql/mariadb/postgres otherwise).
- Server lint: `make server-lint` (golangci-lint). Regenerate mocks: `make generate` (mockgen v1.6.0). Regenerate API spec/clients: `make swagger`.
- Webapp (from `webapp/`): `npm run check` (eslint + stylelint), `npm run fix`, `npm run test` (jest; single test: `npx jest path/to/file.test.ts -t "name"`), `npm run updatesnapshot`, `npm run i18n-extract` after adding/changing `formatjs` messages (updates `i18n/en.json`).
- Cypress: `npm run cypress:ci` (starts `bin/focalboard-server` from `webapp/cypress` on port 8088 — build the server first).
- `make ci` approximates CI: webapp lint/jest/cypress + all server tests.

### Docker

`docker/docker-compose.yml` builds from `docker/Dockerfile` (node → golang → debian runtime) and publishes on host port **8000** (was 80 originally). Run with `cd docker && docker compose up -d --build`. The Go image must be ≥ the version in `server/go.mod` (it uses a `toolchain` directive), and the runtime image's glibc must match the Go build image.

## Architecture

### Server (`server/`, Go module `github.com/mattermost/focalboard/server`)

Layered, wired together in `server/server/server.go` (entry point is `server/main`):

- `api/` — HTTP handlers (gorilla/mux) under `/api/v2`; one file per resource (boards, blocks, cards, members, files, ...). Documented via swagger annotations.
- `app/` — business logic; the `App` struct (`app.go`) coordinates store, permissions, websocket, notifications, webhooks. API handlers call into `app`, not the store directly.
- `services/store/` — `Store` interface (`store.go`) with the SQL implementation in `sqlstore/` (SQLite, MySQL/MariaDB, Postgres; SQL migrations in `sqlstore/migrations/` as numbered `.up.sql`/`.down.sql`, plus Go-based data migrations), `mattermostauthlayer/` (wraps the store when running as a Mattermost plugin), `mockstore/` (generated mocks), and `storetests/` (shared test suite run against every DB driver).
- `services/` — cross-cutting services: `config`, `auth`, `permissions`, `audit`, `notify`, `webhook`, `metrics`, `telemetry`, `scheduler`.
- `ws/` — websocket server that pushes block/board changes to subscribed clients.
- `model/` — shared types (Board, Block, Card, Member, ...). Core data model: a **Board** contains **Blocks** (cards, views, text/image/etc. content blocks); card properties are defined on the board.
- `assets/` — default templates (`templates.boardarchive`, rebuilt with `make templates-archive`). Boards are imported/exported as archives (`app/import.go`, `app/export.go`).

The same code runs in several modes (standalone server, desktop app, Mattermost plugin), so `server/` code often branches on config/`Edition` (set via `-ldflags` in the Makefile) and on single-user mode (`--single-user`).

### Webapp (`webapp/src/`)

React + Redux Toolkit (`store/` slices: boards, cards, views, users, ...). `octoClient.ts` is the REST client; `mutator.ts` wraps all board/block changes (with undo/redo via `undomanager.ts`) and calls `octoClient`; `wsclient.ts` receives websocket updates and dispatches them into the store. `blocks/` are the client-side block models, `components/` the UI, `properties/` the card property types, `pages/` + `router.tsx` the routes. Webpack configs: `webpack.prod.js` (output `pack/`), `webpack.dev.js`, `webpack.editor.js`. Strings are localized with react-intl/formatjs (`webapp/i18n/`).

### Other directories

`docker/` (image + compose for running), `docker-testing/` (compose files for DB-backed server tests), `website/` and `docs/` (docs site), `import/` (importer scripts for other tools), `noticegen/` (NOTICE generation), `experiments/`.
