"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ShieldCheck,
  User,
  LogOut,
  LogIn,
  ChevronDown,
  Settings,
  History,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  userEmail?: string;
  userRole?: string;
  departmentCode?: string;
}

export function Navbar({
  userEmail: initialEmail,
  userRole: initialRole = "Teacher",
  departmentCode = "CSE",
}: NavbarProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string | null>(initialEmail || null);
  const [currentRole, setCurrentRole] = useState<string>(initialRole);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"supabase" | "local">("supabase");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check saved session in localStorage first
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("outcomeX_user");
      const savedRole = localStorage.getItem("outcomeX_role");
      if (savedUser) {
        setCurrentUser(savedUser);
      }
      if (savedRole) {
        setCurrentRole(savedRole);
      }
    }

    // Attempt to check active Supabase Auth session
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data, error }) => {
        if (!error && data?.user?.email) {
          setCurrentUser(data.user.email);
          const role = (data.user.user_metadata?.role as string) || "Teacher";
          setCurrentRole(role);
          setAuthMode("supabase");
          localStorage.setItem("outcomeX_user", data.user.email);
          localStorage.setItem("outcomeX_role", role);
        }
      }).catch(() => {
        // Fallback to local session gracefully if Supabase keys not initialized
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session?.user?.email) {
            setCurrentUser(session.user.email);
            const role = (session.user.user_metadata?.role as string) || "Teacher";
            setCurrentRole(role);
            setAuthMode("supabase");
            localStorage.setItem("outcomeX_user", session.user.email);
            localStorage.setItem("outcomeX_role", role);
          } else {
            // No active session
          }
        }
      );

      return () => {
        authListener?.subscription.unsubscribe();
      };
    } catch {
      // Graceful local handling
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    localStorage.removeItem("outcomeX_user");
    localStorage.removeItem("outcomeX_role");
    setCurrentUser(null);
    setIsDropdownOpen(false);
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Institution */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900 dark:text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span>
              Outcome<span className="text-sky-600 dark:text-sky-400">X</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">PCE Nagpur</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 rounded bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 font-medium text-sky-700 dark:text-sky-300">
              Autonomous
            </span>
          </div>
        </div>

        {/* User Context & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Department badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Dept:</span>
            <span className="font-bold text-slate-900 dark:text-white">{departmentCode}</span>
          </div>

          {currentUser ? (
            /* Authenticated User Menu */
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
              >
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 font-bold text-xs">
                  {currentUser.charAt(0).toUpperCase()}
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {currentUser}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {currentRole}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl shadow-slate-900/10 z-50">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Signed In As
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {currentUser}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {authMode === "supabase" ? "Supabase Live Auth" : "Authenticated Session"}
                      </span>
                      <span className="text-[10px] text-slate-400">PCE Nagpur</span>
                    </div>
                  </div>

                  {/* Quick navigation links */}
                  <div className="p-1 border-b border-slate-100 dark:border-slate-800">
                    <Link
                      href="/admin"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      <span>Department Admin Portal</span>
                    </Link>
                    <Link
                      href="/history"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <History className="h-3.5 w-3.5 text-slate-400" />
                      <span>OBE Audit Log & History</span>
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out from OutcomeX</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Unauthenticated state */
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs text-slate-500">Not signed in</span>
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
