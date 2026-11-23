// ═══════════════════════════════════════════════════════════════════════════════
// OCULTO TEMPORALMENTE — «Ver credencial», decisión de Andrés, 2026-09-08
//
// No es lo mismo que `PRÓXIMA A BORRAR`: allá la pantalla se va, acá se queda. Lo
// único que se quita es la forma de LLEGAR a la credencial desde la interfaz. La
// pantalla (`AccreditationProfilePage`) y sus rutas —`/profile/event/:code` y
// `/profile/:id`— siguen montadas: quien escriba la URL la ve igual que antes.
//
// Por qué así y no borrando: la decisión es POR AHORA, sin fecha de vuelta. Un
// borrado obligaría a reescribir el menú de cada pantalla cuando se revierta, y a
// recordar cuáles eran. Detrás de esta constante, volver es un cambio de una línea.
//
// PARA DEVOLVERLA:
//   1. Poner esta constante en `true`.
//   2. Dar la vuelta a los dos checks del arnés que hoy afirman su AUSENCIA:
//      `e2e/blocks/acreditados.mjs` («la credencial NO se ofrece…») y
//      `e2e/blocks/detalle.mjs` (igual). Los dos dicen en su comentario cómo.
//   3. Borrar la fila de la sección «Acciones ocultas temporalmente» del README.
//
// DÓNDE SE USA (tres puntos de entrada, todos con su marca al lado):
//   - `pages/delivery/EventAccreditedDetailPage.tsx` — menú de la cabecera.
//   - `pages/delivery/AccreditedListPage.tsx` — menú de la fila.
//   - `validation/…/AccessControlTable.tsx` — menú de la fila; ahí el rótulo es
//     «Ver perfil público», que lleva a la MISMA credencial. Esa pantalla ya está
//     `PRÓXIMA A BORRAR`, así que su salida moriría con ella de todos modos; se
//     oculta igual por coherencia, para que no quede un único camino vivo.
// ═══════════════════════════════════════════════════════════════════════════════
export const CREDENTIAL_ACTION_VISIBLE = false;
