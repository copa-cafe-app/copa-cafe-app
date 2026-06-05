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
    const { phone, code, email, password } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Telefone e código obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cadastro: cliente manda email+senha reais → conta única com essas credenciais.
    // Login (sem senha): só gera sessão para o usuário existente.
    const isCadastro = !!(email && password);

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

    // Buscar usuário pelo telefone.
    // O Supabase guarda o telefone só com dígitos (sem '+'), então comparamos
    // apenas os dígitos pra não falhar (bug que fazia tentar criar duplicado).
    const phoneDigits = phone.replace(/\D/g, '');
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    let user = users.find((u: any) => (u.phone || '').replace(/\D/g, '') === phoneDigits);
    let isNewUser = false;

    if (isCadastro) {
      // ===== CADASTRO: 1 usuário único com email+senha REAIS, tudo confirmado =====
      if (user) {
        // Já existe (ex.: conta antiga só-telefone) → "promove" pra ter email/senha reais
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email,
          password,
          phone_confirm: true,
          email_confirm: true,
        });
        if (updErr) throw updErr;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          phone,
          email,
          password,
          phone_confirm: true,
          email_confirm: true,
        });
        if (createErr) throw createErr;
        user = created.user;
        isNewUser = true;
      }

      // Cliente já tem email+senha → faz signInWithPassword
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'password',
          email,
          user_id: user.id,
          is_new_user: isNewUser,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== LOGIN (sem senha): só telefone =====
    const phoneClean = phone.replace('+', '');
    // Senha determinística legada — usada SÓ pra compatibilidade com o build antigo
    // (Play Store), que espera { email, password } e faz signInWithPassword.
    const legacyPass = `otp_${phoneClean}_${TWILIO_VERIFY_SID}`;

    if (!user) {
      // Usuário novo entrando direto por SMS/WhatsApp (sem ter passado pelo cadastro):
      // cria conta só-telefone com email sintético; depois ele preenche o perfil.
      const synthEmail = `${phoneClean}@phone.copacafe.app`;
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        phone,
        email: synthEmail,
        password: legacyPass,
        phone_confirm: true,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      user = created.user;
      isNewUser = true;
    }

    // Gera sessão SEM precisar da senha (magic link → token_hash), funciona pra
    // qualquer email do usuário (real ou sintético). [build novo]
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });
    if (linkErr) throw linkErr;
    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) throw new Error('Falha ao gerar sessão');

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'token',
        token_hash: tokenHash,
        email: user.email,
        // Compat build antigo: contas legadas têm essa senha; o app antigo usa
        // estes 2 campos. O app novo lê 'mode'/'token_hash' e ignora 'password'.
        password: legacyPass,
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
