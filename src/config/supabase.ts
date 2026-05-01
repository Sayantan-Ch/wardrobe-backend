import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabaseAnonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export const supabaseServiceRoleClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
