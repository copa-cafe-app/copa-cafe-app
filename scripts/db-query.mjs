#!/usr/bin/env node
/**
 * Roda SQL no banco de produção pela Management API do Supabase.
 *
 * Setup (uma vez só):
 *   1. Gere um Personal Access Token em https://supabase.com/dashboard/account/tokens
 *   2. Crie um arquivo `.env.local` na raiz do projeto com:
 *        SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx
 *      (`.env*.local` já está no .gitignore — o token nunca vai pro GitHub)
 *
 * Uso:
 *   node scripts/db-query.mjs "SELECT COUNT(*) FROM users"
 *   node scripts/db-query.mjs --file sql/analytics.sql --query 1   # roda o bloco nº 1
 *   node scripts/db-query.mjs "SELECT * FROM users" --csv > users.csv
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = readFileSync(resolve(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();

function loadToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    const match = env.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* .env.local não existe */
  }
  console.error(
    'Falta o token. Gere em https://supabase.com/dashboard/account/tokens e\n' +
      'salve em .env.local como:  SUPABASE_ACCESS_TOKEN=sbp_...'
  );
  process.exit(1);
}

/**
 * Extrai a query nº n do arquivo. Cada seção começa num título de comentário
 * `-- n. TITULO` e vai até o título da seção seguinte; o SQL é tudo que não
 * for linha de comentário.
 */
function extractQuery(file, n) {
  const lines = readFileSync(resolve(ROOT, file), 'utf8').split(/\r?\n/);
  const isTitle = (line) => /^--\s*(\d+)\.\s/.test(line.trim());
  const start = lines.findIndex((line) => new RegExp(`^--\\s*${n}\\.\\s`).test(line.trim()));
  if (start === -1) {
    console.error(`Seção "${n}." não encontrada em ${file}`);
    process.exit(1);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(isTitle);
  const sql = (end === -1 ? rest : rest.slice(0, end))
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim();
  if (!sql) {
    console.error(`Seção "${n}." não tem SQL em ${file}`);
    process.exit(1);
  }
  return sql;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

const args = process.argv.slice(2);
const csv = args.includes('--csv');
const fileIdx = args.indexOf('--file');
const queryIdx = args.indexOf('--query');

let sql;
if (fileIdx !== -1) {
  const file = args[fileIdx + 1];
  sql = queryIdx !== -1 ? extractQuery(file, args[queryIdx + 1]) : readFileSync(resolve(ROOT, file), 'utf8');
} else {
  sql = args.find((a) => !a.startsWith('--'));
}

if (!sql) {
  console.error('Passe uma query: node scripts/db-query.mjs "SELECT ..."');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${loadToken()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`Erro ${res.status}: ${body}`);
  process.exit(1);
}

const rows = JSON.parse(body);
if (csv) {
  console.log(toCsv(rows));
} else {
  console.log(JSON.stringify(rows, null, 2));
}
