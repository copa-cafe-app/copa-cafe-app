import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { cpf_cnpj, telefone } = await req.json();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (cpf_cnpj) {
      const clean = cpf_cnpj.replace(/\D/g, '');
      const { data } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('cpf_cnpj', clean)
        .maybeSingle();
      if (data) {
        return new Response(
          JSON.stringify({ duplicate: true, field: 'cpf_cnpj', message: 'Este CPF/CNPJ já está cadastrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (telefone) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();
      if (data) {
        return new Response(
          JSON.stringify({ duplicate: true, field: 'telefone', message: 'Este telefone já está cadastrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ duplicate: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
