-- ============================================
-- 004_unique_constraints.sql — Evitar usuários duplicados
-- ============================================

-- CPF/CNPJ único
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_cnpj_unique
  ON public.users (cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';

-- Telefone único
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telefone_unique
  ON public.users (telefone)
  WHERE telefone IS NOT NULL AND telefone != '';
