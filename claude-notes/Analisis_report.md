# Análisis de Picoboard (fork de Focalboard)

Fecha: 25 de noviembre de 2026
Rama analizada: `main` (commit `ec1aa31d`, ya incluye el rediseño Pico.Love OS y el login con Google)
Alcance: servidor Go (`server/`), webapp React (`webapp/`), archivos del repositorio, comparación con la competencia y viabilidad.

Cómo se hizo: lectura del código, mediciones con herramientas locales (`go test -cover`, `go vet`, `go list -deps`, `jest`, `tsc`, `npm outdated`, `npm audit`, un grafo de imports del webapp) y una búsqueda web sobre el estado de la competencia. El diagnóstico (secciones 1 a 10) no modificó código; el avance posterior está resumido en la sección 0.

Cada hallazgo lleva una etiqueta:
- **[Verificado]**: lo comprobé leyendo el código o ejecutando algo.
- **[Trazado]**: se siguió el flujo en el código, pero no se reprodujo en vivo.
- **[Sin verificar]**: sospecha razonable que falta confirmar.

Esfuerzo: **S** = horas a 1 día, **M** = 2 a 5 días, **L** = 1 a 4 semanas, **XL** = más de un mes (para una persona).

---

## 0. Estado de avance (actualizado el 26 de noviembre de 2026)

Las secciones 1 a 10 son el **diagnóstico original** del 25 de noviembre y se dejan tal cual como referencia. Esta sección dice qué se hizo desde entonces.

**Ramas (apiladas, ninguna subida; el push lo haces tú):**

| Rama | Base | Commits | Contenido |
|---|---|---|---|
| `fix/phase0-security` | `main` | 6 | Fase 0: correcciones de seguridad urgentes |
| `fix/phase1-hardening` | `fix/phase0-security` | 6 | Fase 1: endurecimiento del servidor y del webapp |
| `chore/phase2-cleanup` | `fix/phase1-hardening` | 16 | Fase 2: código muerto, MySQL, Docker/Postgres, modo plugin, matriz de roles |

Balance acumulado de `main` a `chore/phase2-cleanup`: **596 archivos cambiados, +2.570 / −59.870 líneas.** El repositorio pasó a unos 1.333 archivos rastreados, con unas 52.800 líneas de Go y 56.100 de TS/TSX (incluidos tests y snapshots).

### 0.1 Seguridad (sección 3): estado de cada hallazgo

| # | Hallazgo | Estado | Dónde / cómo |
|---|---|---|---|
| S1 | Inyección SQL por ID de categoría | **Corregido** (Fase 0) | `CASE WHEN` parametrizado, ID validado en el modelo, IDs inlineados en `blocks.go` validados; tests de regresión |
| S2 | Carrera de datos en websockets | **Corregido** (Fase 0) | `RLock` y copias en `ws/server.go`; pasa con `-race` |
| S3 | `go-sqlite3` v2.0.3 retractado | **Corregido** (Fase 0 y 2) | Ahora v1.14.22; al salir `server/v8` ya no hace falta el `exclude` |
| S4 | Enlaces `javascript:` en markdown | **Corregido** (Fase 0), con pendiente | Solo `http`, `https` y `mailto`; `decodeURI` seguro. **Pendiente:** DOMPurify y una Content-Security-Policy (añaden una dependencia: decisión tuya) |
| S5 | Secretos en el log de arranque | **Corregido** (Fase 0) | Se ocultan cadena de BD, `secret` y claves S3; el websocket ya no registra tokens |
| S6 | `authMode: mattermost` confía en una cabecera | **Corregido** (Fase 0 y 2) | `authMode` se valida al arrancar (solo `native` o `google`) y el modo plugin se borró del código |
| S7 | Sin límites de tamaño ni de tiempo | **Corregido** (Fase 1) | JSON 10 MiB, zip 500 MiB, archivos dentro del zip y subidas a `maxfilesize` (50 MiB por defecto), timeouts HTTP, límite de lectura y deadline de escritura en websocket |
| S8 | Cambio de contraseña y fuerza bruta | **Corregido** (Fase 1) | Rate limit (20/min por IP) en login, registro y cambio de contraseña; solo se cambia la propia contraseña y se cierran las otras sesiones |
| S9 | Sesiones sin revocación | **Corregido en parte** (Fase 1) | Tope absoluto de 14 días (`session_max_lifetime`), sin token por query string. **Pendiente:** revocar al dar de baja a alguien en Google Workspace (solo lo cubre el tope de 14 días) |
| S10 | Archivos accesibles por ID (IDOR) | **Corregido** (Fase 1) | `file_info.board_id` (migración 42); los archivos anteriores a la migración no tienen dueño y siguen accesibles |
| S11 | SSO: vinculación y duplicados | **Corregido** (Fase 1) | Se enlaza el `sub` de Google en el primer login; alta SSO serializada con un mutex (no hay índice único en `users`, así que solo protege una instancia) |
| S12 | Cualquiera regenera el token de invitación | **Corregido** (Fase 1) | Se rechaza fuera del modo `native` |
| S13 | Prometheus bloquea `Start()` y escucha en todas las interfaces | **Corregido** (Fase 1) | Corre en goroutine, escucha en `localhost`, SIGINT apaga limpio (probado en vivo) |
| S14 | Zoom deshabilitado y Google Fonts | **Hecho (Fase 3)** | Fuentes locales con `@fontsource` y zoom habilitado |

### 0.2 Calidad del servidor (sección 4)

- **Hecho:** `return` que faltaban tras `errorResponse` (exportar, tarjetas, equipos, sistema); `GetRootTeam` ya no regenera el token ante un error transitorio; corregida la comprobación invertida del login por correo; panics por body `null` y por nombre de archivo corto; índice en `sessions.token` (migración 41); `TestPatchBoard` determinista (se espera a que la cola asíncrona se vacíe).
- **Hecho (Fase 2):** quitados `notifymentions`, `notifysubscriptions`, `plugindelivery`, `mattermostauthlayer`, el adaptador de websocket del plugin, la retención de datos, compliance, statistics, metadata de tablero, el servicio de telemetría y `mattermost/server/v8`; quitados `mmpermissions` y todo el modo `MattermostAuth`; **MySQL y MariaDB** eliminados (el `dbtype` mysql o mariadb falla al arrancar con un mensaje claro).
- **Pendiente:** historial (`*_history`) sin poda; `execHistoryInsert` frágil en Postgres; N+1 y escrituras parciales (4.3); errores con `err.Error()` al cliente y 4 estilos de error (4.2); autorización repartida en ~70 handlers y `handleGetCard` que exige permiso de editor (4.1); eventos de websocket sin orden garantizado y websocket de una sola instancia; sin tests de `server/`, `main`, `metrics`, `config` (8 %) ni concurrencia en ws.
- **Hecho (Fase 2, cierre):** quitados los restos del modo plugin en `app` y `store` (`SearchUserChannels`, `GetChannel`, `PostMessage`, `SendMessage`, la vinculación de canales en `PatchBoard` y `BoardPatch.ChannelID`), `ServicesAPI`/`model/services_api.go`, los límites de tarjetas de la nube (servidor y webapp), la rama de plugin de `wsclient` y `NewVersionBanner`. Verificado: Go con `-race` sobre SQLite, suite completa sobre Postgres y 832 tests de Jest.

### 0.3 Calidad del webapp (sección 5)

- **Hecho (Fase 1):** `apiFetch` con timeout y redirección a login si expira una sesión (401); el `mutator` lanza error y avisa si el servidor rechaza una escritura, así que ya no se registra deshacer de un cambio que no ocurrió; `undomanager` con `try/finally`, límite que conserva lo reciente (200) y limpieza al cambiar de tablero; el websocket reintenta sin límite con backoff, reconecta al volver la red o la pestaña y recarga solo cuando la conexión reabre; script `typecheck` (ya en `webapp-ci`).
- **Hecho (Fase 2):** quitados 41 archivos inalcanzables (página de bienvenida, cabecera global, editor de desarrollo, iconos), 21 idiomas que nunca se cargaban, 7 imágenes, 5 paquetes npm sin uso, **el cliente de telemetría completo** (38 llamadas que no hacían nada) y el **banner "novedades" de Mattermost** (el stash pendiente ya se aplicó y se borró); `en.json` regenerado.
- **Pendiente:** S4 (DOMPurify/CSP), re-renders de `CardBadges` (F16), bundle de 5,1 MB sin división de código (F15), `eslint-plugin-react-hooks`, actualización de React 17 a 19 y reemplazo de `draft-js`, `moment` y `react-beautiful-dnd`, snapshots de poco valor, accesibilidad y `es.json` al 48 %, `pico.scss` de 1.043 líneas, tour de onboarding con textos de Mattermost, código de límites de nube, canales en el cuadro de compartir y la rama de plugin de `wsclient`.

### 0.4 Código y archivos muertos (sección 6)

- **Eliminado:** `mac/`, `linux/`, `win-wpf/`, `website/`, `experiments/`, `noticegen/`, el `templates.boardarchive` huérfano de 6 MB, archivos de CI/Gitpod/GitLab de Mattermost, `docs/` salvo `google-sso.md`, `SECURITY.md`, la política de divulgación, las plantillas de PR, los workflows de release y scorecards, los jobs de Windows y macOS del CI, los targets de escritorio del Makefile, las variables `EXCLUDE_*`, `docker-testing` de MySQL/MariaDB y la configuración de Docker con contraseña escrita en claro.
- **Corregido:** `.dockerignore` ya no manda `node_modules`, `files/`, `bin/` ni la base de datos local al build.
- **Sigue en decisión:** `import/` (importadores), el HTML de swagger generado, la migración de datos de SQLite a Postgres.
- **"Enterprise":** se confirmó que no hay código bajo licencia Enterprise en el repositorio; `server/v8` (el único vínculo posible) ya salió de `go.mod`.

### 0.5 Matriz de roles (decisión de la Fase 2)

Los 65 `TestPermissions*` corrían dos veces: en modo plugin (`mmpermissions` con una API falsa) y en modo estándar. Ahora corren **solo sobre `localpermissions`**, con los ajustes integrados en las tablas. Se comparó por nombre: los **1.284 casos que no son de guest** siguen ejecutándose y pasan; los de guest se saltaban en silencio en modo estándar y se eliminaron. Los tests de `app` que necesitan resultados de admin usan `fakePermissions` (`server/app/helper_test.go`). La suite de integración pasó de 66 s a 47 s.

### 0.6 Docker y despliegue

`docker/docker-compose.yml` ahora levanta **Postgres 16** con healthcheck y toma los secretos del shell (`infisical run --env=dev -- docker compose up -d --build`). Verificado construyendo y levantando el stack: migra 19 tablas y responde. Variables obligatorias: `POSTGRES_PASSWORD` y las `FOCALBOARD_GOOGLE_*`. Al desplegar: recrear el contenedor, los datos viejos de SQLite no se migran solos, y hay que copiar las variables a Infisical `staging` y `prod` (hoy solo `dev`).

### 0.7 Verificación y cifras actuales

| Comprobación | Resultado |
|---|---|
| Go con `-race` sobre SQLite | verde (con una excepción intermitente, ver abajo) |
| Go sobre Postgres real (Docker) | 18 de 18 paquetes verdes |
| `go vet` y `gofmt` | limpios |
| Jest | 838 tests verdes |
| ESLint, stylelint y `typecheck` | limpios |
| Esquema final de las 40 migraciones, antes y después de quitar MySQL | idéntico en Postgres; en SQLite solo líneas en blanco |
| Migraciones 41 y 42 sobre una copia de la base local | aplican sin errores |

### 0.8 Correcciones y advertencias sobre este reporte

- **Corrección:** el CI del servidor **ya corría con `-race`**; la sección 4.6 se equivoca al sugerir añadirlo.
- **Fallo intermitente sin explicar:** en una corrida completa de Go fallaron `TestGetBlocks` y, en otra, `TestPatchBoardsAndBlocks`; pasaron 15 corridas posteriores. Sospecha (no comprobada): la colisión de `insert_at` en SQLite descrita en 4.3.
- **No probado en navegador:** la redirección por 401, la reconexión del websocket, el enlace `javascript:` y la ausencia del banner. Solo hay tests automáticos.
- **Recuperable de git:** la lógica de menciones y suscripciones de `notifymentions`/`notifysubscriptions` (útil para construir notificaciones, ver 7.3) está en el historial, en el commit anterior a `chore(server): remove unlinked notify...`.

### 0.9 Qué sigue

1. **Tú:** subir las tres ramas en orden y abrir los PR; copiar variables a Infisical `staging` y `prod`; decidir sobre DOMPurify/CSP; ejecutar `govulncheck`; revisión humana del código de autenticación; licencia y repositorio privado.
2. **Fase 2:** terminada; solo queda decidir si el tour de onboarding se conserva (sus textos ya no mencionan Mattermost) o se elimina.
3. **Fase 3:** modernizar el frontend (rendimiento y bundle, React 19, `draft-js`, `moment`, `react-beautiful-dnd`, accesibilidad, `es.json`).
4. **Fase 4:** funcionalidades, empezando por notificaciones (hoy no se envía ninguna), recordatorios, historial de actividad y búsqueda global; y la poda del historial (`*_history`).

---

## 1. Resumen ejecutivo

1. **El proyecto upstream está muerto.** El Focalboard standalone no tiene release desde junio de 2024 (último commit de upstream: junio de 2025). Mattermost dejó el plugin Boards en modo mantenimiento. Todo lo que no arreglen ustedes no lo va a arreglar nadie. Picoboard ya es, en la práctica, un producto propio.
2. **La base es razonable, pero tiene deuda acumulada.** Go con capas claras (api → app → store), TypeScript en modo `strict`, 851 tests de Jest en verde y `go vet`/`gofmt` limpios. La deuda principal:
   - un frontend dos versiones mayores atrás de React (17), con un editor abandonado (draft-js) que concentra las 7 vulnerabilidades altas de `npm audit`;
   - cerca del **25 % del código Go y el 10 % del webapp** solo tiene sentido como plugin de Mattermost y aquí es código muerto;
   - soporte de 4 bases de datos que nadie necesita.
3. **Hay varios fallos de seguridad y estabilidad que conviene corregir antes de producción.** Los más graves son baratos de arreglar (S):
   - una **inyección SQL** autenticada al reordenar categorías;
   - una **condición de carrera en el servidor de websockets** que puede tumbar el proceso;
   - un **driver de SQLite retractado** (SQLite de 2020);
   - **enlaces `javascript:`** que se cuelan en el markdown;
   - **secretos impresos en el log** al arrancar;
   - **ningún límite de tamaño ni de tiempo** en las peticiones.
4. **Funcionalidad: falta lo básico de colaboración.** En modo standalone **no se envía ninguna notificación**: las menciones y suscripciones solo se escriben en el log de depuración. Tampoco hay recordatorios de fechas, historial de actividad visible ni búsqueda de tarjetas entre tableros. Frente a Trello o Planka se puede llegar a paridad en 2 o 3 meses. Frente a Asana, ClickUp, Notion o Plane (Gantt, dependencias, automatizaciones, IA) no es realista con una o dos personas.
5. **Recomendación:**
   1. Primero, 4 a 6 semanas de "endurecer y adelgazar": seguridad, borrar código muerto, quedarse con Postgres y actualizar el frontend.
   2. Después, añadir solo las 5 o 6 funcionalidades que pidan los usuarios internos (notificaciones primero).
   3. Si los requisitos crecen hacia gestión de proyectos seria (Gantt, sprints, automatizaciones), reevaluar migrar a **Vikunja** o **Plane** antes de construirlo en casa (sección 8).

---

## 2. Estado y cifras

| Métrica | Valor |
|---|---|
| Go (sin tests) | 202 archivos, 48.590 líneas (unas 9.900 generadas: mocks y `public_methods.go`) |
| Go (tests) | 81 archivos, 19.879 líneas |
| TS/TSX del webapp (sin tests) | 375 archivos, 35.166 líneas |
| SCSS | 175 archivos, 9.113 líneas (`styles/pico.scss` sola tiene 1.043) |
| Migraciones SQL | 40 (up/down × 3 dialectos), con 85 ramas `{{if .mysql/.postgres/.sqlite}}` |
| Endpoints REST | unos 80 (`/api/v2`) |
| Jest | 145 suites, 851 tests, 457 snapshots, todo en verde, unos 20 s |
| Cobertura del webapp | 63 % de sentencias, 54 % de ramas |
| Cobertura efectiva de Go (unitarios + integración) | api 72 %, app 81 %, sqlstore 58 %, **ws 12 %**, config 8 % |
| Cypress | 6 specs, 11 tests (uno en `it.skip`) |
| Bundle | `main.js` de **5,1 MB minificado (unos 1,04 MB gzip)**, en un solo chunk |
| `npm audit --omit=dev` | 7 altas, todas de la cadena draft-js |
| Tests de Go | `go vet` y `gofmt` limpios. La suite completa falla solo por `app.TestPatchBoard`, que es intermitente (ya se sabe por qué, ver 4.6) |

---

## 3. Seguridad: prioridad máxima

Ordenado por gravedad e impacto. Casi todo es esfuerzo S.

| # | Hallazgo | Dónde | Estado | Esfuerzo |
|---|---|---|---|---|
| S1 | **Inyección SQL autenticada.** El cliente puede elegir el `id` al crear una categoría (`Category.Hydrate` solo genera uno si viene vacío). Luego `reorderCategories` lo concatena como SQL crudo: `sq.Case("id").When("'"+categoryID+"'", ...)`. En SQLite, `varchar(36)` no limita la longitud. Hay el mismo patrón, latente, en `category_boards.go:144` y en `blocks.go:920, 1016-1031`. | `server/services/store/sqlstore/category.go:220` | [Verificado] en el código, [Trazado] el flujo completo | S |
| S2 | **Carrera de datos en websockets que tumba el proceso.** `listenersByTeam` y `listenersByBlock` se escriben con `ws.mu.Lock()`, pero se leen **sin lock** en `getListenersForBlock` y en todos los `Broadcast*`. El `RWMutex` nunca se usa con `RLock`. En Go, una lectura y escritura concurrente de un map es un *fatal error* que `recover` no atrapa: el servidor entero se cae. | `server/ws/server.go:464+` | [Verificado] | S |
| S3 | **`mattn/go-sqlite3 v2.0.3+incompatible` está retractado.** Trae SQLite 3.31.1 (enero de 2020), con muchos CVE posteriores. Se selecciona solo porque `mattermost/server/v8`, que usa un único test, lo requiere. | `server/go.mod:18` | [Verificado] | S |
| S4 | **Los enlaces `javascript:` pasan por el markdown.** `htmlFromMarkdown` no filtra el esquema del href, y el resultado va a `dangerouslySetInnerHTML` (descripciones y comentarios). La app no tiene Content-Security-Policy, y el token de sesión vive en `localStorage`. Probado con node: `[x](javascript:alert(1))` produce `href="javascript:alert(1)"`. Además, un `%` mal formado hace que `decodeURI` lance una excepción y rompe el render de la tarjeta. | `webapp/src/utils.ts:291-302` | [Verificado] el HTML generado; [Sin verificar] si el navegador lo ejecuta con `target=_blank` | S |
| S5 | **Secretos en el log de arranque.** `log.Printf("%+v", removeSecurityData(cfg))` solo oculta `GoogleClientSecret`. Salen en claro `DBConfigString` (con la contraseña de Postgres), las claves S3 y `Secret`, también cuando vienen de Infisical. El websocket además registra tokens de sesión y de lectura. | `server/services/config/config.go:137`, `ws/server.go:168,188,437` | [Verificado] | S |
| S6 | **El modo `authMode: "mattermost"` confía en la cabecera `Mattermost-User-Id`.** Con una sola línea de configuración (o la variable de entorno), cualquiera se hace pasar por cualquier usuario. `AuthMode` no se valida contra una lista permitida. | `server/api/auth.go:369`, `ws/server.go:112` | [Trazado] | S |
| S7 | **Sin límites de tamaño ni de tiempo.** `io.ReadAll(r.Body)` sin `MaxBytesReader`. `MaxFileSize` vale 0, es decir, ilimitado. La importación de zip no limita lo descomprimido (riesgo de zip bomb). `http.Server` no tiene timeouts. El websocket no tiene `SetReadLimit`. | `api/*.go`, `web/webserver.go:62`, `app/import.go` | [Trazado] | S/M |
| S8 | **Cambio de contraseña y fuerza bruta.** No hay rate limiting en ningún sitio. `handleChangePassword` toma el `userID` de la URL y no lo compara con el de la sesión, así que permite probar contraseñas de otros usuarios. Con SSO esto pesa menos, porque el login con contraseña está oculto, pero el endpoint sigue vivo. | `server/api/auth.go:258,330` | [Trazado] | M |
| S9 | **Las sesiones no se revocan al dar de baja a alguien.** La expiración es deslizante de 30 días, sin tope absoluto, y los tokens se guardan en claro. Si se elimina a alguien de Google Workspace, conserva Picoboard hasta 30 días inactivo. Además se aceptan tokens en `?access_token=` (acaban en logs y referrers). | `services/auth/request_parser.go:62` | [Trazado] | M |
| S10 | **Archivos accesibles por ID (IDOR).** Se comprueba el permiso sobre el tablero que viene en la URL, pero el archivo se resuelve solo por su ID. Un usuario con acceso a cualquier tablero puede descargar cualquier archivo cuyo ID conozca. | `api/files.go:83,248`, `app/files.go:103` | [Trazado] | M |
| S11 | **SSO de Google.** Está bien hecho (PKCE, state y nonce firmados, `hd` + `email_verified`, redirección segura). Faltan dos cosas: **(a)** no se enlaza el `sub` de Google con el usuario existente, así que un correo reciclado hereda la cuenta anterior; **(b)** no hay índice único en `users.email` ni en `users.username`, por lo que dos primeros logins simultáneos pueden duplicar el usuario. | `server/app/sso.go`, migración `000004` | [Trazado] | S |
| S12 | **Cualquier usuario puede regenerar el token de invitación del equipo** e invalidar los enlaces de todos. | `server/api/teams.go:134` | [Trazado] | S |
| S13 | **Métricas Prometheus.** `prometheusaddress: ":9092"` escucha en todas las interfaces y sin autenticación. Además `Server.Start()` se bloquea en `group.Run()` mientras retiene el mutex, por lo que `main` nunca instala el manejador de SIGINT y no hay apagado ordenado. | `server/server/server.go:340-354` | [Trazado] | S |
| S14 | **Zoom deshabilitado** (`user-scalable=0`, incumple WCAG 1.4.4) y **fuentes cargadas desde Google Fonts**: dependencia externa y fuga de privacidad en una herramienta interna. | `webapp/html-templates/page.ejs` | [Verificado] | S |

Bien resuelto, sin cambios necesarios: el CSRF (cabecera `X-Requested-With` obligatoria en `/api/v2` y sin CORS), el flujo SSO en general, y que `go vet` esté limpio.

---

## 4. Calidad del código: servidor (Go)

### 4.1 Arquitectura
- Las capas son correctas en general, con dos excepciones:
  - **El websocket y `auth` leen el store directamente**, sin pasar por `app`. Las reglas de permisos existen en tres sitios (api, app, ws) y la copia de ws ya divergió: ignora los tableros abiertos.
- **La autorización está repartida en unos 70 handlers**, cada uno con su mezcla de `HasPermissionToBoard`, `HasPermissionToTeam` y `userIsGuest`. Hay inconsistencias reales: `handleGetCard` (`api/cards.go:339`) exige `PermissionManageBoardCards`, así que **un viewer o commenter no puede pedir una tarjeta individual**. Solución: unas pocas funciones de política (`CanViewBoard`, `CanEditBoard`, ...) con tests de tabla. Esfuerzo M/L.
- **Objetos dios:**
  - `App` tiene 145 métodos;
  - la interfaz `Store`, 118 (unos 15 son solo para el plugin);
  - `SQLStore`, 314 contando los métodos generados.
- **Los eventos de websocket pueden llegar desordenados.** Se emiten desde un pool de 10 goroutines, y `ReorderCategories` usa `go func()` sin control.
- **La plantilla `index.html` se vuelve a parsear desde disco en cada petición** (`web/webserver.go:90`).

### 4.2 Manejo de errores
- **Falta `return` después de `errorResponse`** en:
  - `api/archive.go:91` y `:250` (exportar tablero/equipo): devuelve un zip corrupto con estado 200;
  - `api/cards.go:189,195`: hace una doble escritura de la respuesta;
  - `api/teams.go:49`;
  - `api/system.go:53`.

  Además, `handleArchiveImport` responde 200 cuando falla el parseo. Esfuerzo S.
- **Errores tragados con consecuencias:**
  - `team, _ := a.store.GetTeam("0")` (`app/teams.go:12`): un error transitorio de la base de datos regenera el token de invitación;
  - `ws, _ := a.app.GetRootTeam()` seguido de `ws.UpdateAt` provoca un panic con nil;
  - en `Login`, la condición `if err != nil && IsErrNotFound(err)` está invertida, así que los errores reales de base de datos se reportan como "contraseña incorrecta".
- **Panics alcanzables:**
  - `getFileInfoID` hace `fileName[1:]` sobre una cadena vacía;
  - `handleUpdateUserConfig` desreferencia el body cuando es `null`.
- **Cuatro estilos de error conviven:** `model.Err*`, `fmt.Errorf`, `pkg/errors` (archivado) y `merror`. 41 handlers devuelven `err.Error()` al cliente, filtrando texto interno de la base de datos. Todos los 4xx se registran como Error, lo que inunda el log.

### 4.3 Store y base de datos
- **Índices que faltan:**
  - `sessions.token` no tiene índice y se consulta en cada petición autenticada (full scan);
  - `users.email` y `users.username` no tienen índice ni restricción única.

  Se arregla con una migración. Esfuerzo S.
- **Las tablas `*_history` crecen sin límite.** Cada escritura copia la fila entera, y la "data retention" que debía podarlas es código muerto. Para un uso interno de años esto acaba pesando: conviene una tarea programada que guarde las últimas N versiones o N días. Esfuerzo M.
- **El parche `execHistoryInsert` es frágil:**
  - detecta el error comparando el texto del mensaje y hace `sleep(1ms)` posiblemente con el lock de escritura;
  - en **Postgres** el problema es peor: `NOW()` devuelve la hora de inicio de la transacción, así que dos inserciones en la misma transacción colisionan y el reintento no aplica. Probablemente sea el "500 raro de ON CONFLICT" ya observado.

  Solución: `clock_timestamp()` o una clave primaria sustituta. Esfuerzo M.
- **Escrituras parciales y N+1:**
  - `InsertBlocksAndNotify` inserta bloque a bloque sin transacción;
  - `PatchBlocksAndNotify`, `GetMembersForUser` y `handlePatchBlocks` consultan elemento a elemento;
  - cada broadcast de websocket consulta los miembros y luego recorre miembros × listeners.
- **Cuatro motores de base de datos** (SQLite, MySQL, MariaDB, Postgres): unas 100 ramas `dbType` en Go, 85 en las migraciones y 4 objetivos de test. **Recomendación:** quitar MySQL y MariaDB ya (riesgo bajo) y estandarizar producción en Postgres. SQLite puede quedarse solo para desarrollo, o quitarse también, lo que elimina el parche de historial y la dependencia de cgo.

### 4.4 Dependencias de Go
| Dependencia | Problema |
|---|---|
| `mattn/go-sqlite3 v2.0.3` | Retractada (S3) |
| `mattermost/server/v8` | Pseudo-versión, usada solo por un test de migraciones |
| `gorilla/websocket` | Fijada a un commit de master, sin release |
| `gorilla/mux` | Poca actividad. Go ≥1.22 ya trae patrones de rutas en `net/http` |
| `pkg/errors`, `golang/mock` | Archivados (`go.uber.org/mock` es el fork mantenido) |
| `krolaw/zipstream` | De 2018, sin mantenimiento |
| `rudderlabs/analytics-go` | Telemetría muerta |
| `mattermost/server/public` | Acoplamiento profundo: `mlog` en 80 archivos, `model` en 46. Sustituirlo por `log/slog` y tipos propios es esfuerzo L |
| SQLite | El binario enlaza **dos** implementaciones: `mattn` (cgo) y `modernc` (vía morph) |

### 4.5 Websockets
- Funciona **solo en memoria y en una instancia**. Con dos réplicas, las actualizaciones en tiempo real se partirían en silencio. Para una herramienta interna basta una instancia, pero hay que saberlo.
- Escrituras síncronas sin deadline: un cliente lento frena a todos.
- `CheckOrigin` siempre devuelve `true`.
- Las sesiones autenticadas por websocket no se revalidan tras logout o expiración.

### 4.6 Tests
- **`app.TestPatchBoard` es intermitente y la causa está identificada.**
  - Todos los subtests comparten un helper y un controlador gomock.
  - El callback asíncrono de `blockChangeNotifier` de un subtest consume las expectativas del siguiente.
  - Solución: un helper por subtest y una cola síncrona en tests. Esfuerzo S.
  - La mayoría de los subtests que fallan prueban la vinculación con canales, que es solo del plugin y se borra con la sección 6.
- **Sin tests:** `server/` (Start/Shutdown, que habría detectado S13), `main`, `metrics`, `notify`, `config` (8 %). ws tiene un 12 % de cobertura efectiva y ningún test de concurrencia (por eso no se vio S2). **Hay que añadir `-race` en CI.**

### 4.7 Configuración
Defaults inseguros o engañosos:
- `telemetry: true`, aunque está muerta;
- `MaxFileSize: 0`;
- `enableLocalMode: true` en las configuraciones incluidas (socket local que permite resetear contraseñas);
- `secureCookie: false` y `sslmode=disable`;
- una contraseña de Postgres en claro en `docker/config.json`;
- el comentario de `SessionRefreshTime` dice "5 minutos" y el valor es de 5 horas;
- `Secret` y `FeatureFlags` no se usan.

---

## 5. Calidad del código: webapp (React/TypeScript)

### 5.1 Lo que está bien
- `strict: true`, cero `@ts-ignore`, solo 1 componente de clase y ESLint limpio.
- Redux Toolkit con `createSelector` en la mayoría de los slices.
- 851 tests rápidos.

### 5.2 Robustez (lo más importante)
- **El mutator ignora los fallos del servidor (F4/F5).**
  - Nunca revisa `response.ok`. Una edición rechazada se pierde en silencio y además se registra en el historial de deshacer.
  - `octoClient` tiene 71 `fetch` escritos a mano y no maneja errores de forma común: no detecta 401, no tiene timeout ni reintento.
  - Si la sesión expira a mitad de uso, la aplicación muestra listas vacías.
  - Solución: un helper `request<T>()` con errores tipados, 401 → login y timeout. Esfuerzo M.
- **Bugs en `undomanager.ts`:**
  - `isExecuting` queda en `true` para siempre si una acción falla (falta un `try/finally`);
  - el historial no se limpia al cambiar de tablero, así que Ctrl+Z puede deshacer algo del tablero anterior;
  - el código de límite conserva los elementos equivocados (`splice` en lugar de `slice(-limit)`).

  Esfuerzo S.
- **El websocket deja de reconectar para siempre** tras 10 intentos de 3 s (unos 30 s). Después de suspender el portátil o cortarse la VPN, la pestaña ya no recibe cambios y no lo indica. Solución: backoff exponencial sin tope, escuchar los eventos `online` y `visibilitychange`, resincronizar al reconectar y mostrar un aviso de "desconectado". Esfuerzo S/M.

### 5.3 Rendimiento
- **Re-render masivo.**
  - `getCardContents(cardId)` crea un `createSelector` nuevo en cada llamada.
  - `getCardComments` y `getCardAttachments` devuelven un `[]` nuevo cuando la tarjeta no tiene ninguno.
  - Resultado: **todas las `CardBadges` (kanban, galería y calendario) se vuelven a renderizar con cada evento de Redux**, incluido cada lote de websocket.
  - Esfuerzo S, y mejora mucho los tableros grandes.
- El `React.memo` de `KanbanColumn` no sirve, porque recibe un callback nuevo en cada render.
- El orden manual hace `indexOf` dentro de `sort`, es decir O(n² log n).
- No hay virtualización de listas: la tabla renderiza todas las filas.
- **La división en chunks no funciona.** Con `"module": "commonjs"`, el `import()` se compila a `require()`. El bundle sale como un solo `main.js` de 5,1 MB, con 139 locales de moment, los 17 JSON de traducción cargados de golpe y lodash completo.
  - Solución: `module: esnext`, rutas y diálogos pesados en lazy, CSS extraído y `contenthash` en los nombres.
  - Esfuerzo M. Previsiblemente reduce a la mitad o menos la carga inicial.
- **Los logs de depuración van a producción**: las directivas `#!if ENV` no tienen el loader configurado, así que siguen activas 92 llamadas a `Utils.log`. Esfuerzo S.

### 5.4 Dependencias
| Paquete | Versión actual → última | Comentario |
|---|---|---|
| react / react-dom | 17 → 19 | Bloqueado por `@testing-library/react` 11 |
| react-router-dom | 5 → 7 | v5 está en modo legado |
| react-redux / RTK | 7 / 1.8 → 9 / 2 | |
| **draft-js** | 0.11.7, **archivado por Meta** | Origen de las 7 vulnerabilidades altas. Sustitutos: Lexical, TipTap o BlockNote. Otra opción es terminar el `blocksEditor` interno (1.412 líneas, detrás del flag `newBoardsEditor`). Esfuerzo L |
| **moment** | En mantenimiento | Pasar a date-fns o dayjs |
| **react-beautiful-dnd** | Archivado | Además convive con react-dnd: dos librerías de arrastrar. Unificar en dnd-kit, que también trae teclado |
| typescript / eslint / jest | 4.7 / 8 / 27 → 5.x / 10 / 30 | eslint 8 está fuera de soporte |
| emoji-mart | 3 → 5 | v3 incluye un sprite PNG de 3,8 MB |

### 5.5 Calidad y herramientas
- **Los tests no se comprueban con el compilador**: `@swc/jest` elimina los tipos. El `tsconfig` raíz mezcla tipos de Cypress y da 1.541 errores. Añadir `"typecheck": "tsc -p src --noEmit"` con `skipLibCheck`. Esfuerzo S.
- **No hay `eslint-plugin-react-hooks`**: ni `rules-of-hooks` ni `exhaustive-deps` se comprueban, y hay 93 `useEffect` y 191 `useCallback`. Esfuerzo S, más M para corregir lo que aparezca.
- **Snapshots:** 67.854 líneas en 126 archivos (2,2 MB). 34 tests solo comparan snapshots, y cada cambio de estilos los rompe. Aportan poco valor: conviene sustituirlos por aserciones de Testing Library.
- **Archivos que acumulan demasiado:**
  - `utils.ts` (822 líneas) es una clase "cajón de sastre";
  - `centerPanel.tsx` mezcla creación de tarjetas, plantillas, tour, límites y telemetría, y tiene un import roto (`'../../../webapp/src/telemetry/...'`);
  - `Kanban`, `Table` y `TableRow` reciben 14 o 15 props; `readonly` se pasa a mano en unos 60 sitios.

### 5.6 Estilos, accesibilidad, i18n y móvil
- **`styles/pico.scss` (1.043 líneas) sobrescribe 27 componentes desde fuera** con selectores largos. Funciona por orden y especificidad, y se romperá en silencio cuando cambie el markup. Además su bloque `:root` cambia sombras y radios **en todos los temas**, incluido "Focal Theme". Conviene mover reglas a cada componente y acotar los tokens a su tema. Esfuerzo M.
- **Accesibilidad casi inexistente:** 8 `aria-*`, 9 `role` y 4 `tabIndex` en 290 componentes. Hay 41 `<div onClick>`. El kanban y la tabla no se pueden arrastrar con teclado.
- **i18n:**
  - **`es.json` solo tiene el 48 % traducido** (226 de 468 cadenas), relevante si la empresa trabaja en español;
  - `en.json` está desactualizado (16 mensajes distintos y 51 claves sin usar);
  - 21 de los 38 archivos de idioma nunca se cargan.
- **Móvil:** la propia app dice "early beta". Solo hay 37 `@media`. Detecta el móvil por user-agent (los iPad se identifican como "Macintosh" y probablemente no puedan arrastrar). No hay un layout móvil para kanban ni para la tabla.

---

## 6. Código y archivos muertos

En este despliegue no se usan ni el modo plugin de Mattermost, ni las apps de escritorio, ni la web de marketing.

### 6.1 Eliminar con riesgo bajo
| Ruta | Tamaño | Motivo |
|---|---|---|
| `website/` | 179 archivos, 7,4 MB | Sitio Hugo de focalboard.com |
| `server/app/templates.boardarchive` | 6,2 MB | Huérfano. El que se embebe es `server/assets/templates.boardarchive` (y son distintos) |
| `experiments/` | 22 archivos, 631 KB | Extensión de navegador sin referencias |
| `mac/`, `win-wpf/`, `linux/`, `app-config.json` | 62 archivos, unas 5.500 líneas | Apps de escritorio. Al quitarlas, también sus targets del Makefile (`mac-app`, `win-wpf-app`, `linux-app`, `server-mac`, `server-win`, `server-dll`) y los workflows `dev-release.yml` y `prod-release.yml` (que además inyectan claves de Rudder) |
| `noticegen/`, `Dockerfile.build`, `.gitlab-ci.yml`, `.gitpod.yml` | Pequeños | Infraestructura de Mattermost (Node 16, Go 1.18, CI privado de MM) |
| `server/go.tools.mod/.sum`, `webapp/tslint.json` | Pequeños | Nada los usa |
| `.github/workflows/scorecards-analysis.yml`, `.github/CODEOWNERS` (vacío), `dependabot.yml` (revisores de `mattermost/cloud-sre`) | | Pensados para el repo público de MM |
| `docs/*` excepto `google-sso.md` | 9 archivos | Páginas de colaboración de upstream |
| `SECURITY.md`, `responsible_disclosure_policy.md` | | Apuntan a `responsibledisclosure@mattermost.com`: hay que reescribirlos o borrarlos |
| Paquetes Go `notifymentions`, `notifysubscriptions`, `plugindelivery`, `mattermostauthlayer` | unas 3.900 líneas | Nada los importa, ni siquiera los tests. Al quitarlos también sale `sergi/go-diff` |
| Webapp: 41 archivos inalcanzables (`pages/welcome`, `components/globalHeader`, `editableDayPicker`, 11 iconos, etc.) | unas 1.600 líneas, más 5 tests | Comprobado con un grafo de imports desde los entry points de webpack |
| Webapp: 21 locales no importados | 293 KB | `i18n.tsx` no los carga |
| Webapp: imágenes sin uso (`app-bar-icon.png`, `boards-screenshots.png`, `upgrade.png`, `onboardingBg.jpg`) | 368 KB | |
| npm sin uso: `react-hot-keys`, `fstream`, `file-loader`, `@types/react-intl`, `fullcalendar` (paquete paraguas), `@fullcalendar/core` | | Confirmar con `npm run pack` |
| Texto `EXCLUDE_ENTERPRISE` / `EXCLUDE_PLUGIN` | | Ni el Makefile ni el código Go lo leen. Aparece en README, CLAUDE.md, `.env.example` y en los workflows |

**Total eliminable con riesgo bajo:** unos 385 archivos, unas 72.000 líneas de texto (54.000 son `website/` y `experiments/`) y unos 16,5 MB del repositorio.

### 6.2 Eliminar con refactor (riesgo medio, hacerlo por partes)
| Área | Tamaño aproximado | Comentario |
|---|---|---|
| Servidor: `ws/plugin_adapter*` y sus mocks, `mmpermissions` y mocks, compliance (siempre devuelve 403/501), statistics, channels, límites de nube, data retention, telemetría, ramas `MattermostAuth` | **unas 12.000 líneas** (5.300 de mocks generados) más 2.200 de tests: **cerca del 25 % del Go** | Pasa por la interfaz `Store`, los mocks y el webapp. Al terminar, `mattermost/server/public/plugin` y `pluginapi` salen del binario |
| Webapp: tour de onboarding (con textos de Mattermost), aviso de límite de tarjetas y "upgrade", telemetría (68 llamadas que no hacen nada), canales (el cuadro de compartir dice "Search for people and channels"), rama plugin del websocket, insights, `versionMessage` y detección de escritorio | **3.500 a 4.000 líneas (unos 10 % de `src/`)** y 4,4 MB de GIFs e imágenes | |
| Soporte MySQL/MariaDB | Unas 100 ramas | Decisión de producto. Recomendado |

### 6.3 Decidir
- **`import/`** (importadores de Trello, Asana, Notion, Jira, Todoist y Nextcloud Deck): útil si se migran datos. Importan directamente los modelos de `webapp/src/blocks` y no se compilan en CI, así que pueden estar rotos (no verificado). Mantener solo el de Trello si se va a usar.
- **`server/swagger/docs/html/index.html`** (2,2 MB generados): se puede regenerar con `make swagger`.
- **Migraciones SQL:** **no compactarlas.** morph lleva el registro de versiones aplicadas y las bases ya existentes necesitarían una línea base manual por motor.

### 6.4 Lo que no está en git pero conviene saber
- `files/` (144 MB), `bin/` (48 MB), `webapp/pack` (14 MB), `webapp/coverage` (12 MB) y `focalboard.db` están correctamente ignorados.
- **`.dockerignore` tiene un error.** Patrones como `node_modules` solo aplican en la raíz del contexto, así que **`webapp/node_modules` (763 MB), `files/`, `bin/` y la base de datos local se envían al build de Docker**: unos 950 MB de contexto. Además `ADD webapp/` copia el `node_modules` del host antes del `npm install`. Añadir `**/node_modules`, `files/`, `bin/`, `*.db`, `webapp/pack`, `webapp/coverage`, `.env`, `.infisical.yaml` y `AUDITORIA-*.md`. Esfuerzo S, y debería ser lo primero.

---

## 7. Funcionalidades frente a la competencia

### 7.1 Lo que Picoboard ya tiene
- Vistas: tablero kanban, tabla, galería y calendario.
- Propiedades: texto, número, select, multi-select, persona, multi-persona, fecha, checkbox, URL, email, teléfono, y creado/actualizado por y en.
- Filtros, orden, agrupar y cálculos por columna.
- Plantillas de tablero y de tarjeta.
- Comentarios, adjuntos, imágenes y checklists dentro de la tarjeta.
- Roles (admin, editor, commenter, viewer), tableros públicos con enlace de solo lectura y categorías en la barra lateral.
- Tiempo real, deshacer/rehacer, importar y exportar, webhooks básicos, temas (incluido Pico.Love OS) y SSO de Google.

### 7.2 Comparación
Leyenda: ✅ lo tiene · ⚠️ parcial · ❌ no lo tiene

| Funcionalidad | Picoboard | Trello | Asana / ClickUp / Monday | Notion | Jira / Linear | Plane (OSS) | Vikunja (OSS) | Planka / Kan.bn (OSS) |
|---|---|---|---|---|---|---|---|---|
| Kanban, tabla, calendario | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ (kanban) |
| **Notificaciones (in-app, email, Slack)** | ❌ **se escriben en el log y no se envían** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recordatorios de vencimiento | ❌ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| Historial de actividad de la tarjeta | ❌ (los datos existen en `*_history`, pero no hay interfaz) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Búsqueda de tarjetas en todos los tableros | ❌ (solo nombres de tablero, o filtro dentro del tablero) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Timeline / Gantt | ❌ | ⚠️ (Premium) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Dependencias y bloqueos | ❌ | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ |
| Subtareas como tarjetas, relaciones y rollups | ❌ (solo checklists) | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Fórmulas | ❌ | ❌ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| Automatizaciones ("cuando X, haz Y") | ❌ | ✅ (Butler) | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Tareas recurrentes | ❌ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ❌ |
| Sprints / ciclos | ❌ | ❌ | ⚠️ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Docs / wiki junto al tablero | ❌ | ❌ | ⚠️ | ✅ | ✅ (Confluence) | ✅ | ❌ | ❌ |
| Dashboards y reportes | ❌ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ |
| Seguimiento de tiempo | ❌ | ⚠️ (power-up) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ❌ |
| Integraciones (Slack, Google Calendar, GitHub) | ⚠️ (solo webhook saliente) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ (CalDAV) | ⚠️ |
| API pública con tokens personales | ⚠️ (API existe, pero solo con sesión) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Apps móviles o PWA usable | ❌ ("early beta") | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| Funciones de IA (resúmenes, redacción, triage) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Archivar tarjetas / papelera | ⚠️ (undelete por API, sin interfaz) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SSO | ✅ (Google) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (OIDC) | ✅ (OIDC) |
| Self-hosted y datos propios | ✅ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ✅ |

### 7.3 Lo que falta, en orden de valor para un uso interno
1. **Notificaciones** (in-app más email; opcionalmente Slack o Google Chat) para menciones, asignaciones, comentarios en tarjetas seguidas y vencimientos.
   - El modelo de suscripciones y la extracción de menciones ya existen. Lo que hay hoy son paquetes muertos (`notifymentions`, `notifysubscriptions`) atados a la entrega por Mattermost. Se puede reutilizar su lógica con un backend nuevo.
   - **Es la carencia que más diferencia a Picoboard de cualquier competidor.** Esfuerzo L (2 a 3 semanas).
2. **Recordatorios de fecha** con el `scheduler` que ya existe. Esfuerzo M.
3. **Historial de actividad** en la tarjeta: los datos ya están en `blocks_history`. Esfuerzo M.
4. **Búsqueda global de tarjetas** (Postgres full-text o `pg_trgm`). Esfuerzo M.
5. **Papelera y archivado de tarjetas** con interfaz: el endpoint `undelete` ya existe. Esfuerzo S/M.
6. **Tokens personales de API** para scripts e integraciones internas. Esfuerzo M.
7. **Integración con Google Calendar** (aprovechando que ya usan Google Workspace): un feed iCal de las tarjetas con fecha por usuario. Esfuerzo M.
8. **Vista Timeline/Gantt** (nuevo `viewType`). Esfuerzo L.
9. **Propiedad de relación** entre tarjetas (subtareas, bloqueos). Esfuerzo L, porque toca el modelo, los filtros y la interfaz.
10. **Automatizaciones sencillas** (al moverse a "Hecho", asignar fecha o notificar). Esfuerzo L/XL.
11. **IA** (resumir una tarjeta o un hilo, redactar descripciones, convertir notas en tarjetas) con la API de Claude. Esfuerzo M para lo básico. Hay que considerar privacidad y coste.

---

## 8. Viabilidad y mantenibilidad

### 8.1 ¿Qué tan factible es llegar al nivel de la competencia?

| Objetivo | Factible | Estimación (1 dev a tiempo completo) | Comentario |
|---|---|---|---|
| **Paridad con Trello/Planka** (puntos 1 a 7 de 7.3, más móvil decente) | **Sí** | 2 a 3 meses, después del saneamiento | La arquitectura de bloques lo permite sin rediseñar |
| **Paridad con Vikunja/Plane** (más Gantt, relaciones, recurrencia, dashboards) | **Posible, pero caro** | 6 a 12 meses | El modelo de "bloques con JSON en `fields`" complica las relaciones, las consultas y los reportes; muchas cosas acaban resueltas en el cliente |
| **Paridad con Asana, ClickUp, Notion o Jira** | **No es realista** | — | Tienen equipos de cientos de ingenieros. No tiene sentido competir; tiene sentido cubrir lo que el equipo interno usa de verdad |

### 8.2 ¿Qué tan mantenible es?
- **Hoy: media-baja.**
  - El frontend está en React 17, con router v5, draft-js abandonado, dos librerías de arrastrar y moment.
  - Una cuarta parte del servidor es código de plugin que confunde y hay que compilar y mockear.
  - Hay 4 motores de base de datos.
  - Upstream no existe, así que cada CVE de una dependencia es trabajo propio.
  - El conocimiento está concentrado en una persona: el bus factor es 1.
- **Después del saneamiento: buena para 1 o 2 personas.**
  - Quedarían unas 36.000 líneas de Go y 31.000 de TS, en un solo motor de base de datos, sin Mattermost en el binario, con el frontend actualizado y CI con race detector y typecheck.
  - Es un tamaño que una persona puede dominar.
  - El coste recurrente estimado es de 2 a 4 días al mes en actualizaciones de dependencias y correcciones, más lo que se dedique a funcionalidades.
- **Riesgo estructural:** cuanto más se aleje Picoboard de Focalboard, menos sentido tiene mirar upstream. Esto ya pasó: hay que asumir que es un producto propio.

### 8.3 Alternativa que conviene poner sobre la mesa
Si los usuarios piden Gantt, sprints o automatizaciones, **migrar a Vikunja (AGPL, Go + Vue, con Gantt, recurrencia y OIDC) o a Plane Community (AGPL)** puede costar menos que construirlo.
- Se perdería el rediseño Pico.Love OS: habría que retematizar.
- Se perdería el control total del código.
- Picoboard sigue teniendo sentido si lo que se quiere es un **tablero tipo Notion/Trello simple, propio, con la marca de la empresa y sin dependencias externas**. Para ese caso, con el saneamiento y las 5 o 6 funcionalidades de 7.3 queda en muy buena posición.

---

## 9. Hoja de ruta propuesta

### Fase 0: inmediata (1 a 2 días)
- Corregir `.dockerignore` (6.4).
- S1 (inyección SQL), S2 (lock del websocket), S3 (driver SQLite), S4 (filtrar esquemas de enlaces y añadir DOMPurify), S5 (dejar de imprimir secretos).
- Validar `AuthMode` (S6) y quitar el modo `mattermost`.

### Fase 1: endurecer (1 a 2 semanas)
- Límites de body, archivos y zip; timeouts del servidor (S7).
- Rate limiting y comprobación del dueño en cambio de contraseña (S8).
- Tope absoluto de sesión y revocación (S9).
- Archivos ligados a su tablero (S10).
- Enlazar el `sub` de Google e índices únicos (S11), y la migración con el índice de `sessions.token`.
- Los `return` que faltan y los errores tragados (4.2).
- Arrancar Prometheus en una goroutine y escuchar solo en localhost (S13).
- Wrapper de errores y 401 en `octoClient`, bugs de deshacer, websocket que siempre reconecta (5.2).
- Arreglar `TestPatchBoard`; añadir `-race` y `typecheck` en CI.

### Fase 2: adelgazar (1 a 2 semanas)
- Borrar todo lo de 6.1.
- Refactor de 6.2 paquete por paquete: plugin, nube, compliance, telemetría, onboarding.
- Quitar MySQL/MariaDB y decidir sobre SQLite.
- Usar Postgres en Docker con `env_file` para Infisical.

### Fase 3: modernizar el frontend (2 a 4 semanas)
- Bundle: `module: esnext`, lazy loading y fuera los locales de moment (5.3).
- Selectores memoizados (5.3).
- Actualizar a React 18 y luego 19, Testing Library 16, react-redux 9, RTK 2, router 6/7, TypeScript 5 y ESLint 9 (en ese orden).
- Sustituir draft-js (Lexical o TipTap), react-beautiful-dnd (dnd-kit) y moment (date-fns).
- Fuentes servidas localmente, zoom habilitado y `es.json` completo.

### Fase 4: funcionalidades (2 a 3 meses)
Por orden de 7.3: notificaciones → recordatorios → actividad → búsqueda → papelera → tokens de API → iCal. Después, según lo que pidan los usuarios.

### Pendientes previos (de la memoria del proyecto)
- Valores de SSO en Infisical `staging` y `prod`.
- `govulncheck` sobre las dependencias nuevas.
- Revisión humana del código de autenticación.
- La decisión sobre licencia y repositorio privado.
- La prueba de S3 contra MinIO o S3 real.
- El test de Cypress MM-T4433 en `skip`.

---

## 10. Otros puntos importantes

- **Licencia AGPL v3 (sección 13).** Con el código modificado y usado por red, hay que ofrecer el código fuente a los usuarios, aunque sean solo empleados. Un repositorio privado con acceso de lectura para ellos lo resuelve. Pendiente de validar con el área legal (ya estaba anotado).
- **Copias de seguridad.** No hay nada en el repositorio para respaldar la base de datos ni `files/`. Antes de producción hace falta `pg_dump` programado, copia de los archivos o del bucket S3, y una **prueba de restauración**.
- **Observabilidad.** Hay métricas Prometheus (protegerlas, ver S13), pero no hay healthcheck en `docker-compose`, ni alertas, ni logs estructurados hacia algún sitio.
- **Privacidad.** Con la telemetría muerta y las fuentes de Google cargadas en cada visita, conviene apagar explícitamente `telemetry` y servir las fuentes desde la app.
- **CI.** Los workflows heredados construyen apps de escritorio y usan golangci-lint 1.59, que probablemente no soporta Go 1.26 (sin verificar). Hay que rehacer un CI mínimo: lint, typecheck, Jest, `go test -race` con Postgres y build de Docker.
- **Documentación.** El README todavía habla de Focalboard y de Mattermost. Conviene un README de Picoboard con despliegue, variables (`.env.example` ya existe), backups y procedimiento de actualización.

---

## Anexo: cómo reproducir las mediciones

```bash
# Go
cd server
FOCALBOARD_UNIT_TESTING=1 go test -tags 'json1 sqlite3' -cover ./...
go vet -tags 'json1 sqlite3' ./...
go list -m -retracted github.com/mattn/go-sqlite3

# Webapp
cd webapp
npx jest --silent
npm outdated
npm audit --omit=dev
npx tsc -p src --noEmit
```

Fuentes externas consultadas:
- [Plane: top 6 open source project management software in 2026](https://plane.so/blog/top-6-open-source-project-management-software-in-2026)
- [selfhosting.sh: Vikunja vs Planka](https://dev.to/selfhostingsh/vikunja-vs-planka-self-hosted-task-management-4g16)
- [It's FOSS: open source Trello alternatives](https://itsfoss.com/open-source-trello-alternatives/)
- [Mattermost: Boards plugin in maintenance mode](https://support.mattermost.com/hc/en-us/articles/19614000831252-Boards-Plugin-in-Maintenance-Mode)
- [mattermost-community/focalboard#5038](https://github.com/mattermost-community/focalboard/issues/5038)
