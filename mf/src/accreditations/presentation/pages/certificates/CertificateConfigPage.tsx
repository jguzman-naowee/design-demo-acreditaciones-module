import './CertificatesPages.scss';

import {
  ACCREDITATION_MANAGE,
  CertificateRepository
} from '@mf-accreditations/data';
import type { CertificateConfig, EventSport } from '@mf-accreditations/domain';
import {
  getApiErrorMessage,
  NwsEventBar,
  NwsEventGuard,
  type NwsEventScope,
  NwsLoading,
  NwsRequestError,
  REQUIRED_FIELD_MESSAGE,
  useAccreditationCounters
} from '@mf-accreditations/presentation';
import { useSession } from '@naowee-tech/sdk-frontend-react';
import {
  NwtButton,
  NwtCard,
  NwtContext,
  NwtDateField,
  NwtSwitchControl
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useInputControl } from '@rolster/react-forms';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  CERTIFICATE_CONFIG_SUBTITLE,
  CERTIFICATE_CONFIG_TITLE,
  CONFIG_DATE_REQUIRED,
  CONFIG_LOAD_ERROR,
  CONFIG_SAVE_ERROR,
  CONFIG_SAVED_TOAST
} from './certificate.copy';

const repository = invertly(CertificateRepository);

// La plantilla vive en el repo de lambdas ({template_code}/participation_certificate);
// hoy solo existe la default y la pantalla no la deja editar para no romper la
// generación con una carpeta inexistente.
const TEMPLATE_CODE = 'default';

// Backend ↔ picker: la fecha viaja yyyy-mm-dd y el calendario entrega Date local.
function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIsoDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

interface SportDateValue {
  date?: string;
  enabled: boolean;
}

type SportDates = Record<string, SportDateValue>;

// null (fecha default del evento/fase) se guarda bajo esta clave del mapa.
const DEFAULT_KEY = '__default__';

export function CertificateConfigPage() {
  return (
    <NwsEventGuard>
      {(scope) => <CertificateConfigScreen {...scope} />}
    </NwsEventGuard>
  );
}

function CertificateConfigScreen({ event, phase }: NwsEventScope) {
  const { toast } = useContext(NwtContext);
  const canManage = useSession().canActivityByPermission(ACCREDITATION_MANAGE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [config, setConfig] = useState<CertificateConfig | null>(null);
  const [sports, setSports] = useState<EventSport[]>([]);
  const [saving, setSaving] = useState(false);

  // Si ya se intentó guardar. Los campos no se pintan en rojo antes de que la persona haga
  // nada: un formulario que abre con un error es un formulario que regaña sin motivo.
  const [triedSave, setTriedSave] = useState(false);

  const enabled = useInputControl<boolean>(true);
  const [sportDates, setSportDates] = useState<SportDates>({});

  // Con la fase dividida, la configuración y los contadores son del momento elegido.
  const counters = useAccreditationCounters(
    event.code,
    phase?.code,
    undefined,
    phase?.momentCode
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);

    try {
      const [loadedConfig, loadedSports] = await Promise.all([
        repository.getConfig(event.code, phase?.code, phase?.momentCode),
        repository.listEventSports(event.code, phase?.code)
      ]);

      const visibleSports = phase
        ? phase.keepMomentSports(loadedSports)
        : loadedSports;
      const visibleCodes = new Set(visibleSports.map((sport) => sport.code));

      setConfig(loadedConfig);
      setSports(visibleSports);
      enabled.setValue(loadedConfig?.enabled ?? true);

      const initial: SportDates = {};

      // Solo las fechas con fila visible: lo que se guarda es lo que se puede editar.
      for (const sport of loadedConfig?.sports ?? []) {
        if (sport.sportCode && !visibleCodes.has(sport.sportCode)) {
          continue;
        }

        initial[sport.sportCode ?? DEFAULT_KEY] = {
          date: sport.deliveryDate,
          enabled: sport.enabled
        };
      }

      setSportDates(initial);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
    // enabled es un control estable de rolster; meterlo en deps re-dispararía la carga.
  }, [event.code, phase?.code, phase?.momentCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRowChange = useCallback((key: string, value: SportDateValue) => {
    setSportDates((current) => ({ ...current, [key]: value }));
  }, []);

  const rows = useMemo(
    () => [
      { key: DEFAULT_KEY, label: 'Fecha general del evento' },
      ...sports.map((sport) => ({ key: sport.code, label: sport.name }))
    ],
    [sports]
  );

  const save = useCallback(async () => {
    // La fecha general es obligatoria y las de cada deporte no: así lo dice la propia
    // pantalla («Un deporte sin fecha usa la fecha general del evento») y así lo trata el
    // backend, que resuelve delivery_date del POST > fecha del deporte > fecha general y
    // responde 422 si no hay ninguna. Guardar sin ella dejaba la configuración en un estado
    // que se ve bien y no genera nada.
    setTriedSave(true);

    if (!sportDates[DEFAULT_KEY]?.date) {
      toast({
        title: 'Falta la fecha general',
        message: CONFIG_DATE_REQUIRED,
        icon: 'caution',
        theme: 'negative'
      });

      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...(phase?.code ? { phase_code: phase.code } : {}),
        ...(phase?.momentCode ? { moment_code: phase.momentCode } : {}),
        template_code: config?.templateCode ?? TEMPLATE_CODE,
        enabled: enabled.value,
        sports: Object.entries(sportDates)
          .filter(([, value]) => !!value.date)
          .map(([key, value]) => ({
            sport_code: key === DEFAULT_KEY ? null : key,
            delivery_date: value.date as string,
            enabled: value.enabled
          }))
      };

      const saved = await repository.saveConfig(event.code, payload);

      setConfig(saved);
      toast({ ...CONFIG_SAVED_TOAST, icon: 'positive', theme: 'positive' });
    } catch (error) {
      toast({
        title: 'Error',
        message: getApiErrorMessage(error, CONFIG_SAVE_ERROR),
        icon: 'caution',
        theme: 'negative'
      });
    } finally {
      setSaving(false);
    }
  }, [
    config,
    enabled.value,
    event.code,
    phase?.code,
    phase?.momentCode,
    sportDates,
    toast
  ]);

  if (loading) {
    return <NwsLoading />;
  }

  if (loadError) {
    return (
      <NwsRequestError
        error={loadError}
        title={CONFIG_LOAD_ERROR}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <section className="nws-certificates">
      {/* La franja del contexto: el evento a la izquierda y el retrato del evento a la
          derecha, igual que en auditoría. Va FUERA del contenido, a todo el ancho. */}
      <NwsEventBar items={counters} />

      <div className="nws-certificates__content">
        <div className="nws-certificates__header">
          <div className="nws-certificates__description">
            <span className="nwt-h5-font-extrabold">
              {CERTIFICATE_CONFIG_TITLE}
            </span>

            <small className="nwt-smalltext-font-regular nws-certificates__subtitle">
              {CERTIFICATE_CONFIG_SUBTITLE}
            </small>
          </div>

          <div className="nws-certificates__actions">
            <NwtButton
              nwtVariant="loud"
              loading={saving}
              disabled={!canManage}
              onClick={() => void save()}
            >
              Guardar configuración
            </NwtButton>
          </div>
        </div>

        <NwtCard>
          <div className="nws-certificates__general">
            <div className="nws-certificates__switch">
              <NwtSwitchControl formControl={enabled} />
              <span className="nwt-text-font-medium">
                Generación de certificados habilitada
              </span>
            </div>

            {/* ACÁ IBA «Plantilla: default», un campo de solo lectura con un valor
                constante: hoy solo existe esa plantilla y la pantalla no la deja cambiar,
                así que no había nada que decidir ni que mirar. `TEMPLATE_CODE` sigue
                viajando en el payload, que es donde de verdad hace falta. */}
          </div>
        </NwtCard>

        <NwtCard>
          <h3 className="nwt-text-font-medium nws-certificates__section-title">
            Fechas de entrega
          </h3>
          <p className="nwt-smalltext-font-regular nws-certificates__hint">
            La fecha se imprime como «Se entrega a los N días del mes de … de
            …». Un deporte sin fecha usa la fecha general del evento.
          </p>

          <div className="nws-certificates__rows">
            {rows.map((row) => (
              <SportDateRow
                key={row.key}
                label={row.label}
                value={sportDates[row.key]}
                // Solo la general es obligatoria; las de cada deporte caen en ella.
                required={row.key === DEFAULT_KEY}
                showError={triedSave}
                onChange={(value) => onRowChange(row.key, value)}
              />
            ))}
          </div>
        </NwtCard>
      </div>
    </section>
  );
}

interface SportDateRowProps {
  label: string;
  onChange: (value: SportDateValue) => void;
  required?: boolean;
  /** Solo tras intentar guardar: no se abre el formulario en rojo. */
  showError?: boolean;
  value?: SportDateValue;
}

// Fila con hooks propios: los controles de rolster son hooks y las filas son
// dinámicas, así que cada una vive en su propio componente.
function SportDateRow({
  label,
  onChange,
  required = false,
  showError = false,
  value
}: SportDateRowProps) {
  const date = useInputControl<Date | undefined>(fromIsoDate(value?.date));

  useEffect(() => {
    onChange({
      date: date.value ? toIsoDate(date.value) : undefined,
      enabled: value?.enabled ?? true
    });
    // onChange es estable (useCallback del padre).
  }, [date.value]);

  return (
    <div className="nws-certificates__row">
      <span className="nwt-text-font-medium nws-certificates__row-label">
        {label}
      </span>

      <div className="nws-certificates__row-date">
        <NwtDateField
          formControl={date}
          label="Fecha de entrega"
          placeholder="Sin fecha"
          required={required}
          // `errorMessage` del NwtDateField es un string suelto, no el
          // NwtInputBoxMessage que usan el resto de campos del módulo: se manda solo la
          // frase, sin el icono.
          errorMessage={
            required && showError && !date.value
              ? REQUIRED_FIELD_MESSAGE.description
              : undefined
          }
        />
      </div>
    </div>
  );
}
