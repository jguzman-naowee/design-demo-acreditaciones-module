import './AccreditedTypesPage.scss';

import {
  ACCREDITATION_MANAGE,
  AccreditedTypeRepository,
  toAccessDeadline
} from '@mf-accreditations/data';
import type { AccreditedType } from '@mf-accreditations/domain';
import {
  getApiErrorMessage,
  NwsEventBar,
  NwsEventGuard,
  type NwsEventScope,
  NwsLoading,
  NwsRequestError,
  useCatalogPage,
  useRoleCatalogLabels,
  useSearchTerm} from '@mf-accreditations/presentation';
import {
  usePaginationRepository,
  useSession
} from '@naowee-tech/sdk-frontend-react';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtButton,
  NwtCard,
  NwtContext,
  NwtDropdown,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import {
  type AccreditedTypeForm,
  AccreditedTypeModal
} from './AccreditedTypeModal';
import { AccreditedTypesTable } from './AccreditedTypesTable';

const repository = invertly(AccreditedTypeRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

export function AccreditedTypesPage() {
  return (
    <NwsEventGuard>
      {(scope) => <AccreditedTypesCatalog {...scope} />}
    </NwsEventGuard>
  );
}

function AccreditedTypesCatalog({ eventId }: NwsEventScope) {
  // El evento se deja puesto antes de montar el controlador: su primera petición ya sale
  // con el `event_id` del par en lugar de gastarse con uno imposible.
  repository.applyEventScope({ event_id: eventId });

  const controller = usePaginationRepository(repository);
  const { toast } = useContext(NwtContext);

  // Mismo criterio que en permisos: sin accreditation:manage el POST es un 403.
  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  // El gateway ya filtra por evento y por texto, así que la pantalla pide solo
  // los roles del evento activo en lugar de traerse el catálogo entero de todos
  // los eventos para recortarlo acá.
  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);

  // Código de función → su nombre, para la tabla: el tipo solo guarda el código
  // (`platformSubrole`) y «ENT» o «SPECIAL_GUEST» no le dicen nada a nadie.
  //
  // Esto estuvo escrito a mano acá —los dos catálogos, el `Promise.all`, el mapa— hasta que
  // la tabla de acreditados necesitó lo mismo y apareció que el hook ya existía, haciéndolo
  // igual y tolerando mejor el fallo de un catálogo. Es justo lo que advierte su propio
  // comentario: dos sitios que dicen lo mismo terminan diciéndolo distinto.
  const { labelOf: functionLabelOf } = useRoleCatalogLabels();

  useEffect(() => {
    controller.applyFilters({
      event_id: eventId,
      ...(query ? { search: query } : {})
    });
  }, [eventId, query]);

  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  // Con tipo el modal edita; sin él, crea.
  const [editing, setEditing] = useState<AccreditedType>();
  const [toggling, setToggling] = useState(false);

  const typeFilter = useFormControl<string | undefined>('all');

  const accreditedTypes = useMemo(
    () => (controller.state.is('success') ? controller.state.entities : []),
    [controller.state]
  );

  // El filtro se arma con los tipos que el evento TIENE, no con un catálogo.
  //
  // Andrés pidió el catálogo del gateway también acá, y lo dejo dicho porque no resuelve lo
  // que él reportó: ese diccionario trae 30 roles del personal del evento, así que ofrecería
  // 30 opciones de las que casi ninguna casa con nada… y seguiría SIN encontrar «Prueba
  // contrato PR620», que es el tipo que él no podía filtrar y que no está en el diccionario.
  // Con los tipos del propio evento el filtro encuentra siempre lo que hay. Si prefieres el
  // catálogo igual, es cambiar esta lista.
  const typeFilterOptions = useMemo<NwtSelectOption<string>[]>(
    () => [
      // «Todos», y no «Tipos», porque lo pidió QA. Ojo que rompe la convención del resto del
      // módulo —«Estados», «Acción», «Fuente», «Deporte», «Sexo», «Delegación»…—, donde la
      // opción de «todas» se rotula con el NOMBRE de la faceta porque el desplegable no lleva
      // etiqueta encima y ese texto es lo único que dice por qué filtra. Acá se puede: al lado
      // hay un buscador que ya dice «Buscar por tipo».
      { key: 'all', label: 'Todos', value: 'all' },
      ...[...new Set(accreditedTypes.map((type) => type.typeName))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ key: name, label: name, value: name }))
    ],
    [accreditedTypes]
  );

  // El evento y el texto los recortó el servidor; el dropdown de tipo sigue en
  // cliente porque su lista es un catálogo quemado nuestro, no un filtro del
  // gateway.
  const typesFiltered = useMemo(
    () =>
      typeFilter.value === 'all'
        ? accreditedTypes
        : accreditedTypes.filter(
            (accreditedType) => accreditedType.typeName === typeFilter.value
          ),
    [accreditedTypes, typeFilter.value]
  );

  const { page, pageItems, setPage, totalPages } =
    useCatalogPage(typesFiltered);

  const filtering = !!query || typeFilter.value !== 'all';

  const onOpenModal = useCallback(() => {
    setEditing(undefined);
    setModalVisible(true);
  }, []);

  const onCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const onOpenEdit = useCallback((accreditedType: AccreditedType) => {
    setEditing(accreditedType);
    setModalVisible(true);
  }, []);

  const onSubmit = useCallback(
    async (form: AccreditedTypeForm) => {
      setCreating(true);

      try {
        const accessDeadline = form.accessDeadline
          ? toAccessDeadline(form.accessDeadline)
          : undefined;

        if (editing) {
          // El PUT reemplaza el rol completo, así que se manda la lista entera de
          // permisos que debe quedar, y el nombre y el código tal cual estaban:
          // renombrar cambiaría el role_code con el que ya se emitieron
          // acreditaciones.
          //
          // Ojo con `rawName`: es el nombre COMO LO GUARDA el servidor. `typeName` viene ya
          // limpio para mostrar —sin el «(ATHLETE)» pegado— y mandar ese sí renombraría el
          // tipo, de rebote, al guardar unos permisos.
          const updated = await repository.update(
            editing,
            {
              role_name: editing.rawName,
              role_code: editing.roleCode,
              // La categoría y la función. Si el formulario trae función, manda la pareja
              // que eligió; si no, se reenvía lo que el tipo YA tenía, porque este PUT
              // reemplaza el rol completo y omitirlo se lo borraría —incluido el respaldo
              // que hoy evita el 404 al acreditar en los tipos viejos—.
              //
              // Ojo con el orden: quitar la función de un tipo que la tenía no se puede
              // expresar así (mandar `undefined` es no mandar nada, y normalizeJson borra
              // las claves sin valor). Hoy no hace falta —el desplegable no ofrece «sin
              // función» una vez elegida— pero el día que haga falta hay que pedirle a
              // backend una forma de limpiarla.
              ...(form.platformSubrole && form.platformRole
                ? {
                    platform_role: form.platformRole,
                    platform_subrole: form.platformSubrole
                  }
                : {
                    ...(editing.platformRole
                      ? { platform_role: editing.platformRole }
                      : {}),
                    ...(editing.platformSubrole
                      ? { platform_subrole: editing.platformSubrole }
                      : {})
                  }),
              access_deadline: accessDeadline,
              permissions: form.permissions
            },
            form.permissionNames
          );

          setModalVisible(false);

          return toast({
            title: 'Tipo de acreditado actualizado',
            message: `Se guardaron los cambios de ${updated.typeName}.`,
            icon: 'positive',
            theme: 'positive'
          });
        }

        const created = await repository.create(
          {
            role_name: form.roleName,
            // El código del CATÁLOGO, no uno derivado del nombre. `toRoleCode()` daba
            // «DEPORTISTA» a partir de «Deportista», y la plataforma manda «ATHLETE»: de ahí
            // salía el 404 al acreditar que el `platform_role` venía a tapar.
            role_code: form.roleCode,
            // La categoría SIEMPRE que se eligió, con función o sin ella. Sin función es el
            // tipo por defecto de la familia —el `default_type` del catálogo—, y descartarla
            // lo dejaba sin categoría: por eso ese campo llega null en las cuatro familias.
            ...(form.platformRole
              ? {
                  platform_role: form.platformRole,
                  ...(form.platformSubrole
                    ? { platform_subrole: form.platformSubrole }
                    : {})
                }
              : {}),
            event_id: eventId,
            access_deadline: accessDeadline,
            permissions: form.permissions
          },
          form.permissionNames
        );

        setModalVisible(false);

        toast({
          title: 'Tipo creado exitosamente',
          message: `Se creó el tipo de acreditado: ${created.typeName} de forma exitosa. Su estado es activo de forma automática.`,
          icon: 'positive',
          theme: 'positive'
        });
      } catch (error) {
        toast({
          title: editing
            ? 'No se pudo guardar el tipo de acreditado'
            : 'No se pudo crear el tipo de acreditado',
          message: getApiErrorMessage(
            error,
            'Inténtalo de nuevo en unos minutos.'
          ),
          icon: 'caution',
          theme: 'negative'
        });
      } finally {
        setCreating(false);
      }
    },
    [editing, eventId, toast]
  );

  // Activar e inactivar tienen sus propios endpoints, igual que en permisos.
  const onToggle = useCallback(
    async (accreditedType: AccreditedType) => {
      setToggling(true);

      try {
        const updated = accreditedType.isActive
          ? await repository.deactivate(accreditedType)
          : await repository.activate(accreditedType);

        toast({
          title: updated.isActive
            ? 'Tipo de acreditado activado'
            : 'Tipo de acreditado inactivado',
          message: updated.isActive
            ? `${updated.typeName} vuelve a estar disponible para acreditar.`
            : `${updated.typeName} ya no se puede usar en acreditaciones nuevas.`,
          icon: 'positive',
          theme: 'positive'
        });
      } catch (error) {
        toast({
          title: 'No se pudo cambiar el estado',
          message: getApiErrorMessage(
            error,
            `El estado de ${accreditedType.typeName} quedó como estaba.`
          ),
          icon: 'caution',
          theme: 'negative'
        });
      } finally {
        setToggling(false);
      }
    },
    [toast]
  );

  function renderCatalog() {
    if (controller.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando parametrizaciones, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (controller.state.is('failure')) {
      return (
        <NwsRequestError
          error={controller.state.error}
          title="No pudimos cargar los tipos de acreditado"
          onRetry={controller.refresh}
        />
      );
    }

    return (
      <NwtCard className="nws-accredited-types__catalog">
        <div className="nws-accredited-types__filters">
          <div className="nws-accredited-types__search">
            <NwtSearchbox formControl={search} placeholder="Buscar por tipo" />

            <NwtDropdown formControl={typeFilter} options={typeFilterOptions} />
          </div>

          <NwtPagination
            currentPage={page}
            totalPages={totalPages}
            onChange={setPage}
            nwtSize="small"
          />
        </div>

        {typesFiltered.length ? (
          <AccreditedTypesTable
            accreditedTypes={pageItems}
            canManage={canManage}
            functionLabelOf={functionLabelOf}
            onEdit={onOpenEdit}
            onToggle={onToggle}
            working={toggling}
          />
        ) : (
          <NwtEmptyState
            illustrationUrl={illustrationUrl}
            title={
              filtering ? 'Sin resultados' : 'Aún no hay parametrizaciones'
            }
            description={
              filtering
                ? 'Ningún tipo de acreditado coincide con los filtros.'
                : canManage
                  ? 'Crea usuarios para acreditar, asigna permisos y roles en el evento.'
                  : 'Tu usuario puede consultar la parametrización, pero no crearla.'
            }
            actionLabel="Crear la parametrización"
            showAction={!filtering && canManage}
            onActionClick={onOpenModal}
          />
        )}
      </NwtCard>
    );
  }

  return (
    <section className="nws-accredited-types">
      {/* El evento, en su franja y a todo el ancho: en la fila del título no cabía y el nombre
          salía cortado. Por eso el contenido pasó a su propio div —la sección llevaba el
          padding, y con él la franja quedaba indentada en vez de llegar a los bordes—. */}
      <NwsEventBar />

      <div className="nws-accredited-types__content">
        <div className="nws-accredited-types__header">
          <div className="nws-accredited-types__description">
            <span className="nwt-h5-font-bold">Gestión de acreditaciones</span>

            <small className="nwt-smalltext-font-regular">
              Gestiona los parámetros de las acreditaciones
            </small>
          </div>

          <div className="nws-accredited-types__actions">
            {canManage && (
              <NwtButton
                icon="add"
                nwtVariant="loud"
                nwtSize="medium"
                onClick={onOpenModal}
              >
                Agregar tipo de acreditado
              </NwtButton>
            )}
          </div>
        </div>

        {renderCatalog()}
      </div>

      <AccreditedTypeModal
        accreditedType={editing}
        eventId={eventId}
        visible={modalVisible}
        working={creating}
        onClose={onCloseModal}
        onSubmit={onSubmit}
      />
    </section>
  );
}
