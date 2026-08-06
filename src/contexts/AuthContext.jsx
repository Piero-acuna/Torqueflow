import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { auth, workshopId } from "../firebase/client";
import { memberRef } from "../firebase/paths";
import { firebaseErrorMessage } from "../firebase/errors";

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
        setMember(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
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
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (loginError) {
      const message = firebaseErrorMessage(loginError);
      setError(message);
      throw new Error(message);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  const value = useMemo(
    () => ({ user, member, loading, error, login, logout, isAdmin: member?.role === "admin" }),
    [user, member, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return context;
}
