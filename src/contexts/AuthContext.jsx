import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { auth } from "../firebase/client";
import { firebaseErrorMessage } from "../firebase/errors";
import {
  clearAttempts,
  formatRemaining,
  getLockoutStatus,
  registerFailedAttempt
} from "../lib/loginAttempts";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [member, setMember]           = useState(null);
  const [workshopId, setWorkshopIdState] = useState("");
  const [workshop, setWorkshop]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setError("");

      if (!nextUser) {
        setMember(null);
        setWorkshopIdState("");
        setWorkshop(null);
        setLoading(false);
        return;
      }

      try {
        // Obtiene el workshopId y los datos del miembro desde el backend
        // (que consulta Supabase). No toca Firestore en absoluto.
        const token = await nextUser.getIdToken();

        // Primero necesitamos el workshopId; lo obtenemos desde la tabla users
        // de Supabase consultando /api/auth/session sin workshopId (bootstrap).
        // Para esto usamos un endpoint ligero que solo resuelve el uid -> workshopId.
        const userRes = await fetch("/api/auth/user", {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) {
          setMember(null);
          setWorkshopIdState("");
          setWorkshop(null);
          setLoading(false);
          return;
        }

        const { workshopId: resolvedWorkshopId } = await userRes.json();
        if (!resolvedWorkshopId) {
          setMember(null);
          setWorkshopIdState("");
          setWorkshop(null);
          setLoading(false);
          return;
        }

        // Ahora obtenemos los datos completos del taller y del miembro.
        const sessionRes = await fetch(
          `/api/auth/session?workshopId=${resolvedWorkshopId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!sessionRes.ok) {
          setMember(null);
          setWorkshopIdState("");
          setWorkshop(null);
          setLoading(false);
          return;
        }

        const session = await sessionRes.json();
        setWorkshopIdState(session.workshopId);
        setMember(session.member);
        setWorkshop(session.workshop);

        if (session.member?.active !== false) {
          clearAttempts(nextUser.email);
        }
      } catch (sessionError) {
        setError(firebaseErrorMessage(sessionError));
        setMember(null);
        setWorkshop(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  async function login(email, password) {
    setError("");
    const normalizedEmail = email.trim();
    const lockout = getLockoutStatus(normalizedEmail);
    if (lockout.locked) {
      const message = `Demasiados intentos fallidos. Espera ${formatRemaining(lockout.remainingMs)} o usa "Olvidé mi contraseña".`;
      setError(message);
      throw new Error(message);
    }
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      clearAttempts(normalizedEmail);
    } catch (loginError) {
      const attempt = registerFailedAttempt(normalizedEmail);
      const message = attempt.locked
        ? `Demasiados intentos fallidos. Espera ${formatRemaining(attempt.remainingMs)} o usa "Olvidé mi contraseña".`
        : firebaseErrorMessage(loginError);
      setError(message);
      throw new Error(message);
    }
  }

  async function register({ workshopName, ownerName, email, password }) {
    setError("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workshopName, ownerName, email, password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error || "No se pudo crear el taller.";
      setError(message);
      throw new Error(message);
    }
    await login(email, password);
    return payload;
  }

  async function resetPassword(email) {
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (resetError) {
      const message = firebaseErrorMessage(resetError);
      setError(message);
      throw new Error(message);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  const value = useMemo(
    () => ({
      user,
      member,
      workshop,
      workshopId,
      loading,
      error,
      login,
      logout,
      register,
      resetPassword,
      isAdmin: member?.role === "admin"
    }),
    [user, member, workshop, workshopId, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return context;
}
