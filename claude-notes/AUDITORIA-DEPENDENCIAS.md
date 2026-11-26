# Auditoría de dependencias — Focalboard

Fecha de la auditoría: 2026-11-25 · Rama: `main` · Repo: `/home/ulysses316/Documents/personal/local-services/focalboard`

Este documento vive en `claude-notes/` y está en git. Está escrito para retomar el trabajo **sin contexto previo**: explica qué se hizo y por qué, qué decidió el usuario, qué queda pendiente (con pasos concretos), cómo reproducir cada verificación y qué trampas aparecieron.

## 0. Cómo retomar (léelo primero)

1. Estado: la auditoría está **terminada y probada** (el usuario probó la app en local: "todo bien"). Hay **15 commits locales en `main` sin subir**; el usuario hace los `git push` a mano (ver sección 2).
2. Lo que queda es solo lo de la sección 6 (pendientes). Nada es urgente; el único punto que conviene hacer antes de subir es **probar el backend S3 con la configuración real del usuario** (sección 7).
3. La memoria de Claude para este proyecto está en `/home/ulysses316/.claude/projects/-home-ulysses316-Documents-personal-local-services-focalboard/memory/` (`dependency-audit-2026-11.md`, `cypress-drag-test-skipped.md`). Son un resumen; este documento es la fuente detallada.
4. Para saber si algo cambió desde entonces: `git log --oneline 96ca4c80..HEAD` debe mostrar exactamente los 15 commits de la sección 3 (`96ca4c80` es el commit base, anterior a la auditoría) y `git status` debe estar limpio.

## 1. Resumen

| Área | Antes | Ahora |
|---|---|---|
| Webapp (npm) | 120 vulnerabilidades (9 críticas, 65 altas, 32 moderadas, 14 bajas) | 19 (1 crítica que es falso positivo, 9 altas, 9 bajas) |
| Servidor (Go) | ~23 avisos alcanzables en `govulncheck` (stdlib, `x/net`, `grpc`, `gorilla/websocket`, `mattermost/server/v8`) | `govulncheck`: "No vulnerabilities found". `mattermost/server/v8` ya no está en el binario de producción |
| Node | 16.3.0 (Docker), 20 (CI/releases) | 24 LTS en Docker, `.nvmrc` y workflows |
| Go | 1.21 (`go.mod`), imagen `golang:1.21.8` | `go 1.26.0` en `go.mod`, imagen `golang:1.26-bookworm` |
| Cypress | 9 | 16.4 (10 de 11 e2e pasan, 1 `it.skip`) |
| Tests flaky del servidor | varios (`TestPermissionsPatchBoard*`, `TestUndeleteBoard`, `TestPatchBlock`, `TestSQLStore`) | arreglados de raíz; quedan 2 raros (sección 6) |

Estado de los tests al cerrar: jest 820/820; servidor, los 22 paquetes pasan (3 de 3 corridas completas en la última comprobación); e2e Cypress 10 pasan + 1 pendiente; `gofmt`, `go vet`, `npm run check` limpios.

## 2. Preferencias del usuario y reglas del entorno

- **Idioma:** el usuario escribe en español; responder en español.
- **Nunca `git push`** (regla en `~/.claude/CLAUDE.md`): ni normal ni `--force`, ni a ninguna rama. El usuario sube a mano. Hay que hacer el commit y avisar que quedó listo para subir. Los comandos `/commit:commit` del plugin preguntan "Commit + push / Commit only / Commit on a new branch": aunque elija "push", **no se ejecuta el push**; el usuario siempre eligió "Commit only".
- **Commits:** Conventional Commits en inglés (como el historial del repo), agrupados en commits lógicos. Cuando se commitea directamente (no vía `/commit`) se añade el trailer `Co-Authored-By: Claude ... <noreply@anthropic.com>` que indique el sistema; el comando `/commit:commit` prohíbe trailers, así que ahí no se pone.
- **Secretos:** el usuario usa Infisical (`infisical run --env=<entorno> -- <comando>`); aquí no hizo falta.
- **ARM:** "no nos interesa tanto"; no preocuparse por builds ARM.
- **Auto mode / permisos:** el clasificador bloqueó `go run github.com/vektra/mockery/v2@...` (descarga y ejecuta código remoto). No intentar saltarse el bloqueo; los mocks de `filestore` se escribieron a mano. Descargar imágenes públicas de Docker Hub (`golang`, `adobe/s3mock`) sí funcionó.
- **Documentos:** los de auditoría se dejan fuera de git. Para decisiones de alcance, el usuario prefiere que se le pregunte con opciones y una recomendación (suele elegir la recomendada).

Decisiones que tomó el usuario durante la auditoría:
- `mattermost/server/v8`: eligió **escribir un backend de archivos propio** (frente a "solo subir la versión" o "dejarlo documentado").
- `MM-T4433` (e2e de arrastre): eligió **`it.skip` con TODO** y dejarlo anotado para reevaluarlo.
- Flaky de `insert_at`: eligió **arreglarlo en el store** (frente a solo robustecer el test).
- `draft-js`: se dejó **sin tocar** (riesgo aceptado, sección 4.2).

## 3. Commits (15, todos locales, de más antiguo a más reciente)

Dependencias y tooling:
1. `a4d856c4` build(webapp): update npm dependencies to fix audit findings — `npm audit fix` (120 → 69).
2. `c37d1191` build(server): upgrade Go dependencies and toolchain to 1.26 — `go 1.26.0`, `x/net`, `x/crypto`, `grpc`…
3. `3015a550` build(docker): use golang 1.26 image for the Go build stage.
4. `72eedb97` build: upgrade Node to 24 LTS in Docker, CI and release workflows.
5. `917b782f` build(webapp): drop unused imagemin deps and bump webpack tooling (69 → 28).
6. `8b3adc4b` build(webapp): upgrade Cypress to 16 and migrate e2e config (28 → 22). Incluye el `it.skip` de `MM-T4433`.
7. `4cc60889` build(docker): drop optipng CPPFLAGS workaround from webapp stage.
8. `2fd4dbfd` build(webapp): remove unused fetch-mock-jest (22 → 19).

Servidor:
9. `5657da38` test(server): pause before write requests to avoid boards_history collisions — **workaround temporal**, revertido por el commit 13.
10. `e120c0a2` feat(server): add local and S3 file storage package — `server/services/filestore`.
11. `82ddb091` refactor(server): drop mattermost server/v8 dependency.
12. `18228165` fix(store): retry history inserts that collide on insert_at in SQLite.
13. `c2edea06` test(server): remove pause added to avoid history collisions.
14. `b4dff785` fix(app): do not report an error when the export archive closes fine.
15. `80b69e2b` fix(api): return 404 when a requested file does not exist.

## 4. Detalle por área

### 4.1 Webapp (npm)

- `npm audit fix` (sin cambios mayores): 120 → 69.
- **Dependencias sin uso eliminadas** (comprobado con grep en `webpack*.js`, `src/` y todo el proyecto): `image-webpack-loader` y los 6 `imagemin-*` (solo estaban en `package.json`), y `fetch-mock-jest` (los tests usan su propio helper `webapp/src/test/fetchMock`). Con ellas desaparecen sus cadenas vulnerables (`decompress`, `got`, `fetch-mock`, `path-to-regexp`…).
- Subidas mayores: `copy-webpack-plugin` 10→14, `webpack-dev-server` 4→6, `start-server-and-test` 1→3, `cypress` 9→16 (+ `@testing-library/cypress` 10, `cypress-real-events` 1.15, `cypress-failed-log` 2.10). La API de `CopyPlugin` y la config de webpack no necesitaron cambios.
- Se quitó del `Dockerfile` el parche `CPPFLAGS="-DPNG_ARM_NEON_OPT=0"` (era de `optipng-bin`, que ya no se instala). Se mantiene `npm install --no-optional` porque Cypress sigue en `optionalDependencies`.

**Vulnerabilidades restantes (19):**
- **1 crítica, falso positivo: `eslint-config-mattermost`.** `npm audit` dice "Malware in eslint-config-mattermost" por **coincidencia de nombre** con un paquete malicioso del registro npm (hoy placeholder `0.0.1-security`). Lo instalado es la dependencia de GitHub `eslint-plugin-mattermost` fijada al commit `23abcf9988` del repo oficial `mattermost/eslint-plugin-mattermost` (Elias Nahum, 2021), cuyo `package.json` interno se llama igual. Verificado: sin scripts de instalación, `index.js` de 17 líneas y dos JSON de configuración ESLint, sin `child_process`/red/`eval`. No se puede silenciar en `npm audit`.
- **9 altas:** `draft-js`, `@draft-js-plugins/{buttons,editor,emoji,mention,utils}`, `@types/draft-js`, `immutable` (3.7.6, le llega a `draft-js`) y `ws` 7.5.8 (viene de `cypress`→`chrome-remote-interface` y de `jest-environment-jsdom`→`jsdom`; solo tooling de test).
- **9 bajas:** cadena `jest` 27 / `jsdom` 16 (`@tootallnate/once`, `http-proxy-agent`…). Arreglarlas implica `jest` 30.

### 4.2 `draft-js`: riesgo aceptado, sin tocar

`draft-js` está en 0.11.7, la última publicada, y el proyecto está abandonado; npm propone como "fix" una versión **anterior** (0.7.0), es decir, no hay arreglo real. Lo usan 6 archivos: `markdownEditorInput.tsx` (editor de descripciones y comentarios), `entryComponent.tsx`, y el plugin de markdown en vivo (`live-markdown-plugin/liveMarkdownPlugin.ts`, `pluginStrategy.ts`, `block-types/headingBlockStrategy.ts`, `codeBlockStrategy.ts`), más los plugins de emoji y menciones. Un fallo ahí **no rompe la compilación sino el comportamiento** del editor (formato, foco, cursor) y solo `cardBadges` en Cypress lo ejercita. La salida real es reemplazar el editor (Lexical, TipTap…), que es un proyecto de funcionalidad, no una actualización. Corre en el navegador del propio usuario.

Mayores disponibles que no se aplicaron: React 19, react-router 7, Redux Toolkit 2, react-intl 12, marked 18, fullcalendar 7, jest 30.

### 4.3 Servidor (Go): versiones

- `go` 1.21 → 1.26.0 en `server/go.mod` (se eliminó la directiva `toolchain go1.21.8`). Go **local** instalado por el usuario: 1.27.4 en `/usr/local/go/bin/go`. Imagen Docker: `golang:1.26-bookworm`.
- `x/net` 0.25→0.63, `x/crypto` 0.23→0.59, `grpc` 1.64→1.85, `protobuf` 1.34→1.36, `x/sys`, `x/text`, `lib/pq`, `viper`, `testify`, `client_golang`, `logr/v2`, `oklog/run`, `go-diff`, `minio-go/v7` 7.4.1.
- `gorilla/websocket` fijado a `v1.5.4-0.20240701034025-d67f41855da4` (commit de master con el fix de GO-2026-6278; no hay release con el fix). **Revisar cuando salga una release.**

### 4.4 `mattermost/server/v8`: eliminado del binario de producción

- Los ~150 avisos de `v8` son bugs de la **plataforma Mattermost** (canales, equipos, invitados, LDAP, webhooks, playbooks…). Ninguno es de código que Focalboard use y muchos tienen `fix: N/A`, así que subir la versión no los quitaba. `govulncheck` los marcaba porque Focalboard importaba paquetes de `v8`. Además subirla rompía la compilación (el paquete `platform/services/httpservice` ya no existe) y la versión más reciente exige Go ≥ 1.27.3.
- Qué usaba Focalboard de `v8` y por qué se pudo quitar: `utils.TimeFromMillis` (ahora propio en `server/utils`), `store.NewErrNotImplemented` (ahora `model.NewErrNotImplemented`), `httpservice` (solo en el mock muerto `services/telemetry/mocks/ServerIface.go`, de una interfaz inexistente; borrado) y `platform/shared/filestore` (lo importante).
- **Nuevo paquete `server/services/filestore`** (reemplaza `v8/platform/shared/filestore`): interfaz `FileBackend` con los 6 métodos que usa `app` (`Reader`, `FileExists`, `CopyFile`, `MoveFile`, `WriteFile`, `RemoveFile`), `ReadCloseSeeker`, `Settings`, `New(Settings)`. Drivers `local` y `amazons3` (`DriverLocal`, `DriverS3`).
  - Backend local (`local.go`): usa `os.Root`, así que ninguna ruta puede salir del directorio (`..`, symlinks hacia fuera); un archivo escrito a medias se borra; dirs 0750, archivos 0600 (copias con permisos de `os.Create` antes de umask).
  - Backend S3 (`s3.go`) sobre `minio-go`: credenciales IAM (si no hay claves) / estáticas V2 / V4, SSL, región, SSE solo en subida y copia (como el original), trace a stderr, timeout por petición (0 → 20 s en vez de expirar al instante), prefijo (`path.Join`, `/` también en Windows), content-type de imágenes por extensión, tamaño conocido para `*bytes.Buffer`/`*os.File`.
  - Escrito **sin copiar código de `v8`** (licencia AGPL); solo se leyó su comportamiento observable.
  - Mocks `server/services/filestore/mocks` (`FileBackend`, `ReadCloseSeeker`) **escritos a mano** en estilo mockery (`Return` acepta valores o funciones, como esperan `app/files_test.go` y `app/helper_test.go`). Si se regeneran con mockery, mantener ese estilo.
- Cambios de comportamiento a tener en cuenta: un symlink dentro del directorio de archivos que apunte fuera **ya no se sigue**; los directorios se crean con 0750 (antes las copias usaban 0777 antes de umask).
- Verificado: 0 paquetes de `v8` en `go list -deps ./main`; `govulncheck` limpio; tests de `filestore` (local + S3 contra `adobe/s3mock`) y flujo completo en la imagen Docker (sección 5).
- `v8` **sigue en `go.mod` solo por un test**: `services/store/sqlstore/migrationstests/boards_migrator_test.go` importa `channels/db` (`db.Assets()` con las migraciones de Mattermost). No entra en el binario ni en `govulncheck`. Opciones futuras: copiar esos assets al repo o quitar el test (pierde cobertura de migraciones históricas).

### 4.5 Fix en el store: colisión de `insert_at` en las tablas `*_history` (SQLite)

- Problema: `boards_history`, `blocks_history` y `board_members_history` tienen PK con `insert_at`; en SQLite su `DEFAULT` (`STRFTIME('%Y-%m-%d %H:%M:%f','NOW')`) tiene resolución de **1 ms**. Dos cambios de la misma entidad en el mismo milisegundo daban `UNIQUE constraint failed: ..._history.id, ..._history.insert_at` y un HTTP 500. Era la causa de los flaky `TestPermissionsPatchBoard*` (fallaban ~26 de cada 30 corridas, también en el commit base), `TestUndeleteBoard`, `TestPatchBlock` y `TestSQLStore`. Postgres y MySQL tienen resolución de microsegundos y no se ven afectados.
- Arreglo: `execHistoryInsert` (`server/services/store/sqlstore/history.go`) reintenta el insert (máx. 5 intentos, esperando 1 ms) **solo en SQLite** y **solo si** el error es un conflicto de clave en una tabla `_history`. Se usa en los 11 sitios que insertan en esas tablas (`board.go`, `blocks.go`, `legacy_blocks.go`).
- Tests: `history_test.go` (300 escrituras seguidas a un tablero, un bloque y un miembro; fallaba en la 2.ª iteración, ahora pasa) y test de la detección del conflicto. Tras el fix: `TestPermissions*` 30/30 sin pausa, `sqlstore` x10 limpio.
- Alternativa descartada (más invasiva): guardar `insert_at` con microsegundos desde Go en cada insert o cambiar la PK con una migración.

### 4.6 Archivo inexistente: 404 y exportación

- Problema: `app.ErrFileNotFound` era un `errors.New` plano, pero el código que lo consume (`api/files.go`, `app/export.go`) ya esperaba un error de tipo not found (`model.IsErrNotFound`). Resultado: `GET /api/v2/files/teams/{team}/{board}/{file}` devolvía **500** en vez de 404, y la exportación de un tablero **fallaba** si faltaba el archivo de una imagen, en lugar de registrarlo y seguir (que es lo que dice el comentario de `writeArchiveFile`).
- Arreglo (`80b69e2b`): `ErrFileNotFound = model.NewErrNotFound("file")` (mensaje `{file} not found`, como el resto) y un `return` que faltaba tras el `errorResponse` final de `handleServeFile` (sin él, con un reader nulo, el `defer fileReader.Close()` entra en pánico). La webapp trata 404 y 500 igual (sin imagen): sin cambio visible.
- Defecto previo aparte (`b4dff785`): `ExportArchive` hacía `merr.Append(zw.Close())` y `merror` **guarda también los errores nulos**, así que **toda** exportación devolvía un error falso cuyo `Error()` entraba en pánico (el handler lo registraba como "Http handler panic" al final de cada exportación; el zip ya se había enviado, por eso no se notaba). Ahora solo se añade si `zw.Close()` devuelve error.
- Tests: `TestServeFile` (404 para un archivo inexistente; un archivo subido se sirve) en `integrationtests/file_test.go` y un caso en `TestExportBoard` (`integrationtests/export_test.go`) que llama a `App().ExportArchive` directamente. Se verificó que fallan sin los arreglos y pasan con ellos.
- **No se tocó:** `handleArchiveExportBoard` (`api/archive.go`) sigue sin `return` tras `errorResponse` y responde 200 si el error ocurre cuando el zip ya empezó a enviarse (por eso el test llama al `App` en vez de al endpoint).

### 4.7 Node, Docker y CI

- `docker/Dockerfile`: `node:16.3.0` (fijada por digest) → `node:24-bookworm`; `golang:1.21.8` → `golang:1.26-bookworm`; sin `CPPFLAGS`. Runtime sigue en `debian:bookworm-slim`.
- `webapp/.nvmrc` y `.github/workflows/{prod,dev}-release.yml`: Node 24 (`ci.yml` lee `.nvmrc`). **Los workflows de GitHub no se han ejecutado**; solo se cambió la versión de Node.

### 4.8 Cypress 9 → 16

- Migrado a `webapp/cypress.config.ts` (reemplaza `cypress.json` y `cypress/plugins/index.js`); `Cypress.env` → `Cypress.expose` (Cypress 16 quitó `Cypress.env`; son credenciales de prueba públicas); `uiAddNewCard` (`cypress/support/api_commands.ts`) espera el foco del título porque `cardDetail.tsx` (~línea 126) enfoca el título 300 ms después de abrir una tarjeta nueva y Cypress 16 es lo bastante rápido como para hacer clic antes; `within()` acotado con `.first()` y un `contains` negado reescrito en `manageGroups.ts`.
- **`MM-T4433`** (`cypress/integration/createBoard.ts`, "Scrolls the kanban board when dragging card to edge") está en **`it.skip`** con un TODO. Causa: con Cypress 16, `trigger('dragstart'/'dragover')` (con o sin `dataTransfer`) no hace que react-dnd inicie el arrastre, así que `react-dnd-scrolling` (que exige `monitor.isDragging()`) no scrollea (`scrollLeft` se queda en 1933). `cypress-real-events` tampoco sirve: en Electron ni llega `mousedown` y en Chromium no se dispara `dragstart` (CDP no inicia drags HTML5 nativos). Con Cypress 9 sí pasaba.
- En este entorno el `cy.screenshot()` automático al fallar agota los 30 s y tapa el error real; para depurar usar `--config screenshotOnRunFailure=false`.

## 5. Verificaciones realizadas

- **Tests:** jest 139 suites / 820 tests / 457 snapshots; `npm run check`; `npm run pack`; `npm ci`; servidor completo (22 paquetes); e2e Cypress 10/11.
- **Imagen Docker** (reconstruida con `docker compose build` tras eliminar `v8`; 214 MB), en un contenedor temporal sin el volumen `fbdata`: arranca (`/` → 200 en ~16 s por la importación de plantillas); las plantillas importadas escriben sus imágenes en `data/files`; registro, login, creación de tablero, **subida de un archivo de 20 000 bytes y descarga con contenido idéntico**; lectura con `Range` (usa `Seek`) correcta; archivos 0600, directorios 0750; sin errores inesperados en el log. **Esa imagen se construyó antes de los commits 14 y 15** (export/404); para incluirlos hay que reconstruirla.
- **App en local:** el usuario la probó en el navegador con el servidor recompilado y dijo "todo bien" (editor de comentarios/descripciones y subida de archivos incluidos).
- **S3:** solo contra `adobe/s3mock` (8 casos: existe/no existe, escribir, leer con seek, content-type, copiar, mover, borrar, prefijo). **No** contra S3/MinIO reales.

## 6. Pendientes y decisiones abiertas (por prioridad)

1. **Probar el backend S3 con la configuración real del usuario** (SSE, SigV2, IAM, trace, endpoint propio). Es lo único que conviene hacer antes de subir. Si el usuario no usa S3 en producción, el riesgo es bajo.
2. **Subir los commits** (el usuario, a mano): `git push -u origin HEAD`.
3. **Flaky que quedan** (existían antes, también en el commit base):
   - `app.TestPatchBoard` (~3 de cada 60): `Unexpected call GetMembersForBoard` por una carrera entre la goroutine del websocket (`ws/server.go`, broadcast) y el mock gomock del test. Próximo paso: ver cómo `SetupTestHelper` (`app/helper_test.go`) comparte el mock con el `ws.Server` y si hace falta sincronizar o ampliar las expectativas.
   - `integrationtests` `CreateBoard` → 500 `ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint` al insertar la categoría por defecto. Visto 1 vez en 18 corridas completas; 0 en 150 corridas aisladas, con y sin estos cambios. No toca los historiales; posible carrera entre tests que comparten la BD en memoria (`file::memory:?cache=shared`).
4. **`draft-js` y plugins:** riesgo aceptado (4.2). Reabrir solo si se decide reemplazar el editor.
5. **`MM-T4433`:** re-habilitar cuando se averigüe por qué react-dnd ignora el `dragstart` sintético en Cypress 16, o cubrir el scroll con un test de jest sobre `Kanban`.
6. **`handleArchiveExportBoard` sin `return`** tras `errorResponse` (4.6). Cambio pequeño pero tocaría semántica del endpoint; no se hizo.
7. **`v8` solo para un test** (`channels/db`, 4.4): copiar los assets de migración al repo o eliminar el test.
8. **`gorilla/websocket`** en un commit de master hasta que haya release.
9. **Subidas mayores sin aplicar:** React 19, react-router 7, Redux Toolkit 2, react-intl 12, marked 18, fullcalendar 7, jest 30 (arreglaría también las 9 bajas de npm). Cada una es un proyecto aparte.
10. **CI de GitHub no ejecutada** con Node 24; revisar el primer run tras subir.
11. Rebuild de la imagen Docker si se quiere una imagen con los commits 14 y 15.

## 7. Recetas (comandos)

Desde la raíz del repo salvo que se indique.

**Servidor (Go).** Ruido normal al compilar: avisos `sqlite3-binding.c ... may return address of local variable` (cgo de `go-sqlite3`); son inofensivos.
```
cd server
FOCALBOARD_UNIT_TESTING=1 go test -count=1 -tags 'json1 sqlite3' ./... 2>&1 | grep -E "^(ok|FAIL|--- FAIL)" | grep -v "no test files"
go vet -tags 'json1 sqlite3' ./...        # y gofmt -l .
FOCALBOARD_UNIT_TESTING=1 go test -count=1 -tags 'json1 sqlite3' ./integrationtests -run 'TestServeFile|TestExportBoard'
make server                                # compila bin/focalboard-server
```
Un solo test: `-run NombreTest`. Medir flakiness: `-count=30`. Para ver los logs de tests que **pasan** hace falta `-v` (sin `-v` Go los oculta).

**Vulnerabilidades Go:** `govulncheck` se instaló en `/tmp/gobin/govulncheck` (puede haberse borrado):
`GOBIN=/tmp/gobin go install golang.org/x/vuln/cmd/govulncheck@latest` y luego `cd server && /tmp/gobin/govulncheck -tags 'json1 sqlite3' ./...` (nivel por símbolos; `-show traces` para ver rastros). Comprobar `v8` fuera del binario: `cd server && go list -deps -tags 'json1 sqlite3' ./main | grep -c "mattermost/server/v8"` debe dar 0.

**Webapp:**
```
cd webapp
npm ci --ignore-scripts      # instalar desde el lockfile
npm run check                # eslint + stylelint
npx jest                     # 820 tests
npm run pack                 # build de producción (webapp/pack, gitignored)
npm audit                    # debe dar 19 (1 crítica falsa, 9 altas, 9 bajas)
```
**E2E Cypress** (hay que compilar antes el servidor con `make server`; la primera vez `npx cypress install`):
`cd webapp && npm run cypress:ci` (arranca `bin/focalboard-server` en el puerto 8088). Para un spec y sin screenshots de fallo:
`npx start-server-and-test runserver-test http://localhost:8088 "cypress run --config screenshotOnRunFailure=false --spec cypress/integration/cardBadges.ts"`.

**Tests S3 del `filestore`** (se saltan si no hay endpoint):
```
docker run -d --rm --name fb-s3-test -p 127.0.0.1:19000:9090 -e initialBuckets=focalboard-test adobe/s3mock
cd server && FOCALBOARD_TEST_S3_ENDPOINT=127.0.0.1:19000 FOCALBOARD_TEST_S3_ACCESS_KEY=testkey FOCALBOARD_TEST_S3_SECRET_KEY=testsecret123 go test ./services/filestore
docker stop fb-s3-test
```
(MinIO ya no es público en Docker Hub ni en quay.io, por eso `adobe/s3mock`.)

**Docker:** `cd docker && docker compose build` (imagen `docker-app`). Prueba efímera sin tocar el volumen `fbdata`: `docker run -d -p 127.0.0.1:18000:8000 docker-app`, esperar ~16 s a que `/` dé 200, y borrar con `docker rm -f`. API para un humo: `POST /api/v2/register`, `POST /api/v2/login` (`{"type":"normal",...}`), `POST /api/v2/boards`, subida `POST /api/v2/teams/0/{boardID}/files` (multipart, campo `file`), descarga `GET /api/v2/files/teams/0/{boardID}/{fileId}`. Todas necesitan `X-Requested-With: XMLHttpRequest` (CSRF) y `Authorization: Bearer <token>`.

**Correr la app en local** (sin ensuciar el repo ni enviar telemetría): copia de `config.json` en `/tmp/focalboard-local/` con `dbconfig` y `filespath` allí, `webpath` absoluto a `webapp/pack`, `telemetry: false`, `prometheusaddress: ""`, `enableLocalMode: false`; luego `./bin/focalboard-server -config /tmp/focalboard-local/config.json` → http://localhost:8000 (auth nativa: el primer usuario se registra desde la pantalla de login). Antes recompilar `make server` y `cd webapp && npm run pack`. El `config.json` del repo usa `./focalboard.db` y `./files` (ignorados por git) y telemetría activada; `docker compose up` usa el volumen `fbdata`.

## 8. Trampas conocidas

- **zsh y globs:** `grep --include=*.ts` falla en silencio en zsh ("no matches found"). Entrecomillar: `--include='*.ts'`. Esto casi hace concluir que `fetch-mock-jest` no se usaba cuando sí había helpers con nombre parecido (era un helper local).
- `go test` sin `-v` **oculta los logs de los tests que pasan**; un `grep` sobre esos logs da falsos negativos.
- `th.CheckOK(resp)` comprueba status 200 y `resp.Error == nil`. `client.DoAPIGet` devuelve **error y respuesta** juntos en estados no-2xx. `CreateBoardsAndBlocks` **reasigna los IDs** y exige al menos un bloque (con 0 bloques da 400).
- El endpoint de exportación **transmite** el zip: aunque falle a mitad, el status ya es 200. Por eso el test de exportación llama a `App().ExportArchive`.
- Comparar contra el commit base: se usó `git stash -u` + `go test` + `git stash pop` (también con `-- ruta` para revertir solo algunos archivos). Comprobar `git status` después.
- `.eslintcache` en `webapp/` mete ruido en greps globales; excluirlo.
- `npm audit` marca `eslint-config-mattermost` como malware: es un falso positivo documentado en 4.1.
- Los tests de `integrationtests` tardan ~24 s; el paquete completo del servidor, ~1 min.

## 9. Estado del entorno al cerrar

- `git status` limpio; 15 commits locales sin subir.
- El servidor local de prueba **ya no está corriendo** (`/tmp/focalboard-local/` conserva `config.json`, la BD y `files/`; al estar en `/tmp` puede desaparecer).
- Imagen Docker `docker-app:latest` construida (sin los commits 14 y 15). No quedan contenedores de prueba de esta tarea.
- `bin/focalboard-server` y `webapp/pack` compilados antes de los commits 14 y 15 (están en `.gitignore`).
- Herramientas temporales: `/tmp/gobin/govulncheck`; logs sueltos en `/tmp/*.log` (se pueden borrar).
