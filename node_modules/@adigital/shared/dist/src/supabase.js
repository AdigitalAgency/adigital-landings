import { createClient } from '@supabase/supabase-js';
export const createSupabaseClient = (url, key) => {
    return createClient(url, key);
};
// Generic Lead Submission helper that all 40+ landings will use
export const submitLead = async (supabase, table, leadData) => {
    const { data, error } = await supabase
        .from(table)
        .insert([leadData]);
    if (error)
        throw error;
    return data;
};
