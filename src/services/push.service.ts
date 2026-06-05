// @ts-nocheck — arquivo dormente; depende de expo-notifications/expo-device ainda não instalados
// ============================================================================
// SERVIÇO DE PUSH NOTIFICATIONS — DORMENTE / NÃO ATIVADO
// ----------------------------------------------------------------------------
// Este arquivo NÃO é importado em nenhum lugar do app de propósito: push não
// roda no Expo Go (SDK 53+ removeu push no Android) e o pacote `expo-notifications`
// ainda não está instalado. Importar isso agora QUEBRARIA o Expo Go.
//
// COMO ATIVAR (fase de build, ver memória "fundacao-push-notifications"):
//   1) npx expo install expo-notifications expo-device
//   2) app.json → plugins: ["expo-notifications"] e configurar FCM (Android) no EAS
//   3) supabase db push  (aplica a coluna users.expo_push_token)
//   4) Importar registerForPush() no _layout (após login) e chamar
//   5) Build via EAS (não Expo Go)
// ============================================================================
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // simulador não recebe push

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp.data;

    // Salva o token no perfil do usuário (coluna expo_push_token)
    if (token) {
      await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);
    }
    return token;
  } catch {
    return null;
  }
}
