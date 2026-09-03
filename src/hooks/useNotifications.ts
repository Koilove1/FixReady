import { useCallback, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, getMessagingIfSupported, auth } from '../firebase';
import { registerFcmServiceWorker } from '../registerFcmSw';

export type NotificationStatus = 'unsupported' | 'idle' | 'denied' | 'enabled' | 'error';

export function useNotifications() {
  const [status, setStatus] = useState<NotificationStatus>('idle');

  const enable = useCallback(async () => {
    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging || !db) {
        setStatus('unsupported');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const swRegistration = await registerFcmServiceWorker();
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swRegistration ?? undefined,
      });
      if (!token) {
        setStatus('error');
        return;
      }
      const uid = auth?.currentUser?.uid ?? 'anonymous';
      await setDoc(doc(db, 'deviceTokens', token), {
        token,
        uid,
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
      });
      // Foreground messages: FCM's browser SDK doesn't show a system
      // notification while the tab is focused, so surface one manually.
      onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? 'FixReady';
        const body = payload.notification?.body ?? '';
        new Notification(title, { body, icon: '/icon-192.png' });
      });
      setStatus('enabled');
    } catch (err) {
      console.error('Failed to enable notifications', err);
      setStatus('error');
    }
  }, []);

  return { status, enable };
}
