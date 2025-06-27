import { supabase } from './client.js';

export async function saveCreation(svg, title, ip) {
    const { data, error } = await supabase
        .from('creations')
        .insert([{
            svg_code: svg,   
            title: title,
            admin_ip: ip
        }])
        .select();

    if (error) throw error;
    return data;
}

export async function getCreations() {
    const { data, error } = await supabase
        .from('creations')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}
