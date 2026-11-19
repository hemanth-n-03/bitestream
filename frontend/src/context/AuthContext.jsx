import { createContext, useContext, useEffect, useState } from 'react';
import {
  getMeApi,
  loginApi,
  registerApi,
  updateUserProfileApi,
} from '../api/authApi';

const AuthContext = createContext(null);
const TOKEN_KEY = 'bitestream_auth_token';
const USER_KEY = 'bitestream_auth_user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(readStoredToken);
  const [authLoading, setAuthLoading] = useState(Boolean(readStoredToken()));

  const persistSession = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    try {
      if (nextUser && nextToken) {
        localStorage.setItem(TOKEN_KEY, nextToken);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  };

  useEffect(() => {
    const storedToken = readStoredToken();
    if (!storedToken) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    getMeApi()
      .then((freshUser) => {
        if (active) {
          persistSession(freshUser, storedToken);
        }
      })
      .catch(() => {
        if (active) {
          persistSession(null, null);
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async ({ email, password }) => {
    const data = await loginApi({ email, password });
    persistSession(data.user, data.token);
    return data.user;
  };

  const register = async (payload) => {
    const data = await registerApi(payload);
    persistSession(data.user, data.token);
    return data.user;
  };

  const updateProfile = async (updates) => {
    const updatedUser = await updateUserProfileApi(updates);
    persistSession(updatedUser, token);
    return updatedUser;
  };

  const logout = () => persistSession(null, null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authLoading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
