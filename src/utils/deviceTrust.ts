import AsyncStorage from '@react-native-async-storage/async-storage';

// "Lembrar dispositivo" para o 2FA: depois que o usuário passa por uma verificação
// por SMS neste aparelho (login 2FA ou cadastro), marcamos como confiável e não
// pedimos o código SMS de novo aqui. Aparelho novo = pede o código.
function key(userId: string) {
  return `@copa_cafe_trusted_${userId}`;
}

export async function isDeviceTrusted(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === 'true';
  } catch {
    return false;
  }
}

export async function trustDevice(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), 'true');
  } catch {
    // silencioso — se falhar, no máximo pede 2FA de novo
  }
}
