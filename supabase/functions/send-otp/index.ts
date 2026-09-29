import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/auth.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_VERIFY_SID = Deno.env.get('TWILIO_VERIFY_SID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Esta function é pública (cadastro/login ainda sem sessão), então é o alvo
// clássico de "SMS pumping". Defesas: só DDIs do seletor do app
// (src/constants/countryCodes.ts) + limite de envios por telefone e por IP.
const ALLOWED_DIALS = ['55', '44', '1', '57', '52', '502', '504', '51', '506', '505', '503',
  '593', '58', '591', '507', '53', '595', '91'];
const MAX_PER_PHONE_HOUR = 8;
const MAX_PER_IP_HOUR = 30;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function rateLimited(phone: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [byPhone, byIp] = await Promise.all([
    admin.from('otp_requests').select('id', { count: 'exact', head: true })
      .eq('phone', phone).gte('criado_em', since),
    admin.from('otp_requests').select('id', { count: 'exact', head: true })
      .eq('ip', ip).gte('criado_em', since),
  ]);
  // Falha no banco não pode travar login de ninguém: o Twilio Verify ainda
  // tem o limite próprio por número.
  if (byPhone.error || byIp.error) return false;
  return (byPhone.count ?? 0) >= MAX_PER_PHONE_HOUR || (byIp.count ?? 0) >= MAX_PER_IP_HOUR;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, channel = 'whatsapp' } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Telefone obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['whatsapp', 'sms'].includes(channel)) {
      return new Response(
        JSON.stringify({ error: 'Canal inválido. Use "whatsapp" ou "sms"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const e164 = String(phone).trim();
    if (!/^\+\d{8,15}$/.test(e164) || !ALLOWED_DIALS.some((d) => e164.startsWith(`+${d}`))) {
      return json({ error: 'Número de telefone inválido' }, 400);
    }

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido';
    if (await rateLimited(e164, ip)) {
      return json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }, 429);
    }
    await admin.from('otp_requests').insert({ phone: e164, ip });

    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioRes = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/Verifications`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: e164,
          Channel: channel,
        }),
      }
    );

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      return new Response(
        JSON.stringify({ error: data.message || 'Erro ao enviar código' }),
        { status: twilioRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, channel: data.channel, status: data.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
