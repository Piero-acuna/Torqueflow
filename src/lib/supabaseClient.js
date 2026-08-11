import { createClient } from "@supabase/supabase-js";

// VITE_SUPABASE_URL  → URL del proyecto (ej: https://xxxx.supabase.co)
// VITE_SUPABASE_ANON_KEY → clave pública (anon), segura para el navegador.
//
// Esta clave solo puede LEER datos mediante las políticas RLS de "solo lectura
// filtrada por workshop_id". Nunca expone el service_role key al cliente.

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY al .env"
  );
}

export const supabase = createClient(url || "", key || "", {
  auth: {
    // El cliente usa Firebase Auth, no Supabase Auth.
    // Desactivamos sesiones de Supabase para evitar conflictos.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
