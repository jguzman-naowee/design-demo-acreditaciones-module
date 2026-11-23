import './RequestError.scss';

import { NwtEmptyState, NwtIcon } from '@naowee-tech/sdk-react-components';

import { getApiErrorMessage } from '../../helpers/api-error.helper';

interface RequestErrorProps {
  // El error que dejó el controlador del repositorio en su estado de falla.
  error?: unknown;
  onRetry: () => void;
  title?: string;
}

// Las pantallas conectadas al gateway necesitan algo que mostrar cuando el
// microservicio no responde; sin esto el estado de falla dejaba la página en
// blanco.
export function NwsRequestError({ error, onRetry, title }: RequestErrorProps) {
  return (
    <div className="nws-request-error">
      <NwtEmptyState
        illustration={<NwtIcon value="caution" />}
        title={title ?? 'No pudimos cargar la información'}
        description={getApiErrorMessage(
          error,
          'Revisa tu conexión e inténtalo de nuevo.'
        )}
        actionLabel="Reintentar"
        showAction={true}
        onActionClick={onRetry}
      />
    </div>
  );
}
