import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Server-side Supabase client with service role privileges.
// Used ONLY for server-side operations like Realtime Broadcast.
// NEVER expose the service role key to the client.
export const supabaseServer: SupabaseClient | null =
  supabaseUrl && supabaseUrl.startsWith('http') && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null
