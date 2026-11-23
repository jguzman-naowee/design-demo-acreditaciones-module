import { HttpEndpoint, HttpMethod } from '@naowee-tech/sdk-frontend-web';
import { registerDependency } from '@rolster/invertly';

import {
  fileDownloadUrl,
  PRESIGNED_UPLOAD_URL,
  useAccreditationMock
} from '../config/api-config';
import { GatewayApiClient } from '../config/gateway-api-client';
import { mockResponse } from '../mocks/mock.helper';
import {
  type FileDownloadResponse,
  PERMISSION_ICON_PURPOSE,
  type PresignedUploadResponse
} from '../models/file-upload.model';

// El bucket de dev no tiene regla CORS para los orígenes de localhost, así que el
// PUT firmado se cae en el preflight («No 'Access-Control-Allow-Origin' header is
// present»). No es un fallo del código —el mismo PUT responde 200 fuera del
// navegador— pero desde el navegador es indistinguible de una caída de red, así
// que hay que decirlo en lugar de mostrar «Failed to fetch».
export class FileUploadBlockedError extends Error {
  constructor(public readonly host: string) {
    super(
      `No pudimos subir el archivo: el almacenamiento lo rechaza desde el navegador. Reintentar no lo arregla, así que hay que avisarle a soporte (${host}).`
    );
    this.name = 'FileUploadBlockedError';
  }
}

// Subida en tres pasos contra file-storage: presignar, subir al bucket con la URL
// firmada y quedarse con el upload_id para registrarlo en el recurso de negocio.
//
// El paso del PUT sigue el patrón ya probado de suite-web-project
// (`commons/data/files/services/presigned-upload.service.ts`), que resuelve tres
// cosas que no son obvias y que se aprendieron a golpes allá.
export class FileUploadRepository {
  constructor(private readonly apiClient: GatewayApiClient) {}

  public uploadPermissionIcon(file: File): Promise<string> {
    return this.upload(file, PERMISSION_ICON_PURPOSE);
  }

  // La URL para ver un archivo ya subido. Es prefirmada y de vida corta, así que
  // el llamador no debe persistirla: se pide cuando se va a mostrar.
  public requestDownloadUrl(
    uploadId: string
  ): Promise<FileDownloadResponse> {
    if (useAccreditationMock()) {
      return mockResponse<FileDownloadResponse>({
        download_url: '',
        expires_at: new Date(Date.now() + 600000).toISOString(),
        file_name: `${uploadId}.svg`,
        size_bytes: 0
      });
    }

    return this.apiClient.execute(
      new HttpEndpoint<FileDownloadResponse>(
        fileDownloadUrl(uploadId),
        HttpMethod.Get
      )
    );
  }

  private async upload(file: File, purpose: string): Promise<string> {
    if (useAccreditationMock()) {
      return crypto.randomUUID();
    }

    const presigned = await this.apiClient.execute(
      new HttpEndpoint<PresignedUploadResponse>(
        PRESIGNED_UPLOAD_URL,
        HttpMethod.Post,
        {
          payload: {
            file_name: file.name,
            content_type: file.type || 'application/octet-stream',
            purpose
          }
        }
      )
    );

    const uploadUrl = normalizeUploadUrl(presigned.upload_url);

    // Este PUT va directo al bucket con la URL firmada, así que no pasa por el
    // ApiClient (le pondría delante el baseUrl del gateway).
    const uploaded = await fetch(uploadUrl, {
      method: 'PUT',
      headers: buildUploadHeaders(uploadUrl, presigned.required_headers, file),
      // El body va como ArrayBuffer y no como File: con un Blob el navegador
      // añade su propio Content-Type y puede chocar con el que firmó el bucket.
      body: await file.arrayBuffer(),
      // Para que la cookie de sesión del gateway no se filtre al bucket.
      credentials: 'omit'
    }).catch(() => {
      // fetch solo lanza TypeError: el detalle del CORS queda en la consola.
      throw new FileUploadBlockedError(new URL(uploadUrl).host);
    });

    if (!uploaded.ok) {
      throw new Error(
        (await uploaded.text().catch(() => '')) ||
          `No pudimos guardar ${file.name}. Vuelve a intentarlo; si sigue igual, avísale a soporte con este código: ${uploaded.status}.`
      );
    }

    return presigned.upload_id;
  }
}

// La URL firmada llega con los `&` escapados: Go los serializa como `&` (que
// JSON.parse ya deshace) y en otros caminos aparecen como `&amp;`. Si alguno
// sobrevive sin decodificar, la query se rompe y con ella la firma.
function normalizeUploadUrl(uploadUrl: string): string {
  return String(uploadUrl ?? '')
    .trim()
    .replace(/&amp;/gi, '&')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

// Solo se reenvían los headers que están en X-Amz-SignedHeaders: mandar uno que
// el bucket no firmó es un 403 SignatureDoesNotMatch. Hoy solo firma `host`, pero
// el Content-Type hay que mandarlo igual porque el objeto se guarda con él.
function buildUploadHeaders(
  uploadUrl: string,
  requiredHeaders: Record<string, string> | undefined,
  file: File
): Record<string, string> {
  const required = requiredHeaders ?? {};
  const headers: Record<string, string> = {};

  const signed = readSignedHeaders(uploadUrl);
  const normalize = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (signed.length) {
    const lookup = new Map(
      Object.entries(required).map(([key, value]) => [
        normalize(key),
        String(value)
      ])
    );

    signed
      .filter((header) => header.toLowerCase() !== 'host')
      .forEach((header) => {
        const value = lookup.get(normalize(header));

        if (value !== undefined) {
          headers[header] = value;
        }
      });
  } else {
    // Sin lista de firmados, los x-amz-* son los que el bucket espera.
    Object.entries(required)
      .filter(([key]) => key.toLowerCase().startsWith('x-amz-'))
      .forEach(([key, value]) => {
        headers[key] = value;
      });
  }

  if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    const declared = Object.entries(required).find(
      ([key]) => key.toLowerCase() === 'content-type'
    );

    headers['Content-Type'] =
      declared?.[1] ?? file.type ?? 'application/octet-stream';
  }

  return headers;
}

function readSignedHeaders(uploadUrl: string): string[] {
  try {
    const params = new URL(uploadUrl).searchParams;
    const signed =
      params.get('X-Amz-SignedHeaders') ?? params.get('X-Goog-SignedHeaders');

    return signed ? signed.split(';').filter(Boolean) : [];
  } catch {
    return [];
  }
}

registerDependency(FileUploadRepository, {
  singleton: true,
  injects: [{ token: GatewayApiClient, singleton: true }]
});
