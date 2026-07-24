import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEFAULT_OTP_CHANNEL } from '../constants/config';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';

WebBrowser.maybeCompleteAuthSession();

export type OtpChannel = 'whatsapp' | 'sms';

export const authService = {
  // Cadastro com email/senha
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  // Login com email/senha
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Enviar OTP via WhatsApp ou SMS (Twilio Verify).
  // Retorna { ...data, channel } com o canal REALMENTE usado. Se o WhatsApp
  // falhar (ex.: sender ainda não aprovado pela Meta), cai automaticamente pro
  // SMS e devolve channel:'sms' + fellBackToSms:true, pra UI ajustar o texto.
  async sendOtp(phone: string, channel: OtpChannel = DEFAULT_OTP_CHANNEL) {
    const attemptSend = async (ch: OtpChannel) => {
      const maxRetries = 2;
      let lastErr: any;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ phone, channel: ch }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao enviar código');
          return data;
        } catch (err) {
          lastErr = err;
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000));
        }
      }
      throw lastErr;
    };

    try {
      const data = await attemptSend(channel);
      return { ...data, channel };
    } catch (err) {
      // WhatsApp indisponível → fallback automático pro SMS (nunca deixa o
      // usuário travado). Se já era SMS, propaga o erro normalmente.
      if (channel === 'whatsapp') {
        const data = await attemptSend('sms');
        return { ...data, channel: 'sms' as OtpChannel, fellBackToSms: true };
      }
      throw err;
    }
  },

  // Verificar OTP e criar sessão.
  // No cadastro, passe email+password reais: a Edge Function cria/atualiza a conta
  // única com essas credenciais (confirmadas) e o login é feito com elas.
  // No login por telefone (sem senha), a Edge Function devolve um token de sessão.
  async verifyOtp(phone: string, code: string, email?: string, password?: string) {
    // 1. Verificar código no Twilio via Edge Function
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phone, code, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Código inválido');

    if (data.mode === 'password') {
      // Cadastro: login com as credenciais reais que o usuário acabou de definir
      const { data: session, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: password!,
      });
      if (error) throw error;
      return { ...session, is_new_user: data.is_new_user };
    }

    // Login por telefone: cria sessão a partir do token (sem senha)
    const { data: session, error } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    });
    if (error) throw error;
    return { ...session, is_new_user: data.is_new_user };
  },

  // Fallback: SMS OTP via Supabase nativo (caso Edge Functions não estejam disponíveis)
  async sendSmsOtp(phone: string) {
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    return data;
  },

  async verifySmsOtp(phone: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
    return data;
  },

  // Login com Google
  async signInWithGoogle() {
    return this._signInWithOAuthProvider('google');
  },

  // Login com Facebook
  async signInWithFacebook() {
    return this._signInWithOAuthProvider('facebook');
  },

  // OAuth genérico via browser (funciona no Expo Go)
  async _signInWithOAuthProvider(provider: 'google' | 'facebook') {
    const redirectUrl = Linking.createURL('');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error('URL de autenticação não gerada');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type !== 'success') {
      throw new Error('Login cancelado');
    }

    // Extrair tokens da URL de callback (podem vir no # ou no ?)
    const url = result.url;
    const { params: extractedParams } = QueryParams.getQueryParams(url);

    const accessToken = extractedParams.access_token;
    const refreshToken = extractedParams.refresh_token;

    if (!accessToken) {
      // Tentar extrair do fragment manualmente
      const fragment = url.split('#')[1];
      if (fragment) {
        const fragParams = new URLSearchParams(fragment);
        const at = fragParams.get('access_token');
        const rt = fragParams.get('refresh_token');
        if (at) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: at,
            refresh_token: rt || '',
          });
          if (sessionError) throw sessionError;
          return sessionData;
        }
      }
      throw new Error('Token não recebido');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });
    if (sessionError) throw sessionError;

    return sessionData;
  },

  // Recuperação de senha
  // O link no email aponta pra página web fixa que redireciona via deep link copa-cafe://
  // (Expo Go usa o scheme do app já em dev — confere com `Linking.createURL('redefinir-senha')`)
  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://copa-cafe-app.github.io/copa-cafe-app/redefinir-senha.html',
    });
    if (error) throw error;
    return data;
  },

  // Atualizar senha (após recovery ou via perfil)
  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Sessão atual
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  // Listener de mudança de auth
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
