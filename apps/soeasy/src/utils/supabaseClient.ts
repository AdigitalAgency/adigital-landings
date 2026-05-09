import { createSupabaseClient } from '@adigital/shared';

const supabaseUrl = 'https://pmwvdnexorbljellsdbr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtd3ZkbmV4b3JibGplbGxzZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMDcxOTAsImV4cCI6MjA5MzU4MzE5MH0.JvFdOyuyKbJkhmti3GkRebSD2SFDwUrXd2wdBUYJ-Pw';

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
