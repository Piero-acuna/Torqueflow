import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { auth, setWorkshopId } from "../firebase/client";
import { memberRef, userRef } from "../firebase/paths";
import { firebaseErrorMessage } from "../firebase/errors";
import { clearAttempts, getLockoutStatus, registerFailedAttempt, formatRemaining } from "../lib/loginAttempts";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [workshopId, setWorkshopIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setError("");
      if (!nextUser) {
        setMember(null);
        setWorkshopId(null);
        setWorkshopIdState("");
        setLoading(false);
        return;
      }
      try {
        // Cada usuario pertenece a un único taller, resuelto vía el
        // documento users/{uid} (lo escribe el backend al registrar el
        // taller o al invitar a alguien, nunca el cliente). Sin ese
        // documento no hay forma de saber qué taller consultar: se trata
        // igual que "acceso pendiente".
        const userSnapshot = await getDoc(userRef(nextUser.uid));
        if (!userSnapshot.exists() || !userSnapshot.data().workshopId) {
          setWorkshopId(null);
          setWorkshopIdState("");
          setMember(null);
          setLoading(false);
          return;
        }
        const resolvedWorkshopId = userSnapshot.data().workshopId;
        setWorkshopId(resolvedWorkshopId);
        setWorkshopIdState(resolvedWorkshopId);

        const snapshot = await getDoc(memberRef(nextUser.uid));
        const memberData = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
        setMember(memberData);
        if (memberData?.active !== false) clearAttempts(nextUser.email);
      } catch (memberError) {
        setError(firebaseErrorMessage(memberError));
        setMember(null);
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
    () => ({ user, member, workshopId, loading, error, login, logout, register, resetPassword, isAdmin: member?.role === "admin" }),
    [user, member, workshopId, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return context;
}
