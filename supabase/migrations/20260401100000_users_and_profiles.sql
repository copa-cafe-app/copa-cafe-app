-- ============================================
-- Copa Café - Users, Propriedades & Consent
-- ============================================

-- 1. Users profile table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
    CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED')),

  nome TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT NOT NULL,
  avatar_url TEXT,

  estado CHAR(2) NOT NULL,
  municipio TEXT NOT NULL,
  lat DECIMAL,
  lng DECIMAL,

  documento_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  verificado_em TIMESTAMPTZ,

  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_login TIMESTAMPTZ,
  aceite_termos TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceite_privacidade TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Propriedades (farms)
CREATE TABLE IF NOT EXISTS public.propriedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produtor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  area_total_hectares DECIMAL NOT NULL,
  altitude_metros DECIMAL,
  regiao_cafeeira TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Consent records (LGPD)
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('TERMOS_USO', 'PRIVACIDADE', 'MARKETING')),
  aceito BOOLEAN NOT NULL DEFAULT TRUE,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  versao_documento TEXT NOT NULL DEFAULT '1.0'
);

-- 4. Indexes
CREATE INDEX idx_propriedades_produtor ON public.propriedades(produtor_id);
CREATE INDEX idx_consent_user ON public.consent_records(user_id);

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER propriedades_updated_at
  BEFORE UPDATE ON public.propriedades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propriedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Users: only own data
CREATE POLICY "users_own_data" ON public.users
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Propriedades: only own farms
CREATE POLICY "produtor_own_propriedades" ON public.propriedades
  FOR ALL USING (auth.uid() = produtor_id)
  WITH CHECK (auth.uid() = produtor_id);

-- Consent: only own records
CREATE POLICY "user_own_consent" ON public.consent_records
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
