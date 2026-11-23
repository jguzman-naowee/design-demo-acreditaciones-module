// ═══════════════════════════════════════════════════════════════════════════════
// PRÓXIMA A BORRAR — con una advertencia, decisión de producto 2026-09-03
//
// A esta pantalla solo se llega escribiendo su URL: su grupo del menú está oculto
// desde el 2026-09-03 y nada del módulo la enlaza. Por eso entra en la lista de
// Andrés («las que solo se alcanzan por URL no se van a usar»).
//
// PERO, a diferencia de las otras marcadas, esta NO es de mentira y no está a
// medias: es la ÚNICA pantalla del módulo que valida un QR de verdad contra el
// contrato —`POST /accreditations/validate`— y la única que consume permisos.
// Borrarla quita esa capacidad del módulo entero, no una vista redundante.
//
// Así que antes de borrarla hace falta saber dónde valida el evento: si la
// validación vive en otra aplicación (la de la puerta), esto se va sin más; si no,
// el módulo se queda sin poder validar. Queda marcada, no borrada, a propósito.
//
// La lista completa está en el README, sección «Pantallas próximas a borrar».
// ═══════════════════════════════════════════════════════════════════════════════

import './AccessValidatePage.scss';

import {
  AccessPermissionCatalogRepository,
  ACCREDITATION_MANAGE,
  AccreditationValidationRepository,
  ValidationLogRepository
} from '@mf-accreditations/data';
import type { AccreditationValidation } from '@mf-accreditations/domain';
import {
  formatCatalogDate,
  getApiErrorMessage,
  NwsEventGuard,
  type NwsEventScope,
  NwsEventSelector,
  NwsLoading,
  NwsRequestError
} from '@mf-accreditations/presentation';
import {
  usePaginationRepository,
  useSession
} from '@naowee-tech/sdk-frontend-react';
import {
  NwtAlert,
  NwtBadge,
  NwtButton,
  NwtButtonDropdown,
  NwtCard,
  NwtContext,
  NwtDatatable,
  NwtDatatableCell,
  NwtDatatableHeader,
  NwtDatatableRecord,
  NwtDatatableTitle,
  NwtEmptyState,
  NwtPagination,
  NwtTextField
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useInputControl } from '@rolster/react-forms';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import emptyCatalogUrl from '../../../../accreditations/presentation/pages/EmptyCatalog.svg';

const repository = invertly(AccreditationValidationRepository);
const logRepository = invertly(ValidationLogRepository);
const permissionRepository = invertly(AccessPermissionCatalogRepository);

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

// El QR del anverso de la acreditación trae el token desnudo, así que lo que llega del
// escáner (o del portapapeles) es un uuid y nada más.
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ValidationOutcomeProps {
  validation: AccreditationValidation;
}

// El panel que mira quien está en la puerta: primero a quién identificó el QR, y
// después qué pasó con cada permiso. Se pinta igual cuando todo se deniega, porque
// negar el paso también exige saber a quién.
function ValidationOutcome({ validation }: ValidationOutcomeProps) {
  return (
    <div
      className={`nws-access-validate__outcome ${
        validation.granted
          ? 'nws-access-validate__outcome--granted'
          : 'nws-access-validate__outcome--denied'
      }`}
    >
      <div className="nws-access-validate__person">
        <span className="nwt-h5-font-bold">{validation.fullName}</span>

        <small className="nwt-smalltext-font-regular">
          {validation.roleName || 'Sin tipo de acreditado'}
        </small>
      </div>

      <div className="nws-access-validate__results">
        {validation.results.map((result) => (
          <div
            key={result.permissionId}
            className="nws-access-validate__result"
          >
            <NwtBadge
              nwtVariant="quiet"
              nwtTheme={result.granted ? 'positive' : 'negative'}
              vignette={true}
            >
              {result.granted ? 'Acceso permitido' : 'Acceso denegado'}
            </NwtBadge>

            <span className="nwt-text-font-medium">
              {result.permissionName ??
                `Permiso ${result.permissionId} (la acreditación no lo tiene)`}
            </span>

            {/* El motivo lo redacta el backend: el más común es que quien valida no
                esté registrado como validador de ese permiso en el evento. */}
            {result.reason && (
              <small className="nwt-smalltext-font-regular">
                {result.reason}
              </small>
            )}

            {result.usesLabel && (
              <small className="nwt-smalltext-font-regular">
                Usos: {result.usesLabel}
              </small>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// La validación en punto de acceso: se lee el QR de la acreditación, se eligen los permisos
// que esa puerta controla y el backend decide, consumiendo el uso.
//
// Es una pantalla aparte de «Control de accesos», que es la del diseño: esa lista una
// fila por acreditación con sus validaciones consumidas, y lo que el backend tiene es
// un registro de LECTURAS. Se fusionan cuando exista lo otro.
export function AccessValidatePage() {
  return (
    <NwsEventGuard>{(scope) => <AccessValidate {...scope} />}</NwsEventGuard>
  );
}

function AccessValidate({ eventId }: NwsEventScope) {
  // Las lecturas se leen por evento: el filtro va puesto antes de que el controlador
  // monte, así que su primera petición no se gasta con un evento imposible.
  logRepository.applyEventScope({ event_id: eventId });

  const { toast } = useContext(NwtContext);

  // El mismo permiso que el resto del módulo: sin él, validar es un 403.
  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  const logController = usePaginationRepository(logRepository);
  const permissionController = usePaginationRepository(permissionRepository);

  const token = useInputControl<string>('');
  const observation = useInputControl<string>('');
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<AccreditationValidation>();

  useEffect(() => {
    logController.applyFilters({ event_id: eventId });
  }, [eventId]);

  const permissions = useMemo(
    () =>
      permissionController.state.is('success')
        ? permissionController.state.entities
        : [],
    [permissionController.state]
  );

  // Se ofrecen los permisos activos del catálogo. Cuáles puede validar ESTE usuario lo
  // sabe el backend —depende de su registro como validador— y lo dice en el motivo:
  // preguntarlo antes exigiría cruzar su user_code, que el front no tiene.
  const permissionOptions = useMemo(
    () =>
      permissions
        .filter((permission) => permission.isActive)
        .map((permission) => ({
          label: permission.name,
          value: String(permission.id)
        })),
    [permissions]
  );

  const tokenValue = token.value.trim();
  const tokenWrong = !!tokenValue && !TOKEN_PATTERN.test(tokenValue);
  const ready =
    !!tokenValue && !tokenWrong && permissionIds.length > 0 && !validating;

  const onValidate = useCallback(async () => {
    if (!ready) {
      return;
    }

    setValidating(true);

    try {
      const result = await repository.validate({
        qr_validation_token: tokenValue,
        permission_ids: permissionIds.map(Number),
        ...(observation.value.trim()
          ? { observation: observation.value.trim() }
          : {})
      });

      setValidation(result);

      // El token se limpia y los permisos se quedan: en una puerta se escanea uno tras
      // otro sobre los mismos permisos.
      token.setValue('');

      // Solo las concedidas quedan registradas, así que releer con una denegada no
      // cambiaría nada.
      if (result.granted) {
        logController.refresh();
      }
    } catch (error) {
      setValidation(undefined);

      toast({
        title: 'No se pudo validar',
        // Con un token que no existe el backend responde 404 «No se encontró la
        // acreditación», que es exactamente lo que hay que mostrar en la puerta.
        message: getApiErrorMessage(
          error,
          'Revisa el código de la acreditación e inténtalo de nuevo.'
        ),
        icon: 'caution',
        theme: 'negative'
      });
    } finally {
      setValidating(false);
    }
  }, [ready, tokenValue, permissionIds, observation, token, toast]);

  const logs = useMemo(
    () => (logController.state.is('success') ? logController.pageEntities : []),
    [logController.state, logController.pageEntities]
  );

  function renderLogs() {
    if (logController.state.is('loading')) {
      return (
        <NwsLoading>
          <h4>Cargando las lecturas, por favor espere...</h4>
        </NwsLoading>
      );
    }

    if (logController.state.is('failure')) {
      return (
        <NwsRequestError
          error={logController.state.error}
          title="No pudimos cargar las lecturas"
          onRetry={logController.refresh}
        />
      );
    }

    return logs.length ? (
      <NwtDatatable
        header={
          <NwtDatatableHeader>
            <NwtDatatableTitle className="nwt-width-xs-20">
              Fecha de lectura
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-20">
              Acreditación
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-20">
              Permiso
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-15">
              Resultado
            </NwtDatatableTitle>
            <NwtDatatableTitle className="nwt-width-xs-25">
              Observación
            </NwtDatatableTitle>
          </NwtDatatableHeader>
        }
      >
        {logs.map((log) => (
          <NwtDatatableRecord key={log.id}>
            <NwtDatatableCell className="nwt-width-xs-20">
              <span>{formatCatalogDate(log.scannedAt)}</span>
            </NwtDatatableCell>

            {/* El log identifica la acreditación por su code; el nombre no viene. */}
            <NwtDatatableCell className="nwt-width-xs-20">
              <span className="nwt-text-font-medium">
                {log.accreditationCode.slice(0, 8)}
              </span>
            </NwtDatatableCell>

            <NwtDatatableCell className="nwt-width-xs-20">
              <span>{log.permissionName}</span>
            </NwtDatatableCell>

            <NwtDatatableCell className="nwt-width-xs-15">
              <NwtBadge
                nwtVariant="quiet"
                nwtTheme={log.granted ? 'positive' : 'negative'}
                vignette={true}
              >
                {log.granted ? 'Permitido' : 'Denegado'}
              </NwtBadge>
            </NwtDatatableCell>

            <NwtDatatableCell className="nwt-width-xs-25">
              <span>{log.observation || '—'}</span>
            </NwtDatatableCell>
          </NwtDatatableRecord>
        ))}
      </NwtDatatable>
    ) : (
      <NwtEmptyState
        illustrationUrl={illustrationUrl}
        title="Aún no hay lecturas"
        description="Las lecturas de este evento aparecerán acá, tanto las concedidas como las denegadas."
      />
    );
  }

  return (
    <section className="nws-access-validate">
      <div className="nws-access-validate__content">
        <div className="nws-access-validate__header">
          <div className="nws-access-validate__description">
            <span className="nwt-h5-font-bold">Validar acceso</span>

            <small className="nwt-smalltext-font-regular">
              Lee la acreditación en la puerta y consume el permiso
            </small>
          </div>

          <NwsEventSelector />
        </div>

        {!canManage && (
          <NwtAlert nwtTheme="caution" icon="caution" visible={true}>
            Tu usuario puede consultar las lecturas, pero no validar.
          </NwtAlert>
        )}

        <NwtCard className="nws-access-validate__reader">
          <span className="nwt-subtitle-font-bold">Leer la acreditación</span>

          <div className="naotech-grid naotech-grid--4">
            <div className="naotech-col--2">
              {/* El QR del anverso trae el token desnudo: esto recibe lo que el
                  escáner pega. Es OTRO token que el del perfil público. */}
              <NwtTextField
                formControl={token}
                label="Código del QR de la acreditación"
                placeholder="Escanea el QR o pega el código"
                required={true}
                error={tokenWrong}
                message={{
                  description: tokenWrong
                    ? 'Ese código no tiene la forma del QR de la acreditación'
                    : 'El del anverso, no el del perfil público'
                }}
              />
            </div>

            <div className="naotech-col--2">
              {/* La clase del SDK, no una tipografía propia: es el mismo rótulo que pinta
                  NwtDropdown para sus campos, y NwtButtonDropdown no acepta `label`. */}
              <span className="nwt-input-box__label nws-access-validate__label">
                Permisos que controla esta puerta
                <span className="nws-access-validate__required">*</span>
              </span>

              <NwtButtonDropdown
                placeholder={
                  permissionOptions.length
                    ? 'Selecciona los permisos'
                    : 'No hay permisos activos en el catálogo'
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
            </div>

            <div className="naotech-col--3">
              <NwtTextField
                formControl={observation}
                label="Observación"
                placeholder="Opcional: queda en la lectura"
              />
            </div>

            <div className="naotech-col--1 nws-access-validate__submit">
              <NwtButton
                icon="qr-code"
                nwtVariant="loud"
                nwtSize="medium"
                loading={validating}
                disabled={!ready || !canManage}
                onClick={onValidate}
              >
                {validating ? 'Validando...' : 'Validar'}
              </NwtButton>
            </div>
          </div>

          {validation && <ValidationOutcome validation={validation} />}
        </NwtCard>

        <NwtCard className="nws-access-validate__logs">
          <span className="nwt-subtitle-font-bold">Lecturas registradas</span>

          {/* Acá decía «Solo quedan registradas las validaciones concedidas», y era falso: el
              backend registra también las denegadas con su motivo. La columna de resultado ya
              lo dice fila a fila («Permitido» / «Denegado»), así que la nota se va en vez de
              corregirse. */}

          <div className="nws-access-validate__pagination">
            <NwtPagination
              currentPage={logController.currentPage}
              totalPages={logController.totalPages}
              onChange={logController.goToPage}
              nwtSize="small"
            />
          </div>

          {renderLogs()}
        </NwtCard>
      </div>
    </section>
  );
}
