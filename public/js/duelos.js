// Banco de duelos y elección determinista de los duelos del día.
// Módulo puro salvo `cargarBanco`: el Worker de Cloudflare reutiliza `duelosDelDia`
// para saber cuál es la respuesta correcta sin fiarse del cliente.

import { FECHA_LANZAMIENTO, diaSemana, esFechaValida, indiceDia, semanaDesdeLanzamiento, sumarDias } from './fecha.js';

/** Desde este día hay tres duelos diarios, sacados del calendario (campo `fecha`). */
export const FECHA_TRES_DUELOS = '2026-10-03';
export const DUELOS_POR_DIA = 3;

/**
 * Último día del ciclo. Desde el día siguiente, el calendario vuelve a empezar por el
 * día del lanzamiento (el #1), con los mismos duelos. Si se añaden días al calendario,
 * hay que mover esta fecha al último de ellos.
 */
export const FIN_DEL_CICLO = '2026-12-31';

/**
 * Clave de cada duelo del día, en las estadísticas locales y en el contador: el día
 * para el primero (así se guardaban cuando había uno al día) y 'AAAA-MM-DD/N' para los demás.
 */
export const clavePartida = (fecha, ronda = 1) => (ronda === 1 ? fecha : `${fecha}/${ronda}`);

const modulo = (n, m) => ((n % m) + m) % m;
const porId = (a, b) => a.id - b.id;

/** Hash FNV-1a de 32 bits: estable entre navegadores y Node. */
function hash(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** El orden de las cartas depende de la fecha (y de la partida), para que la correcta no salga siempre arriba. */
function seleccion(duelo, semilla) {
  const a = { palabra: duelo.palabraA, anio: duelo.anioA };
  const b = { palabra: duelo.palabraB, anio: duelo.anioB };
  return {
    duelo,
    cartas: hash(semilla) % 2 ? [b, a] : [a, b],
    correcta: duelo.anioA < duelo.anioB ? duelo.palabraA : duelo.palabraB,
  };
}

/**
 * Hasta el 2 de octubre de 2026, un duelo al día: el día de la semana fija la
 * dificultad (lunes 1 … domingo 7) y dentro de ella se rota semana a semana por
 * orden de id. Solo usa los duelos sin `fecha`, para que esos días no cambien.
 */
function dueloSemanal(duelos, fecha) {
  const banco = duelos.filter((d) => !d.fecha);
  let candidatos = banco.filter((d) => d.dificultad === diaSemana(fecha));
  let indice = semanaDesdeLanzamiento(fecha);
  if (candidatos.length === 0) {
    candidatos = banco;
    indice = indiceDia(fecha);
  }
  candidatos = [...candidatos].sort(porId);
  return seleccion(candidatos[modulo(indice, candidatos.length)], fecha);
}

/**
 * La fecha cuyos duelos tocan el día `fecha`: ella misma hasta FIN_DEL_CICLO y, después,
 * la del día equivalente del primer ciclo (el 1 de enero de 2027 vuelve al 1 de octubre).
 */
export function fechaDelCiclo(fecha) {
  if (fecha <= FIN_DEL_CICLO) return fecha;
  const largo = indiceDia(FIN_DEL_CICLO) - indiceDia(FECHA_LANZAMIENTO) + 1;
  return sumarDias(FECHA_LANZAMIENTO, modulo(indiceDia(fecha) - indiceDia(FECHA_LANZAMIENTO), largo));
}

/**
 * Los duelos de un día, en orden de juego (pasado FIN_DEL_CICLO, los del día
 * equivalente del primer ciclo). Desde FECHA_TRES_DUELOS son los que llevan esa
 * `fecha`, por orden de id. Si un día no tiene duelos programados,
 * se rota de tres en tres por los duelos sin fecha (o por todos, si no hay)
 * para que el juego no se quede vacío.
 */
export function duelosDelDia(duelos, fecha) {
  const delCiclo = fechaDelCiclo(fecha);
  if (delCiclo < FECHA_TRES_DUELOS) return [dueloSemanal(duelos, delCiclo)];

  let delDia = duelos.filter((d) => d.fecha === delCiclo).sort(porId);
  if (delDia.length === 0) {
    const sinFecha = duelos.filter((d) => !d.fecha);
    const todos = [...(sinFecha.length ? sinFecha : duelos)].sort(porId);
    const inicio = (indiceDia(delCiclo) - indiceDia(FECHA_TRES_DUELOS)) * DUELOS_POR_DIA;
    delDia = Array.from({ length: DUELOS_POR_DIA }, (_, i) => todos[modulo(inicio + i, todos.length)]);
  }
  return delDia.map((duelo, i) => seleccion(duelo, `${fecha}/${i + 1}`));
}

/** Último día con duelos programados en el calendario (o null). */
export function ultimoDiaProgramado(duelos) {
  return duelos.reduce((ultimo, d) => (d.fecha && (!ultimo || d.fecha > ultimo) ? d.fecha : ultimo), null);
}

/** Avisos sobre errores típicos al editar el JSON a mano. */
export function validarBanco(duelos) {
  const avisos = [];
  const ids = new Set();
  const palabras = new Map();
  const porFecha = new Map();
  for (const d of duelos) {
    const nombre = `duelo ${d.id} (${d.palabraA} / ${d.palabraB})`;
    if (ids.has(d.id)) avisos.push(`id repetido: ${nombre}`);
    ids.add(d.id);
    for (const campo of ['id', 'palabraA', 'anioA', 'palabraB', 'anioB', 'curiosidad']) {
      if (d[campo] === undefined || d[campo] === '') avisos.push(`falta "${campo}" en ${nombre}`);
    }
    if (d.anioA === d.anioB) avisos.push(`años empatados en ${nombre}: no hay respuesta correcta`);
    if (d.fecha !== undefined) {
      if (!esFechaValida(d.fecha) || d.fecha < FECHA_TRES_DUELOS) avisos.push(`fecha no válida en ${nombre}`);
      porFecha.set(d.fecha, (porFecha.get(d.fecha) ?? 0) + 1);
    } else if (!Number.isInteger(d.dificultad) || d.dificultad < 1 || d.dificultad > 7) {
      avisos.push(`dificultad fuera de 1-7 en ${nombre}`);
    }
    for (const palabra of [d.palabraA, d.palabraB]) {
      if (palabras.has(palabra)) avisos.push(`«${palabra}» sale en los duelos ${palabras.get(palabra)} y ${d.id}`);
      else palabras.set(palabra, d.id);
    }
  }
  for (const [fecha, cuantos] of porFecha) {
    if (cuantos !== DUELOS_POR_DIA) avisos.push(`el ${fecha} tiene ${cuantos} duelos en vez de ${DUELOS_POR_DIA}`);
  }
  const sinVerificar = duelos.filter((d) => d.verificado !== true).length;
  if (sinVerificar) avisos.push(`${sinVerificar} duelos con fechas sin verificar`);
  return avisos;
}

export async function cargarBanco(url = 'data/duelos.json') {
  const respuesta = await fetch(url, { cache: 'no-cache' });
  if (!respuesta.ok) throw new Error(`No se pudo cargar el banco de duelos (${respuesta.status})`);
  const { duelos } = await respuesta.json();
  for (const aviso of validarBanco(duelos)) console.warn(`Calendas: ${aviso}`);
  return duelos;
}
