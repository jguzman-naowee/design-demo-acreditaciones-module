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
**Pantallas propias de la demo** (no están en el micro; JS plano, sin compilar, en `mobile/apps/acreditaciones/assets/`): «Categorías» (organización del tipo de acreditado —COJNJ, Mindeporte…— con siglas y color; se elige al crear el tipo), «Permisos de acceso» en dos pestañas: Zonas (indicativo único) y Servicios (ícono), «Formularios de registro» (creador sencillo: preguntas abiertas, selectores y archivos; catálogo en `localStorage`), «Tipos de acreditados» (reemplaza la del micro: la función es un selector al que se pueden agregar funciones nuevas), «Permisos de acceso» (catálogo, con etiquetas en el formulario; reemplaza a la del micro, cuyo «Crear» falla en la demo) y «Usuarios» (administración GLOBAL, fuera de los eventos: sección «Plataforma» fija arriba del panel lateral con «Eventos» (todos los perfiles) y «Usuarios» (Gestor; el Operador de acreditaciones ve solo «Operadores externos»); al entrar en un evento se despliegan debajo las secciones del evento sin quitar las de arriba; perfiles Gestor de acreditaciones / Operador de acreditaciones / Operador externo / Validador; el externo es un tipo de acreditado con acceso (su tipo + los tipos que puede registrar) y no valida accesos; menú lateral por perfil; guarda en `naowee.acreditaciones.usuarios.v4`). Se abren con `#/<id>` y se montan sobre el micro, que no se toca; el catálogo se guarda en el estado del simulador (expuesto en `window.__ACRED_ESTADO__`) y la regla de validación vive en cada permiso (la pantalla «Validación» por tipo salió del menú; `validacion.js` queda sin cargar, para el futuro override por tipo). El micro manda cualquier ruta que no conoce al selector de eventos, por eso no usan rutas nuevas.

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

**Encabezado de las tablas:** buscador en píldora y filtro «Estado: Todos» arriba; el paginado va debajo de la tabla, a la derecha. Las pantallas propias (Permisos, Usuarios) comparten `filtroEstado` y `paginador` (`window.ACRED_DATOS`, definidos en `permisos.js`).
