import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// 登录态：token 与 user 都存 localStorage，刷新页面不掉登录
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const AuthContext = createContext(null);

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  // 登录/注册成功后统一写入
  const signIn = useCallback((payload) => {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setToken(payload.token);
    setUser(payload.user);
    return payload.user;
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      role: user ? user.role : null,
      isLoggedIn: Boolean(token && user),
      signIn,
      signOut,
    }),
    [user, token, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
