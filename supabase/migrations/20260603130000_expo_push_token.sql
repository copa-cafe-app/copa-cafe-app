-- Token de push (Expo) por usuário, para envio de notificações push.
-- Aplicar com `supabase db push` na fase de build (push só funciona em build com FCM).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
