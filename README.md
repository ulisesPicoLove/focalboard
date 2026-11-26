# Picoboard

Picoboard es el tablero de proyectos interno de la empresa: un servidor Go (`server/`) que sirve una SPA React/TypeScript (`webapp/`). Es un fork de [Focalboard](https://github.com/mattermost-community/focalboard) (la alternativa de código abierto a Trello, Notion y Asana), que Mattermost ya no mantiene.

Este fork solo contempla el servidor web standalone. Se eliminaron las apps de escritorio, el plugin de Mattermost y la web de marketing.

## Qué incluye

- Vistas de tablero (kanban), tabla, galería y calendario, con filtros, orden, agrupación y cálculos.
- Propiedades de tarjeta, plantillas, comentarios, adjuntos y checklists.
- Tiempo real por websocket, deshacer/rehacer, importar y exportar tableros.
- Inicio de sesión con Google Workspace (ver [docs/google-sso.md](docs/google-sso.md)).
- Base de datos PostgreSQL (producción) o SQLite (desarrollo y pruebas).

## Ejecutar con Docker

Los secretos viven en Infisical; no se guardan en el repositorio. Las variables disponibles están en [`.env.example`](.env.example).

```
cd docker
infisical run --env=dev -- docker compose up -d --build
```

Se publica en <http://localhost:8000>.

## Desarrollo

Requisitos: Go (versión de `server/go.mod`) y Node (versión de `webapp/.nvmrc`).

```
make prebuild     # npm install en webapp/
make webapp       # compila la SPA en webapp/pack/
make server       # compila bin/focalboard-server
infisical run --env=dev -- ./bin/focalboard-server
```

Pruebas y calidad:

```
make server-test-sqlite   # Go con -race sobre SQLite
make server-test-postgres # Go sobre Postgres en Docker
make server-lint
cd webapp && npm run check && npm run typecheck && npm test
```

La guía de arquitectura para trabajar en el código está en [CLAUDE.md](CLAUDE.md).

## Licencia

El código se usa bajo la GNU AGPL v3 (ver [LICENSE.txt](LICENSE.txt) y [NOTICE.txt](NOTICE.txt)). Se conservan los avisos de copyright de Mattermost, Inc.
