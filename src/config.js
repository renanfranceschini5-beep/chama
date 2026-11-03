// Endereço e chave pública (publishable) do projeto Supabase.
// A chave pública é feita para ficar no navegador: o acesso aos dados é protegido pelas regras (RLS) do banco.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pvyhufovjddkflbfhavk.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4iBy0_mod0i-zAFd-zBLHw_djEemXtV';
