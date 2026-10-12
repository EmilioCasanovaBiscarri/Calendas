// Texto para compartir (sin revelar la respuesta) y su envío.

/**
 * `aciertos`: un booleano por duelo del día. Una marca por duelo: ▰ acertado, ▱ fallado.
 *   Calendas nº 7 ▰▱▰ 2/3 aciertos
 *   emiliocasanovabiscarri.github.io/Calendas
 */
export function textoCompartir({ numero, aciertos }) {
  const marcas = aciertos.map((acierto) => (acierto ? '▰' : '▱')).join('');
  const total = aciertos.filter(Boolean).length;
  return `Calendas nº ${numero} ${marcas} ${total}/${aciertos.length} aciertos\nemiliocasanovabiscarri.github.io/Calendas`;
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Navegadores antiguos o contexto no seguro: recurso clásico.
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let copiado = false;
  try {
    copiado = document.execCommand('copy');
  } catch {
    copiado = false;
  }
  area.remove();
  return copiado;
}

/** Devuelve 'compartido', 'cancelado', 'copiado' o 'error'. */
export async function compartir(texto) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return 'compartido';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelado';
    }
  }
  return (await copiar(texto)) ? 'copiado' : 'error';
}
