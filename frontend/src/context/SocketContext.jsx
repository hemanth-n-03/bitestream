import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  fetchNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from '../api/notificationApi';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

function resolveSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
}

export function SocketProvider({ children }) {
  const { token, isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const socketRef = useRef(null);
  const subscribersRef = useRef(new Map()); // eventName -> Set<callback>
  const wasConnectedRef = useRef(false);
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // connected | reconnecting | disconnected
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoadingNotifications(true);
    try {
      const res = await fetchNotificationsApi({ limit: 30 });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Keep UI functional even if notification fetch transiently fails
    } finally {
      setLoadingNotifications(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      wasConnectedRef.current = false;
      setConnectionStatus('disconnected');
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    loadNotifications();

    const socket = io(resolveSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      if (wasConnectedRef.current) {
        setReconnectNonce((n) => n + 1);
        loadNotifications();
      }
      wasConnectedRef.current = true;
    });

    socket.on('disconnect', () => {
      setConnectionStatus('reconnecting');
    });

    socket.io.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('NEW_NOTIFICATION', (payload) => {
      const notif = payload?.notification;
      if (!notif?._id) return;

      setNotifications((prev) => {
        if (prev.some((n) => n._id === notif._id)) {
          return prev;
        }
        return [notif, ...prev].slice(0, 40);
      });

      if (!notif.isRead) {
        setUnreadCount((c) => c + 1);
        toastRef.current?.info(notif.title);
      }
    });

    socket.onAny((eventName, payload) => {
      const handlers = subscribersRef.current.get(eventName);
      if (handlers && handlers.size > 0) {
        handlers.forEach((fn) => {
          try {
            fn(payload, eventName);
          } catch {
            // Protect socket loop against individual UI handler exceptions
          }
        });
      }
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, token, user?._id, loadNotifications]);

  const subscribe = useCallback((eventNames, handler) => {
    const list = Array.isArray(eventNames) ? eventNames : [eventNames];
    list.forEach((evt) => {
      if (!subscribersRef.current.has(evt)) {
        subscribersRef.current.set(evt, new Set());
      }
      subscribersRef.current.get(evt).add(handler);
    });

    return () => {
      list.forEach((evt) => {
        const set = subscribersRef.current.get(evt);
        if (set) {
          set.delete(handler);
          if (set.size === 0) {
            subscribersRef.current.delete(evt);
          }
        }
      });
    };
  }, []);

  const emitLocationUpdate = useCallback((coordinates, ack) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit('delivery:location_update', { coordinates }, ack);
    return true;
  }, []);

  const markRead = useCallback(async (notificationId) => {
    try {
      const res = await markNotificationReadApi(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      if (typeof res?.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // Ignore transient failures cleanly
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore transient failures cleanly
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connectionStatus,
        isConnected: connectionStatus === 'connected',
        reconnectNonce,
        notifications,
        unreadCount,
        loadingNotifications,
        loadNotifications,
        markRead,
        markAllRead,
        subscribe,
        emitLocationUpdate,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return ctx;
}
