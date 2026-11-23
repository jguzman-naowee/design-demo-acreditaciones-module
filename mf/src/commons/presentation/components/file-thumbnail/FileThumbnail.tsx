import './FileThumbnail.scss';

import { FileUploadRepository } from '@mf-accreditations/data';
import { invertly } from '@rolster/invertly';
import { useEffect, useState } from 'react';

const repository = invertly(FileUploadRepository);

// Resolver un upload_id cuesta una petición, así que esto NO sirve para una tabla:
// N filas serían N peticiones en cada carga, y por eso en el catálogo de permisos
// ver el icono es una acción bajo demanda.
//
// Acá sí se pinta porque el coste está acotado y es conocido: son los dos a cinco
// permisos de UNA acreditación, en una pantalla que se abre de a una.
//
// La URL prefirmada expira, así que se cachea por upload_id con margen y no se
// guarda en la entidad.
const cache = new Map<string, { url: string; expiresAt: number }>();

const EXPIRY_MARGIN_MS = 30_000;

function readCached(uploadId: string): string | undefined {
  const entry = cache.get(uploadId);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt - EXPIRY_MARGIN_MS <= Date.now()) {
    cache.delete(uploadId);

    return undefined;
  }

  return entry.url;
}

interface FileThumbnailProps {
  // Qué representa el archivo, para el texto alternativo.
  label: string;
  uploadId: string | null;
}

export function NwsFileThumbnail({ label, uploadId }: FileThumbnailProps) {
  const [url, setUrl] = useState<string | undefined>(() =>
    uploadId ? readCached(uploadId) : undefined
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uploadId) {
      return;
    }

    const cached = readCached(uploadId);

    if (cached) {
      setUrl(cached);

      return;
    }

    let active = true;

    repository
      .requestDownloadUrl(uploadId)
      .then((file) => {
        if (!file.download_url) {
          return;
        }

        cache.set(uploadId, {
          url: file.download_url,
          expiresAt: new Date(file.expires_at).getTime()
        });

        if (active) {
          setUrl(file.download_url);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [uploadId]);

  // Sin archivo, o si no se pudo resolver, no se deja un hueco roto: el llamador
  // decide qué poner en su lugar con `children` de su propio layout.
  if (!uploadId || failed || !url) {
    return <span className="nws-file-thumbnail nws-file-thumbnail--empty" />;
  }

  return (
    <span className="nws-file-thumbnail">
      <img src={url} alt={`Icono de ${label}`} onError={() => setFailed(true)} />
    </span>
  );
}
