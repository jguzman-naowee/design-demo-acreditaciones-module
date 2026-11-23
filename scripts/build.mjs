// Compila el micro de acreditaciones (vendorizado en mf/) junto con el simulador del gateway.
import path from 'path';
import { fileURLToPath } from 'url';

import esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await esbuild.build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  minify: true,
  outfile: path.join(root, 'mobile/apps/acreditaciones/assets/app.js'),
  tsconfig: path.join(root, 'tsconfig.json'),
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' },
  plugins: [sassPlugin({ loadPaths: [path.join(root, 'node_modules')] })],
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@mf-accreditations': path.join(root, 'mf/src/commons') },
  logLevel: 'warning'
});
console.log('Listo: mobile/apps/acreditaciones/assets/app.js y app.css');
