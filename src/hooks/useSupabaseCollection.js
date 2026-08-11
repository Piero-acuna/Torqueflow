/**
 * src/hooks/useSupabaseCollection.js
 *
 * Hook que suscribe a una tabla de Supabase via Supabase Realtime
 * (postgres_changes). Reemplaza a useCollection.js (Firebase onSnapshot).
 *
 * Uso:
 *   const { data, loading } = useSupabaseCollection("orders", workshopId, {
 *     filter: { column: "status", value: "review" },
 *     orderBy: { column: "created_at", ascending: false }
 *   });
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * @param {string} table     - Nombre de la tabla de Postgres.
 * @param {string} workshopId - workshop_id para filtrar vía RLS y query.
 * @param {object} options
 *   @param {{ column: string, value: any }?}      options.filter  - Filtro adicional (ej: status).
 *   @param {{ column: string, ascending: boolean }?} options.orderBy - Orden de la consulta inicial.
 *   @param {boolean?}                             options.enabled - Habilitar/deshabilitar.
 */
export function useSupabaseCollection(table, workshopId, options = {}) {
  const { filter, orderBy, enabled = true } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!workshopId || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // ── 1. Carga inicial ─────────────────────────────────────────────────
    async function fetchInitial() {
      let query = supabase
        .from(table)
        .select("*")
        .eq("workshop_id", workshopId);

      if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data: rows, error } = await query;
      if (!error) setData(rows || []);
      setLoading(false);
    }

    fetchInitial();

    // ── 2. Suscripción en tiempo real ────────────────────────────────────
    // Supabase Realtime notifica INSERT / UPDATE / DELETE en la tabla.
    // Filtramos por workshop_id directamente en el canal para mayor eficiencia.
    const channelName = `${table}:${workshopId}:${filter?.value || "all"}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table,
          filter: `workshop_id=eq.${workshopId}`
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          setData((prev) => {
            if (eventType === "INSERT") {
              // Evitar duplicados si la carga inicial ya lo incluyó
              if (prev.some((r) => r.id === newRow.id)) return prev;
              return [newRow, ...prev];
            }
            if (eventType === "UPDATE") {
              return prev.map((r) => (r.id === newRow.id ? newRow : r));
            }
            if (eventType === "DELETE") {
              return prev.filter((r) => r.id !== oldRow.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, workshopId, enabled, filter?.column, filter?.value, orderBy?.column]);

  return { data, loading };
}
