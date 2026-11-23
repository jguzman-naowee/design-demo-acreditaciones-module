/* Pasos: goto (url relativa al micro), click (sel), note (sel). El marco solo pulsa y resalta: nada de teclear.
   Los selectores son clases del propio micro; scripts/verificar.mjs comprueba que sigan existiendo. */
(() => {
  const MENU = (ruta) => `.ish-nav [data-go="${ruta}"]`;
  // Todo el módulo depende del evento: cada caso lo elige igual que un usuario nuevo.
  const ENTRAR = [
    { t: "goto", url: "/?reset=1", body: "Empezamos como un usuario que entra por primera vez al módulo." },
    { t: "note", sel: ".nws-event-entry__card", body: "Solo salen los eventos con acreditación configurada. Todo lo demás se lee por evento." },
    { t: "click", sel: ".nws-event-entry__toggle", body: "Abrimos el primer evento para ver sus fases." },
    { t: "click", sel: ".nws-event-entry__phase-list button", body: "Entramos a la primera fase: desde acá el módulo trabaja con ese evento y esa fase." }
  ];
  const IR = (ruta, texto) => ({ t: "click", sel: MENU(ruta), body: texto });

  window.CASOS = [
    { id: "1", titulo: "Entrar al módulo: elegir evento y fase",
      falta: "El buscador de eventos necesita teclear; en la demo se elige de la lista.",
      steps: [...ENTRAR, { t: "note", sel: ".ish-nav", body: "Con el evento elegido, el menú del módulo queda a la mano." }] },
    { id: "2", titulo: "Permisos de acceso",
      falta: "Crear un permiso pide escribir su nombre y subir un ícono; aquí solo se recorre la lista.",
      steps: [...ENTRAR, IR("/parametrization/access-permissions", "Abrimos «Permisos de acceso» en Parametrización."),
        { t: "note", sel: ".nwt-datatable", body: "Los permisos que un carnet puede dar: zonas, escenarios, servicios." }] },
    { id: "3", titulo: "Tipos de acreditados",
      falta: "Crear o editar un tipo pide escribir; aquí se ve la lista con los permisos y sus topes de uso.",
      steps: [...ENTRAR, IR("/parametrization/accredited-types", "Abrimos «Tipos de acreditados»."),
        { t: "note", sel: ".nwt-datatable", body: "Cada tipo reúne permisos; el tope de usos se define por permiso y se ve entre paréntesis." }] },
    { id: "4", titulo: "Gestión de acreditables",
      falta: "Emitir pide elegir el tipo de cada persona en un modal; aquí se llega hasta la selección.",
      steps: [...ENTRAR, IR("/delivery/enabled", "Abrimos «Gestión de acreditables» en Entrega."),
        { t: "note", sel: ".nws-enabled-list__scope", body: "Quién puede acreditarse en esta fase y quién no." },
        { t: "note", sel: ".nws-enabled-list .nwt-datatable__record", body: "Una fila por persona, con lo que le falta si no puede acreditarse." },
        { t: "note", sel: ".nws-delivery__actions", body: "«Acreditar» emite en una sola llamada, cada persona con su tipo." }] },
    { id: "5", titulo: "Lista de acreditados",
      falta: "Los filtros y la búsqueda piden teclear o abrir listas; aquí se ve la tabla y el menú de una fila.",
      steps: [...ENTRAR, IR("/delivery/accredited", "Abrimos «Lista de acreditados»."),
        { t: "note", sel: ".nws-accredited-list__catalog .nwt-datatable__record", body: "Una fila por persona con carnet, con su lote y su estado: activa, entregada o inactiva." },
        { t: "click", sel: ".nws-accredited-list__catalog .nws-row-actions-menu__trigger", body: "Abrimos el menú de la primera fila." },
        { t: "note", sel: ".nws-row-actions-menu__item", body: "Desde acá se entrega, se revierte o se inactiva el carnet." }] },
    { id: "6", titulo: "Lotes de carnets",
      falta: "Generar un lote y abrir su PDF no se recorre aquí.",
      steps: [...ENTRAR, IR("/delivery/card-batches", "Abrimos «Lotes de carnets»."),
        { t: "note", sel: ".nws-card-batches__catalog", body: "Los lotes de PDF ya generados, numerados, con su estado y su fecha." }] },
    { id: "7", titulo: "Certificados de participación",
      falta: "Elegir plantilla y fechas, y generar los certificados, piden teclear o abrir listas.",
      steps: [...ENTRAR, IR("/parametrization/certificates", "Abrimos «Certificados» en Parametrización."),
        { t: "note", sel: ".nws-certificates", body: "Acá se configura la plantilla y las fechas de entrega del certificado." },
        IR("/delivery/certificates", "Pasamos a «Certificados» en Entrega."),
        { t: "note", sel: ".nws-certificates", body: "Acá se entregan, por lote." }] },
    { id: "8", titulo: "Auditoría del evento",
      falta: "Descargar el reporte pide elegir columnas en un modal; aquí se ve el listado.",
      steps: [...ENTRAR, IR("/audit", "Abrimos «Auditoría del evento»."),
        { t: "note", sel: ".nws-audit__card", body: "Las lecturas del evento, con la persona y el motivo cuando se deniega un acceso." }] }
  ];
})();
