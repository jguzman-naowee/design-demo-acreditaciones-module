# Casos de uso · Etapa 1: Parametrización

Borrador para revisar antes de pasarlo al panel «Casos» de la demo. Cubre lo que existe hoy en el menú **Parametrización** de un evento, más la entrada al módulo por rol.

**Actores**
- **Gestor de acreditaciones (GA):** ve todo. Es el único que configura catálogos.
- **Operador de acreditaciones (OA):** gestiona usuarios y formularios del evento.
- **Operador externo (OE):** no configura; usa el formulario y los tipos que se le asignaron.
- **Validador (VA):** no configura; entra directo a su evento.

**Convención:** cada caso tiene actor, precondición, flujo principal, alternos/errores y resultado. «Regla» marca una validación que la demo ya aplica.

---

## Bloque A · Entrada y roles

### CU-01 Entrar al módulo y elegir evento y fase
- **Actor:** GA (y OA con 2 o más eventos asignados).
- **Precondición:** el evento tiene acreditación configurada.
- **Flujo:** 1) ve la lista de eventos; 2) abre uno y ve sus fases; 3) entra a una fase; 4) el menú queda con las secciones de su rol.
- **Alterno:** cambiar de evento desde el selector del encabezado.
- **Regla:** todo lo que se muestra se lee por evento y fase.

### CU-02 Entrada directa según rol
- **Actor:** OE, VA y OA con un solo evento.
- **Flujo:** al iniciar sesión entran directo a su evento asignado, sin lista de eventos.
- **Alterno:** el OA con 2 o más eventos ve la lista y elige.
- **Resultado:** el menú solo muestra lo que su rol permite (GA: Parametrización, Entrega, Validaciones, Auditoría; OA: Usuarios, Formularios, Entrega, Validaciones; OE: Entrega; VA: Validaciones).

---

## Bloque B · Permisos de acceso

### CU-03 Consultar el catálogo de permisos (Zonas y Servicios)
- **Actor:** GA.
- **Flujo:** abre «Permisos de acceso»; alterna entre las pestañas **Zonas** y **Servicios** (cada una con su conteo); busca por nombre, indicativo o etiqueta; filtra por estado; pagina.
- **Alterno:** sin resultados, ve el estado vacío con «Limpiar búsqueda y filtros».
- **Regla:** la zona muestra su indicativo; el servicio muestra su ícono. Las sedes quedan fuera hasta validarlas.

### CU-04 Crear una zona
- **Actor:** GA.
- **Flujo:** «Agregar zona» → nombre, indicativo o número, descripción (opcional), etiquetas (opcional), validación → «Crear».
- **Reglas:** nombre e indicativo obligatorios; el indicativo no puede repetirse; el nombre no puede repetirse (sin distinguir tildes ni mayúsculas); la zona no lleva ícono.
- **Errores:** cada campo muestra su aviso debajo y no deja crear.

### CU-05 Crear un servicio
- **Actor:** GA.
- **Flujo:** «Agregar servicio» → nombre, ícono (archivo de imagen), descripción, etiquetas, validación → «Crear».
- **Reglas:** nombre e **ícono obligatorios**; no lleva indicativo.

### CU-06 Etiquetas de un permiso
- **Actor:** GA.
- **Flujo:** en el formulario, agrega etiquetas (ej. alimentación: desayuno, almuerzo, cena).
- **Regla (reunión del 26-nov):** el permiso **ya no lleva validación**. Cuántas veces se usa se define por tipo de acreditado (CU-14): los periodistas reciben una merienda y los deportistas todas las comidas.

### CU-07 Editar, inactivar y activar un permiso
- **Actor:** GA.
- **Flujo:** menú ⋮ de la fila → Editar (mismo formulario, datos cargados) o Inactivar/Activar.
- **Resultado:** aviso de confirmación; un permiso inactivo deja de ofrecerse al configurar tipos y usuarios.

---

## Bloque C · Categorías

### CU-08 Consultar categorías
- **Actor:** GA.
- **Flujo:** abre «Categorías»; ve siglas con su color, nombre, cuántos tipos la usan y estado; busca y filtra.

### CU-09 Crear una categoría
- **Actor:** GA.
- **Flujo:** «Agregar categoría» → nombre → las siglas se sugieren con la inicial de cada palabra (se omiten conectores) y se pueden editar → color → vista previa de la franja → «Crear categoría».
- **Color:** se escribe por nombre (azul, fucsia…), por código hex, o con la barra del círculo cromatico; el nombre y el hex se mantienen sincronizados.
- **Reglas:** nombre y siglas obligatorios; siglas únicas; un color que no reconoce avisa. Si se borran las siglas, vuelve a sugerir.

### CU-10 Editar o inactivar una categoría
- **Actor:** GA.
- **Reglas:** al cambiar las siglas, se actualizan los tipos que la usan; una categoría inactiva no se puede elegir en tipos nuevos.

---

## Bloque D · Tipos de acreditados

### CU-11 Consultar tipos por padre
- **Actor:** GA.
- **Flujo:** abre «Tipos de acreditados»; ve tipo, tipo de personal (padre), categoría, número de permisos (y cuántos con validación) y estado. Los tres padres son **Personal de la delegación**, **Personal del evento** y **Personal Naowee**.

### CU-12 Configurar un tipo de la delegación (viene de inscripción)
- **Actor:** GA.
- **Precondición:** el tipo llega de inscripción con estado «Por configurar».
- **Flujo:** Editar → elige categoría y permisos con su validación → guardar.
- **Resultado:** deja de estar «Por configurar» y queda activo. Estos tipos no se crean aquí, solo se editan.

### CU-13 Crear tipos de Personal del evento o Personal Naowee
- **Actor:** GA.
- **Flujo:** «Nuevo tipo de acreditado» (queda como Personal del evento) → **nombre del tipo de acreditado** (campo abierto) → categoría → permisos (con su validación, CU-14) → «Crear».
- **Reglas:** nombre, **categoría** y al menos un **permiso** son obligatorios; no se repiten nombres existentes.

### CU-14 Validación por tipo de acreditado
- **Actor:** GA.
- **Flujo:** al elegir los permisos del tipo aparece un bloque por permiso: elige las **etiquetas** que le aplican a ese tipo (vienen todas marcadas) → «Cuenta con validación» → un tope por etiqueta elegida (usos en total o por día, y vigencia desde–hasta). Un permiso sin etiquetas lleva un único tope.
- **Reglas:** no hay tope general; solo las etiquetas elegidas llevan validación; sin validación activa, el acceso es libre. Se guarda por permiso y por tipo (la tabla muestra cuántos permisos llevan validación).
- **Se quitó** la fecha límite de acceso del tipo: se resuelve con la vigencia de la validación.

### CU-15 Inactivar y activar un tipo
- **Actor:** GA.
- **Resultado:** un tipo inactivo no se ofrece al crear usuarios externos ni al acreditar.

---

## Bloque E · Formularios de registro

### CU-16 Consultar el catálogo de formularios
- **Actor:** GA, OA.
- **Flujo:** abre «Formularios de registro»; ve nombre, número de preguntas, **última modificación con quién la hizo** y estado.

### CU-17 Crear un formulario
- **Actor:** GA, OA.
- **Flujo:** «Nuevo formulario» abre una vista de página: constructor a la izquierda, vista previa en vivo a la derecha → nombre y descripción → «Agregar pregunta» → «Crear» → confirma en el pop-up → aviso de éxito.
- **Reglas:** nombre obligatorio; al menos una pregunta; cada pregunta con su texto.

### CU-18 Armar las preguntas
- **Actor:** GA, OA.
- **Tipos:** respuesta abierta (formato texto, número, etc.), selector (con opciones) y archivo (PDF, JPG o PNG; tamaño máximo).
- **Flujo por pregunta:** texto, subtítulo opcional, obligatoria/opcional, reordenar, colapsar a una fila, eliminar.
- **Vista previa:** se puede expandir (oculta el constructor) o esconder (queda una pestaña para reabrirla).

### CU-19 Editar, duplicar e inactivar un formulario
- **Actor:** GA, OA.
- **Reglas:** editar vuelve a pedir confirmación; duplicar crea una copia; solo los formularios **activos** se ofrecen al crear un operador externo.
- **Error:** si falla el guardado, aviso negativo y se queda en el editor.

---

## Bloque F · Usuarios del evento

### CU-20 Consultar usuarios del evento
- **Actor:** GA, OA.
- **Flujo:** dentro del evento, abre «Usuarios»; ve rol, qué puede hacer, vigencia y estado; busca y filtra. El OA ve lo que su rol le permite.

### CU-21 Crear un usuario (2 pasos)
- **Actor:** GA, OA.
- **Paso 1:** datos de la persona; las fechas de inicio y cierre son **opcionales** (sin cierre, el acceso no vence). **Paso 2:** rol y permisos.
- **Reglas:** el usuario queda vinculado al evento actual, sin elegirlo; se debe marcar **al menos un permiso**; los permisos por defecto de cada rol vienen marcados y los que se desmarcan se quitan de verdad; cada campo con error muestra su aviso.
- **Matriz de permisos (GA y OA):** grupos Entrega, Usuarios y formularios, y **Validaciones** (fila «Validadores»). Ambos roles ven la cuadrícula completa; lo que el OA no trae de fábrica sale desmarcado y se puede marcar. Al marcar **Crear** en «Validadores» aparece «Qué pueden validar los validadores que cree», con los permisos del catálogo.
- **Quién crea a quién:** GA crea todos los roles, incluido otro gestor; OA crea operadores externos y lo que su rol permita.

### CU-22 Crear un operador externo
- **Actor:** GA, OA.
- **Flujo:** rol «Operador externo» → su **tipo de acreditado propio** → **tipos que puede registrar** (selector múltiple) → **formulario** → permisos por defecto (registrar, revisar, rechazar/aprobar, mandar a acreditar, crear enlace de registro masivo).
- **Reglas:** el formulario es obligatorio y solo salen los activos; si aún no hay formularios, no deja continuar y avisa que primero hay que crear uno. Los tipos creados en «Tipos de acreditados» aparecen aquí.

### CU-23 Crear un operador de acreditaciones
- **Actor:** GA.
- **Regla:** el tipo de acreditado es **opcional**; puede recibir permisos para crear operadores externos y formularios.

### CU-24 Crear un validador
- **Actor:** GA, OA.
- **Flujo:** rol «Validador» con sus permisos; entra directo al evento asignado.

### CU-25 Editar, inactivar y reactivar un usuario
- **Actor:** GA, OA.
- **Reglas:** inactivar quita el acceso; se revierte desde el menú o ampliando la fecha de cierre.

---

## Cobertura y orden propuesto en el panel «Casos»

| Recorrido en el panel «Casos» | Cubre |
|---|---|
| 1 Entrar al módulo y roles | CU-01, CU-02 |
| 2 Permisos de acceso | CU-03 a CU-07 |
| 3 Categorías | CU-08 a CU-10 |
| 4 Tipos de acreditados | CU-11 a CU-15 |
| 5 Formularios de registro | CU-16 a CU-19 |
| 6 Usuarios del evento | CU-20 a CU-25 |
| 7 Certificados de participación | Configuración en Parametrización |

**Un solo ejemplo corrido.** Los recorridos 2 a 7 siguen el mismo hilo: zona y servicio de ejemplo → categoría «Federación Deportiva Ejemplo» (FDE) → tipo «Médico» con su validación → formulario de ejemplo → operador externo «Valeria Ejemplo». Cada recorrido repite sin resaltar lo que hicieron los anteriores; todos arrancan con los datos reiniciados. Entrega, lotes y auditoría quedan para la siguiente etapa.

El panel pulsa, resalta y también escribe, elige y adjunta archivos.

## Fuera de esta etapa
Validación por tipo de acreditado, sedes de los permisos, pantallas reales de «Escanear y validar» y «Mis validaciones», y uso real del enlace público del formulario.

## Preguntas para ti
1. ¿Reviso alguna regla de las que escribí? Las dedujimos de lo construido, no de documento de Danna.
2. ¿Implementamos como recorridos del panel «Casos» (uno por bloque), o prefieres además un documento para entregar?
