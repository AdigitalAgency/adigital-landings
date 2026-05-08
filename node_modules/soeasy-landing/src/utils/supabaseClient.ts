import { createSupabaseClient } from '@adigital/shared';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL') 
  ? createSupabaseClient(supabaseUrl, supabaseAnonKey) 
  : null as any;
