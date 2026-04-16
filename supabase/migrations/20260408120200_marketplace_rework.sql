-- ============================================
-- 010_marketplace_rework.sql — Rework marketplace com produtos reais
-- da Zona da Mata (MG) e categorias reorganizadas
-- ============================================

-- 1. Limpar dados antigos de seed
DELETE FROM public.itens_pedido WHERE produto_id IN (SELECT id FROM public.produtos_marketplace);
DELETE FROM public.produtos_marketplace;
DELETE FROM public.fornecedores;

-- 2. Alterar constraint de categorias
ALTER TABLE public.produtos_marketplace DROP CONSTRAINT IF EXISTS produtos_marketplace_categoria_check;
ALTER TABLE public.produtos_marketplace ADD CONSTRAINT produtos_marketplace_categoria_check
  CHECK (categoria IN ('FERTILIZANTES','DEFENSIVOS','FERRAMENTAS','MUDAS_SEMENTES','OUTROS_INSUMOS'));

-- 3. Inserir fornecedores reais da Zona da Mata / MG
INSERT INTO public.fornecedores (nome, descricao, telefone, whatsapp, cidade, estado, avaliacao) VALUES
  ('Fertisolo',
   'Referência em fertilizantes e corretivos na Zona da Mata mineira. Atende produtores de café há mais de 30 anos.',
   '(32) 3721-1500', '(32) 99900-1500', 'Viçosa', 'MG', 4.8),

  ('Agrocampo Manhuaçu',
   'Loja agropecuária completa com defensivos, ferramentas e insumos para cafeicultura.',
   '(33) 3331-2000', '(33) 99800-2000', 'Manhuaçu', 'MG', 4.5),

  ('Cooperativa Caparaó',
   'Cooperativa de produtores de café da região do Caparaó. Fornece mudas, insumos e assistência técnica.',
   '(32) 3747-1000', '(32) 99700-1000', 'Espera Feliz', 'MG', 4.7),

  ('Casa do Fazendeiro - Ponte Nova',
   'Rede de lojas agropecuárias com amplo estoque de insumos, ferramentas e equipamentos.',
   '(31) 3817-3000', '(31) 99600-3000', 'Ponte Nova', 'MG', 4.4),

  ('Agroinsumos Muriaé',
   'Especializada em defensivos e fertilizantes para café. Entrega em toda a Zona da Mata.',
   '(32) 3722-4000', '(32) 99500-4000', 'Muriaé', 'MG', 4.6);

-- =============================================
-- 4. FERTILIZANTES
-- =============================================
INSERT INTO public.produtos_marketplace (fornecedor_id, nome, descricao, categoria, subcategoria, marca, preco, unidade, indicacao_cafe, fase_aplicacao, destaque) VALUES

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Adubo NPK 20-05-20 Granulado',
 'Formulação ideal para adubação de cobertura do cafeeiro. Rico em nitrogênio e potássio, favorece o desenvolvimento vegetativo e enchimento dos grãos.',
 'FERTILIZANTES', 'NPK', 'Fertisolo', 198.00, 'saca 50kg', true, 'Floração', true),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Calcário Dolomítico PRNT 90%',
 'Correção de acidez do solo com fornecimento de cálcio e magnésio. Essencial para elevar a saturação de bases na lavoura de café.',
 'FERTILIZANTES', 'Calcário', 'Fertisolo', 180.00, 'tonelada', true, 'Plantio', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Superfosfato Simples 18% P2O5',
 'Fonte de fósforo e enxofre para adubação de plantio e formação do cafeeiro. Libera nutrientes gradualmente.',
 'FERTILIZANTES', 'Fosfato', 'Mosaic', 135.00, 'saca 50kg', true, 'Plantio', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Sulfato de Zinco 35%',
 'Micronutriente essencial para o cafeeiro. Aplicação foliar para correção de deficiência de zinco, comum em solos da Zona da Mata.',
 'FERTILIZANTES', 'Micronutriente', 'Produquímica', 42.00, 'kg', true, 'Floração', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Ácido Bórico 17% B',
 'Fonte de boro para pulverização foliar. Melhora a frutificação e reduz o abortamento de flores no café.',
 'FERTILIZANTES', 'Micronutriente', 'Produquímica', 32.50, 'kg', true, 'Floração', true),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'MAP Purificado 11-52-00',
 'Fosfato monoamônico para adubação de cova no plantio do café. Alta concentração de fósforo.',
 'FERTILIZANTES', 'Fosfato', 'Yara', 245.00, 'saca 50kg', true, 'Plantio', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Cloreto de Potássio (KCl) 60%',
 'Fonte concentrada de potássio para adubação de cobertura. Essencial para maturação e qualidade da bebida.',
 'FERTILIZANTES', 'Potássico', 'Mosaic', 165.00, 'saca 50kg', true, 'Maturação', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Gesso Agrícola',
 'Condicionador de subsuperfície. Fornece cálcio e enxofre, melhora a penetração de raízes em profundidade.',
 'FERTILIZANTES', 'Condicionador', 'Fertisolo', 95.00, 'tonelada', true, 'Plantio', false),

-- =============================================
-- 5. DEFENSIVOS (inclui químicos e biológicos)
-- =============================================

((SELECT id FROM public.fornecedores WHERE nome = 'Agrocampo Manhuaçu'),
 'Opera (Epoxiconazol + Piraclostrobina)',
 'Fungicida sistêmico de amplo espectro para controle de ferrugem do café (Hemileia vastatrix) e cercosporiose. Referência no mercado.',
 'DEFENSIVOS', 'Fungicida', 'BASF', 295.00, 'L', true, 'Floração', true),

((SELECT id FROM public.fornecedores WHERE nome = 'Agrocampo Manhuaçu'),
 'Verdadero 600 WG',
 'Inseticida sistêmico neonicotinóide para controle de bicho-mineiro (Leucoptera coffeella) e cigarras. Aplicação via solo ou foliar.',
 'DEFENSIVOS', 'Inseticida', 'Bayer', 440.00, 'kg', true, 'Maturação', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Agroinsumos Muriaé'),
 'Glifosato Roundup Original DI',
 'Herbicida pós-emergente não seletivo para manejo de plantas daninhas nas entrelinhas do cafezal.',
 'DEFENSIVOS', 'Herbicida', 'Bayer', 72.90, 'L', true, NULL, false),

((SELECT id FROM public.fornecedores WHERE nome = 'Agrocampo Manhuaçu'),
 'Oxicloreto de Cobre 840 WP',
 'Fungicida cúprico preventivo para controle de ferrugem do cafeeiro. Pode ser usado em manejo orgânico.',
 'DEFENSIVOS', 'Fungicida', 'Ihara', 58.00, 'kg', true, 'Floração', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Agroinsumos Muriaé'),
 'Voliam Targo',
 'Inseticida/acaricida para controle de ácaro-vermelho e bicho-mineiro no café. Duplo modo de ação.',
 'DEFENSIVOS', 'Inseticida', 'Syngenta', 320.00, 'L', true, 'Maturação', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Agrocampo Manhuaçu'),
 'Beauveria bassiana (Boveril WP)',
 'Inseticida biológico à base de fungo entomopatogênico. Eficaz no controle da broca-do-café (Hypothenemus hampei).',
 'DEFENSIVOS', 'Biológico', 'Koppert', 155.00, 'kg', true, 'Maturação', true),

((SELECT id FROM public.fornecedores WHERE nome = 'Agrocampo Manhuaçu'),
 'Trichoderma harzianum (Trichodermil)',
 'Fungicida biológico para controle de doenças de solo e promoção do crescimento radicular do cafeeiro.',
 'DEFENSIVOS', 'Biológico', 'Koppert', 105.00, 'L', true, 'Plantio', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Agroinsumos Muriaé'),
 'Óleo de Neem (Azadiractina)',
 'Inseticida natural para controle de pragas em manejo integrado. Baixa toxicidade.',
 'DEFENSIVOS', 'Biológico', 'Vitaplan', 48.00, 'L', true, NULL, false),

-- =============================================
-- 6. FERRAMENTAS E EQUIPAMENTOS
-- =============================================

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Pulverizador Costal Manual 20L',
 'Pulverizador para aplicação de defensivos e adubação foliar. Bico cônico regulável, alça acolchoada.',
 'FERRAMENTAS', 'Pulverizador', 'Guarany', 195.00, 'un', true, NULL, false),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Roçadeira Lateral a Gasolina 43cc',
 'Roçadeira para limpeza das entrelinhas do cafezal. Motor 2 tempos, inclui cabeçote de fio e lâmina.',
 'FERRAMENTAS', 'Roçadeira', 'Stihl', 1850.00, 'un', true, NULL, true),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Derriçadeira de Café Portátil',
 'Colheitadeira portátil para café. Motor a gasolina, hastes vibratórias de alta frequência.',
 'FERRAMENTAS', 'Colheita', 'Stihl', 3200.00, 'un', true, 'Pós-colheita', true),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Peneira para Café em Coco nº 14',
 'Peneira de arame galvanizado para classificação de café. Furos redondos, diâmetro 60cm.',
 'FERRAMENTAS', 'Beneficiamento', NULL, 65.00, 'un', true, 'Pós-colheita', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Refratômetro Brix 0-32%',
 'Medição do grau brix para acompanhar a maturação dos frutos de café. Essencial para colheita no ponto ideal.',
 'FERRAMENTAS', 'Instrumentação', 'Instrutherm', 155.00, 'un', true, 'Maturação', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Medidor de pH do Solo Digital',
 'Medição rápida do pH em campo. Sonda de inserção direta, display digital, leitura instantânea.',
 'FERRAMENTAS', 'Instrumentação', 'Akso', 235.00, 'un', true, NULL, true),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Enxada Forjada com Cabo 130cm',
 'Enxada de aço carbono forjado para capina e tratos culturais na lavoura.',
 'FERRAMENTAS', 'Manuais', 'Tramontina', 62.00, 'un', true, NULL, false),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Sacaria de Juta 60kg (10 unidades)',
 'Sacos de juta para armazenamento e transporte de café em coco ou beneficiado.',
 'FERRAMENTAS', 'Armazenamento', NULL, 85.00, 'pacote 10un', true, 'Pós-colheita', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Lona Plástica para Terreiro 8x10m',
 'Lona preta para secagem de café no terreiro. Resistente a UV, 200 micras.',
 'FERRAMENTAS', 'Secagem', NULL, 210.00, 'un', true, 'Pós-colheita', false),

-- =============================================
-- 7. MUDAS E SEMENTES
-- =============================================

((SELECT id FROM public.fornecedores WHERE nome = 'Cooperativa Caparaó'),
 'Muda Catuaí Vermelho IAC 144',
 'Variedade de café arábica mais plantada no Brasil. Alta produtividade, porte baixo, excelente adaptação à Zona da Mata. Bandeja com 100 mudas prontas para plantio.',
 'MUDAS_SEMENTES', 'Muda Arábica', 'IAC', 290.00, 'bandeja 100un', true, 'Plantio', true),

((SELECT id FROM public.fornecedores WHERE nome = 'Cooperativa Caparaó'),
 'Muda Mundo Novo IAC 379-19',
 'Café arábica de porte alto e vigor excepcional. Boa produtividade e adaptação a altitudes médias. Bandeja com 100 mudas.',
 'MUDAS_SEMENTES', 'Muda Arábica', 'IAC', 300.00, 'bandeja 100un', true, 'Plantio', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Cooperativa Caparaó'),
 'Muda Bourbon Amarelo',
 'Variedade de café especial. Reconhecida por produzir bebida de alta qualidade, muito valorizada em concursos. Bandeja com 100 mudas.',
 'MUDAS_SEMENTES', 'Muda Especial', 'Fundação Procafé', 360.00, 'bandeja 100un', true, 'Plantio', true),

((SELECT id FROM public.fornecedores WHERE nome = 'Cooperativa Caparaó'),
 'Muda Catucaí 2SL (Resistente à Ferrugem)',
 'Variedade com resistência à ferrugem do cafeeiro. Reduz custo com fungicidas. Bandeja com 100 mudas.',
 'MUDAS_SEMENTES', 'Muda Arábica', 'Fundação Procafé', 320.00, 'bandeja 100un', true, 'Plantio', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Cooperativa Caparaó'),
 'Semente de Crotalária Spectabilis',
 'Adubo verde para entrelinhas do cafezal. Fixa nitrogênio, controla nematóides e melhora a estrutura do solo.',
 'MUDAS_SEMENTES', 'Adubo Verde', NULL, 28.00, 'kg', true, NULL, false),

((SELECT id FROM public.fornecedores WHERE nome = 'Cooperativa Caparaó'),
 'Semente de Feijão Guandu Anão',
 'Adubo verde perene para consórcio com café. Ótima fixação de nitrogênio e ciclagem de nutrientes.',
 'MUDAS_SEMENTES', 'Adubo Verde', NULL, 22.00, 'kg', true, NULL, false),

-- =============================================
-- 8. OUTROS INSUMOS
-- =============================================

((SELECT id FROM public.fornecedores WHERE nome = 'Agroinsumos Muriaé'),
 'Espalhante Adesivo Agral',
 'Adjuvante para calda de pulverização. Melhora a aderência e cobertura de defensivos e foliares no cafeeiro.',
 'OUTROS_INSUMOS', 'Adjuvante', 'Syngenta', 38.00, 'L', true, NULL, false),

((SELECT id FROM public.fornecedores WHERE nome = 'Agroinsumos Muriaé'),
 'Óleo Mineral Assist',
 'Adjuvante para mistura em calda de defensivos. Melhora a penetração de inseticidas e fungicidas.',
 'OUTROS_INSUMOS', 'Adjuvante', 'BASF', 42.00, 'L', true, NULL, false),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Análise de Solo Completa',
 'Análise química e física do solo: pH, macronutrientes, micronutrientes, CTC, saturação por bases. Laudo com recomendação de calagem e adubação.',
 'OUTROS_INSUMOS', 'Análise', NULL, 90.00, 'amostra', true, 'Plantio', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Fertisolo'),
 'Análise Foliar do Cafeeiro',
 'Diagnose nutricional via tecido foliar: N, P, K, Ca, Mg, S, B, Cu, Fe, Mn, Zn. Laudo com interpretação.',
 'OUTROS_INSUMOS', 'Análise', NULL, 125.00, 'amostra', true, 'Floração', false),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Arame Liso Galvanizado BWG 14',
 'Arame para construção de espaldeiras e estruturas de sustentação na lavoura.',
 'OUTROS_INSUMOS', 'Infraestrutura', 'Gerdau', 320.00, 'rolo 400m', true, NULL, false),

((SELECT id FROM public.fornecedores WHERE nome = 'Casa do Fazendeiro - Ponte Nova'),
 'Fita de Irrigação por Gotejamento',
 'Fita gotejadora para irrigação localizada do cafezal. Espaçamento 30cm, vazão 1.5 L/h.',
 'OUTROS_INSUMOS', 'Irrigação', 'Netafim', 0.85, 'metro', true, NULL, true);
