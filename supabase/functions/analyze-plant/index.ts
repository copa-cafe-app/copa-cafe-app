import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getRequestUser, json, validateImage } from '../_shared/auth.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
// O build 1.0.2 (Play Store) chama com a anon key. Depois que o 1.0.3+ (que manda
// o token da sessão) estiver no ar, setar o secret ANALYZE_PLANT_REQUIRE_AUTH=true.
const REQUIRE_AUTH = Deno.env.get('ANALYZE_PLANT_REQUIRE_AUTH') === 'true';

const SYSTEM_PROMPT = `Você é um agrônomo especialista em cafeicultura brasileira. Analise a imagem da planta de café e forneça um diagnóstico.

Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "saudavel": boolean,
  "confianca": number (0-100),
  "diagnostico": "string curta com o diagnóstico principal",
  "detalhes": "string com explicação detalhada do que foi observado na imagem",
  "recomendacoes": ["array", "de", "recomendações", "práticas"]
}

Considere as principais doenças e pragas do café no Brasil:
- Ferrugem (Hemileia vastatrix) - manchas alaranjadas
- Cercosporiose (Cercospora coffeicola) - manchas circulares
- Bicho-mineiro (Leucoptera coffeella) - minas nas folhas
- Broca-do-café (Hypothenemus hampei) - perfurações nos frutos
- Phoma - manchas escuras nas folhas jovens
- Deficiências nutricionais (N, K, Mg, B, Zn)

Se a imagem não for de uma planta de café ou não for possível fazer diagnóstico, indique isso no campo "diagnostico" e dê confiança baixa.

Responda APENAS o JSON, sem texto adicional.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (REQUIRE_AUTH && !(await getRequestUser(req))) {
      return json({ error: 'Não autenticado' }, 401);
    }

    const { image_base64, media_type = 'image/jpeg' } = await req.json();

    const invalid = validateImage(image_base64, media_type);
    if (invalid) return json({ error: invalid }, 400);

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type,
                  data: image_base64,
                },
              },
              {
                type: 'text',
                text: 'Analise esta imagem de planta de café e forneça o diagnóstico em JSON.',
              },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(
        JSON.stringify({ error: `Erro na API Claude: ${claudeRes.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeRes.json();
    const textContent = claudeData.content?.find((c: any) => c.type === 'text');

    if (!textContent?.text) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON da resposta
    let analysis;
    try {
      // Remove possíveis markdown code blocks
      const cleanText = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Resposta da IA em formato inválido' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
