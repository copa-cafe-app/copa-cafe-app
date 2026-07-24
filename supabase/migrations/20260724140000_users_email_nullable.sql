-- ============================================================================
-- `users.email` era NOT NULL UNIQUE, mas string vazia NÃO viola NOT NULL.
-- Havia 1 perfil com email = '' (cadastro legado só-por-telefone). No dia em que
-- surgisse um SEGUNDO, o cadastro dele quebraria com violação de unicidade —
-- duas strings vazias colidem, dois NULLs não (o índice único do Postgres ignora
-- NULL).
--
-- Correção: permitir NULL, converter o '' existente em NULL e impedir que
-- qualquer email malformado (inclusive '') entre de novo.
-- Verificado antes de aplicar: 23 usuários, 1 com '' e 0 com formato inválido.
-- ============================================================================

ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

UPDATE public.users SET email = NULL WHERE email = '';

-- Aceita NULL (conta só-por-telefone, sem email) ou um email com @ e domínio.
-- Não tenta validar TLD — isso é papel do validateEmail do app, que também
-- detecta erro de digitação em domínio conhecido.
ALTER TABLE public.users
  ADD CONSTRAINT users_email_formato
  CHECK (email IS NULL OR email LIKE '%@%.%');
