import type {
  AccreditedType,
  ReadyParticipant
} from '@mf-accreditations/domain';
import {
  formatDocumentNumber,
  NwsModal
} from '@mf-accreditations/presentation';
import type {
  NwtDropdownOption,
  NwtInputBoxMessage
} from '@naowee-tech/sdk-react-components';
import {
  NwtAlert,
  NwtButton,
  NwtDropdown
} from '@naowee-tech/sdk-react-components';
import { useFormControl } from '@rolster/react-forms';
import { useCallback, useEffect, useMemo, useState } from 'react';

// El texto del error del desplegable. Sin él, el SDK pinta su genérico «Campo con errores» en
// cuanto el control queda tocado —basta con abrirlo y cerrarlo sin elegir—.
const SELECT_TYPE_MESSAGE: NwtInputBoxMessage = {
  description: 'Seleccione el tipo',
  icon: { value: 'caution', theme: 'negative' }
};

// Una persona de la acreditación. Con dos o más `options` se elige el tipo; con una sola se
// muestra `roleName`, que es el tipo con el que se va a acreditar.
export interface SupportRoleChoice {
  person: ReadyParticipant;
  options: AccreditedType[];
  roleName: string;
}

interface PickSupportRoleModalProps {
  // Todas las personas que se van a acreditar. El modal está abierto mientras haya alguna.
  choices?: SupportRoleChoice[];
  onCancel: () => void;
  // El tipo elegido para cada persona que tenía que elegirlo, por su id.
  onConfirm: (roles: Record<string, string>) => void;
}

interface ChoiceRowProps {
  choice: SupportRoleChoice;
  showErrors: boolean;
  onChange: (id: string, roleCode: string | undefined) => void;
}

function RoleSelect({
  id,
  options,
  showErrors,
  onChange
}: {
  id: string;
  options: AccreditedType[];
  showErrors: boolean;
  onChange: (id: string, roleCode: string | undefined) => void;
}) {
  // Sin validador a propósito: al elegir, el desplegable se desenfoca ANTES de recibir el
  // valor, y con `required` el control quedaba un instante tocado y vacío —el SDK pintaba el
  // error y la fila de abajo rebotaba—. Lo obligatorio lo controla el botón al confirmar.
  const role = useFormControl<string | undefined>(undefined);

  useEffect(() => {
    onChange(id, role.value);
  }, [id, onChange, role.value]);

  const dropdownOptions = useMemo<NwtDropdownOption<string>[]>(
    () =>
      options.map((type) => ({
        key: type.code,
        label: type.typeName,
        value: type.roleCode
      })),
    [options]
  );

  return (
    <NwtDropdown
      formControl={role}
      label="Tipo de acreditado"
      placeholder="Seleccione el tipo"
      options={dropdownOptions}
      required={true}
      error={showErrors && !role.value}
      message={showErrors && !role.value ? SELECT_TYPE_MESSAGE : undefined}
    />
  );
}

// Cada fila con su control: los hooks de react-forms no se pueden crear en un bucle sobre
// una lista que cambia de tamaño, así que el desplegable es un componente y avisa hacia arriba.
function ChoiceRow({ choice, showErrors, onChange }: ChoiceRowProps) {
  const { person, options, roleName } = choice;
  const id = String(person.id);

  return (
    <li className="nws-pick-role-modal__row">
      <div className="nws-pick-role-modal__person">
        <span className="nwt-smalltext-font-bold">{person.fullName}</span>

        <small className="nwt-smalltext-font-regular nws-pick-role-modal__muted">
          {`${person.documentType} ${formatDocumentNumber(person.document)}`}
        </small>
      </div>

      {options.length > 1 ? (
        <RoleSelect
          id={id}
          options={options}
          showErrors={showErrors}
          onChange={onChange}
        />
      ) : (
        <div className="nws-pick-role-modal__person">
          <small className="nwt-smalltext-font-regular">
            Tipo de acreditado
          </small>

          <span className="nwt-smalltext-font-regular">{roleName}</span>
        </div>
      )}
    </li>
  );
}

function PickSupportRoleBody({
  choices,
  onCancel,
  onConfirm
}: Omit<PickSupportRoleModalProps, 'choices'> & {
  choices: SupportRoleChoice[];
}) {
  const [roles, setRoles] = useState<Record<string, string | undefined>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Solo se elige el tipo de quien tiene más de uno; el resto va con el suyo.
  const porElegir = useMemo(
    () => choices.filter((choice) => choice.options.length > 1),
    [choices]
  );

  const onChange = useCallback((id: string, roleCode: string | undefined) => {
    setRoles((current) =>
      current[id] === roleCode ? current : { ...current, [id]: roleCode }
    );
  }, []);

  const onConfirmOnce = useCallback(() => {
    const elegidos = Object.fromEntries(
      porElegir.flatMap((choice) => {
        const roleCode = roles[String(choice.person.id)];

        return roleCode ? [[String(choice.person.id), roleCode]] : [];
      })
    );

    // Mismo criterio que el resto de confirmaciones: el botón queda activo y lo que falta se
    // marca al intentarlo.
    if (Object.keys(elegidos).length < porElegir.length) {
      setShowErrors(true);

      return;
    }

    setConfirming(true);

    onConfirm(elegidos);
  }, [onConfirm, porElegir, roles]);

  return (
    <div className="nws-delivery-confirm-modal__body">
      <NwtAlert
        nwtTheme="informative"
        icon="caution"
        visible={true}
        closabled={false}
      >
        {porElegir.length === 1
          ? 'Una persona tiene más de una función en el evento: elige con qué tipo acreditarla.'
          : 'Algunas personas tienen más de una función en el evento: elige con qué tipo acreditar a cada una.'}
      </NwtAlert>

      {/* La lista tiene su propio scroll: con muchas personas el modal no crece más allá
          de la pantalla y el pie con los botones sigue a la vista. */}
      <ul className="nws-pick-role-modal__list">
        {choices.map((choice) => (
          <ChoiceRow
            key={String(choice.person.id)}
            choice={choice}
            showErrors={showErrors}
            onChange={onChange}
          />
        ))}
      </ul>

      <footer className="nws-delivery-confirm-modal__footer">
        <NwtButton nwtVariant="mute" onClick={onCancel}>
          Cancelar
        </NwtButton>

        <NwtButton
          nwtVariant="loud"
          disabled={confirming}
          onClick={onConfirmOnce}
        >
          {choices.length === 1 ? 'Acreditar' : `Acreditar (${choices.length})`}
        </NwtButton>
      </footer>
    </div>
  );
}

// Confirmar la acreditación cuando alguna persona tiene más de una función: se elige su tipo
// y se ve con qué tipo va el resto.
export function PickSupportRoleModal({
  choices,
  onCancel,
  onConfirm
}: PickSupportRoleModalProps) {
  return (
    <NwsModal
      className="nws-delivery-confirm-modal nws-change-role-modal nws-pick-role-modal"
      title="Elige el tipo de acreditado"
      visible={!!choices?.length}
      onClose={onCancel}
      autoclose={true}
    >
      {/* Montar el cuerpo solo con el modal abierto reinicia las elecciones en cada apertura. */}
      {!!choices?.length && (
        <PickSupportRoleBody
          choices={choices}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )}
    </NwsModal>
  );
}
