import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de documentos financeiros para produtores de café brasileiros.

Você vai receber uma IMAGEM que pode ser:
1. Nota fiscal (NF-e, NFC-e, cupom fiscal)
2. Recibo impresso ou manuscrito
3. Caderno de anotações manuscrito, onde tipicamente cada LINHA representa um item de despesa

Sua tarefa: extrair todas as despesas e retornar em JSON válido.

Categorias disponíveis (use EXATAMENTE um desses valores):
- INSUMOS (adubo, fertilizante, mudas, sementes, calcário)
- MAO_DE_OBRA (diária, colheita, empreita, salário)
- DEFENSIVOS (herbicida, fungicida, inseticida, agrotóxico)
- MAQUINAS (trator, implemento, combustível, manutenção, peças)
- TRANSPORTE (frete, entrega, logística)
- OUTROS (quando não se encaixa em nenhuma acima)

Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "tipo_documento": "nota_fiscal" | "recibo" | "caderno" | "desconhecido",
  "vendor": "string (nome do fornecedor/estabelecimento, ou null se não identificado)",
  "data_documento": "YYYY-MM-DD (data do documento, ou null se não identificado)",
  "confianca": number (0-100),
  "itens": [
    {
      "descricao": "string (descrição do item)",
      "valor": number (em reais, ex: 150.50),
      "categoria": "INSUMOS|MAO_DE_OBRA|DEFENSIVOS|MAQUINAS|TRANSPORTE|OUTROS",
      "data": "YYYY-MM-DD (data específica do item se diferente da do documento, senão null)"
    }
  ],
  "observacoes": "string curta (opcional: alertas sobre legibilidade, campos incertos, etc)"
}

Regras importantes:
- Se o documento tiver UM único valor total (ex: cupom fiscal), retorne um único item com esse valor.
- Se for caderno/lista com vários itens, retorne CADA linha como um item separado.
- Valores sempre em number (não string). Use ponto como separador decimal.
- Se não conseguir identificar um campo, use null.
- Se a imagem não for legível ou não for documento financeiro, retorne "tipo_documento": "desconhecido", itens vazio, e confianca baixa.
- Valores em reais (R$). Ignore centavos se não estiverem claros.

Responda APENAS o JSON, sem texto adicional, sem markdown.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_base64, media_type = 'image/jpeg' } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'Imagem obrigatória (base64)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
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
                text: 'Extraia as despesas deste documento em JSON.',
              },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return new Response(
        JSON.stringify({ error: `Erro na API Claude: ${claudeRes.status}`, details: errText }),
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

    let parsed;
    try {
      const cleanText = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Resposta da IA em formato inválido', raw: textContent.text }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
