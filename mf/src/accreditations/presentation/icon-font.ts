import iconsWoff from '@naowee-tech/sdk-frontend-foundations/fonts/icons.woff';

const STYLE_ID = 'nws-accreditations-icon-font';

// La tipografía de iconos del módulo, con FAMILIA PROPIA.
//
// Va en TypeScript y no en el SCSS por dos razones distintas:
//
// 1. La URL. El CSS del módulo viaja inyectado como <style> dentro del chunk expuesto
//    (`sassPlugin({ type: 'style' })` en el pipeline del SDK), y por ese camino esbuild no
//    reescribe los `url()`: quedaría el especificador de paquete literal, que el navegador
//    resuelve contra el documento del ANFITRIÓN y da 404. El archivo sí se publica junto al
//    chunk, así que la URL se arma con `import.meta.url`, que es lo único que sabe de dónde se
//    cargó el módulo —el CDN o localhost—.
//
// 2. El nombre. Es `-naotech-icons-nws`, no `-naotech-icons`: la suite ya declara esa familia
//    apuntando a SU archivo, con otros codepoints, y declararla otra vez le cambiaba los iconos
//    a toda la aplicación (la campana salía trofeo, #9). Con familia propia nadie choca, y las
//    reglas acotadas de `module-icons.generated.scss` son las que la usan.
//
// Solo woff: lo entienden todos los navegadores donde corre la suite, y ahorra los 39 KB del
// ttf.
export function installIconFont(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@font-face{font-display:block;font-family:'-naotech-icons-nws';font-style:normal;font-weight:400;src:url("${new URL(iconsWoff, import.meta.url).href}") format("woff")}`;

  document.head.appendChild(style);
}
