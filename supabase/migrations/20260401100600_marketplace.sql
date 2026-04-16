-- ============================================
-- 007_marketplace.sql — Marketplace de insumos agrícolas
-- ============================================

-- 1. Fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  logo_url TEXT,
  descricao TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  cidade TEXT,
  estado CHAR(2),
  avaliacao DECIMAL(2,1) DEFAULT 0,  -- 0-5
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Produtos
CREATE TABLE IF NOT EXISTS public.produtos_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE CASCADE,

  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL
    CHECK (categoria IN ('FERTILIZANTES','DEFENSIVOS','BIOLOGICOS','SEMENTES','EQUIPAMENTOS','ANALISES','OUTROS')),
  subcategoria TEXT,                  -- "NPK", "Fungicida", "Inseticida", etc.
  marca TEXT,
  imagem_url TEXT,

  preco DECIMAL(12,2) NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',  -- "un", "kg", "L", "saca", "pacote"
  estoque INTEGER DEFAULT 0,
  destaque BOOLEAN DEFAULT FALSE,

  -- Específico café
  indicacao_cafe BOOLEAN DEFAULT FALSE,  -- Produto indicado para cafeicultura
  fase_aplicacao TEXT,                    -- "Plantio", "Floração", "Maturação", "Pós-colheita"

  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos_marketplace(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor ON public.produtos_marketplace(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_produtos_destaque ON public.produtos_marketplace(destaque) WHERE destaque = TRUE;

-- 3. Pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE','CONFIRMADO','ENVIADO','ENTREGUE','CANCELADO')),
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_produtor ON public.pedidos(produtor_id);

-- 4. Itens do pedido
CREATE TABLE IF NOT EXISTS public.itens_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos_marketplace(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_itens_pedido ON public.itens_pedido(pedido_id);

-- 5. RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- Fornecedores e produtos: leitura pública (todos logados podem ver)
CREATE POLICY "fornecedores_read_all" ON public.fornecedores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "produtos_read_all" ON public.produtos_marketplace
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Pedidos: só o produtor vê/cria os seus
CREATE POLICY "produtor_own_pedidos" ON public.pedidos
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

-- Itens: acesso via pedido do próprio produtor
CREATE POLICY "produtor_own_itens" ON public.itens_pedido
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pedidos
      WHERE pedidos.id = itens_pedido.pedido_id
      AND pedidos.produtor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pedidos
      WHERE pedidos.id = itens_pedido.pedido_id
      AND pedidos.produtor_id = auth.uid()
    )
  );

-- 6. Triggers
CREATE TRIGGER produtos_marketplace_updated_at
  BEFORE UPDATE ON public.produtos_marketplace
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Seed data: fornecedores e produtos reais para café
INSERT INTO public.fornecedores (nome, descricao, cidade, estado, avaliacao) VALUES
  ('AgroCafé Insumos', 'Especialista em insumos para cafeicultura', 'Patrocínio', 'MG', 4.8),
  ('Nutri Campo', 'Fertilizantes e corretivos de solo', 'Uberlândia', 'MG', 4.5),
  ('BioDefensa', 'Defensivos biológicos e químicos', 'Lavras', 'MG', 4.6),
  ('Sementes Sul de Minas', 'Mudas e sementes de café de alta qualidade', 'Machado', 'MG', 4.7),
  ('Agro Equipamentos MG', 'Ferramentas e equipamentos para lavoura', 'Varginha', 'MG', 4.3);

-- Seed produtos (preços baseados no mercado 2026)
INSERT INTO public.produtos_marketplace (fornecedor_id, nome, descricao, categoria, subcategoria, marca, preco, unidade, indicacao_cafe, fase_aplicacao, destaque) VALUES
-- Fertilizantes
((SELECT id FROM public.fornecedores WHERE nome = 'Nutri Campo'), 'Adubo NPK 20-05-20', 'Fertilizante granulado para adubação de cobertura do cafeeiro. Rico em nitrogênio e potássio.', 'FERTILIZANTES', 'NPK', 'Yara', 189.90, 'saca 50kg', true, 'Floração', true),
((SELECT id FROM public.fornecedores WHERE nome = 'Nutri Campo'), 'Calcário Dolomítico PRNT 90%', 'Correção de acidez do solo. Fonte de cálcio e magnésio essenciais para o café.', 'FERTILIZANTES', 'Calcário', 'Votorantim', 45.00, 'tonelada', true, 'Plantio', false),
((SELECT id FROM public.fornecedores WHERE nome = 'Nutri Campo'), 'Superfosfato Simples', 'Fonte de fósforo para o plantio do café. 18% P2O5.', 'FERTILIZANTES', 'Fosfato', 'Mosaic', 125.00, 'saca 50kg', true, 'Plantio', false),
((SELECT id FROM public.fornecedores WHERE nome = 'Nutri Campo'), 'Sulfato de Zinco', 'Micronutriente essencial para o desenvolvimento do cafeeiro. Aplicação foliar.', 'FERTILIZANTES', 'Micronutriente', 'Produquímica', 38.50, 'kg', true, 'Floração', false),
((SELECT id FROM public.fornecedores WHERE nome = 'Nutri Campo'), 'Ácido Bórico', 'Fonte de boro para aplicação foliar no cafeeiro. Melhora a frutificação.', 'FERTILIZANTES', 'Micronutriente', 'Produquímica', 28.90, 'kg', true, 'Floração', true),

-- Defensivos
((SELECT id FROM public.fornecedores WHERE nome = 'BioDefensa'), 'Opera (Epoxiconazol + Piraclostrobina)', 'Fungicida sistêmico para controle de ferrugem e cercosporiose do café.', 'DEFENSIVOS', 'Fungicida', 'BASF', 285.00, 'L', true, 'Floração', true),
((SELECT id FROM public.fornecedores WHERE nome = 'BioDefensa'), 'Verdadero 600 WG', 'Inseticida sistêmico para controle de bicho-mineiro e cigarras.', 'DEFENSIVOS', 'Inseticida', 'Bayer', 420.00, 'kg', true, 'Maturação', false),
((SELECT id FROM public.fornecedores WHERE nome = 'BioDefensa'), 'Glifosato Roundup Original', 'Herbicida para controle de plantas daninhas nas entrelinhas do café.', 'DEFENSIVOS', 'Herbicida', 'Bayer', 68.90, 'L', true, NULL, false),
((SELECT id FROM public.fornecedores WHERE nome = 'BioDefensa'), 'Calda Bordalesa Pronta', 'Fungicida cúprico tradicional para controle preventivo de ferrugem.', 'DEFENSIVOS', 'Fungicida', 'Kimitec', 52.00, 'L', true, 'Floração', false),

-- Biológicos
((SELECT id FROM public.fornecedores WHERE nome = 'BioDefensa'), 'Beauveria bassiana (Boveril)', 'Inseticida biológico para controle de broca-do-café e bicho-mineiro.', 'BIOLOGICOS', 'Inseticida Biológico', 'Koppert', 145.00, 'L', true, 'Maturação', true),
((SELECT id FROM public.fornecedores WHERE nome = 'BioDefensa'), 'Trichoderma harzianum', 'Fungicida biológico para controle de doenças de solo e promoção de crescimento radicular.', 'BIOLOGICOS', 'Fungicida Biológico', 'Koppert', 98.00, 'L', true, 'Plantio', false),
((SELECT id FROM public.fornecedores WHERE nome = 'BioDefensa'), 'Bacillus thuringiensis (Bt)', 'Inseticida biológico para controle de lagartas em café.', 'BIOLOGICOS', 'Inseticida Biológico', 'Koppert', 85.00, 'L', true, NULL, false),

-- Sementes e Mudas
((SELECT id FROM public.fornecedores WHERE nome = 'Sementes Sul de Minas'), 'Muda Catuaí Vermelho IAC 144', 'Muda de café arábica. Alta produtividade, porte baixo. Bandeja com 100 mudas.', 'SEMENTES', 'Muda Arábica', 'IAC', 280.00, 'bandeja 100un', true, 'Plantio', true),
((SELECT id FROM public.fornecedores WHERE nome = 'Sementes Sul de Minas'), 'Muda Mundo Novo IAC 379-19', 'Muda de café arábica. Porte alto, vigor excepcional. Bandeja com 100 mudas.', 'SEMENTES', 'Muda Arábica', 'IAC', 290.00, 'bandeja 100un', true, 'Plantio', false),
((SELECT id FROM public.fornecedores WHERE nome = 'Sementes Sul de Minas'), 'Muda Bourbon Amarelo', 'Café especial. Excelente qualidade de bebida, ideal para cafés premiados.', 'SEMENTES', 'Muda Arábica', 'Fundação Procafé', 350.00, 'bandeja 100un', true, 'Plantio', true),

-- Equipamentos
((SELECT id FROM public.fornecedores WHERE nome = 'Agro Equipamentos MG'), 'Pulverizador Costal 20L', 'Pulverizador manual para aplicação de defensivos. Bico regulável.', 'EQUIPAMENTOS', 'Pulverizador', 'Guarany', 189.90, 'un', true, NULL, false),
((SELECT id FROM public.fornecedores WHERE nome = 'Agro Equipamentos MG'), 'Refratômetro Brix 0-32%', 'Para medição do grau brix na maturação dos frutos do café.', 'EQUIPAMENTOS', 'Instrumentação', 'Instrutherm', 145.00, 'un', true, 'Maturação', false),
((SELECT id FROM public.fornecedores WHERE nome = 'Agro Equipamentos MG'), 'Medidor pH Solo Portátil', 'Medição rápida do pH do solo em campo. Digital com sonda.', 'EQUIPAMENTOS', 'Instrumentação', 'Akso', 220.00, 'un', true, NULL, true),

-- Análises
((SELECT id FROM public.fornecedores WHERE nome = 'AgroCafé Insumos'), 'Análise de Solo Completa', 'Análise química e física do solo: pH, macro e micronutrientes, CTC, V%.', 'ANALISES', 'Solo', NULL, 85.00, 'amostra', true, 'Plantio', false),
((SELECT id FROM public.fornecedores WHERE nome = 'AgroCafé Insumos'), 'Análise Foliar Café', 'Análise de tecido foliar: N, P, K, Ca, Mg, S, B, Cu, Fe, Mn, Zn.', 'ANALISES', 'Foliar', NULL, 120.00, 'amostra', true, 'Floração', false),
((SELECT id FROM public.fornecedores WHERE nome = 'AgroCafé Insumos'), 'Classificação e Prova de Xícara', 'Classificação por tipo/peneira + cupping score SCA. Laudo completo.', 'ANALISES', 'Qualidade', NULL, 150.00, 'amostra', true, 'Pós-colheita', true);
