import type { HttpEndpoint } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { mockResponse } from '../mocks/mock.helper';
import { MOCK_RESPONSES } from '../mocks/mock.registry';
import { ApiClient } from './api-client';

// TODO(api): cliente de las cuatro colecciones que NO tienen contrato en el
// gateway (acreditaciones, lotes, bitácora y personas habilitadas): resuelve
// cada ruta contra el registro de mocks, con lista vacía si no está registrada,
// para que los repositorios reales trabajen con datos en memoria. Las pantallas
// que sí tienen endpoint usan GatewayApiClient y hablan con el gateway.
export class MockApiClient extends ApiClient {
  public override execute<T>(endpoint: HttpEndpoint<T>): Promise<T> {
    return mockResponse((MOCK_RESPONSES[endpoint.path] ?? []) as unknown as T);
  }
}

registerDependency(MockApiClient, { singleton: true });
