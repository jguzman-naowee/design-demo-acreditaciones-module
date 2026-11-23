import type { HttpEndpoint } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { mockResponse } from '../mocks/mock.helper';
import { MOCK_RESPONSES } from '../mocks/mock.registry';
import { ApiClient } from './api-client';
import { useAccreditationMock } from './api-config';

// Cliente de las pantallas que sí tienen contrato en el gateway. Por defecto
// habla con el gateway de verdad; si el interruptor de demo está activo resuelve
// contra el registro de mocks, que guarda las respuestas con la misma forma del
// contrato congelado para que los factories se ejerciten igual en los dos
// caminos. La decisión se toma en cada llamada, no al registrar la dependencia,
// porque el interruptor se puede prender desde la consola del navegador.
export class GatewayApiClient extends ApiClient {
  public override execute<T>(endpoint: HttpEndpoint<T>): Promise<T> {
    if (useAccreditationMock()) {
      return mockResponse(MOCK_RESPONSES[endpoint.path] as T);
    }

    return super.execute(endpoint);
  }
}

registerDependency(GatewayApiClient, { singleton: true });
