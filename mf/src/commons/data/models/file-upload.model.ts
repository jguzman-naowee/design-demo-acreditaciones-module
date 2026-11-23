// POST /v1/files/presigned-upload — FileStorageMsPresignedUploadRequest. El
// gateway no valida nada de esto (no tiene tags de validación): los rechazos de
// tipo o tamaño vienen de file-storage-ms.
export interface PresignedUploadPayload {
  file_name: string;
  content_type: string;
  purpose: string;
}

export interface PresignedUploadResponse {
  upload_id: string;
  upload_url: string;
  // Hay que reenviarlos TODOS al hacer el PUT: S3 firma la petición con ellos y
  // responde 403 si sobra o falta alguno.
  required_headers?: Record<string, string>;
  expires_at: string;
  max_size_bytes: number;
}

// El purpose del icono de un permiso de acreditación, según la colección Bruno
// de file-storage.
export const PERMISSION_ICON_PURPOSE = 'PERMISSION_ICON_FILE';

// GET /v1/files/{upload_id}/download-url — FileStorageMsDownloadURLResponse. La
// URL es prefirmada y expira, así que no se puede guardar: hay que pedirla cada
// vez que haga falta mostrar el archivo.
export interface FileDownloadResponse {
  download_url: string;
  expires_at: string;
  file_name: string;
  size_bytes: number;
}
