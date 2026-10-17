import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiSend } from "./api";

// Con la app abierta el aviso también se muestra (por defecto iOS lo oculta).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let current: string | null = null;

/** Pide permiso, obtiene el token de Expo y lo registra en la API. Si algo falta (simulador, permiso denegado, sin projectId) no hace nada. */
export async function registerForPush() {
  try {
    if (!Device.isDevice) return;
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await apiSend("POST", "/v1/me/push-token", { token: data, platform: Platform.OS === "android" ? "android" : "ios" });
    current = data;
  } catch {
    // Sin push la app sigue funcionando; el aviso llegará por la campana de la web.
  }
}

/** Al cerrar sesión este dispositivo deja de recibir los avisos de esa cuenta. */
export async function unregisterPush() {
  if (!current) return;
  const token = current;
  current = null;
  await apiSend("DELETE", "/v1/me/push-token", { token }).catch(() => {});
}

/** Tipo del aviso que llega en `data.type` (alert, alert_critical, message, task_assigned...). */
export type PushKind = string;

/**
 * Llama a `onOpen` con el tipo del aviso cuando el usuario toca una notificación, también si la app estaba cerrada
 * y se abrió por ella. Devuelve la función para dejar de escuchar.
 */
export function onPushOpened(onOpen: (kind: PushKind) => void) {
  const read = (r: Notifications.NotificationResponse | null) => {
    const kind = r?.notification.request.content.data?.type;
    if (r) onOpen(typeof kind === "string" ? kind : "");
  };
  Notifications.getLastNotificationResponseAsync().then(read).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(read);
  return () => sub.remove();
}
