import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bearer(req: Request): string {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
}

// Usuário logado dono do token, ou null (token ausente, anon key ou sessão inválida).
export async function getRequestUser(req: Request) {
  const token = bearer(req);
  if (!token || token === SUPABASE_ANON_KEY) return null;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  return error ? null : user;
}

// Chamadas internas (outras functions, cron, painel) usam a service role key.
export function isServiceRole(req: Request): boolean {
  return bearer(req) === SUPABASE_SERVICE_ROLE_KEY;
}

// Imagens enviadas para a IA: tipos que a API aceita e teto de ~6 MB de arquivo.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BASE64_LEN = 8_000_000;

export function validateImage(image_base64: unknown, media_type: unknown): string | null {
  if (typeof image_base64 !== 'string' || !image_base64) return 'Imagem obrigatória (base64)';
  if (image_base64.length > MAX_BASE64_LEN) return 'Imagem muito grande';
  if (typeof media_type !== 'string' || !IMAGE_TYPES.includes(media_type)) return 'Tipo de imagem inválido';
  return null;
}
