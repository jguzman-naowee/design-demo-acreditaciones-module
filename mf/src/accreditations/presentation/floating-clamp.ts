/**
 * Los paneles flotantes del SDK, dentro de la ventana.
 *
 * EL FALLO, medido el 2026-09-08
 * ──────────────────────────────
 * El calendario de «Fecha de entrega» se sale de la pantalla por la derecha. Reportado por
 * Andrés sobre staging y reproducido en el arnés a CUATRO anchos —1920, 1650, 1440 y
 * 1280—: se sale **103 px en todos**. No es cosa de pantallas chicas; el campo va pegado al
 * borde derecho de una tarjeta a todo el ancho, así que el hueco a su derecha es siempre el
 * mismo (~49 px) y el panel mide 412.
 *
 * La causa está en `helpers/floating.js` del SDK, que es de donde cuelgan TODOS sus paneles
 * flotantes:
 *
 *     const top = place === 'bottom' ? rect.bottom + gap : rect.top - height - gap;
 *     const next = { position: 'fixed', top, zIndex };
 *     …
 *     next.left = rect.left;
 *
 * Voltea en vertical cuando no cabe abajo (`flip`), pero en horizontal pone el borde
 * izquierdo del panel sobre el del ancla y no lo compara nunca con `window.innerWidth`. Le
 * falta el `shift` que hace cualquier librería de posicionamiento.
 *
 * Afecta a los cuatro componentes que lo usan —DateField, Dropdown, ButtonDropdown y
 * Popover—, no solo al calendario.
 *
 * EL ARREGLO
 * ──────────
 * El componente no expone alineación (`NwtDateField` no tiene prop para eso) y el panel sale
 * por portal a `document.body` con su `left` en el `style` en línea, que React reescribe.
 * Así que no hay CSS que lo pueda corregir: solo quien conoce el ancla y el ancho de la
 * ventana puede calcular el sitio, y eso es JavaScript.
 *
 * Se vigila el documento y se corrige el `left` en cuanto el panel aparece o el SDK lo
 * recalcula —que es lo que hace al hacer scroll o cambiar el tamaño—. Corregir sobre la
 * mutación y no con nuestros propios `scroll`/`resize` es a propósito: nuestros oyentes se
 * registrarían ANTES que los suyos y el SDK volvería a pisarnos.
 *
 * No se le mueve el `top`: ese sí lo resuelve bien.
 *
 * ÁMBITO. Las cuatro clases son del SDK de React y solo existen donde está montado este
 * módulo: comprobado que la suite no usa ninguna, ni en su código ni en
 * `@naowee-tech/styles-foundations`. Aun así el arreglo es idempotente y solo mueve lo que
 * se sale, así que lo peor que podría hacerle a un panel ajeno es meterlo en pantalla.
 *
 * ESTO SE BORRA cuando el SDK acote en horizontal. Está reportado.
 */

// Los paneles que salen de `useFloating`. Ver components/{DateField,Dropdown,ButtonDropdown,
// Popover} del SDK.
const PANELES = [
  '.nwt-date-field__popover',
  '.nwt-dropdown__list',
  '.nwt-popover__surface'
].join(',');

// El aire que se le deja al borde de la ventana. Pegado al canto se lee como recortado.
const MARGEN = 8;

function acotar(panel: HTMLElement): void {
  // Mientras está oculto el SDK lo deja en 0,0: moverlo ahí no sirve de nada y además
  // dispara otra mutación.
  if (panel.style.visibility === 'hidden' || !panel.style.left) {
    return;
  }

  const ancho = panel.offsetWidth;

  if (!ancho) {
    return;
  }

  const actual = parseFloat(panel.style.left);

  if (Number.isNaN(actual)) {
    return;
  }

  const maximo = window.innerWidth - MARGEN - ancho;
  // Si ni siquiera cabe con los dos márgenes, se prefiere que se vea el principio.
  const destino = Math.max(MARGEN, Math.min(actual, maximo));

  // Sin este corte cada escritura dispararía otra mutación y el observador se realimenta.
  if (Math.abs(destino - actual) < 0.5) {
    return;
  }

  panel.style.left = `${destino}px`;
}

function acotarLosDe(nodo: Node): void {
  if (!(nodo instanceof HTMLElement)) {
    return;
  }

  if (nodo.matches(PANELES)) {
    acotar(nodo);
  }

  nodo.querySelectorAll<HTMLElement>(PANELES).forEach(acotar);
}

let instalado = false;

export function installFloatingClamp(): void {
  // El módulo puede montarse y desmontarse varias veces en la misma página; un observador
  // por montaje sería una fuga.
  if (instalado || typeof document === 'undefined') {
    return;
  }

  instalado = true;

  new MutationObserver((cambios) => {
    for (const cambio of cambios) {
      if (cambio.type === 'attributes') {
        acotarLosDe(cambio.target);
      } else {
        cambio.addedNodes.forEach(acotarLosDe);
      }
    }
  }).observe(document, {
    attributeFilter: ['style'],
    attributes: true,
    childList: true,
    subtree: true
  });
}
