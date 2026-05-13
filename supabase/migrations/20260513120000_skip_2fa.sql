-- Adiciona flag skip_2fa pra contas que precisam pular o OTP de 2FA
-- Uso: contas de review do Google Play, suporte interno, testes
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS skip_2fa BOOLEAN NOT NULL DEFAULT FALSE;
