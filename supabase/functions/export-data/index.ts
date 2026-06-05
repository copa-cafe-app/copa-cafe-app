import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const REMETENTE = 'Copa Café <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Exportação por email ainda não configurada' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const uid = user.id;
    const [perfil, propriedades, lotes, atividades, despesas, alertas] = await Promise.all([
      admin.from('users').select('*').eq('id', uid).maybeSingle(),
      admin.from('propriedades').select('*').eq('produtor_id', uid),
      admin.from('lotes').select('*').eq('produtor_id', uid),
      admin.from('atividades_campo').select('*').eq('produtor_id', uid),
      admin.from('despesas').select('*').eq('produtor_id', uid),
      admin.from('alertas_preco').select('*').eq('produtor_id', uid),
    ]);

    const dump = {
      exportado_em: new Date().toISOString(),
      perfil: perfil.data,
      propriedades: propriedades.data || [],
      lotes: lotes.data || [],
      atividades_campo: atividades.data || [],
      despesas: despesas.data || [],
      alertas_preco: alertas.data || [],
    };

    const destino = user.email;
    if (!destino) {
      return new Response(JSON.stringify({ error: 'Sua conta não tem email para envio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resumo = `
      <h2>Seus dados — Copa Café</h2>
      <p>Aqui está a cópia dos seus dados, conforme solicitado (LGPD).</p>
      <ul>
        <li>Propriedades: ${dump.propriedades.length}</li>
        <li>Lotes: ${dump.lotes.length}</li>
        <li>Atividades de campo: ${dump.atividades_campo.length}</li>
        <li>Despesas: ${dump.despesas.length}</li>
        <li>Alertas de preço: ${dump.alertas_preco.length}</li>
      </ul>
      <p>Os dados completos seguem em anexo (JSON).</p>
    `;

    const jsonStr = JSON.stringify(dump, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMETENTE,
        to: [destino],
        subject: 'Seus dados — Copa Café (LGPD)',
        html: resumo,
        attachments: [{ filename: 'meus-dados-copacafe.json', content: base64 }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || 'Falha ao enviar' }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
