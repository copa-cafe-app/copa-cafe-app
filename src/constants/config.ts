export const SUPABASE_URL = 'https://fftrgrgrvvobydticzaz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdHJncmdydnZvYnlkdGljemF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzU5MjgsImV4cCI6MjA5MDgxMTkyOH0.d6V3fwu2dugKK4KAuN0v-ScBmN65AQhN91j7DKpEReg';

// ─── OTP por WhatsApp ────────────────────────────────────────────────────────
// Só ligar quando o WhatsApp Sender (Twilio/Meta) estiver APROVADO e atribuído
// ao Verify Service. Enquanto false, o app usa SMS e nem mostra a opção WhatsApp.
// Quando aprovar: trocar para `true` (o back-end já aceita channel:'whatsapp').
// Mesmo com true, se o WhatsApp falhar no envio, o app cai pro SMS sozinho.
export const WHATSAPP_ENABLED = false;

// Canal de OTP padrão derivado da flag acima.
export const DEFAULT_OTP_CHANNEL: 'whatsapp' | 'sms' = WHATSAPP_ENABLED ? 'whatsapp' : 'sms';

// ─── WhatsApp de negociação (CTA "Negociar pelo WhatsApp" nas cotações) ──────
// ⚠️ TROCAR ANTES de ativar o OTP por WhatsApp.
// Plano (decidido 2026-07-23): o número atual `5533999465365` vai virar o SENDER
// do OTP no Twilio. Quando isso acontecer, ele deixa de funcionar como WhatsApp
// normal → o CTA precisa apontar pra OUTRO número. Pedro vai fornecer o novo.
// Passo amanhã: colar o número novo aqui (formato só dígitos, com DDI 55).
// Enquanto o número novo não existe, mantém o atual (o CTA segue funcionando).
export const WHATSAPP_NEGOCIACAO = '5533999465365'; // TODO: trocar pelo número dedicado
