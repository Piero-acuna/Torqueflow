const FRIENDLY_ERRORS = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/user-disabled": "Este usuario está deshabilitado.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
  "permission-denied": "No tienes permiso para realizar esta acción.",
  "failed-precondition": "La operación requiere una configuración adicional en Firebase.",
  unavailable: "Firebase no está disponible temporalmente."
};

export function firebaseErrorMessage(error) {
  return FRIENDLY_ERRORS[error?.code] || error?.message || "Ocurrió un error inesperado.";
}
