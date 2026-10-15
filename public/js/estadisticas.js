// Estadísticas locales. Si localStorage no está disponible (modo privado,
// datos bloqueados…) todo sigue funcionando en memoria durante la sesión.

import { clavePartida } from './duelos.js';
import { sumarDias } from './fecha.js';

const CLAVE_BASE = 'calendas:v1';
let clave = CLAVE_BASE;
let estado = null;

/** En modo desarrollo se usa otra clave para no ensuciar las estadísticas reales. */
export function usarModoDesarrollo() {
  clave = `${CLAVE_BASE}:dev`;
  estado = null;
}

const vacio = () => ({ racha: 0, mejorRacha: 0, ultimoDia: null, jugados: 0, aciertos: 0, partidas: {} });

export function leer() {
  if (estado) return estado;
  try {
    const guardado = JSON.parse(localStorage.getItem(clave));
    estado = guardado && typeof guardado === 'object' ? { ...vacio(), ...guardado } : vacio();
  } catch {
    estado = vacio();
  }
  return estado;
}

function guardar() {
  try {
    localStorage.setItem(clave, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento persistente: nos quedamos con la copia en memoria.
  }
}

export function partidaDe(fecha, ronda = 1) {
  return leer().partidas[clavePartida(fecha, ronda)] ?? null;
}

/**
 * Fallar no rompe la racha; solo la rompe saltarse un día. Cada duelo suma a
 * jugados y aciertos; la racha cuenta los días en que se jugó algún duelo de ese
 * mismo día. Los duelos del archivo no cuentan para la racha.
 */
export function registrarPartida(fecha, ronda, { dueloId, eleccion, acierto, archivo = false }) {
  const e = leer();
  const clave = clavePartida(fecha, ronda);
  if (e.partidas[clave]) return e.partidas[clave];

  // La comparación de cadenas AAAA-MM-DD es cronológica. Jugar una fecha
  // anterior a la última (solo posible con ?fecha=) no toca la racha.
  if (!archivo && (!e.ultimoDia || fecha > e.ultimoDia)) {
    e.racha = e.ultimoDia === sumarDias(fecha, -1) ? e.racha + 1 : 1;
    e.mejorRacha = Math.max(e.mejorRacha, e.racha);
    e.ultimoDia = fecha;
  }
  e.jugados += 1;
  if (acierto) e.aciertos += 1;
  e.partidas[clave] = { dueloId, eleccion, acierto, archivo };
  guardar();
  return e.partidas[clave];
}

/** Días distintos en que se jugó algún duelo de ese mismo día (sin los del archivo). */
export function diasJugados() {
  const { partidas } = leer();
  const dias = new Set();
  for (const [clave, partida] of Object.entries(partidas)) {
    if (!partida.archivo) dias.add(clave.split('/')[0]);
  }
  return dias.size;
}

/** Racha vigente a fecha de hoy: si ayer no se jugó, ya está rota. */
export function rachaActual(fecha) {
  const { ultimoDia, racha } = leer();
  return ultimoDia === fecha || ultimoDia === sumarDias(fecha, -1) ? racha : 0;
}
