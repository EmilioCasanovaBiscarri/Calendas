// Worker de Cloudflare: el contador global de Calendas.
//
// La web se publica en GitHub Pages (https://emiliocasanovabiscarri.github.io/Calendas/) y llama
// aquí desde otro dominio, así que las respuestas llevan cabeceras CORS para ese origen.
// Quien entre por la dirección antigua (calendas.calendas.workers.dev) se redirige a
// GitHub Pages. La web no se sube a Cloudflare: en local, npm run dev la sirve con
// `wrangler dev --assets public` junto al contador.
//
//   GET  /api/respuestas?fecha=AAAA-MM-DD&ronda=N     → { aciertos, total }
//   POST /api/respuestas { fecha, ronda, palabra }    → { aciertos, total } (ya incluyendo esta respuesta)
//
// `ronda` es el número de duelo dentro del día (1-3; si falta, 1). Los totales viven
// en D1, una fila por duelo: la columna `fecha` guarda la misma clave que el cliente,
// 'AAAA-MM-DD' para el primer duelo del día (como cuando había uno solo) y
// 'AAAA-MM-DD/N' para los siguientes. Cada respuesta suma con un único UPSERT
// atómico, así que no se pierden respuestas aunque lleguen a la vez.
// El acierto se calcula aquí con el mismo banco y la misma lógica que el cliente.

import banco from '../public/data/duelos.json';
import { clavePartida, duelosDelDia } from '../public/js/duelos.js';
import { esFechaValida, fechaUTC, sumarDias } from '../public/js/fecha.js';

const WEB = 'https://emiliocasanovabiscarri.github.io/Calendas';
const ORIGEN_WEB = 'https://emiliocasanovabiscarri.github.io';
const HOST_ANTIGUO = 'calendas.calendas.workers.dev';

const CORS = {
  'Access-Control-Allow-Origin': ORIGEN_WEB,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
  });

async function totales(db, clave) {
  const fila = await db.prepare('SELECT aciertos, total FROM conteo WHERE fecha = ?1').bind(clave).first();
  return { aciertos: fila?.aciertos ?? 0, total: fila?.total ?? 0 };
}

/** El duelo `ronda` de ese día, o null si el día no tiene tantos duelos. */
function dueloDe(fecha, ronda = 1) {
  if (!Number.isInteger(ronda)) return null;
  return duelosDelDia(banco.duelos, fecha)[ronda - 1] ?? null;
}

async function respuestas(peticion, db) {
  // Petición previa del navegador antes del POST con JSON desde GitHub Pages.
  if (peticion.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (peticion.method === 'GET') {
    const parametros = new URL(peticion.url).searchParams;
    const fecha = parametros.get('fecha');
    const ronda = Number(parametros.get('ronda') ?? 1);
    if (!esFechaValida(fecha)) return json({ error: 'fecha no válida' }, 400);
    if (!dueloDe(fecha, ronda)) return json({ error: 'ronda no válida' }, 400);
    return json(await totales(db, clavePartida(fecha, ronda)));
  }

  if (peticion.method === 'POST') {
    let cuerpo;
    try {
      cuerpo = await peticion.json();
    } catch {
      return json({ error: 'JSON no válido' }, 400);
    }
    const { fecha, ronda = 1, palabra } = cuerpo ?? {};

    // El día es el del jugador, y en el mundo conviven fechas de ayer, hoy y mañana
    // en UTC (de UTC−12 a UTC+14). Se acepta además un día antes: quien abrió el
    // duelo a las 23:59 puede responder a las 00:01.
    const hoy = fechaUTC();
    const plazo = [-2, -1, 0, 1].map((dias) => sumarDias(hoy, dias));
    if (!esFechaValida(fecha) || !plazo.includes(fecha)) {
      return json({ error: 'fecha fuera de plazo' }, 400);
    }

    const duelo = dueloDe(fecha, ronda);
    if (!duelo) return json({ error: 'ronda no válida' }, 400);
    const { cartas, correcta } = duelo;
    if (!cartas.some((carta) => carta.palabra === palabra)) {
      return json({ error: 'palabra no válida' }, 400);
    }

    const fila = await db
      .prepare(
        `INSERT INTO conteo (fecha, aciertos, total) VALUES (?1, ?2, 1)
         ON CONFLICT (fecha) DO UPDATE SET aciertos = aciertos + excluded.aciertos, total = total + 1
         RETURNING aciertos, total`,
      )
      .bind(clavePartida(fecha, ronda), palabra === correcta ? 1 : 0)
      .first();
    return json({ aciertos: fila.aciertos, total: fila.total });
  }

  return json({ error: 'método no permitido' }, 405);
}

export default {
  async fetch(peticion, env) {
    const url = new URL(peticion.url);
    if (url.pathname === '/api/respuestas') return respuestas(peticion, env.DB);
    if (url.hostname === HOST_ANTIGUO) return Response.redirect(WEB + url.pathname + url.search, 301);
    return new Response('No encontrado', { status: 404 });
  },
};
