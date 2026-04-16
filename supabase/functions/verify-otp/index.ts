import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_VERIFY_SID = Deno.env.get('TWILIO_VERIFY_SID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Telefone e código obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verificar código no Twilio Verify
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioRes = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, Code: code }),
      }
    );

    const verifyData = await twilioRes.json();

    if (!twilioRes.ok || verifyData.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Código inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Admin: buscar ou criar usuário
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const phoneClean = phone.replace('+', '');
    const email = `${phoneClean}@phone.copacafe.app`;
    const password = `otp_${phoneClean}_${TWILIO_VERIFY_SID}`;

    // Buscar usuário pelo telefone
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    let user = users.find((u: any) => u.phone === phone);
    let isNewUser = false;

    if (!user) {
      // Criar usuário
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        phone,
        phone_confirm: true,
        email,
        email_confirm: true,
        password,
      });
      if (createErr) throw createErr;
      user = created.user;
      isNewUser = true;
    } else {
      // Atualizar senha pra garantir que bate
      await supabaseAdmin.auth.admin.updateUser(user.id, {
        phone_confirm: true,
        password,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        email,
        password,
        user_id: user.id,
        is_new_user: isNewUser,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
