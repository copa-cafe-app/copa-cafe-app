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
