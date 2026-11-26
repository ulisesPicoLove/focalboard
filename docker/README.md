# Picoboard con Docker

`docker-compose.yml` levanta PostgreSQL y la aplicación. Las contraseñas y claves de Google
no están en el repositorio: se inyectan desde Infisical.

```bash
cd docker
infisical run --env=dev -- docker compose up -d --build
```

La aplicación queda en <http://localhost:8000> (cambia el puerto del host con `PICOBOARD_PORT`).

## Variables

| Variable | Obligatoria | Para qué |
|---|---|---|
| `POSTGRES_PASSWORD` | sí | Contraseña del usuario `picoboard` de la base de datos (va dentro de una URL: usa solo letras y números, o codifícala) |
| `FOCALBOARD_GOOGLE_CLIENT_ID`, `FOCALBOARD_GOOGLE_CLIENT_SECRET`, `FOCALBOARD_GOOGLE_ALLOWED_DOMAIN` | sí con `authMode=google` | Inicio de sesión con Google ([guía](../docs/google-sso.md)) |
| `FOCALBOARD_SERVERROOT` | en producción | URL pública (con `https://`); fija el callback de Google |
| `FOCALBOARD_AUTHMODE` | no | `google` por defecto; `native` para usuario y contraseña |
| `PICOBOARD_PORT` | no | Puerto del host (8000 por defecto) |

El resto de variables `FOCALBOARD_*` está documentado en [`../.env.example`](../.env.example).

## Datos

- `pgdata`: base de datos PostgreSQL.
- `fbdata`: archivos subidos (`/opt/focalboard/data/files`).

Respáldalos antes de actualizar. Para una copia de la base: `docker exec picoboard-db pg_dump -U picoboard picoboard > picoboard.sql`.

## Construir sin Compose

```bash
docker build -f docker/Dockerfile -t picoboard .
```
