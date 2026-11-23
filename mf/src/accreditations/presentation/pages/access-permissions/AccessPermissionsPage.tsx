import './AccessPermissionsPage.scss';

import {
  AccessPermissionRepository,
  type AccessPermissionUpdatePayload,
  ACCREDITATION_MANAGE,
  FileUploadRepository
} from '@mf-accreditations/data';
import type { AccessPermission } from '@mf-accreditations/domain';
import {
  getApiErrorMessage,
  NwsLoading,
  NwsRequestError,
  openUploadedFile,
  useCatalogPage,
  useSearchTerm
} from '@mf-accreditations/presentation';
import {
  usePaginationRepository,
  useSession
} from '@naowee-tech/sdk-frontend-react';
import {
  NwtButton,
  NwtCard,
  NwtContext,
  NwtEmptyState,
  NwtPagination,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useInputControl } from '@rolster/react-forms';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import emptyCatalogUrl from '../EmptyCatalog.svg';
import {
  type AccessPermissionForm,
  AccessPermissionModal} from './AccessPermissionModal';
import { AccessPermissionsTable } from './AccessPermissionsTable';

const repository = invertly(AccessPermissionRepository);
const fileUploadRepository = invertly(FileUploadRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

export function AccessPermissionsPage() {
  const controller = usePaginationRepository(repository);
  const { toast } = useContext(NwtContext);

  // El accreditation-ms exige accreditation:manage en los diez endpoints, así que
  // sin el permiso crear es un 403 seguro.
  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  // El buscador filtra en el SERVIDOR (`search`), así que ya no hace falta
  // traerse el catálogo completo para recortarlo en cliente.
  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);

  // El controlador ya pide el catálogo al montar, así que aplicar un filtro vacío
  // en el primer render dispararía la misma petición dos veces.
  const filtered = useRef(false);

  useEffect(() => {
    if (!filtered.current && !query) {
      return;
    }

    filtered.current = true;
    controller.applyFilters(query ? { search: query } : {});
  }, [query]);

  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  // Con permiso el modal edita; sin él, crea. Y `toggling` bloquea las acciones de
  // la tabla mientras una escritura está en vuelo.
  const [editing, setEditing] = useState<AccessPermission>();
  const [toggling, setToggling] = useState(false);

  const permissions = useMemo(
    () => (controller.state.is('success') ? controller.state.entities : []),
    [controller.state]
  );

  const { page, pageItems, setPage, totalPages } = useCatalogPage(permissions);

  const onOpenModal = useCallback(() => {
    setEditing(undefined);
    setModalVisible(true);
  }, []);

  const onCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const onOpenEdit = useCallback((permission: AccessPermission) => {
    setEditing(permission);
    setModalVisible(true);
  }, []);

  // El icono se resuelve solo cuando se pide: cambiar el upload_id por su URL
  // prefirmada cuesta una petición, y hacerlo por fila serían N en cada carga.
  const onViewIcon = useCallback(
    async (permission: { fileIconUploadId: string | null; name: string }) => {
      if (!permission.fileIconUploadId) {
        return;
      }

      try {
        await openUploadedFile(permission.fileIconUploadId);
      } catch (error) {
        toast({
          title: 'No se pudo abrir el icono',
          message: getApiErrorMessage(
            error,
            `El archivo de ${permission.name} no está disponible.`
          ),
          icon: 'caution',
          theme: 'negative'
        });
      }
    },
    [toast]
  );

  const onSubmit = useCallback(
    async (form: AccessPermissionForm) => {
      setCreating(true);

      try {
        // El icono viaja como upload_id de file-storage, así que primero se sube
        // el archivo y después se guarda el permiso con el id resultante.
        const fileIconUploadId = form.icon
          ? await fileUploadRepository.uploadPermissionIcon(form.icon)
          : undefined;

        if (editing) {
          // El PATCH es parcial y solo se manda lo que de verdad cambió. No es
          // ahorro: pasar `has_limit` a true da 409 si el permiso ya está asignado
          // a un rol, así que reenviarlo igual convertiría una edición del nombre
          // en un error que el usuario no podría entender.
          const payload: AccessPermissionUpdatePayload = {
            ...(form.name !== editing.name ? { name: form.name } : {}),
            ...(form.description !== editing.description
              ? { description: form.description }
              : {}),
            ...(form.hasLimit !== editing.hasLimit
              ? { has_limit: form.hasLimit }
              : {}),
            ...(form.zoneName !== editing.zoneName
              ? { zone_name: form.zoneName }
              : {}),
            ...(form.venueName !== editing.venueName
              ? { venue_name: form.venueName }
              : {}),
            ...(fileIconUploadId
              ? { file_icon_upload_id: fileIconUploadId }
              : {})
          };

          if (!Object.keys(payload).length) {
            setModalVisible(false);

            return toast({
              title: 'No había nada que guardar',
              message: `${editing.name} quedó igual.`,
              icon: 'caution',
              theme: 'informative'
            });
          }

          const permission = await repository.update(editing, payload);

          setModalVisible(false);

          return toast({
            title: 'Permiso actualizado',
            message: `Se guardaron los cambios de ${permission.name}.`,
            icon: 'positive',
            theme: 'positive'
          });
        }

        const permission = await repository.create({
          name: form.name,
          description: form.description,
          has_limit: form.hasLimit,
          file_icon_upload_id: fileIconUploadId,
          zone_name: form.zoneName || undefined,
          venue_name: form.venueName || undefined
        });

        setModalVisible(false);

        toast({
          title: 'Permiso creado exitosamente',
          message: permission.fileIconUploadId
            ? `Se creó el permiso de ${permission.name}. Archivo de imagen cargado correctamente.`
            : `Se creó el permiso de ${permission.name}.`,
          icon: 'positive',
          theme: 'positive'
        });
      } catch (error) {
        toast({
          title: editing
            ? 'No se pudo guardar el permiso'
            : 'No se pudo crear el permiso',
          // El backend explica sus 409 —«ya está asignado a un tipo de
          // acreditado»— y ese texto es más útil que cualquier frase nuestra.
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
    [editing, toast]
  );

  // Activar e inactivar tienen sus propios endpoints y no pasan por el PATCH.
  const onToggle = useCallback(
    async (permission: AccessPermission) => {
      setToggling(true);

      try {
        const updated = permission.isActive
          ? await repository.deactivate(permission)
          : await repository.activate(permission);

        toast({
          title: updated.isActive ? 'Permiso activado' : 'Permiso inactivado',
          message: updated.isActive
            ? `${updated.name} vuelve a estar disponible para los tipos de acreditado.`
            : `${updated.name} ya no se puede asignar a un tipo de acreditado nuevo.`,
          icon: 'positive',
          theme: 'positive'
        });
      } catch (error) {
        toast({
          title: 'No se pudo cambiar el estado',
          message: getApiErrorMessage(
            error,
            `El estado de ${permission.name} quedó como estaba.`
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

  const Component = useMemo(() => {
    if (controller.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando permisos, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (controller.state.is('failure')) {
      return (
        <NwsRequestError
          error={controller.state.error}
          title="No pudimos cargar los permisos"
          onRetry={controller.refresh}
        />
      );
    }

    return (
      <NwtCard className="nws-access-permissions__catalog">
        <div className="nws-access-permissions__filters">
          <NwtSearchbox
            formControl={search}
            placeholder="Buscar por nombre o descripción"
          />

          <NwtPagination
            currentPage={page}
            totalPages={totalPages}
            onChange={setPage}
            nwtSize="small"
          />
        </div>

        {permissions.length ? (
          <AccessPermissionsTable
            canManage={canManage}
            onEdit={onOpenEdit}
            onToggle={onToggle}
            onViewIcon={onViewIcon}
            permissions={pageItems}
            working={toggling}
          />
        ) : (
          <NwtEmptyState
            illustrationUrl={illustrationUrl}
            title={query ? 'Sin resultados' : 'Aún no hay permisos'}
            description={
              query
                ? 'Ningún permiso coincide con la búsqueda.'
                : canManage
                  ? 'Crea el catálogo de permisos para el acceso a los eventos.'
                  : 'Tu usuario puede consultar el catálogo, pero no crearlo.'
            }
            actionLabel="Crear la parametrización"
            showAction={!query && canManage}
            onActionClick={onOpenModal}
          />
        )}
      </NwtCard>
    );
  }, [
    controller.state,
    controller.refresh,
    search,
    page,
    totalPages,
    setPage,
    permissions.length,
    query,
    pageItems,
    canManage,
    onOpenModal,
    onOpenEdit,
    onToggle,
    onViewIcon,
    toggling
  ]);

  return (
    <section className="nws-access-permissions">
      <div className="nws-access-permissions__header">
        <div className="nws-access-permissions__description">
          <span className="nwt-h5-font-bold">
            Catálogo de permisos de acceso
          </span>

          <small className="nwt-smalltext-font-regular">
            Crea los permisos de acceso para el evento
          </small>
        </div>

        <div className="nws-access-permissions__actions">
          {canManage && (
            <NwtButton
              icon="add"
              nwtVariant="loud"
              nwtSize="medium"
              onClick={onOpenModal}
            >
              Agregar permiso
            </NwtButton>
          )}
        </div>
      </div>

      {Component}

      <AccessPermissionModal
        permission={editing}
        visible={modalVisible}
        working={creating}
        onClose={onCloseModal}
        onSubmit={onSubmit}
      />
    </section>
  );
}
