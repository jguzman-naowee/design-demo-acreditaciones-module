interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly APP_TITLE: string;
  readonly API_URL_V1: string;
  readonly API_URL_V2: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Interruptor de demo sin recompilar; ver useAccreditationMock().
//
// Tiene que ser `var`: TypeScript solo trata como propiedades de `globalThis` a las
// declaraciones globales con `var`, y api-config lo lee así. Con `let` compila el archivo
// pero rompe ese acceso, que es lo que pasó cuando el autofix de eslint lo cambió.
// eslint-disable-next-line no-var
declare var __NAOWEE_ACCREDITATION_MOCK__: boolean | undefined;

declare module '*.scss';

declare module '*.woff' {
  const url: string;
  export default url;
}

declare module '*.svg' {
  const url: string;
  export default url;
}

// La tipografía de iconos se importa para que el bundler la emita y nos dé su URL; ver
// icon-font.ts para por qué hay que rearmar el @font-face a mano.
declare module '*.woff' {
  const url: string;
  export default url;
}
