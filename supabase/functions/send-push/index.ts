import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, isServiceRole, json } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Envia push via Expo Push API.
// Body: { user_ids?: string[], tokens?: string[], title, body, data? }
// Se vier user_ids, busca o expo_push_token de cada um na tabela users.
// Só aceita chamadas internas (service role) — o app nunca chama esta function.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!isServiceRole(req)) return json({ error: 'Não autorizado' }, 403);

  try {
    const { user_ids, tokens, title, body, data } = await req.json();
    if (!title || !body) return json({ error: 'title e body obrigatórios' }, 400);

    let pushTokens: string[] = Array.isArray(tokens) ? tokens.filter(Boolean) : [];

    if (Array.isArray(user_ids) && user_ids.length > 0) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: rows, error } = await admin
        .from('users')
        .select('expo_push_token')
        .in('id', user_ids);
      if (error) throw error;
      const fromDb = (rows || []).map((r: any) => r.expo_push_token).filter(Boolean);
      pushTokens = [...pushTokens, ...fromDb];
    }

    // dedup e valida formato do token do Expo
    pushTokens = [...new Set(pushTokens)].filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));

    if (pushTokens.length === 0) return json({ sent: 0, note: 'nenhum token válido' });

    const messages = pushTokens.map((to) => ({ to, sound: 'default', title, body, data: data || {} }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    return json({ sent: pushTokens.length, result });
  } catch (err: any) {
    return json({ error: err.message || 'Erro interno' }, 500);
  }
});
