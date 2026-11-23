# design-demo-acreditaciones-module

Demo navegable del **módulo de Acreditaciones** de Sports (suite-web-v2), con el micro real
`suite-mf-accreditations` (v0.0.12) montado en el marco de `design-layouts-demos`: ventana 16:9,
selector de tamaño, **Vista plana** y panel de **Casos** (recorrido guiado). Corre sin backend:
el contrato del gateway del micro se simula en el navegador y **lo que se crea o cambia se recuerda
entre recargas** (`localStorage`).

## Correr

```bash
npm install          # necesita NPM_TOKEN (paquetes privados @naowee-tech)
npm run build        # compila mf/ + simulador → mobile/apps/acreditaciones/assets/app.{js,css}
npm run dev          # http://localhost:8770  (otro puerto: PORT=8771 npm run dev)
npm run verificar    # rutas, selectores de los casos y cobertura del gateway, sin navegador
```

Abre http://localhost:8770/web/?app=acreditaciones. Un recargue conserva los datos; `?reset=1`
(lo usan los casos) los devuelve al principio.

## Qué muestra

Las pantallas vivas del menú del micro, todas conectadas al contrato congelado del gateway:
Permisos de acceso, Tipos de acreditados, Certificados (configuración y entrega), Gestión de
acreditables, Lista de acreditados, Lotes de carnets y Auditoría del evento.
**No incluye** las pantallas «próximas a borrar» del micro (lotes generados, historial, control de
accesos, validar acceso, credencial de demo) ni «Ver credencial», oculta por decisión de producto.

## Cómo está armado

| Ruta | Qué es |
|---|---|
| `mf/` | El micro vendorizado, **intacto** (ver `mf/PROCEDENCIA.md`) y su contrato del gateway. |
| `src/` | Pegamento de la demo: simulador del gateway sobre `XMLHttpRequest` con persistencia, y el montaje del micro. |
| `scripts/build.mjs` | esbuild del micro + `src/` (el bundle compilado se **commitea**: Pages no instala paquetes privados). |
| `mobile/apps/acreditaciones/` | La app dentro del marco: `index.html`, menú (`assets/shell.js`), casos (`casos.js`, `assets/casos/`). |
| `404.html` | Pages no tiene fallback de SPA: una ruta profunda vuelve al `index.html` de la app con `?r=`. |
| `web/`, `shared/` | El marco (no sabe nada de Acreditaciones). |

## Casos

`mobile/apps/acreditaciones/casos.js`: un caso por flujo, cada uno desde el inicio y con la
navegación real del menú. El marco solo pulsa y resalta, así que nada pide teclear; cada caso
declara en `falta` lo que no recorre.

## Reglas del marco

`RULES.md`. Esta demo no es estática: el estado vive en `localStorage` del navegador.
