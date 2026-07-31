"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { loginUser, registerUser, apiFetch } from "@/lib/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("luxestay_token");
    const storedUser = localStorage.getItem("luxestay_user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user session", e);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    const userInfo = {
      email: data.email,
      name: data.user_name,
      role: data.role,
    };
    setToken(data.access_token);
    setUser(userInfo);
    localStorage.setItem("luxestay_token", data.access_token);
    localStorage.setItem("luxestay_user", JSON.stringify(userInfo));
    return userInfo;
  };

  const register = async (email, password, full_name, role = "user") => {
    const data = await registerUser(email, password, full_name, role);
    const userInfo = {
      email: data.email,
      name: data.user_name,
      role: data.role,
    };
    setToken(data.access_token);
    setUser(userInfo);
    localStorage.setItem("luxestay_token", data.access_token);
    localStorage.setItem("luxestay_user", JSON.stringify(userInfo));
    return userInfo;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("luxestay_token");
    localStorage.removeItem("luxestay_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
