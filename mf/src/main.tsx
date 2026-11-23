// El SDK 3 cambió el runtime de federación: `@softarc/native-federation-runtime` salió del
// árbol y en su lugar va `initShellFederation`, que envuelve al orquestador nuevo. Sigue
// aceptando la URL del manifiesto, así que el arranque no cambia de forma.
//
// Este main es el del cascarón de desarrollo del propio micro (`nf-dev`), no el del módulo
// federado: el módulo entra por su `remoteEntry` y lo monta el anfitrión.
import { initShellFederation } from '@naowee-tech/sdk-frontend-react';

initShellFederation('/federation.manifest.json')
  .then(() => import('./bootstrap.js'))
  .catch((err) => console.error(err));
