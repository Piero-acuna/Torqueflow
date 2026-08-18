import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { EMPTY_WORKSHOP_SETTINGS } from "../config/constants";
import { useAuth } from "./AuthContext";

const WorkshopContext = createContext(null);

export function WorkshopProvider({ children }) {
  const { workshopId } = useAuth();
  const [workshop, setWorkshop] = useState(EMPTY_WORKSHOP_SETTINGS);
  const [loading, setLoading]   = useState(true);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!workshopId) {
      setWorkshop(EMPTY_WORKSHOP_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);

    // ── 1. Carga inicial ─────────────────────────────────────────────────
    supabase
      .from("workshops")
      .select("*")
      .eq("id", workshopId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setWorkshop({ ...EMPTY_WORKSHOP_SETTINGS, ...toWorkshop(data) });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // ── 2. Suscripción en tiempo real ────────────────────────────────────
    const channel = supabase
      .channel(`workshops:${workshopId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "workshops", filter: `id=eq.${workshopId}` },
        ({ new: row }) => {
          if (row) setWorkshop((prev) => ({ ...prev, ...toWorkshop(row) }));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workshopId]);

  const value = useMemo(() => ({ workshop, loading }), [workshop, loading]);
  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

// Transforma snake_case de Postgres a camelCase para que los componentes
// existentes funcionen sin cambios.
function toWorkshop(row) {
  return {
    id:                   row.id,
    businessName:         row.business_name,
    legalName:            row.legal_name,
    taxId:                row.tax_id,
    phone:                row.phone,
    email:                row.email,
    address:              row.address,
    currency:             row.currency,
    taxRate:              row.tax_rate,
    laborHourRate:        row.labor_hour_rate,
    dailyGoal:            row.daily_goal,
    orderPrefix:          row.order_prefix,
    nextOrderNumber:      row.next_order_number,
    requireApproval:      row.require_approval,
    preventNegativeStock: row.prevent_negative_stock,
    notifyReady:          row.notify_ready,
    notifyDelay:          row.notify_delay,
    notifyDelivered:      row.notify_delivered,
    active:               row.active,
    terms:                row.terms,
    documentFooter:       row.document_footer
  };
}

export function useWorkshop() {
  const context = useContext(WorkshopContext);
  if (!context) throw new Error("useWorkshop debe utilizarse dentro de WorkshopProvider.");
  return context;
}
