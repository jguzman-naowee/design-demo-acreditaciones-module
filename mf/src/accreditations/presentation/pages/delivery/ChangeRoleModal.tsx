import {
  AccreditedRecordRepository,
  AccreditedTypeCatalogRepository
} from '@mf-accreditations/data';
import type {
  AccreditedRecordDetail,
  AccreditedType
} from '@mf-accreditations/domain';
import { SUPPORT_PERSONNEL } from '@mf-accreditations/domain';
import {
  getApiErrorMessage,
  NwsModal,
  REQUIRED_FIELD_MESSAGE
} from '@mf-accreditations/presentation';
import type { NwtDropdownOption } from '@naowee-tech/sdk-react-components';
import {
  NwtAlert,
  NwtButton,
  NwtContext,
  NwtDropdown,
  NwtTextArea
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useAreaControl, useFormControl } from '@rolster/react-forms';
import { required } from '@rolster/validators/helpers';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

const repository = invertly(AccreditedRecordRepository);
const typeRepository = invertly(AccreditedTypeCatalogRepository);

export interface ChangeRoleResult {
  newCode: string;
  cardBatchSkippedReason: string | null;
}

interface ChangeRoleModalProps {
  // El modal está abierto mientras haya acreditación.
  detail?: AccreditedRecordDetail;
  onCancel: () => void;
  onChanged: (result: ChangeRoleResult) => void;
}

interface ChangeRoleBodyProps {
  detail: AccreditedRecordDetail;
  onCancel: () => void;
  onChanged: (result: ChangeRoleResult) => void;
}

// Los tipos a los que se puede pasar: activos, distintos del actual y SOLO de personal de
// apoyo. El cambio de tipo es para el apoyo con varias funciones (docente entrenador ↔
// asistente); el backend rechaza cualquier otro destino, así que ofrecerlo solo llevaría a
// un error.
function tiposDestino(
  types: AccreditedType[],
  roleCode: string
): AccreditedType[] {
  return types.filter(
    (type) =>
      type.isActive &&
      type.roleCode !== roleCode &&
      type.platformRole === SUPPORT_PERSONNEL
  );
}

function ChangeRoleBody({ detail, onCancel, onChanged }: ChangeRoleBodyProps) {
  const { toast } = useContext(NwtContext);

  // `undefined` mientras se piden, 'error' si la petición falló.
  const [types, setTypes] = useState<AccreditedType[] | 'error'>();
  const [confirming, setConfirming] = useState(false);

  const role = useFormControl<string | undefined>(undefined, [required]);
  const note = useAreaControl('', [required]);

  useEffect(() => {
    let alive = true;

    typeRepository
      .requestAll({ event_id: detail.eventId, limit: 100 })
      .then((list) => alive && setTypes(list.items))
      .catch(() => alive && setTypes('error'));

    return () => {
      alive = false;
    };
  }, [detail.eventId]);

  // El valor del desplegable es el `role_code`, que es lo que pide el backend.
  const options = useMemo<NwtDropdownOption<string>[]>(
    () =>
      types && types !== 'error'
        ? tiposDestino(types, detail.roleCode).map((type) => ({
            key: type.code,
            label: type.typeName,
            value: type.roleCode
          }))
        : [],
    [types, detail.roleCode]
  );

  const sinOpciones = Array.isArray(types) && !options.length;

  const onConfirm = useCallback(() => {
    const roleCode = role.value;
    const reason = note.value.trim();

    // Mismo criterio que el resto de confirmaciones: el botón queda activo y el error se
    // pinta debajo del campo al intentarlo.
    if (!roleCode || !reason) {
      role.touch();
      note.touch();

      return;
    }

    setConfirming(true);

    repository
      .changeRole(String(detail.id), { role_code: roleCode, reason })
      .then((result) =>
        onChanged({
          newCode: result.newCode,
          cardBatchSkippedReason: result.cardBatchSkippedReason
        })
      )
      .catch((error) => {
        setConfirming(false);

        toast({
          title: 'No se pudo cambiar el tipo de acreditado',
          message: getApiErrorMessage(
            error,
            'Intenta de nuevo en unos minutos.'
          ),
          icon: 'caution',
          theme: 'negative'
        });
      });
  }, [detail.id, note, onChanged, role, toast]);

  return (
    <div className="nws-delivery-confirm-modal__body">
      <NwtAlert
        nwtTheme="caution"
        icon="caution"
        visible={true}
        closabled={false}
      >
        La acreditación actual se inactiva y su QR deja de validar; se emite una
        nueva con otro QR. No se puede deshacer y, si el carnet ya estaba
        impreso, hay que reimprimirlo.
      </NwtAlert>

      {types === 'error' && (
        <NwtAlert
          nwtTheme="negative"
          icon="caution"
          visible={true}
          closabled={false}
        >
          No pudimos cargar los tipos de acreditado del evento. Cierra y vuelve
          a intentarlo.
        </NwtAlert>
      )}

      {sinOpciones && (
        <NwtAlert
          nwtTheme="caution"
          icon="caution"
          visible={true}
          closabled={false}
        >
          El evento no tiene otro tipo de personal de apoyo activo.
        </NwtAlert>
      )}

      {/* El tipo actual, como nota junto al campo: es contexto para elegir, no una pregunta. */}
      <div className="nws-change-role-modal__role">
        <span className="nwt-smalltext-font-regular nws-change-role-modal__current">
          {`Tipo actual: ${detail.roleName}`}
        </span>

        <NwtDropdown
          formControl={role}
          label="Nuevo tipo de acreditado"
          placeholder={types ? 'Selecciona el tipo' : 'Cargando tipos...'}
          options={options}
          disabled={!options.length}
          required={true}
          message={role.wrong ? REQUIRED_FIELD_MESSAGE : undefined}
        />
      </div>

      <NwtTextArea
        className="nws-delivery-confirm-modal__field"
        formControl={note}
        label="Escribe el motivo del cambio"
        placeholder="Ej: Se acreditó como asistente y es entrenador"
        required={true}
        message={note.wrong ? REQUIRED_FIELD_MESSAGE : undefined}
      />

      <footer className="nws-delivery-confirm-modal__footer">
        <NwtButton nwtVariant="mute" onClick={onCancel}>
          Cancelar
        </NwtButton>

        <NwtButton
          nwtTheme="negative"
          nwtVariant="loud"
          disabled={confirming || !options.length}
          onClick={onConfirm}
        >
          Sí, cambiar tipo
        </NwtButton>
      </footer>
    </div>
  );
}

// Cambiar el tipo de acreditado desde el detalle: inactiva la acreditación y emite una nueva
// para la misma persona con el tipo elegido, en una sola operación del backend.
export function ChangeRoleModal({
  detail,
  onCancel,
  onChanged
}: ChangeRoleModalProps) {
  return (
    <NwsModal
      className="nws-delivery-confirm-modal nws-change-role-modal"
      title="Cambiar tipo de acreditado"
      visible={!!detail}
      onClose={onCancel}
      autoclose={true}
    >
      {/* Montar el cuerpo solo con el modal abierto reinicia el formulario en cada apertura,
          igual que en DeliveryConfirmModal. */}
      {detail && (
        <ChangeRoleBody
          detail={detail}
          onCancel={onCancel}
          onChanged={onChanged}
        />
      )}
    </NwsModal>
  );
}
