"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Shield, LogOut, ChevronDown, Hotel } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-3">

          {/* Brand Logo */}
          <Link href={user?.role === "admin" ? "/admin" : "/"} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#0071c2] flex items-center justify-center shadow-sm group-hover:bg-[#005ea6] transition-colors duration-200">
              <Hotel className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold tracking-tight text-slate-800">
                  Luxe<span className="text-[#0071c2]">Stay</span>
                </span>
                {user?.role === "admin" && (
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Agency Portal
                  </span>
                )}
              </div>
              <span className="block text-[10px] tracking-widest uppercase text-slate-400 font-medium">
                {user?.role === "admin" ? "Property Operations & Management" : "Resort & Villas"}
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
            {user?.role === "admin" ? (
              <>
                <Link
                  href="/admin"
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071c2] text-white transition-all font-bold shadow-sm"
                >
                  <Shield className="w-4 h-4" />
                  <span>Agency Dashboard</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/" className="hover:text-[#0071c2] transition-colors">
                  Home
                </Link>
                <Link href="/rooms" className="hover:text-[#0071c2] transition-colors">
                  Rooms & Suites
                </Link>
                {user && (
                  <Link href="/bookings" className="hover:text-[#0071c2] transition-colors font-semibold">
                    My Reservations
                  </Link>
                )}
                <Link href="/amenities" className="hover:text-[#0071c2] transition-colors">
                  Amenities
                </Link>
              </>
            )}
          </nav>

          {/* Auth Button / Avatar Dropdown */}
          <div className="flex items-center space-x-4">
            {!user ? (
              <Link
                href="/login"
                className="px-6 py-2.5 rounded-full bg-[#0071c2] hover:bg-[#005ea6] text-white font-semibold shadow-sm transition-colors duration-200"
              >
                Login / Signup
              </Link>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2.5 p-1 px-3 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0071c2]/10 border border-[#0071c2]/20 flex items-center justify-center font-bold text-[#0071c2] text-sm">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="text-left hidden sm:block">
                    <span className="block text-xs font-semibold text-slate-700 leading-tight">
                      {user.name}
                    </span>
                    <span className="block text-[10px] uppercase font-bold text-[#0071c2]">
                      {user.role}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div
                    onClick={() => setDropdownOpen(false)}
                    className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 text-sm text-slate-600 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-blue-50 text-[#0071c2] border border-blue-100">
                        Role: {user.role}
                      </span>
                    </div>

                    {user.role === "admin" && (
                      <div className="py-1">
                        <Link
                          href="/admin"
                          className="flex items-center px-4 py-2 text-[#0071c2] hover:bg-slate-50 transition-colors font-semibold"
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Admin Dashboard
                        </Link>
                      </div>
                    )}

                    {user.role !== "admin" && (
                      <div className="py-1">
                        <Link
                          href="/bookings"
                          className="flex items-center px-4 py-2 hover:bg-slate-50 transition-colors font-semibold text-slate-700"
                        >
                          <ChevronDown className="w-4 h-4 mr-2 text-slate-500" />
                          My Reservations
                        </Link>
                      </div>
                    )}

                    <div className="py-1">
                      <button
                        onClick={logout}
                        className="w-full flex items-center px-4 py-2 text-rose-500 hover:bg-slate-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
