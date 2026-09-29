// Push notifications (Expo Push + FCM no Android).
//
// Não funciona no Expo Go (SDK 53+ removeu push no Android): lá tudo aqui vira
// no-op. No build da loja precisa do google-services.json + chave FCM V1 no EAS.
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const pushDisponivel = !isExpoGo && Device.isDevice;

// Notificação chegando com o app aberto também aparece
if (pushDisponivel) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Registra o aparelho para receber push e salva o token no perfil.
 * `pedirPermissao: false` só renova o token se o usuário já autorizou antes
 * (usado ao abrir o app, sem mostrar pop-up).
 */
export async function registerForPush(userId: string, pedirPermissao = false): Promise<string | null> {
  if (!pushDisponivel) return null;
  try {
    const { status: atual } = await Notifications.getPermissionsAsync();
    let status = atual;
    if (atual !== 'granted') {
      if (!pedirPermissao) return null;
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token) {
      await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);
    }
    return token;
  } catch {
    return null;
  }
}

/** Ao tocar numa notificação, chama `abrir` com os dados dela. Retorna o cancelamento. */
export function onNotificacaoTocada(abrir: (data: Record<string, unknown>) => void): () => void {
  if (!pushDisponivel) return () => {};
  // Notificação que abriu o app estando fechado
  Notifications.getLastNotificationResponseAsync()
    .then((resp) => { if (resp) abrir(resp.notification.request.content.data ?? {}); })
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    abrir(resp.notification.request.content.data ?? {});
  });
  return () => sub.remove();
}
