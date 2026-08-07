// Bloqueo de intentos fallidos de login, guardado en localStorage por correo.
//
// Importante: esto es una capa de UX/fricción en el navegador, NO un control
// de seguridad real — cualquiera puede borrar localStorage o probar en modo
// incógnito. La protección de verdad contra fuerza bruta la da Firebase
// Auth del lado del servidor (después de varios intentos fallidos devuelve
// "auth/too-many-requests" y exige esperar, ver src/firebase/errors.js). Este
// módulo solo evita que alguien reintente sin parar desde la misma pestaña y
// le explica cuánto falta, en vez de dejarlo golpear el botón.

const STORAGE_PREFIX = "torqueflow:loginAttempts:";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function key(email) {
  return STORAGE_PREFIX + email.trim().toLowerCase();
}

function read(email) {
  try {
    const raw = window.localStorage.getItem(key(email));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(email, state) {
  try {
    window.localStorage.setItem(key(email), JSON.stringify(state));
  } catch {
    // localStorage no disponible (modo privado, cuota, etc.): degradar sin romper el login.
  }
}

export function getLockoutStatus(email) {
  if (!email) return { locked: false, remainingMs: 0 };
  const state = read(email);
  if (!state?.lockedUntil) return { locked: false, remainingMs: 0 };
  const remainingMs = state.lockedUntil - Date.now();
  if (remainingMs <= 0) return { locked: false, remainingMs: 0 };
  return { locked: true, remainingMs };
}

export function registerFailedAttempt(email) {
  if (!email) return getLockoutStatus(email);
  const current = read(email) || { count: 0 };
  const count = current.count + 1;
  const state = { count, lastAttemptAt: Date.now() };
  if (count >= MAX_ATTEMPTS) state.lockedUntil = Date.now() + LOCKOUT_MS;
  write(email, state);
  return getLockoutStatus(email);
}

export function clearAttempts(email) {
  if (!email) return;
  try {
    window.localStorage.removeItem(key(email));
  } catch {
    // ignorar
  }
}

export function formatRemaining(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.ceil((ms % 60000) / 1000);
  if (minutes > 0) return `${minutes} min ${seconds}s`;
  return `${seconds}s`;
}

export const LOGIN_LOCKOUT_CONFIG = { MAX_ATTEMPTS, LOCKOUT_MS };
