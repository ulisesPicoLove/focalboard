# Comparación de estilos antes y después (refactors de CSS)

Herramienta para comprobar que un cambio de CSS/SCSS **no altera cómo se ve la app**,
sin mirar capturas a ojo: renderiza pantallas reales en un Brave sin interfaz, vuelca el
estilo computado de todos los elementos (con sus `::before` y `::after`) y compara dos corridas.

Se usó para mover las sobrescrituras de `webapp/src/styles/pico.scss` a cada componente:
encontró dos regresiones reales (reglas del componente que antes perdían por orden de
carga y al mover el archivo pasaron a ganar) y confirmó 0 diferencias en 19.230 elementos
con el tema Pico, el tema claro y los anchos 1400, 1000, 700 y 400 px.

## Cómo usarlo

1. Compilar la versión a comparar: `cd webapp && npm run pack` y `make server`.
2. Ajustar las rutas de `reset.sh` y de `capture.js` (están escritas para una carpeta
   temporal concreta y para `/Applications/Brave Browser.app`) y crear `config.json`
   de prueba (puerto 8123, SQLite temporal, `webpath` al `webapp/pack`).
3. `./reset.sh` arranca el servidor con una base de datos limpia y crea 5 tableros de
   ejemplo desde plantillas (más una vista de galería). Cada captura debe partir de un
   estado igual: una interacción que cree datos (por ejemplo el «+» del calendario)
   rompe la comparación.
4. `node capture.js salida.json [light]` (`WIDTH=700 node capture.js ...` para otro ancho).
5. Repetir con la otra versión y `python3 diff.py antes.json despues.json "" 25`.
   Primero comparar dos corridas de la misma versión: debe dar 0 diferencias.

Cobertura: login y registro, las vistas de tablero, tabla, galería y calendario de cinco
tableros, el diálogo de tarjeta, y 14 estados con interacción (filtro, menú de vista,
compartir, agregar tablero, buscar tableros, menú de usuario, menú de tarjeta, menú de
columna, menú de cabecera de tabla, cálculos, evento del calendario, menú de propiedad).
No cubre estados de ratón (`:hover`, `:active`) ni animaciones.
