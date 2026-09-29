import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getRequestUser, json } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Push para o produtor quando a equipe Copa avalia a amostra do lote.
// Chamada pela tela /amostras logo depois do RPC avaliar_amostra.
// Body: { lote_id }
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getRequestUser(req);
    if (!user) return json({ error: 'Não autenticado' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: staff, error: staffErr } = await admin
      .from('users').select('is_copa_staff').eq('id', user.id).maybeSingle();
    if (staffErr) throw staffErr;
    if (!staff?.is_copa_staff) return json({ error: 'Acesso restrito à equipe Copa' }, 403);

    const { lote_id } = await req.json();
    if (typeof lote_id !== 'string') return json({ error: 'lote_id obrigatório' }, 400);

    const { data: lote, error: loteErr } = await admin
      .from('lotes')
      .select('id, produtor_id, variedade, quantidade_sacas, amostra_status, amostra_motivo, amostra_avaliada_em, amostra_avaliada_por')
      .eq('id', lote_id)
      .maybeSingle();
    if (loteErr) throw loteErr;

    // Só notifica avaliação recém-feita por quem está chamando (evita reenvio/spam)
    const recente = lote?.amostra_avaliada_em &&
      Date.now() - new Date(lote.amostra_avaliada_em).getTime() < 10 * 60 * 1000;
    if (!lote || !recente || lote.amostra_avaliada_por !== user.id ||
        !['APROVADA', 'REPROVADA'].includes(lote.amostra_status)) {
      return json({ error: 'Nenhuma avaliação recente para notificar' }, 409);
    }

    const { data: produtor, error: prodErr } = await admin
      .from('users').select('expo_push_token').eq('id', lote.produtor_id).maybeSingle();
    if (prodErr) throw prodErr;
    const token = produtor?.expo_push_token;
    if (!token || !token.startsWith('ExponentPushToken')) return json({ sent: 0, note: 'produtor sem push' });

    const aprovada = lote.amostra_status === 'APROVADA';
    const resumo = `${lote.variedade} • ${lote.quantidade_sacas} sacas`;
    const message = {
      to: token,
      sound: 'default',
      channelId: 'default',
      title: aprovada ? '✅ Amostra aprovada!' : 'Amostra reprovada',
      body: aprovada
        ? `A Copa aprovou a amostra do seu lote (${resumo}). Toque para ver.`
        : `A Copa avaliou a amostra do lote (${resumo})${lote.amostra_motivo ? `: ${lote.amostra_motivo}` : ''}. Você pode enviar nova amostra.`,
      data: { tipo: 'amostra', lote_id: lote.id },
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(message),
    });
    const result = await res.json();
    return json({ sent: 1, result });
  } catch (err: any) {
    return json({ error: err.message || 'Erro interno' }, 500);
  }
});
