// Arranque: decide qué día es, carga los duelos del día y muestra o la pregunta
// o el resultado ya jugado. Desde el 3 de octubre de 2026 hay tres duelos al día:
// ?partida=N elige cuál (si falta, el primero sin jugar).

import { esFechaValida, fechaLocal, msHastaProximoDuelo, numeroDuelo } from './fecha.js';
import { DUELOS_POR_DIA, FECHA_TRES_DUELOS, cargarBanco, duelosDelDia, fechaDelCiclo, ultimoDiaProgramado } from './duelos.js';
import * as estadisticas from './estadisticas.js';
import { enviarRespuesta, pedirTotales } from './api.js';
import { revelar } from './revelacion.js';
import { compartir, textoCompartir } from './compartir.js';

const $ = (selector) => document.querySelector(selector);

// Modo desarrollo: ?fecha=AAAA-MM-DD simula otro día, usa estadísticas aparte
// y no envía nada al backend.
const parametros = new URLSearchParams(location.search);
const parametroFecha = parametros.get('fecha');
const modoDesarrollo = parametroFecha !== null && esFechaValida(parametroFecha);
if (parametroFecha !== null && !modoDesarrollo) {
  console.warn(`Calendas: ?fecha=${parametroFecha} no es válida; usa el formato AAAA-MM-DD.`);
}
if (modoDesarrollo) estadisticas.usarModoDesarrollo();

const hoy = modoDesarrollo ? parametroFecha : fechaLocal();
const fecha = hoy;
const numero = numeroDuelo(fecha);

let selecciones = [];
let ronda = 1;
let seleccion = null;
let porcentajeHoy = null;
let cuentaAtrasActiva = false;

retirarPortada();
iniciar();

/** Enlace a otro duelo de hoy, conservando el ?fecha= del modo desarrollo. */
function enlaceRonda(r) {
  const destino = new URLSearchParams();
  if (modoDesarrollo) destino.set('fecha', hoy);
  destino.set('partida', r);
  return `?${destino}`;
}

/** Enlace a la pantalla final del día: la página sin ?partida=. */
function enlaceResumen() {
  return modoDesarrollo ? `?fecha=${hoy}` : location.pathname;
}

/** Duelos de un día sin necesidad de cargar el banco. */
function duelosEn(dia) {
  return fechaDelCiclo(dia) < FECHA_TRES_DUELOS ? 1 : DUELOS_POR_DIA;
}

function partidasDe(dia, n) {
  return Array.from({ length: n }, (_, i) => estadisticas.partidaDe(dia, i + 1));
}

/** Duelo que se abre: el de ?partida= si es válido; si no, el primero sin jugar; si están todos, el último. */
function rondaInicial(n) {
  const pedida = Number(parametros.get('partida'));
  if (Number.isInteger(pedida) && pedida >= 1 && pedida <= n) return pedida;
  const sinJugar = partidasDe(fecha, n).findIndex((partida) => !partida);
  return sinJugar === -1 ? n : sinJugar + 1;
}

/** El siguiente duelo sin jugar del día (primero los posteriores a este), o null. */
function siguienteSinJugar() {
  const n = selecciones.length;
  for (let paso = 1; paso < n; paso++) {
    const r = ((ronda - 1 + paso) % n) + 1;
    if (!estadisticas.partidaDe(fecha, r)) return r;
  }
  return null;
}

/**
 * La portada con el logo se ve al menos PORTADA_MS desde que se abre la app y luego se desvanece.
 * Los estilos (fuentes de Google incluidas) bloquean el primer pintado: con red lenta se garantiza
 * además que se vea PINTADA_MS desde que se pintó, para que el logo acabe de animarse.
 */
function retirarPortada() {
  const PORTADA_MS = 1500;
  const PINTADA_MS = 1400;
  const FUNDIDO_MS = 500;
  const portada = document.getElementById('portada');
  if (!portada) return;
  if (document.documentElement.classList.contains('sin-portada')) {
    portada.remove();
    return;
  }
  const pintada = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? performance.now();
  setTimeout(() => {
    portada.classList.add('oculta');
    setTimeout(() => portada.remove(), FUNDIDO_MS);
  }, Math.max(0, PORTADA_MS - performance.now(), PINTADA_MS - (performance.now() - pintada)));
}

async function iniciar() {
  if (modoDesarrollo) {
    $('#barra-dev').hidden = false;
    $('#dev-fecha').textContent = hoy;
  }
  pintarEstadisticas();
  prepararReglas();
  document.addEventListener('click', saltarPortadaAlNavegar);
  $('#compartir').addEventListener('click', alCompartir);
  document.addEventListener('visibilitychange', recargarSiCambioElDia);

  try {
    const banco = await cargarBanco();
    const ultimo = ultimoDiaProgramado(banco);
    const delCiclo = fechaDelCiclo(fecha);
    if (delCiclo >= FECHA_TRES_DUELOS && (!ultimo || delCiclo > ultimo)) {
      console.warn(`Calendas: no hay duelos programados para el ${fecha}; se repiten duelos del banco.`);
    }
    selecciones = duelosDelDia(banco, fecha);
    ronda = rondaInicial(selecciones.length);
    seleccion = selecciones[ronda - 1];
  } catch (error) {
    console.error(error);
    $('#instruccion').textContent = 'No se ha podido cargar el duelo. Prueba a recargar la página.';
    return;
  }

  // Con los tres duelos jugados, la página sin ?partida= es la pantalla final.
  if (!parametros.has('partida') && partidasDe(fecha, selecciones.length).every(Boolean)) {
    mostrarResumen();
    return;
  }

  pintarRondas();
  const botones = document.querySelectorAll('.carta');
  seleccion.cartas.forEach((carta, i) => {
    botones[i].querySelector('.carta-palabra').textContent = carta.palabra;
  });

  const partida = estadisticas.partidaDe(fecha, ronda);
  if (partida) {
    mostrarResultado(partida.eleccion, false);
    sincronizarPorcentaje(partida);
    return;
  }

  $('#duelo').classList.add('listo');
  botones.forEach((boton, i) => {
    boton.disabled = false;
    boton.addEventListener('click', () => responder(seleccion.cartas[i].palabra));
  });
}

function responder(palabra) {
  if (estadisticas.partidaDe(fecha, ronda)) return;
  const acierto = palabra === seleccion.correcta;
  const partida = estadisticas.registrarPartida(fecha, ronda, {
    dueloId: seleccion.duelo.id,
    eleccion: palabra,
    acierto,
  });
  mostrarResultado(palabra, true);
  pintarRondas();
  pintarEstadisticas();
  sincronizarPorcentaje(partida);
}

/** Pestañas con los duelos del día (solo si hay más de uno) y su resultado. */
function pintarRondas() {
  const n = selecciones.length;
  const nav = $('#rondas');
  if (n < 2) return;
  nav.replaceChildren();
  partidasDe(fecha, n).forEach((partida, i) => {
    const r = i + 1;
    const enlace = document.createElement('a');
    enlace.className = 'ronda';
    enlace.href = enlaceRonda(r);
    const estado = !partida ? 'sin jugar' : partida.acierto ? 'acertado' : 'fallado';
    if (partida) enlace.classList.add(partida.acierto ? 'acertado' : 'fallado');
    enlace.textContent = `Duelo ${r}${!partida ? '' : partida.acierto ? ' ✓' : ' ✗'}`;
    enlace.setAttribute('aria-label', `Duelo ${r} de ${n}, ${estado}`);
    if (r === ronda) {
      enlace.classList.add('actual');
      enlace.setAttribute('aria-current', 'page');
    }
    nav.append(enlace);
  });
  nav.hidden = false;
}

function mostrarResultado(eleccion, animar) {
  const siguiente = siguienteSinJugar();
  $('#siguiente').hidden = false;
  if (siguiente !== null) {
    $('#siguiente').href = enlaceRonda(siguiente);
    $('#siguiente').textContent = `Duelo ${siguiente} de ${selecciones.length} →`;
  } else {
    avisarAlmanaque();
    $('#siguiente').href = enlaceResumen();
    $('#siguiente').textContent = 'Ver resultado →';
  }
  revelar({
    cartas: seleccion.cartas,
    eleccion,
    correcta: seleccion.correcta,
    curiosidad: seleccion.duelo.curiosidad,
    animar,
  });
}

/** Frase de la ficha final según los aciertos del día (de ninguno a todos). */
const FRASES = [
  'Hoy las fechas te han dado esquinazo.',
  'Una fecha bien puesta. Algo es algo.',
  'Buen olfato para la historia.',
  'Memoria de cronista: ni una fecha fuera de sitio.',
];

/** Hoja de calendario: marca de la ficha final, llena si se acertó el duelo. */
const HOJA = '<path class="hoja-cuerpo" d="M3.5 5.5h17v15h-17Z"/><path class="hoja-anillas" d="M8 3v5M16 3v5"/>';

/** Pantalla final: ficha con el resultado, una línea por duelo, estadísticas y botones. */
function mostrarResumen() {
  const partidas = partidasDe(fecha, selecciones.length);
  const aciertos = partidas.filter((partida) => partida.acierto).length;
  const total = partidas.length;
  $('#duelo').hidden = true;
  $('#resultado').hidden = true;
  $('#pie').hidden = true;

  const marcas = $('#resumen-marcas');
  marcas.innerHTML = partidas
    .map((partida) => `<svg class="${partida.acierto ? 'bien' : 'mal'}" viewBox="0 0 24 24" aria-hidden="true">${HOJA}</svg>`)
    .join('');
  marcas.setAttribute('aria-label', `${aciertos} ${aciertos === 1 ? 'acierto' : 'aciertos'} de ${total}`);
  $('#resumen-cifra').innerHTML = `${aciertos} <small>de ${total}</small>`;
  $('#resumen-frase').textContent = FRASES[Math.round((aciertos / total) * 3)];

  $('#resumen-lista').replaceChildren(
    ...selecciones.map((sel, i) => {
      const acierto = partidas[i].acierto;
      const otra = sel.cartas.find((carta) => carta.palabra !== sel.correcta);
      const li = document.createElement('li');
      const enlace = document.createElement('a');
      enlace.href = enlaceRonda(i + 1);
      enlace.innerHTML =
        `<span class="marca ${acierto ? 'bien' : 'mal'}" aria-label="${acierto ? 'Acierto' : 'Fallo'}">${acierto ? '✓' : '✗'}</span>` +
        '<span class="lema"></span><span class="destino"></span>';
      enlace.querySelector('.lema').textContent = sel.correcta;
      enlace.querySelector('.destino').textContent = `antes que ${otra.palabra}`;
      li.append(enlace);
      return li;
    }),
  );

  $('#resumen').hidden = false;
  avisarAlmanaque();
  iniciarCuentaAtras();
}

/**
 * Con todos los duelos de hoy jugados, la mano ☜ marca Calendas como «Hecho» en Almanaque,
 * y su hoja muestra los aciertos del día y la racha. En modo desarrollo no se manda el
 * resultado: es de un día simulado.
 */
function avisarAlmanaque() {
  if (modoDesarrollo) {
    window.almanaqueHecho?.();
    return;
  }
  const partidas = partidasDe(fecha, selecciones.length);
  window.almanaqueHecho?.({
    aciertos: partidas.filter((partida) => partida?.acierto).length,
    total: partidas.length,
    racha: estadisticas.rachaActual(hoy),
  });
}

/** Envía la respuesta si aún no consta en el servidor y muestra el % global. */
async function sincronizarPorcentaje(partida) {
  if (modoDesarrollo) return;
  const enviar = !partida.enviada;
  const totales = enviar
    ? await enviarRespuesta(fecha, ronda, partida.eleccion)
    : await pedirTotales(fecha, ronda);
  if (!totales) return;
  if (enviar) estadisticas.marcarEnviada(fecha, ronda);
  if (totales.total === 0) return;

  porcentajeHoy = Math.round((totales.aciertos / totales.total) * 100);
  const el = $('#porcentaje');
  el.textContent = `El ${porcentajeHoy} % de los jugadores acertó hoy`;
  el.hidden = false;
}

/** Días, aciertos (sobre los duelos jugados) y rachas: en la pantalla final («rs-») y en la ventana («ve-»). */
function pintarEstadisticas() {
  const e = estadisticas.leer();
  const cifras = {
    dias: estadisticas.diasJugados(),
    aciertos: e.jugados ? `${Math.round((e.aciertos / e.jugados) * 100)} %` : '—',
    racha: estadisticas.rachaActual(hoy),
    mejor: e.mejorRacha,
  };
  for (const [nombre, valor] of Object.entries(cifras)) {
    $(`#rs-${nombre}`).textContent = valor;
    $(`#ve-${nombre}`).textContent = valor;
  }
}

function formatoCuenta(ms) {
  const segundos = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function iniciarCuentaAtras() {
  if (cuentaAtrasActiva) return;
  cuentaAtrasActiva = true;
  const el = $('#cuenta');
  const tic = () => {
    const ms = msHastaProximoDuelo();
    el.textContent = formatoCuenta(ms);
    if (ms <= 0 && !modoDesarrollo) location.reload();
  };
  tic();
  setInterval(tic, 1000);
}

/** Si la app se queda abierta y pasa la medianoche, carga el duelo nuevo al volver. */
function recargarSiCambioElDia() {
  if (!modoDesarrollo && document.visibilityState === 'visible' && fechaLocal() !== hoy) {
    location.reload();
  }
}

async function alCompartir() {
  const partidas = partidasDe(fecha, selecciones.length);
  if (!partidas.length || !partidas.every(Boolean)) return;
  const texto = textoCompartir({ numero, aciertos: partidas.map((partida) => partida.acierto) });
  const resultado = await compartir(texto);
  const aviso = $('#aviso');
  aviso.textContent =
    resultado === 'copiado' ? 'Copiado al portapapeles' : resultado === 'error' ? `No se pudo copiar: ${texto}` : '';
  clearTimeout(alCompartir.temporizador);
  alCompartir.temporizador = setTimeout(() => (aviso.textContent = ''), 4000);
}

/** Ventanas «Cómo se juega» (botón «?») y «Estadísticas» (icono de barras) de la cabecera. */
function prepararReglas() {
  for (const [boton, id] of [['#abrir-reglas', '#reglas'], ['#abrir-estadisticas', '#ventana-estadisticas']]) {
    const dialogo = $(id);
    $(boton).addEventListener('click', () => dialogo.showModal());
    dialogo.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => dialogo.close()));
    // Tocar fuera de la ficha (en el fondo) también cierra.
    dialogo.addEventListener('click', (evento) => {
      if (evento.target === dialogo) dialogo.close();
    });
  }
}

/** Al ir a otro duelo desde dentro del juego, la página siguiente no repite la portada. */
function saltarPortadaAlNavegar(evento) {
  if (!evento.target.closest('.ronda, #siguiente, .lista-final a')) return;
  try {
    sessionStorage.setItem('calendas:sin-portada', '1');
  } catch {
    // Sin sessionStorage la portada también sale al navegar; no pasa nada.
  }
}
