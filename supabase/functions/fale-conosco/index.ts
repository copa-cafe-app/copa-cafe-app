import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const DESTINO = 'info@coffeecopa.com';
// Enquanto o domínio coffeecopa.com não estiver verificado no Resend, usa o remetente
// compartilhado deles (onboarding@resend.dev). Depois trocar por algo @coffeecopa.com.
const REMETENTE = 'Copa Café <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { nome, telefone, mensagem } = await req.json();

    if (!mensagem || !mensagem.trim()) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatória' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const msg = String(mensagem).slice(0, 200);

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Envio de email ainda não configurado' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = `
      <h2>Nova mensagem — Fale Conosco (Copa Café)</h2>
      <p><strong>Nome:</strong> ${escapeHtml(nome || '—')}</p>
      <p><strong>Telefone:</strong> ${escapeHtml(telefone || '—')}</p>
      <hr/>
      <p>${escapeHtml(msg)}</p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMETENTE,
        to: [DESTINO],
        reply_to: DESTINO,
        subject: `Fale Conosco — ${nome || 'Usuário'}`,
        html,
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
