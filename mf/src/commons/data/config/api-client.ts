import { ApiClient as NaoweeApiClient } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import { API_CONFIG } from './api-config';

// El `x-trace-id` del gateway llega en `ApiError.traceId` desde el SDK 2.10: el
// interceptor tiene que vivir ahí porque el SDK viaja federado con su propia instancia
// de liomaze, y un interceptor registrado desde acá quedaría en otra y no correría.
export class ApiClient extends NaoweeApiClient {
  constructor() {
    super(API_CONFIG);
  }
}

registerDependency(ApiClient, { singleton: true });
