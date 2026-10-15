# Calendas

**Ponle fecha a las palabras.** Un juego diario sobre la historia del léxico español. Cada día hay tres duelos entre dos palabras, los mismos para todos, y en cada uno el jugador toca la palabra que entró antes en el español. Tras responder se revelan los años de primera documentación, una línea de tiempo y una curiosidad.

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
  js/revelacion.js             Revelación y línea de tiempo
  js/compartir.js              Texto para compartir, Web Share API o portapapeles
  data/duelos.json             Banco de duelos
assets/                        SVG de origen de los iconos
scripts/generar-iconos.mjs     Genera los PNG de public/icons a partir de assets/ (npm run iconos)
.github/workflows/pages.yml    Publica public/ en GitHub Pages en cada push a main
```

No hay framework ni paso de compilación: el navegador carga los módulos ES directamente.

## Ejecutar en local

```sh
npm run dev                  # o: python3 -m http.server -d public
```

`npm run dev` necesita Node. No vale abrir `index.html` con doble clic (`file://`): los módulos ES necesitan un servidor.

### Modo desarrollo

- `?fecha=2026-10-05` simula ese día. En este modo las estadísticas se guardan aparte (no tocan las reales) y aparece una barra arriba que lo indica.
- **`/reiniciar`** borra todo lo que Calendas guarda en el navegador (partidas, estadísticas reales y del modo desarrollo) y vuelve al juego como si nunca se hubiera jugado.
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
- **El calendario es un ciclo** que termina el 31 de diciembre de 2026 (`FIN_DEL_CICLO` en `public/js/duelos.js`). Desde el día siguiente vuelve a empezar por el día del lanzamiento: el 1 de enero de 2027 salen los duelos del 1 de octubre (uno solo, como aquel día), el 2 los del 2, el 3 los del 3 de octubre, y así sucesivamente. El número del día sigue creciendo (#93, #94…), y las estadísticas se guardan con la fecha real, así que no se mezclan con las de la primera vuelta. Si añades días al calendario, mueve `FIN_DEL_CICLO` al último.
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

**Importante:** no cambies los duelos de un día que ya ha empezado: quien ya jugó vería otras palabras.

## Publicar

La web se publica en GitHub Pages en cada push a `main`: **https://emiliocasanovabiscarri.github.io/Calendas/**, como el resto de juegos. La publica `.github/workflows/pages.yml`, que sube `public/` tal cual.

**Primera vez:** el repo tiene que ser público (con cuenta gratuita, Pages no publica repos privados). En **Settings → Pages**, elige *Source: GitHub Actions*.

## Derechos de autor

© 2026 Emilio Casanova Biscarri. Todos los derechos reservados. El código, los textos y los diseños de este repositorio no pueden copiarse ni reutilizarse sin permiso.
