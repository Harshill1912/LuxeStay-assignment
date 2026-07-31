"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Shield, User, Hotel, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, fullName, role);
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  // Quick One-Click Demo Credentials Filler
  const handleQuickDemo = (demoType) => {
    setIsRegister(false);
    setError(null);
    if (demoType === "admin") {
      setEmail("admin@luxestay.com");
      setPassword("admin123");
    } else {
      setEmail("user@luxestay.com");
      setPassword("user123");
    }
  };

  const inputCls =
    "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0071c2] focus:bg-white transition-colors";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0071c2] mx-auto flex items-center justify-center text-white shadow-sm">
            <Hotel className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isRegister ? "Create account" : "Welcome back"}
          </h2>
          <p className="text-xs text-slate-400">
            {isRegister ? "Join LuxeStay for luxury room bookings" : "Sign in to manage your LuxeStay experience"}
          </p>
        </div>

        {/* Quick Demo Credentials Switcher */}
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
          <span className="block text-[11px] font-bold text-[#0071c2] uppercase tracking-wider text-center">
            ⚡ One-click demo login
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo("user")}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors flex items-center justify-center space-x-1"
            >
              <User className="w-3.5 h-3.5 text-[#0071c2]" />
              <span>Normal user</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("admin")}
              className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0071c2] text-xs font-semibold border border-blue-100 transition-colors flex items-center justify-center space-x-1"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin demo</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@luxestay.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Select role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={inputCls}
              >
                <option value="user">Normal user (Guest)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#0071c2] hover:bg-[#005ea6] text-white font-semibold text-sm shadow-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{loading ? "Processing…" : isRegister ? "Create account" : "Sign in"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-[#0071c2] hover:underline font-semibold"
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Register here"}
          </button>
        </div>

      </div>
    </div>
  );
}
