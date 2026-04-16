# Copa Café — Especificação Técnica v1.2 (MVP Produtor)

## Visão Geral

App mobile-first (React Native / Expo) focado no **cafeicultor brasileiro**. O MVP entrega ferramentas de gestão da fazenda, cadastro de lotes, cotações em tempo real e rastreabilidade. Os papéis de Comerciante e Corretor serão adicionados em fases futuras.

**Público-alvo MVP:** ~330 mil cafeicultores brasileiros, sendo 78% agricultores familiares.

---

## 1. Usuário: Produtor

### 1.1 Perfil

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| nome | string | Sim | Nome completo |
| cpf_cnpj | string (encrypted) | Sim | Validação em tempo real |
| email | string | Sim | Único |
| telefone | string (E.164) | Sim | +5531999999999 |
| avatar_url | string | Não | Foto de perfil |
| estado | char(2) | Sim | UF |
| municipio | string | Sim | |
| lat / lng | decimal | Não | Geolocalização da fazenda |

### 1.2 Modelo de Dados

```typescript
// src/types/user.ts

enum AccountStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

interface User {
  id: string;
  status: AccountStatus;

  nome: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
  avatar_url?: string;

  estado: string;
  municipio: string;
  coordenadas?: { lat: number; lng: number };

  documento_verificado: boolean;
  verificado_em?: Date;

  criado_em: Date;
  atualizado_em: Date;
  ultimo_login?: Date;
  aceite_termos: Date;
  aceite_privacidade: Date;
}
```

```typescript
// src/types/fazenda.ts

interface Propriedade {
  id: string;
  produtor_id: string;
  nome: string;
  area_total_hectares: number;
  altitude_metros?: number;
  regiao_cafeeira?: string;         // Ex: "Sul de Minas", "Cerrado Mineiro"
  criado_em: Date;
  atualizado_em: Date;
}

interface Talhao {
  id: string;
  propriedade_id: string;
  nome: string;                      // Ex: "Talhão A - Bourbon"
  area_hectares: number;
  variedade: string;
  altitude_metros?: number;
  ano_plantio?: number;
  poligono_geojson?: GeoJSON;
  criado_em: Date;
}

interface Certificacao {
  id: string;
  propriedade_id: string;
  tipo: string;                      // "UTZ", "Rainforest", "Orgânico", etc
  validade?: Date;
  documento_url?: string;
  criado_em: Date;
}
```

```typescript
// src/types/lote.ts

type LoteStatus = 'RASCUNHO' | 'DISPONIVEL' | 'EM_NEGOCIACAO' | 'VENDIDO' | 'ENCERRADO';
type ProcessoTipo = 'NATURAL' | 'LAVADO' | 'HONEY' | 'DESCASCADO' | 'OUTRO';

interface Lote {
  id: string;
  produtor_id: string;
  talhao_id?: string;
  status: LoteStatus;

  // Café
  variedade: string;
  processo: ProcessoTipo;
  safra: string;                     // "2024/25"
  peneira?: string;
  pontuacao_cupping?: number;        // 84.5
  notas_sensoriais?: string;         // "Chocolate, caramelo, frutas vermelhas"

  // Volume e preço
  quantidade_sacas: number;
  preco_por_saca?: number;           // null = "aceito propostas"
  preco_negociavel: boolean;

  // Rastreabilidade
  qrcode_hash?: string;
  altitude_metros?: number;
  data_colheita?: Date;

  fotos_urls?: string[];

  criado_em: Date;
  atualizado_em: Date;
}
```

```typescript
// src/types/diario.ts

type AtividadeTipo = 'ADUBACAO' | 'PULVERIZACAO' | 'PODA' | 'COLHEITA' | 'IRRIGACAO' | 'OUTRO';

interface AtividadeCampo {
  id: string;
  talhao_id: string;
  produtor_id: string;
  tipo: AtividadeTipo;
  descricao?: string;
  data: Date;
  insumos_utilizados?: string;
  quantidade_insumo?: number;
  unidade_insumo?: string;
  custo?: number;
  fotos_urls?: string[];
  criado_em: Date;
}

interface DespesaProducao {
  id: string;
  propriedade_id: string;
  produtor_id: string;
  safra: string;                     // "2024/25"
  categoria: 'INSUMO' | 'MAO_DE_OBRA' | 'MAQUINARIO' | 'FRETE' | 'OUTRO';
  descricao: string;
  valor: number;
  data: Date;
  talhao_id?: string;               // Se a despesa é por talhão
  criado_em: Date;
}
```

---

## 2. Segurança e Autenticação

### 2.1 Stack

| Camada | Tecnologia |
|---|---|
| Autenticação | Supabase Auth |
| Criptografia em trânsito | TLS 1.3 |
| Criptografia em repouso | AES-256 (CPF/CNPJ) |
| Token | JWT (15min) + Refresh token (30d, rotation) |
| Validação | Zod |

### 2.2 Fluxo de Onboarding (5 etapas)

```
ETAPA 1 — Cadastro
├── Email + Senha (mín 8 chars, 1 maiúsc, 1 número)
├── OU Google / Apple Sign-in
└── Telefone (obrigatório)

ETAPA 2 — Verificação de Telefone
└── SMS OTP (6 dígitos, expira 5min, máx 3 tentativas)

ETAPA 3 — Dados Pessoais
├── Nome completo
├── CPF ou CNPJ (validação tempo real)
├── Estado e Município
└── Foto (opcional)

ETAPA 4 — Dados da Fazenda
├── Nome da propriedade
├── Área total (hectares)
├── Altitude (metros)
├── Região cafeeira (select com regiões conhecidas)
└── Certificações (multi-select, opcional)

ETAPA 5 — Termos de Uso + Política de Privacidade (LGPD)
└── Aceite obrigatório com timestamp
```

### 2.3 Login

```
Opção A: Email + Senha
Opção B: Google / Apple
Opção C: SMS OTP (login rápido — ideal para produtor rural)
Opção D: Biometria (Face ID / Fingerprint) para relogin
```

### 2.4 Row Level Security

```sql
-- Usuário só acessa seus próprios dados
CREATE POLICY "user_own_data" ON users
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Produtor só vê suas propriedades
CREATE POLICY "produtor_own_propriedades" ON propriedades
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

-- Produtor só vê talhões das suas propriedades
CREATE POLICY "produtor_own_talhoes" ON talhoes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM propriedades
      WHERE propriedades.id = talhoes.propriedade_id
      AND propriedades.produtor_id = auth.uid()
    )
  );

-- Produtor só vê e edita seus lotes
CREATE POLICY "produtor_own_lotes" ON lotes
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

-- Produtor só vê suas atividades de campo
CREATE POLICY "produtor_own_atividades" ON atividades_campo
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

-- Produtor só vê suas despesas
CREATE POLICY "produtor_own_despesas" ON despesas_producao
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);
```

### 2.5 LGPD

```typescript
// src/services/lgpd.ts

interface ConsentRecord {
  user_id: string;
  tipo: 'TERMOS_USO' | 'PRIVACIDADE' | 'MARKETING';
  aceito: boolean;
  ip_address: string;
  timestamp: Date;
  versao_documento: string;
}

interface LGPDService {
  exportarDados(userId: string): Promise<UserDataExport>;
  anonimizarConta(userId: string): Promise<void>;
  listarConsentimentos(userId: string): Promise<ConsentRecord[]>;
  revogarConsentimento(userId: string, tipo: string): Promise<void>;
}
```

---

## 3. Estrutura de Telas (UX)

### 3.1 Mapa de Navegação

```
Copa Café App
│
├── 🔐 Auth Stack
│   ├── Splash Screen
│   ├── Onboarding (3 slides explicativos)
│   ├── Login
│   ├── Cadastro (wizard 5 etapas)
│   ├── Recuperar Senha
│   └── Verificação OTP
│
├── 🏠 Tab Navigator (5 tabs)
│   │
│   ├── 📊 Home (Tab 1)
│   │   ├── Saudação + nome do produtor
│   │   ├── Card: Cotação do dia (arábica / conilon)
│   │   ├── Card: Clima hoje (temp, chuva, umidade)
│   │   ├── Card: Resumo da safra
│   │   │   ├── Lotes cadastrados
│   │   │   ├── Lotes vendidos
│   │   │   └── Receita estimada
│   │   ├── Alertas recentes (cotação, clima)
│   │   └── Atalhos rápidos
│   │       ├── "+ Novo Lote"
│   │       ├── "Registrar Atividade"
│   │       └── "Ver Cotações"
│   │
│   ├── 🛒 Meus Lotes (Tab 2)
│   │   ├── Lista de lotes (filtro por status)
│   │   │   ├── Rascunho
│   │   │   ├── Disponível
│   │   │   ├── Em negociação
│   │   │   ├── Vendido
│   │   │   └── Encerrado
│   │   ├── FAB: "+ Novo Lote"
│   │   │   ├── Selecionar talhão (opcional)
│   │   │   ├── Variedade (select)
│   │   │   ├── Processo (natural/lavado/honey/descascado)
│   │   │   ├── Safra
│   │   │   ├── Peneira
│   │   │   ├── Pontuação cupping (0-100)
│   │   │   ├── Notas sensoriais (texto livre)
│   │   │   ├── Quantidade (sacas)
│   │   │   ├── Preço por saca (opcional)
│   │   │   ├── Data de colheita
│   │   │   ├── Fotos (até 5)
│   │   │   └── Salvar como Rascunho / Publicar
│   │   ├── Detalhe do Lote
│   │   │   ├── Todas as infos + fotos
│   │   │   ├── QR Code de rastreabilidade
│   │   │   ├── Editar / Encerrar
│   │   │   └── Compartilhar (WhatsApp, link)
│   │   └── Histórico de vendas
│   │
│   ├── 🌱 Fazenda (Tab 3)
│   │   ├── Visão geral da propriedade
│   │   │   ├── Nome, área, altitude, região
│   │   │   ├── Certificações ativas
│   │   │   └── Editar dados
│   │   ├── Talhões
│   │   │   ├── Lista / Mapa dos talhões
│   │   │   ├── "+ Novo Talhão"
│   │   │   │   ├── Nome
│   │   │   │   ├── Área (ha)
│   │   │   │   ├── Variedade
│   │   │   │   ├── Altitude
│   │   │   │   ├── Ano de plantio
│   │   │   │   └── Desenhar no mapa (opcional)
│   │   │   └── Detalhe do Talhão
│   │   │       ├── Dados técnicos
│   │   │       ├── Atividades recentes
│   │   │       └── Lotes deste talhão
│   │   ├── Diário de Campo
│   │   │   ├── Timeline de atividades
│   │   │   ├── Filtro por talhão / tipo / período
│   │   │   └── "+ Registrar Atividade"
│   │   │       ├── Selecionar talhão
│   │   │       ├── Tipo (adubação, pulverização, poda, colheita, irrigação, outro)
│   │   │       ├── Data
│   │   │       ├── Descrição
│   │   │       ├── Insumo utilizado + quantidade
│   │   │       ├── Custo (R$)
│   │   │       └── Foto (opcional)
│   │   └── Custos de Produção
│   │       ├── Resumo por safra
│   │       │   ├── Total de despesas
│   │       │   ├── Custo por saca (calculado)
│   │       │   └── Gráfico por categoria
│   │       ├── Lista de despesas (filtro por safra/categoria)
│   │       └── "+ Nova Despesa"
│   │           ├── Categoria (insumo, mão de obra, maquinário, frete, outro)
│   │           ├── Descrição
│   │           ├── Valor (R$)
│   │           ├── Data
│   │           └── Talhão (opcional)
│   │
│   ├── 📈 Cotações (Tab 4)
│   │   ├── Cotação atual
│   │   │   ├── Arábica (CEPEA, Bolsa NY)
│   │   │   ├── Conilon (CEPEA, Bolsa Londres)
│   │   │   └── Câmbio USD/BRL
│   │   ├── Gráfico de evolução (7d, 30d, 6m, 1a)
│   │   ├── Alertas de preço
│   │   │   └── "Me avise quando arábica passar de R$X"
│   │   └── Simulador de Venda
│   │       ├── Input: quantidade de sacas
│   │       ├── Cotação atual (auto)
│   │       ├── Custo de produção por saca (puxado de Custos)
│   │       ├── Output: receita bruta, custo, margem (R$ e %)
│   │       └── Botão: "Criar lote com este preço"
│   │
│   └── 👤 Perfil (Tab 5)
│       ├── Foto + nome + região
│       ├── Dados pessoais (editar)
│       ├── Dados da propriedade (editar)
│       ├── Certificações
│       ├── Configurações
│       │   ├── Notificações (push, email, SMS)
│       │   ├── Privacidade (LGPD: exportar dados, excluir conta)
│       │   ├── Segurança (alterar senha, biometria)
│       │   └── Unidades (hectares/alqueires, R$/USD)
│       ├── Ajuda e suporte
│       └── Sair
│
└── 🔔 Notificações (acessível do header)
    ├── Alertas de cotação atingida
    ├── Alertas de clima (geada, chuva forte)
    ├── Lembretes do diário de campo
    └── Atualizações da plataforma
```

### 3.2 Navegação

```typescript
// src/navigation/MainNavigator.tsx

const tabs = [
  { name: 'Home',      icon: 'home',        component: HomeScreen },
  { name: 'Lotes',     icon: 'package',     component: LotesScreen },
  { name: 'Fazenda',   icon: 'leaf',        component: FazendaScreen },
  { name: 'Cotações',  icon: 'trending-up',  component: CotacoesScreen },
  { name: 'Perfil',    icon: 'user',         component: PerfilScreen },
];
```

---

## 4. Estrutura de Pastas

```
copa-cafe/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── cadastro/
│   │   │   ├── index.tsx            # Step 1: credenciais
│   │   │   ├── verificacao.tsx      # Step 2: OTP
│   │   │   ├── perfil.tsx           # Step 3: dados pessoais
│   │   │   ├── fazenda.tsx          # Step 4: dados da fazenda
│   │   │   └── termos.tsx           # Step 5: aceite LGPD
│   │   └── recuperar-senha.tsx
│   │
│   ├── (tabs)/
│   │   ├── home.tsx
│   │   ├── lotes/
│   │   │   ├── index.tsx            # Lista de lotes
│   │   │   ├── [loteId].tsx         # Detalhe do lote
│   │   │   └── novo.tsx             # Cadastrar lote
│   │   ├── fazenda/
│   │   │   ├── index.tsx            # Visão geral
│   │   │   ├── talhoes/
│   │   │   │   ├── index.tsx        # Lista de talhões
│   │   │   │   ├── [talhaoId].tsx   # Detalhe do talhão
│   │   │   │   └── novo.tsx         # Novo talhão
│   │   │   ├── diario/
│   │   │   │   ├── index.tsx        # Timeline
│   │   │   │   └── nova-atividade.tsx
│   │   │   └── custos/
│   │   │       ├── index.tsx        # Resumo + lista
│   │   │       └── nova-despesa.tsx
│   │   ├── cotacoes/
│   │   │   ├── index.tsx            # Cotações + gráfico
│   │   │   ├── alertas.tsx          # Config alertas
│   │   │   └── simulador.tsx        # Simulador de venda
│   │   └── perfil/
│   │       ├── index.tsx
│   │       ├── editar.tsx
│   │       ├── privacidade.tsx
│   │       └── seguranca.tsx
│   │
│   ├── notificacoes.tsx
│   └── _layout.tsx
│
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── FAB.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── LoadingSkeleton.tsx
│   │   ├── home/
│   │   │   ├── CotacaoCard.tsx
│   │   │   ├── ClimaCard.tsx
│   │   │   ├── SafraResumoCard.tsx
│   │   │   └── AtalhoRapido.tsx
│   │   ├── lotes/
│   │   │   ├── LoteCard.tsx
│   │   │   ├── LoteStatusBadge.tsx
│   │   │   ├── LoteForm.tsx
│   │   │   └── QRCodeView.tsx
│   │   ├── fazenda/
│   │   │   ├── PropriedadeHeader.tsx
│   │   │   ├── TalhaoCard.tsx
│   │   │   ├── TalhaoForm.tsx
│   │   │   ├── AtividadeCard.tsx
│   │   │   ├── AtividadeForm.tsx
│   │   │   ├── DespesaCard.tsx
│   │   │   ├── DespesaForm.tsx
│   │   │   └── CustoChart.tsx
│   │   ├── cotacoes/
│   │   │   ├── PriceDisplay.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   ├── AlertaForm.tsx
│   │   │   └── SimuladorVenda.tsx
│   │   └── auth/
│   │       ├── OTPInput.tsx
│   │       ├── DocumentUpload.tsx
│   │       └── WizardProgress.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useUser.ts
│   │   ├── usePropriedade.ts
│   │   ├── useTalhoes.ts
│   │   ├── useLotes.ts
│   │   ├── useDiario.ts
│   │   ├── useCustos.ts
│   │   └── useCotacao.ts
│   │
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── propriedade.service.ts
│   │   ├── talhao.service.ts
│   │   ├── lote.service.ts
│   │   ├── diario.service.ts
│   │   ├── custo.service.ts
│   │   ├── cotacao.service.ts
│   │   └── lgpd.service.ts
│   │
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── userStore.ts
│   │   ├── fazendaStore.ts
│   │   ├── lotesStore.ts
│   │   └── cotacaoStore.ts
│   │
│   ├── types/
│   │   ├── user.ts
│   │   ├── fazenda.ts
│   │   ├── lote.ts
│   │   ├── diario.ts
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── validators.ts           # CPF, CNPJ, email, telefone
│   │   ├── formatters.ts           # Moeda, data, peso, área
│   │   ├── calculators.ts          # Custo por saca, margem
│   │   └── crypto.ts
│   │
│   └── constants/
│       ├── theme.ts
│       ├── regions.ts              # Regiões cafeeiras do BR
│       ├── varieties.ts            # Variedades de café
│       └── config.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_users.sql
│   │   ├── 002_propriedades.sql
│   │   ├── 003_talhoes.sql
│   │   ├── 004_certificacoes.sql
│   │   ├── 005_lotes.sql
│   │   ├── 006_atividades_campo.sql
│   │   ├── 007_despesas_producao.sql
│   │   ├── 008_consent_lgpd.sql
│   │   └── 009_rls_policies.sql
│   ├── seed.sql
│   └── config.toml
│
├── app.json
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 5. Schema do Banco de Dados

```sql
-- ============================================
-- 001_users.sql
-- ============================================

CREATE TYPE account_status AS ENUM (
  'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status account_status DEFAULT 'PENDING_VERIFICATION',

  nome VARCHAR(200) NOT NULL,
  cpf_cnpj_encrypted BYTEA,
  cpf_cnpj_hash VARCHAR(64),
  email VARCHAR(255) UNIQUE NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  avatar_url TEXT,

  estado CHAR(2) NOT NULL,
  municipio VARCHAR(200) NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  documento_verificado BOOLEAN DEFAULT FALSE,
  verificado_em TIMESTAMPTZ,

  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  ultimo_login TIMESTAMPTZ,
  aceite_termos TIMESTAMPTZ NOT NULL,
  aceite_privacidade TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_users_estado ON users(estado);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- 002_propriedades.sql
-- ============================================

CREATE TABLE propriedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  nome VARCHAR(200) NOT NULL,
  area_total_hectares DECIMAL(10, 2),
  altitude_metros INTEGER,
  regiao_cafeeira VARCHAR(100),

  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 003_talhoes.sql
-- ============================================

CREATE TABLE talhoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id UUID NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,

  nome VARCHAR(100) NOT NULL,
  area_hectares DECIMAL(10, 2),
  variedade VARCHAR(100),
  altitude_metros INTEGER,
  ano_plantio INTEGER,
  poligono_geojson JSONB,

  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 004_certificacoes.sql
-- ============================================

CREATE TABLE certificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id UUID NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL,
  validade DATE,
  documento_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 005_lotes.sql
-- ============================================

CREATE TYPE lote_status AS ENUM (
  'RASCUNHO', 'DISPONIVEL', 'EM_NEGOCIACAO', 'VENDIDO', 'ENCERRADO'
);

CREATE TYPE processo_tipo AS ENUM (
  'NATURAL', 'LAVADO', 'HONEY', 'DESCASCADO', 'OUTRO'
);

CREATE TABLE lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES users(id),
  talhao_id UUID REFERENCES talhoes(id),
  status lote_status DEFAULT 'RASCUNHO',

  variedade VARCHAR(100) NOT NULL,
  processo processo_tipo NOT NULL,
  safra VARCHAR(10) NOT NULL,
  peneira VARCHAR(20),
  pontuacao_cupping DECIMAL(4, 1),
  notas_sensoriais TEXT,

  quantidade_sacas INTEGER NOT NULL,
  preco_por_saca DECIMAL(10, 2),
  preco_negociavel BOOLEAN DEFAULT TRUE,

  qrcode_hash VARCHAR(64) UNIQUE,
  altitude_metros INTEGER,
  data_colheita DATE,

  fotos_urls TEXT[],

  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lotes_status ON lotes(status);
CREATE INDEX idx_lotes_produtor ON lotes(produtor_id);

-- ============================================
-- 006_atividades_campo.sql
-- ============================================

CREATE TYPE atividade_tipo AS ENUM (
  'ADUBACAO', 'PULVERIZACAO', 'PODA', 'COLHEITA', 'IRRIGACAO', 'OUTRO'
);

CREATE TABLE atividades_campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talhao_id UUID NOT NULL REFERENCES talhoes(id) ON DELETE CASCADE,
  produtor_id UUID NOT NULL REFERENCES users(id),

  tipo atividade_tipo NOT NULL,
  descricao TEXT,
  data DATE NOT NULL,
  insumos_utilizados VARCHAR(200),
  quantidade_insumo DECIMAL(10, 2),
  unidade_insumo VARCHAR(20),
  custo DECIMAL(10, 2),
  fotos_urls TEXT[],

  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_atividades_talhao ON atividades_campo(talhao_id);
CREATE INDEX idx_atividades_produtor ON atividades_campo(produtor_id);
CREATE INDEX idx_atividades_data ON atividades_campo(data);

-- ============================================
-- 007_despesas_producao.sql
-- ============================================

CREATE TYPE despesa_categoria AS ENUM (
  'INSUMO', 'MAO_DE_OBRA', 'MAQUINARIO', 'FRETE', 'OUTRO'
);

CREATE TABLE despesas_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id UUID NOT NULL REFERENCES propriedades(id),
  produtor_id UUID NOT NULL REFERENCES users(id),
  talhao_id UUID REFERENCES talhoes(id),

  safra VARCHAR(10) NOT NULL,
  categoria despesa_categoria NOT NULL,
  descricao VARCHAR(300) NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data DATE NOT NULL,

  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_despesas_produtor ON despesas_producao(produtor_id);
CREATE INDEX idx_despesas_safra ON despesas_producao(safra);

-- ============================================
-- 008_consent_lgpd.sql
-- ============================================

CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  aceito BOOLEAN NOT NULL,
  ip_address INET,
  versao_documento VARCHAR(20) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_user ON consent_records(user_id);
```

---

## 6. Prompt para Claude Code

```
Estou criando o app Copa Café — MVP focado no produtor de café brasileiro.

Stack:
- React Native com Expo (Expo Router)
- Supabase (Auth + Database + Storage)
- TypeScript
- Zustand para state management
- Zod para validação

O MVP tem um único tipo de usuário: PRODUTOR (cafeicultor).

Funcionalidades do MVP:
1. Auth: cadastro (wizard 5 etapas), login (email, Google, SMS OTP), biometria
2. Home: cotação do dia, clima, resumo da safra, atalhos rápidos
3. Meus Lotes: CRUD de lotes de café com dados técnicos, fotos e QR Code
4. Fazenda: propriedade, talhões, diário de campo, custos de produção
5. Cotações: arábica/conilon em tempo real, gráficos, alertas, simulador de venda
6. Perfil: dados pessoais, propriedade, certificações, LGPD

Preciso que você:
1. Inicialize o projeto Expo com TypeScript
2. Configure Supabase client
3. Aplique as migrações SQL
4. Implemente o fluxo de auth completo (cadastro + login)
5. Monte a navegação por tabs (Home, Lotes, Fazenda, Cotações, Perfil)
6. Comece pelas telas de auth e Home

A especificação completa está em copa-cafe-spec.md neste diretório.
Siga a estrutura de pastas, tipos e RLS policies definidos lá.
```

---

## 7. Roadmap MVP Produtor

| Fase | Escopo | Estimativa |
|---|---|---|
| **Fase 1** | Setup Expo + Supabase, Auth completo, navegação por tabs | 1 semana |
| **Fase 2** | Home (cotação, clima, resumo safra) | 3-4 dias |
| **Fase 3** | Fazenda (propriedade, talhões, CRUD) | 1 semana |
| **Fase 4** | Diário de campo + Custos de produção | 1 semana |
| **Fase 5** | Meus Lotes (CRUD, fotos, QR Code) | 1 semana |
| **Fase 6** | Cotações (API, gráficos, alertas, simulador) | 1 semana |
| **Fase 7** | Perfil + LGPD + Notificações | 3-4 dias |
| **Fase 8** | Testes, polish, deploy beta | 1 semana |

**Fases futuras (pós-MVP):**
- Comerciante (marketplace de compra)
- Corretor (intermediação + comissões)
- Chat em tempo real
- Rastreabilidade pública
