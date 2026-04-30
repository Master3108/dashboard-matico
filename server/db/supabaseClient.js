// =====================================================================
// MATICO - Cliente unico de Supabase
// =====================================================================
// Este archivo crea UNA SOLA instancia del cliente de Supabase y la
// exporta. Todos los wrappers (questionBank.js, users.js, etc.) usan
// este mismo cliente para que no se abran multiples conexiones.
//
// Carga las credenciales desde .env (variables SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY). Si faltan, el server NO arranca y avisa
// claramente cual falta.
//
// Uso:
//   import { supabase } from './db/supabaseClient.js';
//   const { data, error } = await supabase.from('subjects').select('*');
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    throw new Error(
        '[supabaseClient] Falta SUPABASE_URL en .env. ' +
        'Anadi en server/.env la linea: ' +
        'SUPABASE_URL=https://tuproyecto.supabase.co'
    );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        '[supabaseClient] Falta SUPABASE_SERVICE_ROLE_KEY en .env. ' +
        'Anadi en server/.env la linea: ' +
        'SUPABASE_SERVICE_ROLE_KEY=sb_secret_...'
    );
}

// El service_role_key bypassa Row Level Security (RLS), por eso solo se
// usa en backend. NUNCA se debe exponer al frontend.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    global: {
        headers: {
            'X-Client-Info': 'matico-backend'
        }
    }
});

// Helper estandar: lanza error legible si la respuesta de Supabase trae
// `error`. Util para que los wrappers no tengan que repetir el `if`.
export const ensureSupabaseOk = (response, contextMsg = '') => {
    if (response && response.error) {
        const ctx = contextMsg ? ` (${contextMsg})` : '';
        const err = new Error(`Supabase error${ctx}: ${response.error.message}`);
        err.cause = response.error;
        throw err;
    }
    return response?.data ?? null;
};
