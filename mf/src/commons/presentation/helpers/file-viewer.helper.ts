import { FileUploadRepository } from '@mf-accreditations/data';
import { invertly } from '@rolster/invertly';

const repository = invertly(FileUploadRepository);

// Cuánto antes de que expire se considera vencida una URL. Si se apura el último segundo, la
// pestaña puede abrirse justo cuando el enlace deja de valer.
const MARGEN = 30_000;

// Las URL ya firmadas, mientras sigan valiendo.
//
// Cachear SÍ sirve, aunque el enlace dure minutos: la respuesta trae su `expires_at`, y dentro
// de esa ventana el usuario cambia de pestaña de PDF varias veces. Sin caché, cada ida y vuelta
// entre «PDF 1» y «PDF 2» costaba una petición de firma, y volver a la primera otra más.
//
// De proceso y sin invalidación: un `upload_id` apunta siempre al mismo archivo, y lo único que
// caduca es la firma, que es justo lo que se comprueba.
const firmadas = new Map<string, { url: string; expiresAt: number }>();

function firmadaVigente(uploadId: string): string | undefined {
  const guardada = firmadas.get(uploadId);

  if (!guardada) {
    return undefined;
  }

  if (guardada.expiresAt - MARGEN <= Date.now()) {
    firmadas.delete(uploadId);

    return undefined;
  }

  return guardada.url;
}

// Abrir un archivo de file-storage cuesta una petición: hay que cambiar su `upload_id` por una
// URL prefirmada. Por eso se resuelve BAJO DEMANDA y no al pintar una lista: una tabla de N
// filas serían N peticiones en cada carga.
export async function resolveUploadedFileUrl(
  uploadId: string
): Promise<string> {
  const vigente = firmadaVigente(uploadId);

  if (vigente) {
    return vigente;
  }

  const file = await repository.requestDownloadUrl(uploadId);

  if (!file.download_url) {
    throw new Error('El archivo no tiene una URL de descarga disponible.');
  }

  const expiresAt = file.expires_at
    ? new Date(file.expires_at).getTime()
    : Date.now() + MARGEN;

  firmadas.set(uploadId, { url: file.download_url, expiresAt });

  return file.download_url;
}

export async function openUploadedFile(uploadId: string): Promise<void> {
  const url = await resolveUploadedFileUrl(uploadId);

  // noopener para que la pestaña abierta no herede window.opener.
  window.open(url, '_blank', 'noopener');
}

// Varios archivos de un tirón, que es lo que pide un lote partido en chunks.
//
// El orden importa y no es un detalle de estilo: se firman TODAS las URL primero y solo después
// se abren las pestañas, en un bucle sin `await` en medio. Con un `await` entre apertura y
// apertura, el navegador deja de considerarlas parte del gesto del usuario y el bloqueador de
// ventanas se come todas menos la primera.
//
// Devuelve cuántas se abrieron de verdad: `window.open` responde null cuando el bloqueador la
// tumba, y quien llama tiene que poder decirlo en vez de dar por hecho que salieron todas.
export async function openUploadedFiles(
  uploadIds: string[]
): Promise<{ abiertas: number; total: number }> {
  const urls = await Promise.all(
    uploadIds.map((uploadId) => resolveUploadedFileUrl(uploadId))
  );

  let abiertas = 0;

  for (const url of urls) {
    if (window.open(url, '_blank', 'noopener')) {
      abiertas += 1;
    }
  }

  return { abiertas, total: urls.length };
}
