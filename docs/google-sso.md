# Inicio de sesión con Google (Google Workspace)

Picoboard puede autenticar a los usuarios con su cuenta de Google Workspace, sin contraseñas propias. Solo
pueden entrar las cuentas del dominio configurado. Es un modo de autenticación nuevo, `google`, que reemplaza
al `native` (usuario y contraseña).

## Cómo funciona

1. El usuario pulsa **Sign in with Google**. El navegador va a `/oauth/google/login`, y el servidor lo
   redirige a Google (OpenID Connect, flujo de código con PKCE, con `state` y `nonce`).
2. Google devuelve al usuario a `/oauth/google/callback`. El servidor valida el token de Google y exige que el
   correo esté verificado y que pertenezca al dominio permitido (comprueba tanto la reclamación `hd` como el
   sufijo del correo).
3. Se busca al usuario por correo, y se crea en su primer acceso. El nombre de usuario sale de la parte local
   del correo (`ana.perez@empresa.com` → `ana.perez`; si ya existe, se añade un sufijo).
4. Se crea una sesión normal de la aplicación y el navegador abre la página que se pedía.

En este modo el servidor rechaza con 501 el inicio de sesión, el registro y el cambio de contraseña, y la
interfaz oculta el formulario de contraseña, la página de registro, "Change password" e "Invite users".

## Qué hay que preparar en Google Cloud

1. En [Google Cloud Console](https://console.cloud.google.com/) abre (o crea) un proyecto de tu organización.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo de usuario **Interno** (solo cuentas de tu
   Workspace).
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**, tipo **Aplicación web**.
4. En **URI de redireccionamiento autorizados** añade exactamente:

   ```
   https://<tu-host>/oauth/google/callback
   ```

   Si Picoboard está bajo un prefijo (por ejemplo `https://empresa.com/boards`), la URI es
   `https://empresa.com/boards/oauth/google/callback`. No hacen falta "orígenes de JavaScript autorizados".
5. Guarda el **ID de cliente** y el **secreto**.

## Configuración

| Variable de entorno                | Clave en `config.json`  | Valor                                                                  |
| ---------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `FOCALBOARD_AUTHMODE`              | `authMode`              | `google`                                                               |
| `FOCALBOARD_SERVERROOT`            | `serverRoot`            | URL pública, con `https://` (por ejemplo `https://boards.empresa.com`) |
| `FOCALBOARD_GOOGLE_CLIENT_ID`      | `google_client_id`      | ID de cliente                                                          |
| `FOCALBOARD_GOOGLE_CLIENT_SECRET`  | `google_client_secret`  | Secreto del cliente                                                    |
| `FOCALBOARD_GOOGLE_ALLOWED_DOMAIN` | `google_allowed_domain` | Dominio de Workspace permitido (por ejemplo `empresa.com`)             |

Todas las variables del proyecto, con su valor por defecto, están en `.env.example` en la raíz del repositorio.
Guarda el secreto en Infisical, no en `config.json`, y arranca el servidor con las variables del entorno:

```sh
infisical run --env=prod -- ./bin/focalboard-server
```

Si falta alguna de las tres claves de Google, el servidor **no arranca** y dice cuáles faltan. El secreto no se
escribe en el log de arranque (aparece como `[redacted]`).

`serverRoot` debe ser la URL por la que los usuarios entran de verdad: de ahí salen la URI de retorno que se
envía a Google y el atributo `Secure` de la cookie (se activa si empieza por `https://`).

## Qué esperar

- **Usuarios existentes:** si ya existe un usuario con el mismo correo (por ejemplo, creado con contraseña),
  Google inicia sesión en esa misma cuenta y conserva sus tableros.
- **Cuentas ligadas a Google:** un usuario creado con Google queda ligado al identificador (`sub`) de esa cuenta.
  Si el mismo correo lo usa luego otra cuenta de Google distinta (por ejemplo, una dirección reasignada), el
  acceso se rechaza.
- **Sesiones antiguas:** al pasar a `google`, las sesiones creadas en modo `native` dejan de ser válidas y esas
  personas tienen que entrar con Google. Es intencional.
- **Un solo proceso:** la firma de la cookie temporal de inicio de sesión vive en memoria. Reiniciar el servidor
  solo cancela los inicios de sesión que estaban en curso (el usuario vuelve a pulsar el botón). Con varias
  instancias detrás de un balanceador, el callback debe llegar a la misma instancia que inició el flujo.
- **Sin nombre ni foto:** solo se guardan el correo y el nombre de usuario derivado; no se importan nombres
  completos ni avatares.
- **Cerrar sesión** cierra la sesión de Picoboard, no la de Google. Al volver a entrar, Google muestra el
  selector de cuenta.
- **Administración local:** el modo local por socket Unix (`enableLocalMode`) no se ve afectado.

## Mensajes de error en la pantalla de acceso

| Código (`?error=`) | Significado                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| `sso_domain`       | La cuenta no es del dominio permitido, o es una cuenta personal con un correo parecido |
| `sso_unverified`   | Google no ha verificado el correo                                                      |
| `sso_denied`       | El usuario canceló el inicio de sesión                                                 |
| `sso_expired`      | El inicio de sesión tardó más de 10 minutos o no empezó en este navegador              |
| `sso_unavailable`  | No se pudo contactar con Google                                                        |
| `sso_failed`       | Cualquier otro fallo; el detalle queda en el log del servidor                          |

## Pruebas

```sh
cd server
FOCALBOARD_UNIT_TESTING=1 go test -tags 'json1 sqlite3' -race ./services/auth/googlesso/... ./api/ ./app/ ./services/config/
```

Las pruebas usan un proveedor OpenID Connect falso (`services/auth/googlesso/fakeidp`), así que no necesitan
credenciales ni red. La comprobación final con Google real requiere el ID de cliente y el secreto reales.
