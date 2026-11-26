/* Pasos: goto (url relativa al micro), click (sel), note (sel). El marco solo pulsa y resalta: nada de teclear.
   Los selectores son clases del propio micro; scripts/verificar.mjs comprueba que sigan existiendo. */
(() => {
  const MENU = (ruta) => `.ish-nav [data-go="${ruta}"]`;
  // Todo el módulo depende del evento: cada caso lo elige igual que un usuario nuevo.
  const ENTRAR = [
    { ent: true, t: "goto", url: "/?reset=1", body: "Empezamos como un usuario que entra por primera vez al módulo." },
    { ent: true, t: "note", sel: ".nws-event-entry__card", body: "Solo salen los eventos con acreditación configurada. Todo lo demás se lee por evento." },
    { ent: true, t: "click", sel: ".nws-event-entry__toggle", body: "Abrimos el primer evento para ver sus fases." },
    { ent: true, t: "click", sel: ".nws-event-entry__phase-list button", body: "Entramos a la primera fase: desde acá el módulo trabaja con ese evento y esa fase." }
  ];
  // Rellenar: escribir en un campo, elegir en un selector, adjuntar un archivo. Siempre con un solo registro de ejemplo.
  const ESC = (sel, value, body) => ({ t: "type", sel, value, body });
  const ELIGE = (sel, value, body) => ({ t: "select", sel, value, body });
  const ADJ = (sel, body) => ({ t: "file", sel, mira: ".nwt-file-field__content", nombre: "icono-ejemplo.svg", contenido: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="none" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>', body });
  const CLIC = (sel, body) => ({ t: "click", sel, body });
  const NOTA = (sel, body) => ({ t: "note", sel, body });
  const IR = (ruta, texto) => ({ t: "click", sel: MENU(ruta), body: texto });

  window.CASOS = [
    { id: "1", titulo: "Entrar al módulo y entrada según el rol (CU-01, CU-02)",
      falta: "Cambiar de rol abre un menú de perfiles; aquí se recorre el del gestor y se explica el de los demás.",
      steps: [...ENTRAR, { t: "note", sel: ".ish-nav", body: "El gestor ve todo: Parametrización, Entrega, Validaciones y Auditoría." },
        { t: "click", sel: ".ish-user .ish-chip", body: "El perfil se cambia desde aquí. Cada rol es una persona distinta." },
        { t: "note", sel: ".ish-perfiles", body: "El operador externo y el validador entran directo a su evento asignado, sin lista de eventos. El operador de acreditaciones también, salvo que tenga 2 o más eventos: entonces elige. Su menú solo muestra lo que su rol permite." }] },
    { id: "2", titulo: "Permisos de acceso: zonas y servicios (CU-03 a CU-07)",
      falta: "Se crea una zona y un servicio de ejemplo; editar e inactivar se describen. Los datos de ejemplo se borran al iniciar otro recorrido.",
      steps: [...ENTRAR, CLIC('.ish-nav [data-pantalla="permisos"]', "Abrimos «Permisos de acceso» en Parametrización."),
        NOTA(".nwt-tabs__list", "Los permisos se dividen en dos pestañas con su conteo: Zonas y Servicios. Se busca por nombre, indicativo o etiqueta y se filtra por estado."),
        NOTA(".ish-perms .nwt-datatable", "Zonas: cada una lleva un indicativo o número único que aparece en la acreditación; no lleva ícono."),
        CLIC("[data-nuevo]", "Creamos una zona de ejemplo con «Agregar zona»."),
        ESC('[data-f="name"]', "Zona de ejemplo", "El nombre es obligatorio y no se puede repetir."),
        ESC('[data-f="indicativo"]', "5", "El indicativo o número también es obligatorio y único: aparece en la acreditación."),
        CLIC("[data-guardar]", "Creamos la zona. La descripción y las etiquetas son opcionales."),
        NOTA(".ish-perms .nwt-datatable", "La zona de ejemplo ya está en el catálogo, con su indicativo."),
        CLIC('[data-tab="servicio"]', "Pasamos a Servicios."),
        CLIC("[data-nuevo]", "Creamos un servicio de ejemplo con «Agregar servicio»."),
        ESC('[data-f="name"]', "Servicio de ejemplo", "El servicio no lleva indicativo: lleva un ícono. Las sedes quedan fuera por ahora, están por validarse."),
        CLIC('[data-ms="tags"]', "Las etiquetas dividen el servicio (por ejemplo alimentación: desayuno, almuerzo). Se eligen o se crean."),
        { t: "click", sel: '[data-opt^="tags|"]', txt: "Desayuno", body: "Elegimos «Desayuno»." },
        { t: "click", sel: '[data-opt^="tags|"]', txt: "Almuerzo", body: "Y «Almuerzo»." },
        CLIC(".ish-modal__t", "Cerramos la lista."),
        ADJ("[data-icono]", "El ícono es obligatorio. Aquí se adjunta uno de ejemplo."),
        CLIC("[data-guardar]", "Creamos el servicio."),
        NOTA(".ish-perms .nwt-datatable", "El servicio de ejemplo ya está en su pestaña, con su ícono."),
        CLIC("[data-menu]", "Abrimos el menú de la primera fila."),
        NOTA(".ish-menu", "Editar o inactivar. Un permiso inactivo deja de ofrecerse al configurar tipos y usuarios."),
        NOTA(".ish-perms", "Aquí el permiso solo lleva sus etiquetas (desayuno, almuerzo, cena…). Cuántas veces se puede usar se define por tipo de acreditado, en «Tipos de acreditados».")] },
    { id: "3", titulo: "Categorías de acreditación (CU-08 a CU-10)",
      falta: "Se crea una categoría de ejemplo; editar e inactivar se describen. La de ejemplo se borra al iniciar otro recorrido.",
      steps: [...ENTRAR, CLIC('.ish-nav [data-pantalla="categorias"]', "Abrimos «Categorías» en Parametrización."),
        NOTA(".ish-perms .nwt-datatable", "Cada categoría es una organización (Comité Organizador, Ministerio del Deporte…) con sus siglas y un color: es la franja con siglas al pie de la acreditación. Muestra cuántos tipos la usan."),
        CLIC("[data-nuevo]", "Creamos una categoría de ejemplo."),
        ESC('[data-f="nombre"]', "Federación Deportiva Ejemplo", "Al escribir el nombre, las siglas se sugieren con la inicial de cada palabra."),
        NOTA('[data-f="siglas"]', "Las siglas se pueden editar y deben ser únicas."),
        ESC('[data-f="colorTxt"]', "azul", "El color se escribe por nombre, por código hex o con la barra del círculo cromático."),
        NOTA(".ish-cat-franja", "La vista previa muestra la franja tal como saldrá en la acreditación."),
        CLIC("[data-guardar]", "Creamos la categoría."),
        NOTA(".ish-perms .nwt-datatable", "La categoría de ejemplo ya está en el catálogo. Si se cambian sus siglas, se actualizan los tipos que la usan; una categoría inactiva no se elige en tipos nuevos.")] },
    { id: "4", titulo: "Tipos de acreditados (CU-11 a CU-15)",
      falta: "Se crea un tipo de ejemplo; configurar los de la delegación se describe. El tipo de ejemplo se borra al iniciar otro recorrido.",
      steps: [...ENTRAR, CLIC('.ish-nav [data-pantalla="tipos"]', "Abrimos «Tipos de acreditados» en Parametrización."),
        NOTA(".ish-perms .nwt-datatable", "Cada tipo tiene su padre (Personal de la delegación, Personal del evento o Personal Naowee), su categoría, sus permisos y cuántos de ellos llevan validación."),
        NOTA(".ish-perms .nwt-datatable", "Los tipos de la delegación llegan de inscripción como «Por configurar»: se editan para darles categoría y permisos; no se crean aquí."),
        CLIC("[data-nuevo]", "«Nuevo tipo de acreditado» crea un tipo del evento."),
        ESC("[data-nombre]", "Médico", "Se escribe el nombre del tipo de acreditado: es un campo abierto."),
        ELIGE("[data-cat]", "FDE", "La categoría es obligatoria: elegimos la que acabamos de crear."),
        CLIC('[data-ms="pm"]', "Ahora los permisos del tipo: al menos uno es obligatorio."),
        { t: "click", sel: '[data-opt^="pm|"]', txt: "Servicio de ejemplo", body: "Elegimos el servicio que creamos en Permisos de acceso." },
        { t: "click", sel: '[data-opt^="pm|"]', txt: "Zona de ejemplo", body: "Y la zona de ejemplo." },
        CLIC(".ish-modal__t", "Cerramos la lista. Debajo aparece un bloque de validación por cada permiso elegido."),
        NOTA('[data-ms^="et:"]', "Al asignar un permiso con etiquetas se jalan solas, todas elegidas: se quitan las que no le aplican a este tipo."),
        CLIC("[data-vsw]", "La validación se fija aquí, por tipo: activamos «Cuenta con validación» (a un periodista y a un deportista les tocan usos distintos)."),
        ESC('[data-vf$="|usos"]', "1", "Cada etiqueta elegida lleva su propio tope: «Desayuno» se puede usar 1 vez."),
        ELIGE('[data-vf$="|por"]', "dia", "En total o por día. Aquí, por día. Lo mismo se hace con «Almuerzo» y las demás etiquetas."),
        CLIC("[data-guardar]", "Creamos el tipo."),
        NOTA(".ish-perms .nwt-datatable", "El tipo de ejemplo ya está en la lista, con su categoría y sus permisos."),
        CLIC("[data-menu]", "Abrimos el menú de una fila."),
        NOTA(".ish-menu", "Editar, o inactivar: un tipo inactivo no se ofrece al crear usuarios externos ni al acreditar.")] },
    { id: "5", titulo: "Formularios de registro (CU-16 a CU-19)",
      falta: "Se crea un formulario de ejemplo con una pregunta; duplicar e inactivar se describen. Se borra al iniciar otro recorrido.",
      steps: [...ENTRAR, CLIC('.ish-nav [data-pantalla="formularios"]', "Abrimos «Formularios de registro» en Parametrización. Lo ven el gestor y el operador de acreditaciones."),
        NOTA(".ish-perms .nwt-datatable", "El catálogo con el número de preguntas, la última modificación (con quién la hizo) y el estado. Solo los formularios activos se ofrecen al crear un operador externo."),
        CLIC("[data-nuevo]", "«Nuevo formulario» abre una vista de página, no un modal: constructor a la izquierda y vista previa en vivo a la derecha."),
        ESC('[data-f="nombre"]', "Formulario de ejemplo", "Ponemos el nombre. La vista previa lo muestra al instante."),
        CLIC("[data-abrir-panel]", "«Agregar pregunta» despliega los tres tipos: respuesta abierta, selector y archivo."),
        CLIC('[data-addq="abierta"]', "Agregamos una respuesta abierta."),
        ESC('[data-q="0|texto"]', "Nombre completo", "Escribimos la pregunta. Cada una puede ser obligatoria u opcional, llevar subtítulo, reordenarse y colapsarse."),
        NOTA(".ish-prev", "La vista previa se puede expandir, ocultar y volver a abrir."),
        CLIC("[data-guardar]", "Creamos el formulario."),
        CLIC("[data-fc-ok]", "Sale un pop-up de confirmación: confirmamos."),
        NOTA(".ish-perms .nwt-datatable", "El formulario de ejemplo ya está en el catálogo, con quién lo modificó. Se puede editar, duplicar o inactivar.")] },
    { id: "6", titulo: "Usuarios del evento (CU-20 a CU-25)",
      falta: "Se crea un operador externo de ejemplo; el operador de acreditaciones y el validador se describen.",
      steps: [...ENTRAR, CLIC('.ish-nav [data-pantalla="usuarios"]', "La gestión de usuarios es de cada evento: está dentro del evento, en Parametrización. Abrimos «Usuarios»."),
        NOTA(".ish-perms .nwt-datatable", "Cada usuario tiene un rol (gestor, operador de acreditaciones, operador externo o validador), lo que puede hacer en este evento y su vigencia."),
        CLIC("[data-nuevo]", "«Nuevo usuario»: queda vinculado a este evento, sin elegirlo."),
        ESC('[data-f="nombre"]', "Valeria Ejemplo", "Paso 1: los datos de la persona."),
        ESC('[data-f="correo"]', "valeria.ejemplo@correo.com", "Aquí llegan las credenciales de acceso."),
        ESC('[data-f="desde"]', "2026-11-26", "Paso 1: las fechas de vigencia son opcionales. Esta es la de inicio."),
        ESC('[data-f="hasta"]', "2026-12-31", "Fecha de cierre, opcional: pasada, el acceso se vence; sin fecha, no vence."),
        CLIC("[data-siguiente]", "Pasamos al paso 2: rol y permisos."),
        ELIGE("[data-perfil-sel]", "externo", "Elegimos el rol: operador externo. El gestor crea todos los roles, incluido otro gestor; el operador de acreditaciones solo crea operadores externos."),
        { t: "select", sel: "[data-propio]", opcion: "Médico", body: "El operador externo es, él mismo, un tipo de acreditado: elegimos «Médico», el que acabamos de crear." },
        CLIC('[data-ms^="tp:"]', "Y los tipos que puede registrar."),
        { t: "click", sel: '[data-opt^="tp:"]', txt: "Médico", body: "Puede registrar médicos." },
        CLIC(".ish-modal__t", "Cerramos la lista."),
        { t: "select", sel: "[data-formulario]", opcion: "Formulario de ejemplo", body: "Su formulario de registro: el que armamos antes. Si no hubiera formularios activos, no dejaría continuar." },
        CLIC("[data-siguiente]", "Creamos el usuario."),
        CLIC('[data-key="aceptar"]', "Sale la confirmación: el usuario ya puede entrar con las credenciales que le llegan al correo. Aceptamos."),
        NOTA(".ish-perms .nwt-datatable", "El operador externo de ejemplo ya está en la lista. Inactivar quita el acceso; se revierte desde el menú o ampliando la fecha de cierre."),
        NOTA(".ish-perms .nwt-datatable", "Operador externo: lleva su tipo de acreditado, los tipos que registra y su formulario (obligatorio; si aún no hay formularios activos no deja continuar). Operador de acreditaciones: el tipo es opcional y puede crear operadores externos y formularios.")] },
    { id: "7", titulo: "Certificados de participación",
      falta: "Elegir plantilla y fechas pide abrir listas; aquí se ve la pantalla de configuración.",
      steps: [...ENTRAR, IR("/parametrization/certificates", "Abrimos «Certificados» en Parametrización."),
        { t: "note", sel: ".nws-certificates", body: "Acá se configura la plantilla y las fechas de entrega del certificado de participación para los acreditados." }] },
  ];
  // Un solo ejemplo corrido: cada recorrido repite, sin resaltar, lo que hicieron los anteriores y sigue desde ahí.
  const PROCESO = ["2", "3", "4", "5", "6", "7"];
  PROCESO.forEach((id, k) => {
    const c = window.CASOS.find((x) => x.id === id);
    if (k && c) c.steps.splice(ENTRAR.length, 0, { t: "prepara", ids: PROCESO.slice(0, k), body: "Preparamos lo que quedó de los recorridos anteriores para seguir con el mismo ejemplo." });
  });
})();
