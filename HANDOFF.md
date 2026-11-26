# Traspaso de trabajo (Picoboard)

Estado al **26 de noviembre de 2026**. Para el detalle completo y la justificación de cada decisión, lee la sección 0 de [`Analisis_report.md`](Analisis_report.md). Este archivo es la versión corta para retomar rápido en otra computadora o en otra sesión.

## 1. Qué es esto

Picoboard es un fork de Focalboard para uso **interno** de la empresa: servidor Go (`server/`) que sirve una SPA React/TypeScript (`webapp/`), con inicio de sesión de Google Workspace y PostgreSQL en producción. Solo funciona como servidor web standalone. La arquitectura y los comandos están en [`CLAUDE.md`](CLAUDE.md).

## 2. Ramas (apiladas, hay que subirlas en este orden)

```
main
 └─ fix/phase0-security        Fase 0: correcciones de seguridad urgentes
     └─ fix/phase1-hardening   Fase 1: endurecimiento de servidor y webapp
         └─ chore/phase2-cleanup  Fase 2: código muerto, MySQL, Docker/Postgres, modo plugin, matriz de roles
```

El push se hace a mano (regla del `CLAUDE.md` global del usuario): `git push -u origin fix/phase0-security fix/phase1-hardening chore/phase2-cleanup`. Al abrir PR, hay que hacerlos en ese orden, cada uno contra la rama anterior.

Convención de commits: Conventional Commits en inglés, con el pie `Co-Authored-By` que indique la sesión.

## 3. Arrancar el entorno

Los secretos viven en **Infisical**; nunca se leen de un `.env` ni se imprimen.

```bash
infisical login && infisical init        # en una máquina nueva (.infisical.yaml está ignorado por git)
make prebuild                            # npm install del webapp
make webapp                              # compila webapp/pack
make server                              # compila bin/focalboard-server
infisical run --env=dev -- ./bin/focalboard-server    # http://localhost:8000
```

Con Docker (Postgres + app):

```bash
cd docker
infisical run --env=dev -- docker compose up -d --build
```

Variables obligatorias: `POSTGRES_PASSWORD` y `FOCALBOARD_GOOGLE_CLIENT_ID`, `FOCALBOARD_GOOGLE_CLIENT_SECRET`, `FOCALBOARD_GOOGLE_ALLOWED_DOMAIN`. Todas están documentadas en [`.env.example`](.env.example) y el flujo de Google en [`docs/google-sso.md`](docs/google-sso.md). Hoy **solo el entorno `dev` de Infisical tiene valores**; `staging` y `prod` están vacíos. Para el callback local, `FOCALBOARD_SERVERROOT=http://localhost:8000` ya está registrado en Google Cloud.

## 4. Verificar que todo sigue bien

```bash
# Servidor (desde server/)
FOCALBOARD_UNIT_TESTING=1 go test -race -tags 'json1 sqlite3' ./...
go vet -tags 'json1 sqlite3' ./...
make server-test-postgres                # suite completa contra Postgres en Docker (desde la raíz)

# Webapp (desde webapp/)
npm run check && npm run typecheck && npx jest --coverage=false
```

Resultado esperado al cierre de este traspaso: Go verde con `-race`, 18 de 18 paquetes verdes en Postgres, 838 tests de Jest, ESLint, stylelint y `typecheck` limpios.

## 5. Lo que ya está hecho (resumen)

- **Seguridad (S1 a S13):** inyección SQL, carrera en websockets, driver SQLite retractado, enlaces `javascript:`, secretos en el log, `authMode` validado, límites de tamaño y de tiempo, rate limit, sesiones con tope de 14 días, archivos ligados a su tablero, vinculación de Google por `sub`, métricas en `localhost`.
- **Servidor:** modo plugin de Mattermost eliminado, MySQL y MariaDB eliminados (solo Postgres y SQLite), telemetría, compliance, statistics y retención de datos eliminados, matriz de permisos reescrita sobre `localpermissions` (1.284 casos).
- **Webapp:** `apiFetch` con timeout y 401, el `mutator` ya no registra deshacer de escrituras rechazadas, websocket que reconecta siempre, telemetría y banner "novedades" de Mattermost eliminados, 41 archivos muertos fuera.
- **Repo y Docker:** apps de escritorio, sitio de marketing y archivos de CI de Mattermost eliminados; Docker ahora con Postgres y secretos desde el shell.

## 6. Pendiente, en orden sugerido

1. **Subir las ramas y abrir los PR** (lo haces tú).
2. **Infisical `staging` y `prod`:** copiar las variables. Producción necesita `FOCALBOARD_SERVERROOT` con `https://` y el callback `<SERVERROOT>/oauth/google/callback` registrado en Google Cloud.
3. **`govulncheck ./...`** en `server/` (el arnés bloqueó descargarlo; tienes que correrlo tú) y una **revisión humana del código de autenticación** (`server/services/auth/googlesso`, `server/app/sso.go`, `server/api/sso.go`).
4. **Decisión sobre DOMPurify y una Content-Security-Policy** en el webapp (S4 quedó a medias; añade una dependencia).
5. **Fase 2, lo que queda:** restos de canales y `ServicesAPI` en `app` y `store` (`SearchUserChannels`, `GetChannel`, `PostMessage`, `SendMessage`, vinculación de canales en `PatchBoard`, `model/services_api.go`), límites de tarjetas de la nube (servidor y webapp), tour de onboarding con textos de Mattermost, rama de plugin de `wsclient`.
6. **Fase 3, frontend:** bundle de 5,1 MB sin división de código, re-renders de `CardBadges`, `eslint-plugin-react-hooks`, React 17 a 19, reemplazar `draft-js` (7 vulnerabilidades altas), `moment` y `react-beautiful-dnd`, accesibilidad, completar `es.json` (48 %), mover las sobrescrituras de `pico.scss` a cada componente, fuentes locales en vez de Google Fonts, reactivar el zoom (S14).
7. **Fase 4, funcionalidades:** notificaciones (hoy no se envía ninguna), recordatorios de fecha, historial de actividad, búsqueda global, poda de las tablas `*_history`. La lógica de menciones y suscripciones que se borró está en el historial de git, en el commit anterior a `chore(server): remove unlinked notify...`.

## 7. Decisiones abiertas

- **Licencia (AGPL v3, sección 13) y repositorio privado:** con código modificado y uso por red hay que ofrecer el código fuente a los usuarios, aunque sean empleados. Pendiente de revisión legal; no se añadió el enlace "Source code" ni se cambió la visibilidad del repo. Ver la nota completa en la memoria del proyecto o en la sección 10 del reporte.
- **Datos de SQLite a Postgres:** los datos viejos del contenedor (SQLite) no se migran solos.
- **Cypress:** no se ha corrido la suite desde el rediseño; `MM-T4433` (arrastrar al borde del kanban) está en `it.skip` desde la actualización a Cypress 16.
- **Índices únicos en `users`:** no existen; el alta SSO está serializada con un mutex, que solo protege una instancia.

## 8. Advertencias

- **Fallo intermitente sin explicar** en la suite de integración sobre SQLite (`TestGetBlocks` en una corrida y `TestPatchBoardsAndBlocks` en otra; 15 corridas posteriores pasaron). Sospecha, sin comprobar: colisión de `insert_at` en SQLite.
- **No probado en navegador:** la redirección por 401, la reconexión del websocket, el bloqueo de enlaces `javascript:` y la ausencia del banner. Solo hay tests automáticos.
- **Archivos que no viajan con git:** `AUDITORIA-DEPENDENCIAS.md` (excluido en `.git/info/exclude`) y `.infisical.yaml`. Cópialos a mano si los necesitas.
- **Al desplegar:** recrear el contenedor y reiniciar cualquier instancia local; `make server` antes si el binario es anterior.
