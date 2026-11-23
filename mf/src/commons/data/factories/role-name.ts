// El nombre del tipo de acreditado, para mostrar.
//
// El contrato tiene dos campos para lo mismo: `role_code` —la identidad, en inglés y en
// mayúsculas: ATHLETE, DELEGADO— y `role_name`, el nombre que alguien escribió al crear el
// tipo. Medido en staging el 2026-08-25:
//
//     GET /v1/accreditation/roles?event_id=12
//     → { "role_code": "ATHLETE", "role_name": "Deportista (ATHLETE)" }
//
// O sea que el código venía DENTRO del nombre, porque así se creó el tipo. Y como el nombre se
// pinta en el listado de acreditados, en el detalle, en el perfil y en los desplegables, ese
// «(ATHLETE)» salía por todo el módulo. QA lo reportó como texto en inglés.
//
// Se limpia acá, en la fábrica, y no en cada pantalla: son quince sitios donde se muestra un
// nombre de rol, y el que se olvide es el que lo vuelve a sacar.
//
// Solo se quita el paréntesis final cuando repite EXACTAMENTE el código. Un tipo llamado
// «Deportista (juvenil)» se queda como está: eso es parte del nombre, no un código pegado.
//
// `code` va vacío donde el contrato no lo manda: la validación en punto de acceso solo trae
// `role_name`. Ahí se quita cualquier paréntesis final que SEA un código —mayúsculas, dígitos,
// guiones— porque en este módulo eso es siempre el role_code. Un «(juvenil)» en minúsculas se
// respeta igual.
export function toRoleLabel(
  name: string | null | undefined,
  code = ''
): string {
  const raw = (name ?? '').trim();

  // Sin nombre, el código es lo único que hay: mejor eso que una fila sin tipo.
  if (!raw) {
    return code;
  }

  if (!code) {
    return raw.replace(/\s*\(\s*[A-Z0-9_-]{2,}\s*\)\s*$/, '').trim() || raw;
  }

  const suffix = new RegExp(
    `\\s*\\(\\s*${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)\\s*$`,
    'i'
  );

  // Un nombre que solo trae el código entre paréntesis quedaría vacío: se devuelve el código.
  return raw.replace(suffix, '').trim() || code;
}
