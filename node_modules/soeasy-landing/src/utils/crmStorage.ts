import { supabase } from './supabaseClient';
import { submitLead } from '@adigital/shared';
import { differenceInMonths } from 'date-fns';

export type LeadStatus = 'new' | 'no-answer' | 'bad-moment' | 'appointment' | 'client' | 'rejected';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  audience: string;
  language: string;
  status: LeadStatus;
  created_at: string; // Supabase uses snake_case by default
  notes: string;
  monthly_subscription?: number;
  start_date?: string;
  is_deleted?: boolean;
}

export const getLeads = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Lead[];
};

export const getTrash = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('is_deleted', true)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Lead[];
};

export const saveLead = async (lead: Partial<Lead>) => {
  if (!supabase) {
    console.warn('Supabase not configured. Lead not saved.');
    return null;
  }
  return submitLead(supabase, 'leads', { ...lead, updated_at: new Date().toISOString() });
};

export const deleteLead = async (id: string) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('leads')
    .update({ is_deleted: true })
    .eq('id', id);
  
  if (error) throw error;
};

export const calculateTotalRevenue = (lead: Lead) => {
  if (lead.status !== 'client' || !lead.monthly_subscription || !lead.start_date) return 0;
  const months = differenceInMonths(new Date(), new Date(lead.start_date)) + 1;
  return lead.monthly_subscription * months;
};

export const getStatusColor = (status: LeadStatus) => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'no-answer': return 'bg-yellow-100 text-yellow-800';
    case 'bad-moment': return 'bg-orange-100 text-orange-800';
    case 'appointment': return 'bg-purple-100 text-purple-800';
    case 'client': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusLabel = (status: LeadStatus) => {
  switch (status) {
    case 'new': return 'Νέα Επαφή';
    case 'no-answer': return 'Δεν απάντησε';
    case 'bad-moment': return 'Κακή στιγμή';
    case 'appointment': return 'Ραντεβού';
    case 'client': return 'Πελάτης';
    case 'rejected': return 'Απόρριψη';
    default: return status;
  }
};
