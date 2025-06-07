import { supabase } from './client.js';

export function subscribeToCreations(callback) {
    supabase
        .channel('public:creations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'creations' }, payload => {
            console.log('Realtime payload:', payload);
            callback(payload);
        })
        .subscribe();
}
