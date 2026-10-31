import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://sxymmgtclsvvbmxyurpb.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_VAmxtFUrzlubRU2rfGoMuw_5RTO1pD-';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kristinka-auth' },
});

/** Prihlasovacie meno -> interný e-mail v Supabase */
export const usernameToEmail = (u: string) =>
  u.includes('@') ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}@kristinka-plavanie.sk`;
