// supabase/client.js
/*
import { createClient } from '@supabase/supabase-js'


const supabaseUrl = ''
const supabaseKey = '
export const supabase = createClient(supabaseUrl, supabaseKey)


 */
// client.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

