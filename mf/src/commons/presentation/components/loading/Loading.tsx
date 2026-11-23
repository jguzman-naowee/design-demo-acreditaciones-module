import './Loading.scss';

import { NwtSpinner } from '@naowee-tech/sdk-react-components';
import type { PropsWithChildren } from 'react';

export function NwsLoading({ children }: PropsWithChildren) {
  return (
    <div className="nws-loading">
      <NwtSpinner />
      {children}
    </div>
  );
}
