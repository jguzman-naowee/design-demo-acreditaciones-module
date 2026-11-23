import {
  CertificateRepository,
  type GenerateCertificatesPayload
} from '@mf-accreditations/data';
import type { ActiveAccredited, EventSport } from '@mf-accreditations/domain';
import { NwsModal, useSearchTerm } from '@mf-accreditations/presentation';
import type { NwtSelectOption } from '@naowee-tech/sdk-react-components';
import {
  NwtButton,
  NwtDateField,
  NwtDropdown,
  NwtSearchbox
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useFormControl, useInputControl } from '@rolster/react-forms';
import { useEffect, useMemo, useState } from 'react';

const repository = invertly(CertificateRepository);

export type GenerationMode = 'sport' | 'individual';

interface GenerateCertificatesModalProps {
  mode: GenerationMode;
  visible: boolean;
  eventId: number;
  phaseCode?: string;
  // La fase dividida certifica por momento: cada uno tiene su configuración.
  momentCode?: string;
  sports: EventSport[];
  generating: boolean;
  onClose: () => void;
  onGenerate: (payload: GenerateCertificatesPayload) => void;
}

function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function GenerateCertificatesModal(
  props: GenerateCertificatesModalProps
) {
  const { mode, visible, onClose } = props;

  return (
    <NwsModal
      className="nws-certificates-modal"
      title={
        mode === 'sport'
          ? 'Generar certificados por deporte'
          : 'Generar certificado individual'
      }
      visible={visible}
      onClose={onClose}
      autoclose={true}
    >
      {/* El cuerpo se monta con el modal: los controles no releen el valor inicial. */}
      {visible && <ModalBody {...props} />}
    </NwsModal>
  );
}

function ModalBody({
  mode,
  eventId,
  phaseCode,
  momentCode,
  sports,
  generating,
  onClose,
  onGenerate
}: GenerateCertificatesModalProps) {
  const sport = useFormControl<string | undefined>(undefined);
  const date = useInputControl<Date | undefined>(undefined);

  const search = useInputControl<string>('');
  const query = useSearchTerm(search.value);
  const [candidates, setCandidates] = useState<ActiveAccredited[]>([]);
  const [picked, setPicked] = useState<ActiveAccredited>();
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (mode !== 'individual') {
      return;
    }

    let cancelled = false;

    setSearching(true);
    repository
      .searchActiveAccredited(eventId, query || undefined)
      .then((found) => {
        if (!cancelled) {
          setCandidates(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, eventId, query]);

  const sportOptions = useMemo<NwtSelectOption<string>[]>(
    () =>
      sports.map((item) => ({
        key: item.code,
        label: item.name,
        value: item.code
      })),
    [sports]
  );

  const ready = mode === 'sport' ? !!sport.value : !!picked;

  const submit = () => {
    const base = {
      ...(phaseCode ? { phase_code: phaseCode } : {}),
      ...(momentCode ? { moment_code: momentCode } : {}),
      ...(date.value ? { delivery_date: toIsoDate(date.value) } : {})
    };

    if (mode === 'sport' && sport.value) {
      onGenerate({ ...base, sport_code: sport.value });
    }

    if (mode === 'individual' && picked) {
      onGenerate(
        picked.userCode
          ? { ...base, user_codes: [picked.userCode] }
          : { ...base, accreditation_codes: [picked.accreditationCode] }
      );
    }
  };

  return (
    // El título lo pinta la cabecera del NwtModal, como en el resto de los modales del
    // módulo: repetirlo acá dejaba la cabecera del SDK vacía con solo la X, y el hueco
    // que quedaba encima se veía como un salto antes del título.
    <div className="nws-certificates-modal__body">
      {mode === 'sport' ? (
        <NwtDropdown
          formControl={sport}
          label="Deporte"
          placeholder="Selecciona el deporte"
          options={sportOptions}
        />
      ) : (
        <div className="nws-certificates-modal__picker">
          <NwtSearchbox
            formControl={search}
            placeholder="Buscar acreditado por nombre o documento"
          />

          <div className="nws-certificates-modal__candidates">
            {searching && (
              <span className="nwt-smalltext-font-regular">Buscando…</span>
            )}

            {!searching && !candidates.length && (
              <span className="nwt-smalltext-font-regular">
                Sin acreditados activos que coincidan.
              </span>
            )}

            {!searching &&
              candidates.map((candidate) => (
                <button
                  key={candidate.accreditationCode}
                  type="button"
                  className={`nws-certificates-modal__candidate${
                    picked?.accreditationCode === candidate.accreditationCode
                      ? ' nws-certificates-modal__candidate--picked'
                      : ''
                  }`}
                  onClick={() => setPicked(candidate)}
                >
                  <span className="nwt-text-font-medium">
                    {candidate.fullName}
                  </span>
                  <span className="nwt-smalltext-font-regular">
                    {candidate.documentNumber}
                    {candidate.roleName ? ` · ${candidate.roleName}` : ''}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      <NwtDateField
        formControl={date}
        label="Fecha de entrega (opcional)"
        placeholder="Usa la fecha configurada"
      />

      <footer className="nws-certificates-modal__footer">
        <NwtButton nwtVariant="mute" onClick={onClose}>
          Cancelar
        </NwtButton>

        <NwtButton
          nwtVariant="loud"
          loading={generating}
          disabled={!ready}
          onClick={submit}
        >
          Generar
        </NwtButton>
      </footer>
    </div>
  );
}
