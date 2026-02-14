import { createClient } from '@supabase/supabase-js';

// ── Tipos de la base de datos ──────────────────────────────────────────────

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;            // formato YYYY-MM-DD
  user_id: string | null;
  es_todo_el_dia: boolean;  // true = evento sin hora específica
  hora_inicio: string | null; // formato HH:MM
  hora_fin: string | null;    // formato HH:MM
}

export interface Todo {
  id: string;
  user_id: string | null;
  titulo: string;
  fecha: string;              // formato YYYY-MM-DD
  completado: boolean;
}

export interface DailyWellness {
  id: string;
  user_id: string | null;
  fecha: string;            // formato YYYY-MM-DD
  agua_litros: number;      // 0 – 6
  pasos: number;            // 0 – 20000
  horas_sueno: number;      // 0 – 24
}

// ── Cliente de Supabase ────────────────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️  Faltan variables de entorno de Supabase. ' +
    'Asegúrate de tener EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en tu .env'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');