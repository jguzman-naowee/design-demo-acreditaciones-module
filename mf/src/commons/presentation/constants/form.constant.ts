import type { NwtInputBoxMessage } from '@naowee-tech/sdk-react-components';

// El SDK pinta "Campo con errores" cuando un campo está en error y no se le pasa
// un mensaje, y el validador `required` de @rolster dice "Campo es requerido":
// ninguno es el texto del diseño. Ojo: el SDK usa `message` también como texto
// de ayuda cuando NO hay error, así que hay que pasarlo condicionado a `wrong`.
export const REQUIRED_FIELD_MESSAGE: NwtInputBoxMessage = {
  // «Debe diligenciarse» y no «es obligatorio»: lo pidió QA así, y dice qué hacer en vez de
  // constatar una propiedad del campo. El asterisco del rótulo ya avisa de que es obligatorio.
  description: 'Este campo debe diligenciarse',
  icon: { value: 'caution', theme: 'negative' }
};
