import type { AccessPermission } from '@mf-accreditations/domain';
import {
  NwsModal,
  REQUIRED_FIELD_MESSAGE
} from '@mf-accreditations/presentation';
import {
  NwtButton,
  NwtFileField,
  NwtSwitchControl,
  NwtTextField
} from '@naowee-tech/sdk-react-components';
import {
  useFormControl,
  useFormGroup,
  useInputControl
} from '@rolster/react-forms';
import { required } from '@rolster/validators/helpers';
import { useCallback } from 'react';

// El purpose PERMISSION_ICON_FILE de file-storage solo acepta image/svg+xml y
// hasta 1 MiB: png y jpg fallan en el presign. Es svg a propósito, porque el
// carnet lo embebe como data-URI y el raster no escala a 9mm.
const ICON_MIME_TYPE = 'image/svg+xml';
const ICON_MAX_BYTES = 1024 * 1024;

// El icono se sube a file-storage antes de guardar el permiso, así que el modal
// entrega el archivo y la página orquesta la subida.
export interface AccessPermissionForm {
  description: string;
  hasLimit: boolean;
  icon?: File;
  name: string;
  venueName: string;
  zoneName: string;
}

interface AccessPermissionFormProps {
  // Con permiso es edición; sin él, alta. La forma del formulario es la misma.
  permission?: AccessPermission;
  onSubmit: (form: AccessPermissionForm) => void;
  working: boolean;
}

function AccessPermissionFormBody({
  permission,
  onSubmit: onSubmitForm,
  working
}: AccessPermissionFormProps) {
  const formGroup = useFormGroup({
    name: useInputControl<string>(permission?.name ?? '', [required]),
    description: useInputControl<string>(permission?.description ?? '', [
      required
    ]),
    hasLimit: useFormControl<boolean>(permission?.hasLimit ?? false),
    zoneName: useInputControl<string>(permission?.zoneName ?? ''),
    venueName: useInputControl<string>(permission?.venueName ?? ''),
    icon: useInputControl<File | undefined>(undefined)
  });

  const { controls } = formGroup;

  const icon = controls.icon.value;
  // El tipo lo filtra el propio selector de archivo (mimeTypes → accept), que es
  // lo que pide el purpose: solo svg. El tamaño hay que comprobarlo acá, porque el
  // NwtFileField no lo mira y el bucket rechaza por encima de 1 MiB.
  const iconTooLarge = !!icon && icon.size > ICON_MAX_BYTES;

  const onSubmit = useCallback(() => {
    if (formGroup.invalid || iconTooLarge) {
      return;
    }

    onSubmitForm({
      name: controls.name.value.trim(),
      description: controls.description.value.trim(),
      hasLimit: !!controls.hasLimit.value,
      zoneName: controls.zoneName.value.trim(),
      venueName: controls.venueName.value.trim(),
      icon: controls.icon.value
    });
  }, [formGroup, controls, iconTooLarge, onSubmitForm]);

  return (
    <div className="nws-access-permission-modal__body">
      <div className="naotech-grid naotech-grid--4">
        <div className="naotech-col--2">
          {/* El mensaje va condicionado a `wrong`: el SDK usa `message` también como texto
              de ayuda cuando NO hay error, así que pasarlo siempre lo pintaría bajo un campo
              correcto. Sin él salía su texto por defecto, «Campo con errores», que no dice
              qué hacer. Lo reportó QA. */}
          <NwtTextField
            formControl={controls.name}
            label="Nombre del permiso"
            placeholder="Ej: Área de preparación de atletas"
            required={true}
            message={controls.name.wrong ? REQUIRED_FIELD_MESSAGE : undefined}
          />
        </div>

        <div className="naotech-col--2">
          <NwtTextField
            formControl={controls.description}
            label="Descripción"
            placeholder="Ej: Área que incluye camerinos y baños"
            required={true}
            message={
              controls.description.wrong ? REQUIRED_FIELD_MESSAGE : undefined
            }
          />
        </div>

        {/* Zona y sede son TEXTO LIBRE en el backend: no hay catálogo, así que no
              hay desplegable que ofrecer. Es lo que el diseño llamaba
              «zonas/sedes» del permiso. */}
        <div className="naotech-col--2">
          <NwtTextField
            formControl={controls.zoneName}
            label="Zona"
            placeholder="Ej: Zona norte"
          />
        </div>

        <div className="naotech-col--2">
          <NwtTextField
            formControl={controls.venueName}
            label="Sede"
            placeholder="Ej: Coliseo El Salitre"
          />
        </div>

        {/* Lo que el backend distingue es si el permiso lleva tope de usos. El
              tope en sí se define por tipo de acreditado, al asignarle el permiso.
              Ojo: pasarlo a «con tope» da 409 si el permiso ya está asignado. */}
        <div className="naotech-col--4">
          <div className="nws-access-permission-modal__switch">
            <NwtSwitchControl formControl={controls.hasLimit} />

            <div className="nws-access-permission-modal__switch-text">
              <span>Este permiso tiene tope de usos</span>

              <small className="nwt-smalltext-font-regular">
                El número de usos se define en cada tipo de acreditado.
              </small>
            </div>
          </div>
        </div>

        <div className="naotech-col--4">
          <NwtFileField
            formControl={controls.icon}
            label={
              permission?.fileIconUploadId
                ? 'Reemplazar el icono'
                : 'Icono del permiso'
            }
            placeholder="Seleccione el archivo"
            mimeTypes={[ICON_MIME_TYPE]}
            error={iconTooLarge}
            message={{
              description: iconTooLarge
                ? 'El archivo pesa más de 1 MB'
                : permission?.fileIconUploadId
                  ? 'Ya tiene un icono cargado; elige otro solo si quieres cambiarlo'
                  : 'Formato del archivo debe ser .svg, máximo 1 MB'
            }}
          />
        </div>
      </div>

      <footer className="nws-access-permission-modal__footer">
        <NwtButton
          onClick={onSubmit}
          disabled={formGroup.invalid || iconTooLarge || working}
        >
          {working
            ? permission
              ? 'Guardando...'
              : 'Creando...'
            : permission
              ? 'Guardar'
              : 'Crear'}
        </NwtButton>
      </footer>
    </div>
  );
}

interface AccessPermissionModalProps {
  permission?: AccessPermission;
  onClose: () => void;
  onSubmit: (form: AccessPermissionForm) => void;
  visible: boolean;
  working: boolean;
}

export function AccessPermissionModal({
  permission,
  onClose,
  onSubmit,
  visible,
  working
}: AccessPermissionModalProps) {
  return (
    <NwsModal
      className="nws-access-permission-modal"
      title={permission ? `Editar ${permission.name}` : 'Nuevo permiso'}
      visible={visible}
      onClose={onClose}
      autoclose={true}
    >
      {/* Igual que en el modal de tipos: el NwtModal siempre renderiza sus
          children y los controles siembran su estado una sola vez, así que el
          formulario tiene que montarse de cero en cada apertura. Sin esto, tras
          un alta exitosa el modal reabre con los datos del permiso anterior y
          un clic crea un duplicado —y en edición mostraría el permiso de antes. */}
      {visible && (
        <AccessPermissionFormBody
          permission={permission}
          onSubmit={onSubmit}
          working={working}
        />
      )}
    </NwsModal>
  );
}
