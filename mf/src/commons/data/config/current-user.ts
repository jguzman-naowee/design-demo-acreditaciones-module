// TODO(api): quién ejecuta la acción lo sellará el backend en el servidor. Hasta
// entonces el historial necesita un autor, y los repositorios son singletons de
// la capa de datos que no pueden leer el contexto de React: el módulo remoto
// deja aquí el nombre de la sesión al montar, igual que el shell configura el
// runtime con setRuntimeConfig.
const UNKNOWN_USER = 'Sistema';

let currentUser = UNKNOWN_USER;

export function setCurrentUser(name?: string): void {
  currentUser = name?.trim() || UNKNOWN_USER;
}

export function getCurrentUser(): string {
  return currentUser;
}
