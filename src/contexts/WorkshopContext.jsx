import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { workshopRef } from "../firebase/paths";
import { EMPTY_WORKSHOP_SETTINGS } from "../config/constants";

const WorkshopContext = createContext(null);

export function WorkshopProvider({ children }) {
  const [workshop, setWorkshop] = useState(EMPTY_WORKSHOP_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      workshopRef(),
      (snapshot) => {
        setWorkshop({ ...EMPTY_WORKSHOP_SETTINGS, ...(snapshot.exists() ? snapshot.data() : {}) });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ workshop, loading }), [workshop, loading]);
  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

export function useWorkshop() {
  const context = useContext(WorkshopContext);
  if (!context) throw new Error("useWorkshop debe utilizarse dentro de WorkshopProvider.");
  return context;
}
