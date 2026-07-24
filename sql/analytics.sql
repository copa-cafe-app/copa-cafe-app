-- ============================================================================
-- Copa Café — queries de leitura da plataforma
-- ============================================================================
-- Como usar: Supabase Dashboard → SQL Editor → cole UMA query por vez → Run.
-- Clique em "Save" pra ela virar query salva (aí é 2 cliques nas próximas vezes).
-- Todas são SOMENTE LEITURA (SELECT). Rodam como service_role no editor, então
-- enxergam todos os usuários (a RLS `users_own_data` só limita o app).
--
-- ⚠️ Confiabilidade dos campos de localização:
--    `lat`/`lng`  = GPS REAL, capturado quando o usuário abre a home. Confiável.
--    `estado`/`municipio` = digitados no cadastro, SEM validação. Não confie
--    (há testadores com "97", "Ggh", "Test"). Use o GPS pra saber de onde vêm.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PANORAMA GERAL — o número que você olha primeiro
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM users)                                   AS usuarios,
  (SELECT COUNT(*) FROM users WHERE status = 'ACTIVE')           AS ativos,
  (SELECT COUNT(*) FROM users WHERE lat IS NOT NULL)             AS com_gps,
  (SELECT COUNT(*) FROM users WHERE ultimo_login > NOW() - INTERVAL '7 days')  AS logaram_7d,
  (SELECT COUNT(*) FROM users WHERE criado_em  > NOW() - INTERVAL '7 days')    AS novos_7d,
  (SELECT COUNT(*) FROM propriedades)                            AS propriedades,
  (SELECT COUNT(*) FROM talhoes)                                 AS talhoes,
  (SELECT COUNT(*) FROM lotes)                                   AS lotes,
  (SELECT COUNT(*) FROM atividades_campo)                        AS atividades,
  (SELECT COUNT(*) FROM despesas_producao)                       AS despesas;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. QUEM SÃO OS USUÁRIOS — lista completa com localização e engajamento
--    Esta é a query "mãe": responde 80% das perguntas de uma vez.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  u.nome,
  u.email,
  u.telefone,
  u.status,
  u.estado    AS estado_digitado,     -- não confiável
  u.municipio AS municipio_digitado,  -- não confiável
  u.lat, u.lng,
  CASE
    WHEN u.lat IS NULL                              THEN 'sem GPS'
    WHEN u.lat BETWEEN -34 AND 6 AND u.lng BETWEEN -74 AND -34 THEN 'Brasil'
    ELSE 'Exterior'
  END AS origem_gps,
  u.criado_em::date   AS cadastrou_em,
  u.ultimo_login,
  (SELECT COUNT(*) FROM propriedades      p WHERE p.produtor_id = u.id) AS propriedades,
  (SELECT COUNT(*) FROM talhoes           t WHERE t.produtor_id = u.id) AS talhoes,
  (SELECT COUNT(*) FROM lotes             l WHERE l.produtor_id = u.id) AS lotes,
  (SELECT COUNT(*) FROM atividades_campo  a WHERE a.produtor_id = u.id) AS atividades,
  (SELECT COUNT(*) FROM despesas_producao d WHERE d.produtor_id = u.id) AS despesas
FROM users u
ORDER BY u.criado_em DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DE ONDE VÊM (só GPS) — pra colar num mapa
--    Exporte como CSV e jogue em qualquer ferramenta de mapa.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  u.nome,
  ROUND(u.lat::numeric, 5) AS lat,
  ROUND(u.lng::numeric, 5) AS lng,
  u.municipio AS municipio_digitado,
  u.criado_em::date AS cadastrou_em
FROM users u
WHERE u.lat IS NOT NULL AND u.lng IS NOT NULL
ORDER BY u.lat DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. USUÁRIO REAL x CASCA VAZIA — quem passou do cadastro
--    "Ativou" = criou talhão, lote, atividade ou despesa DEPOIS do cadastro.
--    ⚠️ `propriedades` NÃO entra na conta: ela é criada dentro do próprio fluxo
--    de cadastro (verificado: as 23 nasceram <5 min depois do usuário), então
--    contá-la faria todo mundo parecer engajado.
-- ─────────────────────────────────────────────────────────────────────────────
WITH uso AS (
  SELECT u.id, u.nome, u.criado_em,
    (SELECT COUNT(*) FROM talhoes           t WHERE t.produtor_id = u.id)
  + (SELECT COUNT(*) FROM lotes             l WHERE l.produtor_id = u.id)
  + (SELECT COUNT(*) FROM atividades_campo  a WHERE a.produtor_id = u.id)
  + (SELECT COUNT(*) FROM despesas_producao d WHERE d.produtor_id = u.id) AS registros
  FROM users u
)
SELECT
  CASE WHEN registros = 0 THEN 'só cadastrou' ELSE 'usou de verdade' END AS perfil,
  COUNT(*) AS usuarios,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM uso
GROUP BY 1
ORDER BY usuarios DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CRESCIMENTO — cadastros por semana
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  DATE_TRUNC('week', criado_em)::date AS semana,
  COUNT(*)                            AS novos_usuarios,
  SUM(COUNT(*)) OVER (ORDER BY MIN(criado_em)) AS acumulado
FROM users
GROUP BY 1
ORDER BY 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. QUAIS FEATURES PEGARAM — adoção por módulo
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'Propriedades' AS modulo, COUNT(DISTINCT produtor_id) AS usuarios, COUNT(*) AS registros FROM propriedades
UNION ALL SELECT 'Talhões',       COUNT(DISTINCT produtor_id), COUNT(*) FROM talhoes
UNION ALL SELECT 'Lotes',         COUNT(DISTINCT produtor_id), COUNT(*) FROM lotes
UNION ALL SELECT 'Diário/Atividades', COUNT(DISTINCT produtor_id), COUNT(*) FROM atividades_campo
UNION ALL SELECT 'Despesas',      COUNT(DISTINCT produtor_id), COUNT(*) FROM despesas_producao
UNION ALL SELECT 'Alertas preço', COUNT(DISTINCT produtor_id), COUNT(*) FROM alertas_preco
UNION ALL SELECT 'Pedidos (mktplace)', COUNT(DISTINCT produtor_id), COUNT(*) FROM pedidos
ORDER BY usuarios DESC, registros DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. O QUE ACONTECEU ULTIMAMENTE — feed cru dos últimos 30 dias
-- ─────────────────────────────────────────────────────────────────────────────
SELECT criado_em, 'lote'      AS tipo, variedade AS detalhe, produtor_id FROM lotes             WHERE criado_em > NOW() - INTERVAL '30 days'
UNION ALL
SELECT criado_em, 'atividade',           titulo,             produtor_id FROM atividades_campo  WHERE criado_em > NOW() - INTERVAL '30 days'
UNION ALL
SELECT criado_em, 'despesa',             descricao,          produtor_id FROM despesas_producao WHERE criado_em > NOW() - INTERVAL '30 days'
UNION ALL
SELECT criado_em, 'propriedade',         nome,               produtor_id FROM propriedades      WHERE criado_em > NOW() - INTERVAL '30 days'
ORDER BY criado_em DESC
LIMIT 100;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SAÚDE DO CADASTRO — quantos travaram no meio do funil
-- ─────────────────────────────────────────────────────────────────────────────
SELECT status, COUNT(*) AS usuarios,
       COUNT(*) FILTER (WHERE ultimo_login IS NULL) AS nunca_logaram
FROM users
GROUP BY status
ORDER BY usuarios DESC;
