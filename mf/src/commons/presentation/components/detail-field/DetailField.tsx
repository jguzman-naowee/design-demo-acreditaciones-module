import './DetailField.scss';

import type { ReactNode } from 'react';

interface NwsDetailFieldProps {
  children: ReactNode;
  label: string;
}

// El SDK no tiene el par etiqueta/valor del diseño: NwtReadonlyField dibuja un
// <input> con borde y foco, y su valor solo admite texto (no un badge). La
// rampa tipográfica es la misma de NwtBannerInformation.
export function NwsDetailField({ children, label }: NwsDetailFieldProps) {
  return (
    <div className="nws-detail-field">
      <span className="nws-detail-field__label nwt-smalltext-font-medium">
        {label}
      </span>

      <span className="nws-detail-field__value nwt-body-font-semibold">
        {children}
      </span>
    </div>
  );
}
