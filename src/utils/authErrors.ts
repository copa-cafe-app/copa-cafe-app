const errorMap: Record<string, string> = {
  'Invalid login credentials': 'Email ou senha incorretos',
  'Email not confirmed': 'Email ainda não confirmado. Verifique sua caixa de entrada.',
  'User already registered': 'Este email já está cadastrado',
  'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres',
  'Token has expired or is invalid': 'Código inválido ou expirado',
  'Email rate limit exceeded': 'Muitas tentativas. Aguarde um momento e tente novamente.',
  'For security purposes, you can only request this after': 'Aguarde alguns segundos antes de tentar novamente',
  'Unable to validate email address: invalid format': 'Formato de email inválido',
  'Signup requires a valid password': 'Informe uma senha válida',
  'A user with this email address has already been registered': 'Este email já está cadastrado',
  'Phone number format is invalid': 'Formato de telefone inválido',
  'New password should be different from the old password': 'A nova senha deve ser diferente da anterior',
};

export function translateAuthError(message: string): string {
  // Exact match
  if (errorMap[message]) return errorMap[message];

  // Partial match (for messages like "...after 55 seconds")
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return value;
  }

  // Fallback — mostra erro real para debug
  return message || 'Erro desconhecido';
}
