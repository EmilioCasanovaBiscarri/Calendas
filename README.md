# Calendas

**Ponle fecha a las palabras.** Un juego diario sobre la historia del léxico español. Cada día hay tres duelos entre dos palabras, los mismos para todos, y en cada uno el jugador toca la palabra que entró antes en el español. Tras responder se revelan los años de primera documentación, una línea de tiempo, una curiosidad y el porcentaje de jugadores que acertó.

> ⚠️ **Las fechas y curiosidades del banco de ejemplo son provisionales y pueden ser inexactas.**
> Todos los duelos de `public/data/duelos.json` llevan `"verificado": false`. Antes de publicar hay que comprobar cada año de primera documentación (y cada curiosidad) con fuentes como el **CORDE** (Corpus Diacrónico del Español), el **CDH** (Corpus del Diccionario histórico), el **Diccionario histórico de la lengua española** de la RAE o el *Diccionario crítico etimológico* de Corominas y Pascual, y cambiar el campo a `"verificado": true`. Ojo con los años redondos: casi siempre son estimaciones.

## Estructura

```
public/                        La web: todo lo que se publica
  index.html                   Única pantalla (incluye en línea el logo de la portada de arranque)
  icons/sello.svg              Favicon: el sello de lacre
  icons/*.png                  Iconos de iPhone y Android (generados)
  manifest.webmanifest         Nombre e iconos al instalar la app en el móvil
  reiniciar/index.html         /reiniciar: borra los datos locales y vuelve al juego
  css/estilos.css              Estilos (tokens de color, cartas, animaciones, modo oscuro)
  js/app.js                    Arranque y flujo de la partida
  js/fecha.js                  Fecha local, número de duelo, cuenta atrás (módulo puro)
  js/duelos.js                 Elección determinista de los duelos del día y validación del banco
  js/estadisticas.js           Rachas y aciertos en localStorage
  js/api.js                    Cliente del contador global (tolerante a fallos)
  js/revelacion.js             Revelación y línea de tiempo
  js/compartir.js              Texto para compartir, Web Share API o portapapeles
  data/duelos.json             Banco de duelos
assets/                        SVG de origen de los iconos
scripts/generar-iconos.mjs     Genera los PNG de public/icons a partir de assets/ (npm run iconos)
worker/index.js                Worker de Cloudflare: el contador /api/respuestas
migrations/                    Esquema de la base de datos D1 del contador
wrangler.jsonc                 Configuración de Cloudflare (Worker y D1)
.github/workflows/pages.yml    Publica public/ en GitHub Pages en cada push a main
```

No hay framework ni paso de compilación: el navegador carga los módulos ES directamente.

## Ejecutar en local

Requisitos: Node 22 o superior.

**Con contador (recomendado):**

```sh
npm install
npm run dev                  # http://localhost:8787
```

`npm run dev` prepara una base de datos D1 local y arranca el Worker con `wrangler dev --assets public`, que sirve la web y `/api/respuestas` a la vez. La web solo se sirve así en local: a Cloudflare solo se sube el contador. Las respuestas en local van a esa base de datos local, nunca a la real.

**Solo la web:**

```sh
npm run estatico             # o: python3 -m http.server -d public
```

Sin contador, el juego funciona igual y simplemente no muestra el porcentaje global. No vale abrir `index.html` con doble clic (`file://`): los módulos ES necesitan un servidor.

### Modo desarrollo

- `?fecha=2026-10-05` simula ese día. En este modo las estadísticas se guardan aparte (no tocan las reales), no se envía nada al backend y aparece una barra arriba que lo indica.
- **`/reiniciar`** borra todo lo que Calendas guarda en el navegador (partidas, estadísticas reales y del modo desarrollo) y vuelve al juego como si nunca se hubiera jugado. Ojo: en producción, volver a jugar el duelo de hoy envía otra respuesta al contador global.
- En la consola del navegador aparecen avisos si el banco tiene errores (ids repetidos, años empatados, dificultades sin duelos…) y cuántos duelos quedan sin verificar.

## Iconos

- **iPhone («Añadir a pantalla de inicio»):** usa `icons/apple-touch-icon.png` (180×180). iOS no admite iconos SVG.
- **Android e instalación:** `manifest.webmanifest` declara los iconos de 192 y 512 px y uno *maskable*.
- **WhatsApp:** como en Periplo, no hay etiquetas `og:`, así que la vista previa del enlace muestra el título de la página y el icono de la app como miniatura pequeña.

Los PNG se generan a partir de los SVG de `assets/` con `npm run iconos` (usa `sips`, de macOS). La «C» del sello está convertida a trazado, así que no dependen de ninguna fuente.

## Cómo funcionan los duelos del día

- La fecha es la del **jugador**: el día cambia a su medianoche, como en los demás juegos de Almanaque.
- **Desde el 3 de octubre de 2026 hay tres duelos al día** (`FECHA_TRES_DUELOS` en `public/js/duelos.js`), sacados de un **calendario**: cada duelo nuevo lleva una `fecha` y ese día salen sus tres duelos, en orden de `id`. Conviene ordenarlos de más fácil a más difícil.
- Arriba aparecen tres pestañas (*Duelo 1*, *Duelo 2*, *Duelo 3*) con el resultado de cada uno. Al responder, el botón lleva al siguiente duelo sin jugar; al terminar los tres aparecen *Compartir resultado* (`Calendas #3 ✅❌✅ 🔥4`), la cuenta atrás y el aviso de «Hecho» a Almanaque. Cada duelo se abre con `?partida=N`; sin ese parámetro se abre el primero sin jugar.
- **El calendario es un ciclo** que termina el 10 de diciembre de 2026 (`FIN_DEL_CICLO` en `public/js/duelos.js`). Desde el día siguiente vuelve a empezar por el día del lanzamiento: el 11 de diciembre salen los duelos del 1 de octubre (uno solo, como aquel día), el 12 los del 2, el 13 los del 3 de octubre, y así sucesivamente. El número del día sigue creciendo (#72, #73…), y las estadísticas y el contador se guardan con la fecha real, así que no se mezclan con las de la primera vuelta. Si añades días al calendario, mueve `FIN_DEL_CICLO` al último.
- **Si un día no tiene duelos en el calendario**, el juego no se queda vacío: rota de tres en tres por los duelos sin `fecha` y avisa en la consola.
- **Los dos primeros días (1 y 2 de octubre) tuvieron un único duelo**, elegido con el sistema antiguo, que se conserva para que esos días no cambien: el día de la semana fijaba la dificultad (lunes = 1 … domingo = 7) y dentro de ella se rotaba por semanas en orden de `id`. Solo usa los duelos sin `fecha`.
- El orden de las dos cartas depende de la fecha y del número de duelo, para que la correcta no salga siempre arriba.
- El **número del día** (#1, #2…) cuenta los días desde el lanzamiento, el 1 de octubre de 2026 (`FECHA_LANZAMIENTO` en `public/js/fecha.js`).

### Instrucciones

- El botón **?** de la cabecera, arriba a la derecha como en los demás juegos del Almanaque, abre «Cómo se juega» (`#reglas` en `public/index.html`).

### Sin archivo

- Solo se juegan los duelos de hoy: no hay lista de días pasados (se quitó el 11 de octubre de 2026). Un `?duelo=N` antiguo se ignora y abre los de hoy.
- La portada con el logo sale en cada carga de la página, incluidas las recargas. Solo se la salta al moverse entre los duelos del día.

## Añadir duelos

Edita `public/data/duelos.json` y añade **tres** objetos al array `duelos` por cada día nuevo:

```json
{
  "id": 45,
  "fecha": "2026-10-13",
  "palabraA": "sándwich",
  "anioA": 1890,
  "fuenteA": "CORDE: 1890, autor, obra",
  "palabraB": "bocadillo",
  "anioB": 1600,
  "fuenteB": "DHLE: 1600",
  "curiosidad": "Dos o tres líneas sobre la historia de las palabras.",
  "verificado": false
}
```

- `id`: entero único. Dentro de un día, fija el orden de los tres duelos.
- `fecha`: día en que sale (`AAAA-MM-DD`, desde el 3 de octubre de 2026).
- `anioA` / `anioB`: año de primera documentación. No pueden coincidir.
- Da igual qué palabra pongas como A o como B.
- `fuenteA` / `fuenteB` (opcionales): de dónde sale cada año, para poder revisarlo. El juego no los usa.
- La consola avisa si un día no tiene exactamente tres duelos o si una palabra ya ha salido en otro duelo.

Los duelos 1 a 14 no llevan `fecha` sino `dificultad` (de 1 a 7): son los del sistema antiguo y los que rellenan los días sin calendario. **No les quites ni añadas duelos sin `fecha`**: cambiaría qué salió el 1 y el 2 de octubre en el archivo.

**Importante:** no cambies los duelos de un día que ya ha empezado: quien ya jugó vería otras palabras. El Worker usa el mismo JSON, así que web y contador siempre coinciden en cuál es la respuesta correcta. Pero el Worker lleva el JSON y `duelos.js` empaquetados: **cada vez que cambies el calendario o esa lógica, vuelve a desplegarlo** (`npm run desplegar`), o el contador no sabrá qué duelos tocan los días nuevos.

## Porcentaje global (contador)

`worker/index.js` expone `/api/respuestas`:

- `POST { fecha, ronda, palabra }`: registra la respuesta al duelo `ronda` (1, 2 o 3) de ese día y devuelve `{ aciertos, total }`. El acierto se calcula en el servidor y solo se aceptan respuestas con fecha de entre dos días antes y un día después de la fecha UTC del servidor: cada jugador usa su fecha local (de UTC−12 a UTC+14), y quien responde justo después de medianoche aún envía la de ayer.
- `GET ?fecha=AAAA-MM-DD&ronda=N`: devuelve `{ aciertos, total }`.
- Si falta `ronda`, se entiende que es 1.

Los totales se guardan en D1 (la base de datos SQLite de Cloudflare), una fila por duelo. La columna `fecha` guarda `AAAA-MM-DD` para el primer duelo del día (como cuando había uno solo) y `AAAA-MM-DD/2` o `AAAA-MM-DD/3` para los otros, así que no hizo falta cambiar la tabla. Cada respuesta suma con una sola operación atómica, así que no se pierden respuestas aunque lleguen muchas a la vez. El cliente recuerda si ya envió su respuesta y la reintenta al volver a abrir si falló. Si el contador no responde en 3,5 s, el porcentaje se oculta.

Limitación del prototipo: no hay protección contra envíos falsos desde fuera de la app.

## Publicar

El juego se publica en dos sitios, los dos automáticamente en cada push a `main`:

- **La web, en GitHub Pages:** **https://emiliocasanovabiscarri.github.io/Calendas/**, como el resto de juegos. La publica `.github/workflows/pages.yml`, que sube `public/` tal cual.
- **El contador, en Cloudflare:** un Worker con la base de datos D1 en **https://calendas.calendas.workers.dev/api/respuestas**. GitHub Pages solo sirve archivos estáticos, así que no puede guardar las respuestas de todos. `js/api.js` llama al Worker cuando la web está en github.io, y el Worker solo acepta peticiones del navegador (CORS) desde `https://emiliocasanovabiscarri.github.io`. Cualquier otra ruta de calendas.calendas.workers.dev redirige a GitHub Pages, para que sigan funcionando los enlaces y las apps instaladas con la dirección antigua.

**GitHub Pages, primera vez:** el repo tiene que ser público (con cuenta gratuita, Pages no publica repos privados). En **Settings → Pages**, elige *Source: GitHub Actions*.

**Cloudflare, primera vez (desde la terminal):**

```sh
npx wrangler login                     # abre el navegador para entrar en Cloudflare
npx wrangler d1 create calendas        # solo si se monta en otra cuenta: copia el database_id en wrangler.jsonc
npm run desplegar                      # crea la tabla en D1 y publica el Worker
```

**Publicación automática del Worker en cada push:** en el panel de Cloudflare, abre **Workers & Pages → calendas → Settings → Build → Connect** y elige el repo `Calendas` de GitHub, rama `main`. Pon como *Deploy command* `npm run desplegar`, para que aplique también las migraciones nuevas de la base de datos.

**Cambios en la base de datos:** añade un archivo nuevo en `migrations/` (`0002_….sql`). `npm run desplegar` lo aplica antes de publicar.

## Derechos de autor

© 2026 Emilio Casanova Biscarri. Todos los derechos reservados. El código, los textos y los diseños de este repositorio no pueden copiarse ni reutilizarse sin permiso.
