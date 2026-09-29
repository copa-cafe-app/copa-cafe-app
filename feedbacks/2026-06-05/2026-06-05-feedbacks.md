# Feedbacks — 2026-06-05

## 1. Tela Inicial/clima
- **tivemos relatos de que o local do clima divulgado não está igual ao cadastrado**
- **Prioridade:** (alta)
- precisamos fazer com que o produtor libere a localização ao fazer uso do app, e que isso gere coordenadas que possam ser compartilhadas conosco - prioridade de obtermos coordenadas: ALTÍSSIMA

---

## 2. barra inferior
- **Onde:** barra inferior do app
- **O quê:** precosamos torna-la um pouco mais alta. tivemos feedbacks de que em alguns celulares não dá pra clicar direito, e fica difícil clicar para voltar/mudar pagina
- **Print:** salvo como print 0017 na pasta prints. esse item deve subir um pouco, somente o suficiente para não ficar tao colado assim embaixo
- **Prioridade:** alta
- o mesmo vale para outras informações que estão ficando muito embaixo na pagina


## 3. Lotes -> Novo Lote
- Na opção PENEIRA, acrescentar a informação 17/18
- **Prioridade:** MÉDIA

## 4. Fazenda -> Diário de Campo
- tivemos relatos de que se o usuário entrar e não finalizar as etapas de preenchimento não é possível sair/voltar. porém devo relatar que no meu teste no expo go, não atestei isso, está funcionando normal. porém, verifique se pode haver algo impedindo que isso seja feito no teste real em telefone android
- prioridade media


## 5. Saúde da Planta / análise da planta
- **Onde:ícone da home "Saúde Planta" (aliás, altera para Saúde da Planta) e Fazenda -> Análise da Planta
o recurso apresentou erro. não está funcionando
- prioridade alta

## 6. Criação de lotes
- também apresenta erros
- prioridade alta


## 7. Diário de Campo
- foi dado um feedback bem aceito de que poderia haver uma forma de pesquisar por períodos superiores a um mês, dando a opção de se criar um relatório de determinado período
- prioridade média

## 8. custo de produção
- foi dado o feedback para se buscar uma integração maior entre esse lançamento de custos e o diário de campo, para evitar custos duplicados e fazer com que o lançado no diário já reflita na aba custos de produção, podendo-se acrescentar comprovantes por exemplo. Além disso, foi dada a ideia de nessa aba de custo de produção emitir um relatório com despesas totais em determinado período escolhido, seja dias, mês inteiro ou ano, ou período personalizado
- **Prioridade:** altissima

---
---

# STATUS DO ATAQUE (Claude — 2026-06-05)

- **FB1 — Localização/coordenadas: ✅ FEITO (código).** Bug encontrado: o app salvava `coordenadas` (coluna inexistente) → nenhuma coordenada estava sendo gravada. Corrigido p/ `lat`/`lng`. Agora pede localização ao abrir o app e salva no perfil. Card de clima passou a mostrar o município CADASTRADO (não o geocodificado vizinho). ⚠️ Decisão pendente: clima deve seguir GPS (onde o celular está) ou continuar pela cidade da fazenda? (mantive fazenda, sua preferência anterior).
- **FB2 — Barra inferior: ✅ FEITO.** Causa: `edgeToEdgeEnabled` + padding fixo. Agora respeita a safe area (sobe nos celulares com barra de gestos).
- **FB3 — Peneira 17/18: ✅ FEITO.** O campo era input numérico (nem aceitava "/"). Virou seletor com 17/18, 16/17, 15/16, 14/15, 13, Moka, Bica corrida.
- **FB4 — Diário trava ao não finalizar: ✅ FEITO (provável causa).** Os modais não tinham `onRequestClose` → no Android o botão voltar não fechava (no iPhone/Expo Go não tem botão físico, por isso não reproduziu). Adicionado nos modais do Diário e Novo Lote.
- **FB5 — Saúde da Planta: 🔴 CAUSA RAIZ ACHADA.** A função está deployada e a `ANTHROPIC_API_KEY` existe, MAS a Claude responde **401 (key inválida/expirada)**. Mesma key usada no OCR de recibos → também quebrado. AÇÃO: gerar nova key em console.anthropic.com e setar (`npx supabase secrets set ANTHROPIC_API_KEY=...`). Label "Saúde da Planta" já corrigido. ✅ (rename)
- **FB6 — Criar lote: ⏳ PRECISA DO ERRO.** Schema remoto OK (bebida/cata aplicados), insert válido. Não reproduzi sem o texto do erro. O app já mostra o erro num Alert — me manda o que aparece. Suspeita: conta legada (RLS) ou era o próprio campo peneira (já corrigido no FB3).
- **FB7 — Diário busca por período + relatório: ✅ FEITO.** Botão de relatório (ícone) no header do Diário → escolhe data início/fim (qualquer intervalo, >1 mês) → gera PDF das atividades do período (resumo por tipo + custo total + detalhado). `exportAtividades.ts` + `atividadeService.listByRange`.
- **FB8 — Integrar custos + diário + comprovantes + relatório por período: ✅ FEITO (decisão: UNIFICAR).** Custo lançado numa atividade do Diário cria/atualiza automaticamente UMA despesa na tela Custos (origem=DIARIO, badge "Diário"). Apagar a atividade remove a despesa (cascade). Dá pra anexar comprovante na atividade (vai junto na despesa). Tela Custos ganhou export por **período personalizado** (data início/fim). Migration aplicada no banco + corrigido bug de RLS (UPDATE de atividade estava bloqueado). Mapeamento tipo→categoria: Adubação→Insumos, Pulverização→Defensivos, Poda/Colheita→Mão de obra, Irrigação/Outro→Outros.

## ⚠️ Pra testar FB7/FB8 no app
- Migrations já aplicadas no banco remoto (`20260605120000` + `20260605120100`). Era só rodar no Expo Go.
- **FB5 (Saúde da Planta / OCR de recibos) só volta a funcionar depois que você setar uma `ANTHROPIC_API_KEY` nova válida** — o anexo de comprovante via "Escanear" depende dela; o anexo manual (foto) funciona independente.