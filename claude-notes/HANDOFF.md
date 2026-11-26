# Traspaso de trabajo (Picoboard)

Estado al **26 de noviembre de 2026**. Para el detalle completo y la justificación de cada decisión, lee la sección 0 de [`Analisis_report.md`](Analisis_report.md) (en esta misma carpeta) y, para la auditoría de dependencias de noviembre, [`AUDITORIA-DEPENDENCIAS.md`](AUDITORIA-DEPENDENCIAS.md). Este archivo es la versión corta para retomar rápido en otra computadora o en otra sesión.

## 1. Qué es esto

Picoboard es un fork de Focalboard para uso **interno** de la empresa: servidor Go (`server/`) que sirve una SPA React/TypeScript (`webapp/`), con inicio de sesión de Google Workspace y PostgreSQL en producción. Solo funciona como servidor web standalone. La arquitectura y los comandos están en [`CLAUDE.md`](../CLAUDE.md).

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

Variables obligatorias: `POSTGRES_PASSWORD` y `FOCALBOARD_GOOGLE_CLIENT_ID`, `FOCALBOARD_GOOGLE_CLIENT_SECRET`, `FOCALBOARD_GOOGLE_ALLOWED_DOMAIN`. Todas están documentadas en [`.env.example`](../.env.example) y el flujo de Google en [`docs/google-sso.md`](../docs/google-sso.md). Hoy **solo el entorno `dev` de Infisical tiene valores**; `staging` y `prod` están vacíos. Para el callback local, `FOCALBOARD_SERVERROOT=http://localhost:8000` ya está registrado en Google Cloud.

## 4. Verificar que todo sigue bien

```bash
# Servidor (desde server/)
FOCALBOARD_UNIT_TESTING=1 go test -race -tags 'json1 sqlite3' ./...
go vet -tags 'json1 sqlite3' ./...
make server-test-postgres                # suite completa contra Postgres en Docker (desde la raíz)

# Webapp (desde webapp/)
npm run check && npm run typecheck && npx jest --coverage=false
```

Resultado esperado al cierre de este traspaso: Go verde con `-race`, 18 de 18 paquetes verdes en Postgres, 832 tests de Jest, ESLint, stylelint y `typecheck` limpios.

## 5. Lo que ya está hecho (resumen)

- **Seguridad (S1 a S13):** inyección SQL, carrera en websockets, driver SQLite retractado, enlaces `javascript:`, secretos en el log, `authMode` validado, límites de tamaño y de tiempo, rate limit, sesiones con tope de 14 días, archivos ligados a su tablero, vinculación de Google por `sub`, métricas en `localhost`.
- **Servidor:** vinculación de canales, `ServicesAPI` y límites de tarjetas de la nube eliminados (servidor y webapp), modo plugin de Mattermost eliminado, MySQL y MariaDB eliminados (solo Postgres y SQLite), telemetría, compliance, statistics y retención de datos eliminados, matriz de permisos reescrita sobre `localpermissions` (1.284 casos).
- **Webapp:** `apiFetch` con timeout y 401, el `mutator` ya no registra deshacer de escrituras rechazadas, websocket que reconecta siempre, telemetría y banner "novedades" de Mattermost eliminados, 41 archivos muertos fuera.
- **Repo y Docker:** apps de escritorio, sitio de marketing y archivos de CI de Mattermost eliminados; Docker ahora con Postgres y secretos desde el shell.

## 6. Pendiente, en orden sugerido

1. **Subir las ramas y abrir los PR** (lo haces tú).
2. **Infisical `staging` y `prod`:** copiar las variables. Producción necesita `FOCALBOARD_SERVERROOT` con `https://` y el callback `<SERVERROOT>/oauth/google/callback` registrado en Google Cloud.
3. **`govulncheck ./...`** en `server/` (el arnés bloqueó descargarlo; tienes que correrlo tú) y una **revisión humana del código de autenticación** (`server/services/auth/googlesso`, `server/app/sso.go`, `server/api/sso.go`).
4. **Decisión sobre DOMPurify y una Content-Security-Policy** en el webapp (S4 quedó a medias; añade una dependencia).
5. **Fase 2: terminada** (26 de noviembre de 2026). Quedó fuera, por decisión, el tour de onboarding: solo se reescribieron sus dos textos de Mattermost. El resto del tour (pasos, endpoint `/onboard` y tablero "Welcome to Boards!") sigue ahí; decidir si se conserva o se elimina entero.
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
- **Archivo que no viaja con git:** `.infisical.yaml` (ignorado). En una máquina nueva, `infisical login` e `infisical init`. Las notas de este directorio (`claude-notes/`) sí están en git.
- **Al desplegar:** recrear el contenedor y reiniciar cualquier instancia local; `make server` antes si el binario es anterior.

## 9. Preferencias del usuario y trampas conocidas

Esta sección existe para que no haga falta copiar la memoria local de Claude a otra computadora. Un agente que retome el trabajo debe leerla y respetarla.

### Reglas globales del usuario (están en su `~/.claude/CLAUDE.md`, que no viaja con git)

- **Nunca hacer `git push`** (ni `--force`, ni a ninguna rama o remoto), aunque pida "guardarlo en GitHub". El usuario hace los push a mano; hay que hacer el commit y avisar que quedó listo para subir.
- **Secretos con Infisical** salvo que se diga lo contrario: `infisical run --env=<entorno> -- <comando>` (por ejemplo `--env=prod`), en lugar de pedir valores o leerlos de un `.env`. No imprimir ni copiar los valores de los secretos.
- Si la otra computadora no tiene ese archivo, hay que recrearlo con esas dos reglas.

### Cómo trabajar con el usuario

- **Responder en español.** Los commits van en inglés (Conventional Commits), los documentos del proyecto en español.
- **ARM no es una preocupación**: no hay que cuidar compatibilidad con ARM.
- Confirmar antes de cualquier acción de cara al exterior: push, cambiar la visibilidad del repositorio o tocar Infisical `staging` y `prod`.
- Al comprobar Infisical, verificar presencia o forma de los valores con booleanos; nunca mostrar el valor.

### Trampas técnicas

- **`pkill -f "<patrón>"` puede matar el propio shell** si el patrón aparece en la línea de comandos. Usar un PID o `pkill -x`. El proceso del servidor se llama `focalboard-serv` (15 caracteres, el nombre se trunca).
- **El modo automático bloquea `go run` de herramientas remotas** (por ejemplo `mockery`). Por eso los mocks de `filestore` están escritos a mano, y los de `mockstore` se editan a mano al cambiar la interfaz `Store` (`public_methods.go` y `mockstore.go`).
- **Un servidor sin `authMode` (binario viejo) debe seguir mostrando el formulario de contraseña**: el webapp trata un `authMode` ausente como `native`.
- **`authMode` solo acepta `native` o `google`**, y `dbtype` solo `postgres` o `sqlite3`; cualquier otro valor aborta el arranque.
- **Un binario anterior no incluye los cambios nuevos**: tras traer las ramas hay que ejecutar `make server` y reiniciar, y recrear el contenedor (`docker compose up -d --build`).
- **Descargar y ejecutar `govulncheck`** lo bloquea el arnés; el usuario debe correrlo él mismo.
- Las notas de memoria dicen que el `.infisical.yaml` está ignorado por git; en una máquina nueva hay que hacer `infisical login` e `infisical init`.

### Decisiones ya tomadas (no rehacer)

- **Tema:** "Pico.Love OS" es el tema por defecto; el antiguo se llama "Focal Theme". El diálogo "Confirm card delete" conserva su botón Delete en menta (el usuario lo aceptó). Los colores de las opciones usan tres extensiones suaves (naranja `#f5b995`, amarillo `#f7e08a`, violeta `#b4a7f5`) para distinguir las diez opciones.
- **Cypress:** el usuario eligió dejar `MM-T4433` en `it.skip` y revisarlo después. Ofrecer reactivarlo cuando se hable de e2e: averiguar por qué react-dnd ignora el `dragstart` sintético, o cubrir el scroll con un test de Jest sobre `Kanban`.
- **Pendientes menores de la fase de rediseño** (sin urgencia): comprobar el contraste de las etiquetas mono de 10 px al 56 % de opacidad en los temas claros, y revisar el diálogo de importar archivo, el calendario con eventos con fecha, arrastrar y soltar, y la edición en línea tras el nuevo estilo.

### Licencia (AGPL v3, sección 13) y repositorio privado: decisión abierta

- Picoboard se usa solo dentro de la empresa y el usuario quiere hacer privado el repositorio en GitHub. **Esto no es asesoría legal; debe confirmarlo el área legal.**
- `LICENSE.txt` es dual: MIT para binarios compilados por Mattermost, **AGPL v3** para el código fuente con el que se construyen versiones propias, o una licencia comercial de Mattermost (`commercial@mattermost.com`). Apache 2.0 aplica solo a `webapp/html-templates/`, `config.json`, `webapp/i18n/`, `server/model/` y `plugin/`.
- Como el código está modificado, la AGPL aplica completa. Un repositorio privado está permitido.
- **Sección 13:** si los empleados usan la versión modificada por red, hay que ofrecerles su código fuente. Es discutible que una audiencia solo interna lo active; se asume que sí. Un repositorio privado con lectura para esos empleados, o un enlace o zip de "Source code", lo cumple.
- Se deben conservar los avisos de copyright de Mattermost (`LICENSE.txt`, `NOTICE.txt`). Renombrar a Picoboard es válido; la marca de Mattermost cubre el nombre "Mattermost", no "Focalboard".
- `origin` es `github.love:ulisesPicoLove/focalboard`. Si es un fork de un repositorio público, GitHub no permite hacerlo privado: habría que crear un repositorio nuevo y hacer el push a mano.
- **No añadir el enlace "Source code" al menú ni cambiar la visibilidad hasta que el usuario lo pida.** Cuando lo haga, recordarle este punto abierto.

### Cuando el usuario regrese

Ofrecer los pasos de la sección 6 en ese orden y preguntar cuál tomar, en vez de volver a investigar. Confirmar antes de lo que salga del repositorio (push, visibilidad, Infisical `staging`/`prod`).
