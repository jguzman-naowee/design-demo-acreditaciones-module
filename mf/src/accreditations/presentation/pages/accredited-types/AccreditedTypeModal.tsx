import {
  AccessPermissionCatalogRepository,
  type AccreditedTypePermissionPayload,
  RoleCatalogRepository
} from '@mf-accreditations/data';
import type {
  AccreditedType,
  RoleCatalogFamily
} from '@mf-accreditations/domain';
import {
  NwsModal,
  REQUIRED_FIELD_MESSAGE
} from '@mf-accreditations/presentation';
import { usePaginationRepository } from '@naowee-tech/sdk-frontend-react';
import type { NwtDropdownOption } from '@naowee-tech/sdk-react-components';
import {
  NwtButton,
  NwtButtonDropdown,
  NwtDateField,
  NwtDropdown,
  NwtIcon,
  NwtTextField
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import {
  useFormControl,
  useFormGroup,
  useInputControl
} from '@rolster/react-forms';
import { required } from '@rolster/validators/helpers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// El catálogo completo, no la instancia de la pantalla de permisos: esa lleva el
// filtro del buscador y dejaría el modal ofreciendo un subconjunto.
const accessPermissionRepository = invertly(AccessPermissionCatalogRepository);

const roleCatalogRepository = invertly(RoleCatalogRepository);

// El catálogo del EVENTO, no la instancia de la pantalla: esa lleva el filtro del buscador
// —el servidor recorta por `search`— y con un texto puesto la lista llega incompleta.

// `/catalogs/EVENT_ROLE` devuelve 30, y backend los comparó contra la tabla real de orc
// (`mission_staff_role`) el 2026-09-09: son los 28 de misión MÁS estos dos, que no lo son.

export interface AccreditedTypeForm {
  // La fecha límite de acceso del rol; sin ella el rol no caduca.
  accessDeadline?: Date;
  // La CATEGORÍA, que la pantalla no pregunta: se DERIVA de la función elegida. El backend
  // exige la pareja completa —`platform_subrole` sin `platform_role` responde 400
  // «platform_subrole exige platform_role: indique la categoría»— así que las dos van juntas
  // o no va ninguna.
  platformRole?: string;
  // La FUNCIÓN: ENT, DAS, ADI, FISIOTERAPEUTA, JEFE_MISION… Opcional: un tipo sin función es
  // el tipo POR DEFECTO de su categoría.
  platformSubrole?: string;
  permissions: AccreditedTypePermissionPayload[];
  /**
   * El código del catálogo, que ahora es REAL y no derivado del nombre. Antes se sacaba del
   * nombre en español con toRoleCode() —«Deportista» → DEPORTISTA— y por eso no casaba con
   * el ATHLETE que manda la plataforma.
   */
  roleCode: string;
  // Nombre de cada permiso elegido, para que la fila recién creada no muestre
  // ids mientras el camino de demo no tiene un 201 de verdad.
  permissionNames: Record<number, string>;
  roleName: string;
}

interface AccreditedTypeFormProps {
  // Con tipo es edición; sin él, alta.
  accreditedType?: AccreditedType;
  // El evento: las funciones de misión son SUYAS, no un catálogo global.
  eventId: number;
  onSubmit: (form: AccreditedTypeForm) => void;
  working: boolean;
}

// Las tres funciones del personal de apoyo son un diccionario plano; las de misión traen
// además de qué categoría son y si ya están ocupadas. Se unifican acá para que el
// desplegable no tenga que saber de cuál de los dos salió cada una.
interface FuncionElegible {
  code: string;
  name: string;
  platformRole: string;
  configured: boolean;
  // El tipo que ya la ocupa, para poder decirlo en la etiqueta en vez de deshabilitar a secas.
  roleCode?: string;
}

function AccreditedTypeFormBody({
  accreditedType,
  eventId,
  onSubmit,
  working
}: AccreditedTypeFormProps) {
  const permissionsController = usePaginationRepository(
    accessPermissionRepository
  );

  // El NwtButtonDropdown solo maneja valores string, así que los ids de permiso
  // viajan como texto y se vuelven número al armar el payload.
  const [permissionIds, setPermissionIds] = useState<string[]>(
    accreditedType?.permissions.map((permission) =>
      String(permission.permissionId)
    ) ?? []
  );

  // Los usos de CADA permiso, por su id. Es lo que el contrato pide de verdad
  // —`AccreditedTypePermissionPayload` es `{permission_id, max_uses_per_person}`— y lo que
  // hasta ahora colapsábamos en un solo número para todos.
  //
  // Se siembra con lo que el tipo ya tenía guardado: al editar, cada permiso abre con su
  // número, no en blanco.
  const [usos, setUsos] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(
      (accreditedType?.permissions ?? []).map((permission) => [
        String(permission.permissionId),
        permission.maxUsesPerPerson ?? undefined
      ])
    )
  );

  const onUsosChange = useCallback((permissionId: string, valor: string) => {
    const numero = Number(valor);

    setUsos((actual) => ({
      ...actual,
      [permissionId]: valor.trim() && numero > 0 ? numero : undefined
    }));
  }, []);

  const formGroup = useFormGroup({
    // En edición el tipo no se toca: el `role_code` se deriva del nombre y es la
    // identidad con la que viajan las acreditaciones ya emitidas.
    type: useFormControl<string | undefined>(
      accreditedType?.typeName,
      accreditedType ? [] : [required]
    ),
    accessDeadline: useInputControl<Date | undefined>(
      accreditedType?.accessDeadline ?? undefined
    ),
    // Sin validador: la función es OPCIONAL. Un tipo sin ella es el tipo por defecto de su
    // categoría, que es como están hoy los 15 que hay en staging.
    subrole: useFormControl<string | undefined>(accreditedType?.platformSubrole)
  });

  const { controls } = formGroup;

  // Arriba, SOLO las cuatro categorías de la plataforma. Nada más.
  //
  // Antes esta lista traía además los 30 roles de `/catalogs/event-role` —Voluntario,
  // Alcalde, Médico, Juez Nacional…— y los tres oficios del personal de apoyo, todo revuelto:
  // el desplegable ofrecía «Deportista, Delegado, Personal de apoyo, Personal de misión,
  // Voluntario, Alcalde…», o sea CATEGORÍAS y ROLES al mismo nivel, como si fueran lo mismo.
  // Andrés lo vio sobre el evento 2408.
  //
  // Y no era solo feo: esos 30 roles SON funciones. Backend lo puso negro sobre blanco el
  // 2026-09-09 —la tabla `mission_staff_role` de orc trae VOLUNTEER, MAYOR, SPECIAL_GUEST,
  // LOGISTICS_COORDINATOR, PER…, los mismos— y su sitio es el campo «Función», colgando de
  // «Personal de misión». Arriba se elige de QUIÉN es el tipo; abajo, QUÉ hace.
  //
  // Y ya no se escriben acá: las da `role-catalog`, que además dice qué funciones cuelgan de
  // cada una. Cada familia que backend publique sale sola.
  const [familias, setFamilias] = useState<RoleCatalogFamily[]>([]);

  const catalogo = familias;

  // ── Las funciones ────────────────────────────────────────────────────────────
  // Dos orígenes, y no uno: las del personal de apoyo son un DICCIONARIO (tres, iguales para
  // todos los eventos) y las de misión son POR EVENTO, porque salen de quién esté inscrito en
  // orc. El endpoint de misión, además, dice cuáles están ya configuradas.
  //
  // Cada uno con SU catch, por lo mismo que el catálogo de tipos: que falle el de misión
  // —que hoy devuelve [] en casi todos los eventos— no puede llevarse por delante las tres
  // del apoyo, que son las que se usan de verdad.
  // El CATÁLOGO de funciones de misión (30 de `/catalogs/EVENT_ROLE`) y, aparte, cuáles de
  // ellas ya están configuradas en este evento.

  // Los tipos que el evento YA tiene, para saber qué funciones están ocupadas: ofrecer una
  // que ya tiene dueño lleva derecho al 409 «La función 'ENT' de 'SUPPORT_PERSONNEL' ya está
  // asignada al tipo 'DOCENTE_ENTRENADOR'».
  //
  // Se piden ACÁ y no llegan por prop desde la pantalla, aunque ella ya los tenga: su lista
  // sale de un controlador que el servidor RECORTA por el texto del buscador. Con «Deportista»
  // escrito, «Docente/Entrenador» no venía, su función ENT se veía libre, se ofrecía, y al
  // guardar salía el 409 que este campo existe para evitar. Lo cazó Juan Ma en la revisión.

  // UNA sola fuente: la taxonomía del evento. Antes eran cuatro peticiones y el cruce entre
  // ellas —de qué familia cuelga cada función, cuál está ocupada— se hacía acá a mano.
  useEffect(() => {
    let vivo = true;

    roleCatalogRepository
      .requestFamilies(eventId)
      .then((lista: RoleCatalogFamily[]) => {
        if (vivo) {
          setFamilias(lista);
        }
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, [eventId]);

  // La CATEGORÍA elegida arriba, validada contra las familias que dio el servidor: así un
  // valor viejo de un tipo ya creado no se cuela si esa familia dejó de existir.
  const categoria = useMemo<string | undefined>(() => {
    const elegido = accreditedType?.platformRole ?? controls.type.value;

    return familias.some((familia) => familia.code === elegido)
      ? elegido
      : undefined;
  }, [accreditedType, controls.type.value, familias]);

  // Las funciones de la familia elegida, con su dueño si lo tiene. El anidamiento lo da el
  // servidor: ya no hay que saber acá de qué familia cuelga cada una.
  const funciones = useMemo<FuncionElegible[]>(
    () =>
      (familias.find((familia) => familia.code === categoria)?.functions ?? []).map(
        (funcion) => ({
          code: funcion.code,
          name: funcion.name,
          platformRole: categoria ?? '',
          configured: funcion.configured,
          roleCode: funcion.configuredType?.roleCode
        })
      ),
    [familias, categoria]
  );

  // Cómo se llama la categoría que el tipo YA tiene, para enseñarla al editar. Sale de la
  // misma lista que el desplegable del alta, así que dice exactamente lo mismo.
  // Con `familias` en las dependencias: el catálogo llega por red y sin ella el rótulo se
  // quedaba con el del primer render, o sea el código crudo.
  const categoriaDelTipo = useMemo(
    () =>
      accreditedType?.platformRole
        ? (familias.find((uno) => uno.code === accreditedType.platformRole)
            ?.name ?? accreditedType.platformRole)
        : '',
    [accreditedType, familias]
  );


  // Las funciones DE ESA CATEGORÍA: elegir «Personal de apoyo» arriba deja abajo sus tres
  // oficios, y «Personal de misión» los suyos. Antes salían todas mezcladas, así que se podía
  // armar un «Deportista con función Fisioterapeuta» que el backend rechaza.
  //
  // Se quitan las ocupadas —ofrecerlas lleva derecho al 409— menos la que este tipo YA tiene:
  // sin esa excepción, al editar un tipo su propia función desaparecería y guardar la
  // borraría.
  const functionOptions = useMemo<NwtDropdownOption<string>[]>(
    () =>
      funciones
        .filter((funcion) => funcion.platformRole === categoria)
        .filter(
          (funcion) =>
            !funcion.configured ||
            funcion.code === accreditedType?.platformSubrole
        )
        .map((funcion) => ({
          key: funcion.code,
          label: funcion.name,
          value: funcion.code
        })),
    [funciones, categoria, accreditedType]
  );

  // Cambiar la categoría de arriba tiene que soltar la función de abajo: si no, quedaría
  // pegada una función de la categoría anterior —«Deportista» con «Docente/Entrenador»— que
  // el desplegable ya no muestra y que el backend rechazaría al guardar.
  //
  // Se compara contra el valor ANTERIOR y no se limpia a secas, porque este efecto también
  // corre al montar y en edición borraría la función que el tipo ya tenía.
  const categoriaPrevia = useRef(controls.type.value);

  useEffect(() => {
    if (categoriaPrevia.current !== controls.type.value) {
      categoriaPrevia.current = controls.type.value;
      controls.subrole.setValue(undefined);
    }
  }, [controls.type.value, controls.subrole]);

  // El valor del desplegable es el CÓDIGO; la etiqueta, el nombre.
  const typeOptions = useMemo<NwtDropdownOption<string>[]>(
    () =>
      catalogo.map((rol) => ({
        key: rol.code,
        label: rol.name,
        value: rol.code
      })),
    [catalogo]
  );

  const permissions = useMemo(
    () =>
      permissionsController.state.is('success')
        ? permissionsController.state.entities
        : [],
    [permissionsController.state]
  );

  // Un permiso inactivo no se puede asignar (409 del backend), así que no se
  // ofrece. Los que el rol YA tiene se quedan aunque estén inactivos: son una
  // asignación existente, y esconderlos los borraría al guardar, porque el PUT
  // reemplaza la lista completa.
  const permissionOptions = useMemo(
    () =>
      permissions
        .filter(
          (permission) =>
            permission.isActive || permissionIds.includes(String(permission.id))
        )
        .map((permission) => ({
          label: permission.isActive
            ? permission.name
            : `${permission.name} (inactivo)`,
          value: String(permission.id)
        })),
    [permissions, permissionIds]
  );

  // Qué permisos llevan tope de usos. Se mira en el catálogo Y en los que el tipo ya tenía:
  // el catálogo llega por red, y hasta que llega no se sabría que un permiso lleva tope. Sin
  // los del propio tipo, al abrir la edición el campo del límite se veía vacío un instante y
  // el efecto de abajo borraba el valor guardado —medido: un tipo con tope 20 abría en blanco—.
  const idsConTope = useMemo(() => {
    const ids = new Set<string>();

    permissions
      .filter((permission) => permission.hasLimit)
      .forEach((permission) => ids.add(String(permission.id)));

    (accreditedType?.permissions ?? [])
      .filter((permission) => permission.hasLimit)
      .forEach((permission) => ids.add(String(permission.permissionId)));

    return ids;
  }, [permissions, accreditedType]);

  // El backend exige `max_uses_per_person` cuando el permiso declara `has_limit`: sin número
  // responde 400. Así que un permiso con tope elegido y sin usos no deja guardar, y se dice
  // en su propia fila en lugar de en un aviso suelto al pie.
  const faltanUsos = useMemo(
    () =>
      permissionIds.filter(
        (permissionId) => idsConTope.has(permissionId) && !usos[permissionId]
      ),
    [permissionIds, idsConTope, usos]
  );

  const onRemovePermission = useCallback((permissionId: string) => {
    setPermissionIds((current) =>
      current.filter((value) => value !== permissionId)
    );
  }, []);

  // Mover un permiso arriba o abajo. La posición ES el `order` que se manda, así que esto es
  // lo único que hay para elegirlo.
  //
  // Hace falta de verdad y no es un adorno: el desplegable del SDK AÑADE AL FINAL al marcar,
  // así que desmarcar un permiso y volver a marcarlo lo manda al último puesto. Antes daba
  // igual; desde SUV2-2330 ese orden es el que el carnet imprime, y sin las flechas la única
  // forma de arreglarlo sería rehacer la selección entera.
  const onMovePermission = useCallback((desde: number, hacia: number) => {
    setPermissionIds((current) => {
      if (hacia < 0 || hacia >= current.length) {
        return current;
      }

      const movidos = [...current];

      [movidos[desde], movidos[hacia]] = [movidos[hacia], movidos[desde]];

      return movidos;
    });
  }, []);

  const onConfirm = useCallback(() => {
    // Al crear, el desplegable da el CÓDIGO del catálogo y de ahí sale el nombre. Al
    // editar, ninguno de los dos se toca: son los que llevan las acreditaciones ya emitidas.
    const elegido = catalogo.find((rol) => rol.code === controls.type.value);
    const type = elegido?.name ?? accreditedType?.typeName;
    const code = elegido?.code ?? accreditedType?.roleCode;

    if (
      formGroup.invalid ||
      !type ||
      !code ||
      permissionIds.length === 0 ||
      faltanUsos.length
    ) {
      return;
    }

    // Con función elegida, el nombre y el código del tipo salen de ELLA y no de la categoría.
    // Si salieran de la categoría, los dos tipos de apoyo de un evento se llamarían los dos
    // «Personal de apoyo» y compartirían `role_code`, que es único por evento: el segundo no
    // se podría crear. Y en la tabla no habría forma de distinguirlos.
    //
    // Backend lo confirmó: mandando `role_code: "ENT"` al acreditar, el ms resuelve solo el
    // tipo que tiene esa función. Lo mismo para las de misión con «JMI».
    const funcion = funciones.find(
      (item) => item.code === controls.subrole.value
    );

    onSubmit({
      roleName: funcion?.name ?? type,
      roleCode: funcion?.code ?? code,
      // La categoría es la de arriba. Van las dos o ninguna: `platform_subrole` sin
      // `platform_role` responde 400 «indique la categoría».
      //
      // Sin función también se manda, y es lo correcto: ese es el tipo POR DEFECTO de la
      // categoría, el que atrapa a quien no tenga función. Repetirlo da 409, que también es
      // lo correcto: un evento no puede tener dos tipos por defecto de lo mismo.
      ...(categoria
        ? {
            platformRole: categoria,
            ...(funcion ? { platformSubrole: funcion.code } : {})
          }
        : {}),
      accessDeadline: controls.accessDeadline.value,
      permissionNames: Object.fromEntries(
        permissions.map((permission) => [permission.id, permission.name])
      ),
      // Cada permiso con SU número, que es como el backend lo guarda. Los que no declaran
      // tope van sin él: el backend los descarta igual.
      //
      // Ojo: el `null` no llega al servidor. normalizeJson de @rolster/commons
      // (que usa liomaze antes de enviar) descarta las claves sin valor, así que
      // max_uses_per_person viaja AUSENTE. Para este contrato es lo mismo —el
      // campo es opcional y con has_limit:false el backend lo descarta— pero
      // significa que este cliente no puede mandar un null explícito si algún
      // día hace falta para limpiar un campo.
      //
      // Y `order` es la POSICIÓN EN LA LISTA, que es exactamente la que el usuario ve y
      // mueve con las flechas. Empieza en 1 y no en 0 por el mismo normalizeJson de arriba:
      // un `order: 0` viajaría ausente y daría el 400 justo en el primer permiso.
      //
      // Se numera 1..N consecutivo. El contrato admite huecos —el backend no recompacta—,
      // pero acá la lista completa se manda entera en cada guardado, así que un hueco no
      // significaría nada y cerrarlo es más predecible.
      permissions: permissionIds.map((permissionId, posicion) => ({
        permission_id: Number(permissionId),
        max_uses_per_person: idsConTope.has(permissionId)
          ? (usos[permissionId] ?? null)
          : null,
        order: posicion + 1
      }))
    });
  }, [
    accreditedType,
    catalogo,
    categoria,
    funciones,
    formGroup,
    controls,
    permissionIds,
    permissions,
    idsConTope,
    usos,
    faltanUsos,
    onSubmit
  ]);

  return (
    <div className="nws-accredited-type-modal__body">
      <div className="naotech-grid naotech-grid--4">
        <div className="naotech-col--4">
          {accreditedType ? (
            // El nombre y su código no se editan: el código es lo que llevan las
            // acreditaciones ya emitidas, y renombrar el rol las dejaría
            // apuntando a uno que no existe.
            //
            // Y lo que enseña es la CATEGORÍA —«Personal de apoyo»—, que es lo MISMO que
            // ofrece el desplegable al que sustituye en el alta. Enseñar acá el nombre del
            // tipo repetía la función palabra por palabra: el tipo se llama igual que ella
            // —convención de backend, `role_code` = el código de orc—, así que
            // «Docente/Entrenador» salía en este campo Y en «Función», y se leía como si una
            // se hubiera colado en la otra. Lo reportó QA dos veces; la primera le puse la
            // categoría debajo del nombre y no bastó, porque el valor seguía estando repetido
            // arriba. El nombre del tipo no se pierde: lo lleva el título del modal.
            //
            // Sin categoría —los tipos creados antes de que backend la guardara— se cae al
            // nombre, que es lo único que hay para identificar la fila.
            <div className="nws-accredited-type-modal__fixed">
              <span className="nwt-input-box__label nws-accredited-type-modal__label">
                Tipo de acreditado
              </span>

              <span className="nwt-text-font-medium">
                {categoriaDelTipo || accreditedType.typeName}
              </span>
            </div>
          ) : (
            <NwtDropdown
              formControl={controls.type}
              label="Selecciona el tipo de acreditado"
              placeholder="Ej: Personal de apoyo"
              options={typeOptions}
              required={true}
              message={
                controls.type.wrong ? REQUIRED_FIELD_MESSAGE : undefined
              }
            />
          )}
        </div>

        {/* La FUNCIÓN, y NO la categoría.
            ─────────────────────────────────────────────────────────────────────────────
            Acá hubo un campo «¿Deportista o personal de apoyo?» —el `platform_role`— que se
            quitó el 2026-09-08 por un bloqueo medido: el backend no admitía dos tipos con el
            mismo `platform_role` en un evento y solo había dos valores, así que con
            «Deportista» y «Delegado» creados las dos opciones salían deshabilitadas y «Crear»
            quedaba apagado PARA SIEMPRE.

            Ese bloqueo ya no existe: desde SUV2-2228 la unicidad es de la PAREJA (categoría,
            función), y repetirla responde 409 con un mensaje legible —«La función 'ENT' de
            'SUPPORT_PERSONNEL' ya está asignada al tipo 'DOCENTE_ENTRENADOR' en el evento
            26»— en vez de dejar la pantalla sin salida. Verificado por backend en staging el
            2026-09-09.

            Vuelve UN campo, no dos: por decisión de Andrés se pregunta solo la función y la
            categoría se DERIVA de ella. El precio, sabido y aceptado: la fila SIN función es
            el tipo por defecto de su categoría, y sin campo de categoría no se puede declarar
            cuál es —los tipos por defecto siguen dependiendo de que su `role_code` coincida
            con el rol de plataforma, que es la coincidencia de nombres de siempre—.

            Es opcional a propósito: los 15 tipos que hay hoy en staging no tienen ninguna. */}
        <div className="naotech-col--4">
          <NwtDropdown
            formControl={controls.subrole}
            label="Función"
            placeholder={
              !categoria
                ? 'Primero elige una categoría arriba'
                : functionOptions.length
                  ? 'Opcional · sin función vale para toda la categoría'
                  : 'Esta categoría no tiene funciones libres'
            }
            options={functionOptions}
            disabled={!functionOptions.length}
          />

          {/* Se dice lo que el campo HACE, porque «Función» a secas no lo explica: es lo que
              permite que el evento tenga «Docente/Entrenador» y «Docente/Asistente» como
              tipos distintos en vez de un único «Personal de apoyo» para los dos. */}
          <small className="nwt-smalltext-font-regular">
            Con función, este tipo se usará solo para quienes la tengan. Sin
            ella, para toda su categoría.
          </small>
        </div>
        <div className="naotech-col--4">
          {/* La clase del SDK, no una tipografía propia: es el mismo rótulo que pinta
              NwtDropdown para sus campos, y NwtButtonDropdown no acepta `label`. */}
          <span className="nwt-input-box__label nws-accredited-type-modal__label">
            Seleccionar permisos
            <span className="nws-accredited-type-modal__required">*</span>
          </span>

          <NwtButtonDropdown
            placeholder={
              permissionOptions.length
                ? 'Selecciona los permisos'
                : 'Primero crea permisos de acceso'
            }
            options={permissionOptions}
            value={permissionIds}
            fullWidth={true}
            disabled={!permissionOptions.length}
            displayText={
              permissionIds.length
                ? `${permissionIds.length} seleccionado${permissionIds.length !== 1 ? 's' : ''}`
                : undefined
            }
            onSelectionChange={setPermissionIds}
          />

          {/* Cada permiso elegido con SUS usos. El tope es del permiso, no del tipo: el
              backend lo guarda en cada uno, y antes lo colapsábamos en un solo número para
              todos —el campo que había que deshabilitar cuando ninguno llevaba tope—.

              La zona se pinta SIEMPRE, con su alto reservado: si apareciera con el primer
              permiso, el modal daría un salto debajo del cursor. Ver el mixin `zona-fija`. */}
          <div className="nws-accredited-type-modal__chips">
            {permissionIds.length === 0 ? (
              <small className="nws-accredited-type-modal__chips-empty nwt-smalltext-font-regular">
                Los permisos que elijas aparecen acá.
              </small>
            ) : (
              <ul className="nws-accredited-type-modal__picked">
                {permissionIds.map((permissionId, posicion) => {
                  const permiso = permissions.find(
                    (item) => String(item.id) === permissionId
                  );
                  const conTope = idsConTope.has(permissionId);
                  const nombre = permiso?.name ?? permissionId;

                  return (
                    <li key={permissionId}>
                      {/* El número a la vista: es el `order` que se guarda y con el que el
                          carnet pinta los iconos, así que sin él el usuario movería cosas
                          sin saber qué está eligiendo. */}
                      <span className="nws-accredited-type-modal__orden nwt-smalltext-font-medium">
                        {posicion + 1}
                      </span>

                      <span className="nws-accredited-type-modal__nombre nwt-text-font-regular">
                        {nombre}
                      </span>

                      {/* Solo los permisos que declaran tope piden número: en los demás el
                          backend lo descarta, así que se dice en vez de ofrecer un campo que
                          no guarda nada. */}
                      {conTope ? (
                        <NwtTextField
                          type="number"
                          nwtSize="small"
                          placeholder="usos"
                          value={usos[permissionId] ?? ''}
                          error={faltanUsos.includes(permissionId)}
                          onChange={(valor) =>
                            onUsosChange(permissionId, String(valor))
                          }
                        />
                      ) : (
                        <small className="nwt-smalltext-font-regular">
                          Sin tope
                        </small>
                      )}

                      {/* Flechas y no arrastrar: no hay librería de arrastre en el
                          proyecto ni componente del SDK que ordene, así que arrastrar habría
                          que escribirlo a mano Y además dejar un camino por teclado. Con
                          botones el teclado sale gratis. Los extremos van deshabilitados en
                          vez de ocultos, para que la fila no cambie de ancho al moverse. */}
                      <div className="nws-accredited-type-modal__mover">
                        <button
                          type="button"
                          aria-label={`Subir ${nombre}`}
                          disabled={posicion === 0}
                          onClick={() => onMovePermission(posicion, posicion - 1)}
                        >
                          <NwtIcon value="arrow-up" />
                        </button>

                        <button
                          type="button"
                          aria-label={`Bajar ${nombre}`}
                          disabled={posicion === permissionIds.length - 1}
                          onClick={() => onMovePermission(posicion, posicion + 1)}
                        >
                          <NwtIcon value="arrow-down" />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="nws-accredited-type-modal__quitar"
                        aria-label={`Quitar ${nombre}`}
                        onClick={() => onRemovePermission(permissionId)}
                      >
                        <NwtIcon value="close" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* La «Fecha límite de acceso» del diseño, que el backend ya guarda por
            rol (`access_deadline`). Es opcional: sin ella el rol no caduca. El
            calendario da un día y el acceso cierra al final de ese día. */}
        <div className="naotech-col--4">
          <NwtDateField
            formControl={controls.accessDeadline}
            label="Fecha límite de acceso"
            placeholder="Opcional"
          />
        </div>
      </div>

      <footer className="nws-accredited-type-modal__footer">
        <NwtButton
          onClick={onConfirm}
          disabled={
            formGroup.invalid ||
            permissionIds.length === 0 ||
            faltanUsos.length > 0 ||
            working
          }
        >
          {working
            ? accreditedType
              ? 'Guardando...'
              : 'Creando...'
            : accreditedType
              ? 'Guardar'
              : 'Crear'}
        </NwtButton>
      </footer>
    </div>
  );
}

interface AccreditedTypeModalProps {
  accreditedType?: AccreditedType;
  eventId: number;
  onClose: () => void;
  onSubmit: (form: AccreditedTypeForm) => void;
  visible: boolean;
  working: boolean;
}

export function AccreditedTypeModal({
  accreditedType,
  eventId,
  onClose,
  onSubmit,
  visible,
  working
}: AccreditedTypeModalProps) {
  return (
    <NwsModal
      className="nws-accredited-type-modal"
      title={
        accreditedType
          ? `Editar ${accreditedType.typeName}`
          : 'Nuevo tipo de acreditado'
      }
      visible={visible}
      onClose={onClose}
      autoclose={true}
    >
      {/* useReactControl siembra su estado con un useState perezoso y nunca
          vuelve a leer el valor inicial; el NwtModal, además, siempre renderiza
          sus children. El formulario debe montarse de cero cada vez que se abre. */}
      {visible && (
        <AccreditedTypeFormBody
          accreditedType={accreditedType}
          eventId={eventId}
          onSubmit={onSubmit}
          working={working}
        />
      )}
    </NwsModal>
  );
}
