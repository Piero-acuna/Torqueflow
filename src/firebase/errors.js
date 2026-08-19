/**
 * Traduce códigos de error de Firebase Auth a mensajes en español.
 * Usado por AuthContext para mostrar errores al usuario.
 */
const MESSAGES = {
  "auth/invalid-credential":        "Correo o contraseña incorrectos.",
  "auth/user-not-found":            "No existe una cuenta con ese correo.",
  "auth/wrong-password":            "Contraseña incorrecta.",
  "auth/email-already-in-use":      "Ya existe una cuenta con ese correo.",
  "auth/weak-password":             "La contraseña debe tener al menos 6 caracteres.",
  "auth/invalid-email":             "El correo no tiene un formato válido.",
  "auth/user-disabled":             "Esta cuenta ha sido deshabilitada.",
  "auth/too-many-requests":         "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "auth/network-request-failed":    "Error de red. Verifica tu conexión.",
  "auth/requires-recent-login":     "Por seguridad, vuelve a iniciar sesión.",
  "auth/popup-closed-by-user":      "Ventana de acceso cerrada. Inténtalo de nuevo.",
  "auth/cancelled-popup-request":   "Acceso cancelado.",
  "auth/operation-not-allowed":     "Método de acceso no habilitado.",
  "auth/account-exists-with-different-credential": "Ya existe una cuenta con ese correo usando otro método."
};

export function firebaseErrorMessage(error) {
  if (!error) return "Error desconocido.";
  return MESSAGES[error.code] || error.message || "Ocurrió un error inesperado.";
}
