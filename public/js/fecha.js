// Utilidades de fecha. Una "fecha de juego" es siempre una cadena 'AAAA-MM-DD'
// referida al calendario del jugador: el día cambia a su medianoche. Módulo puro:
// no toca `window` ni `document`.

export const FECHA_LANZAMIENTO = '2026-10-01';

const MS_DIA = 86_400_000;

const dosCifras = (n) => String(n).padStart(2, '0');

/** Fecha de juego actual (o del instante `ms`) en la hora local del jugador. */
export function fechaLocal(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}`;
}

export function esFechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  return desdeIndice(indiceDia(fecha)) === fecha;
}

/** Días transcurridos desde 1970-01-01 (sin horas ni zonas de por medio). */
export function indiceDia(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia) / MS_DIA;
}

function desdeIndice(indice) {
  return new Date(indice * MS_DIA).toISOString().slice(0, 10);
}

export function sumarDias(fecha, dias) {
  return desdeIndice(indiceDia(fecha) + dias);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemana(fecha) {
  return ((new Date(indiceDia(fecha) * MS_DIA).getUTCDay() + 6) % 7) + 1;
}

/** Número de duelo: el día del lanzamiento es el #1. */
export function numeroDuelo(fecha) {
  return indiceDia(fecha) - indiceDia(FECHA_LANZAMIENTO) + 1;
}

/** Semanas (de lunes a domingo) transcurridas desde la semana del lanzamiento. */
export function semanaDesdeLanzamiento(fecha) {
  const lunes = (f) => indiceDia(f) - (diaSemana(f) - 1);
  return Math.floor((lunes(fecha) - lunes(FECHA_LANZAMIENTO)) / 7);
}

/** Ms hasta la próxima medianoche local. También los días de cambio de hora (23 o 25 horas). */
export function msHastaProximoDuelo(ahora = Date.now()) {
  const d = new Date(ahora);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - ahora;
}

const formatoLargo = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** 'jueves, 1 de octubre' */
export function fechaLarga(fecha) {
  return formatoLargo.format(indiceDia(fecha) * MS_DIA);
}
