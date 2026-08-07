import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { auth, workshopId } from "../firebase/client";
import { memberRef } from "../firebase/paths";
import { firebaseErrorMessage } from "../firebase/errors";
import { clearAttempts, getLockoutStatus, registerFailedAttempt, formatRemaining } from "../lib/loginAttempts";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setError("");
      if (!nextUser || !workshopId) {
        setMember(null);
        setLoading(false);
        return;
      }
      try {
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
    () => ({ user, member, loading, error, login, logout, resetPassword, isAdmin: member?.role === "admin" }),
    [user, member, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return context;
}
