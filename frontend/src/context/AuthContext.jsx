import { createContext, useContext, useEffect, useState } from "react";
import { requestJson } from "../api/client";

const AuthContext = createContext(null);

const STORAGE_KEY = "diet_planner_auth";

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStoredAuth);

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  async function login(username, password) {
    const data = await requestJson("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setAuth(data);
    return data;
  }

  function logout() {
    setAuth(null);
  }

  const value = {
    token: auth?.access_token || null,
    role: auth?.role || null,
    username: auth?.username || null,
    displayName: auth?.display_name || null,
    isAuthenticated: Boolean(auth?.access_token),
    isAdmin: auth?.role === "admin",
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
