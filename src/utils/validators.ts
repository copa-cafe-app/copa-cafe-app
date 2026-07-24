export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Rejeitar sequências iguais (000.000.000-00, 111.111.111-11, etc)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Rejeitar sequências iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (d1 !== parseInt(digits[12])) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  if (d2 !== parseInt(digits[13])) return false;

  return true;
}

// Política de senha única do app (antes divergia: cadastro exigia 8+maiúscula+número,
// redefinição aceitava 6). Retorna a primeira falha encontrada, em ordem.
export function validatePassword(senha: string): { valid: boolean; message?: string } {
  if (senha.length < 8) return { valid: false, message: 'Mínimo 8 caracteres' };
  if (!/[A-Z]/.test(senha)) return { valid: false, message: 'Precisa ter 1 letra maiúscula' };
  if (!/[0-9]/.test(senha)) return { valid: false, message: 'Precisa ter 1 número' };
  return { valid: true };
}

// Domínios que concentram quase todo cadastro de pessoa física no Brasil.
// Servem pra pegar erro de digitação (ex.: "hotmail.coml"), que passa em
// qualquer regex porque "coml" é estruturalmente um TLD válido.
const DOMINIOS_COMUNS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'live.com',
  'msn.com',
];

/**
 * Damerau-Levenshtein (alinhamento ótimo): conta troca de letras vizinhas como
 * UMA edição. Precisa ser Damerau e não Levenshtein puro porque transposição
 * ("gmial.com") é o erro de digitação mais comum, e em Levenshtein ela custa 2.
 */
function distancia(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposição
      }
    }
    if (Math.min(...d[i]) > max) return max + 1;
  }
  return d[a.length][b.length];
}

// Estrutura: sem espaços, um único @, domínio com ponto e TLD de 2 a 24 letras.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,24}$/;

/**
 * Valida email de verdade. Antes o app só checava `email.includes('@')`, o que
 * deixou entrar cadastros inutilizáveis em produção (ex.: "@hotmail.coml" —
 * o usuário nunca receberia recuperação de senha nem exportação de dados).
 * Quando o domínio é quase um domínio conhecido, devolve a sugestão pra tela
 * poder oferecer a correção em vez de só barrar.
 */
export function validateEmail(email: string): {
  valid: boolean;
  message?: string;
  suggestion?: string;
} {
  const limpo = email.trim().toLowerCase();
  if (!limpo) return { valid: false, message: 'Informe seu email' };
  if (!EMAIL_RE.test(limpo)) return { valid: false, message: 'Email inválido' };

  const [conta, dominio] = limpo.split('@');
  const parecido = DOMINIOS_COMUNS.find((d) => d !== dominio && distancia(dominio, d, 1) === 1);
  if (parecido) {
    return {
      valid: false,
      message: `Você quis dizer ${conta}@${parecido}?`,
      suggestion: `${conta}@${parecido}`,
    };
  }

  return { valid: true };
}

export function validateCPFCNPJ(value: string): { valid: boolean; message?: string } {
  const digits = value.replace(/\D/g, '');

  if (digits.length <= 11) {
    if (digits.length !== 11) return { valid: false, message: 'CPF deve ter 11 dígitos' };
    if (!validateCPF(digits)) return { valid: false, message: 'CPF inválido' };
    return { valid: true };
  }

  if (digits.length !== 14) return { valid: false, message: 'CNPJ deve ter 14 dígitos' };
  if (!validateCNPJ(digits)) return { valid: false, message: 'CNPJ inválido' };
  return { valid: true };
}
