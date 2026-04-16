import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_VERIFY_SID = Deno.env.get('TWILIO_VERIFY_SID')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
          To: phone,
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
