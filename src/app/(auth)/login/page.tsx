"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Database,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [department, setDepartment] = useState("CSE");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [academicRole, setAcademicRole] = useState<"teacher" | "hod">("teacher");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already authenticated with Supabase, redirect to dashboard
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user) {
          router.replace("/");
        }
      });
    } catch {}
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = createClient();

    try {
      if (authMode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMessage(error.message);
        } else if (data?.user) {
          const roleLabel =
            (data.user.user_metadata?.role as string) ||
            (academicRole === "hod" ? "Department Admin / HOD" : "Teacher / Course Coordinator");

          if (typeof window !== "undefined") {
            localStorage.setItem("outcomeX_user", data.user.email || email.trim());
            localStorage.setItem("outcomeX_role", roleLabel);
          }

          setSuccessMessage("Authentication verified. Entering OutcomeX...");
          setTimeout(() => {
            router.push("/");
          }, 400);
        }
      } else {
        // Sign up flow
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              department,
              role: academicRole === "hod" ? "Department Admin / HOD" : "Teacher / Course Coordinator",
            },
          },
        });

        if (error) {
          setErrorMessage(error.message);
        } else if (data?.user) {
          if (data.session) {
            setSuccessMessage("Account created successfully! Logging you in...");
            setTimeout(() => {
              router.push("/");
            }, 500);
          } else {
            setSuccessMessage(
              "Account registered. Please verify your email or sign in with your credentials."
            );
            setAuthMode("signin");
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header with College Emblem / Icon */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-xl shadow-sky-500/25 mb-1">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Outcome<span className="text-sky-600 dark:text-sky-400">X</span> Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Priyadarshini College of Engineering, Nagpur
            <br />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Autonomous CO-PO-PSO Attainment Automation System
            </span>
          </p>
        </div>

        {/* Authentication Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Sign In vs Register Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-all ${
                authMode === "signin"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Faculty Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-all ${
                authMode === "signup"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Register Faculty Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* If Sign Up, collect Full Name and Academic Role */}
            {authMode === "signup" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Faculty Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Prof. / Dr. Full Name"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Academic Designation
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAcademicRole("teacher")}
                      className={`rounded-xl py-2 px-3 text-xs font-semibold border ${
                        academicRole === "teacher"
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Teacher / Coordinator
                    </button>
                    <button
                      type="button"
                      onClick={() => setAcademicRole("hod")}
                      className={`rounded-xl py-2 px-3 text-xs font-semibold border ${
                        academicRole === "hod"
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      HOD / Dept Admin
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Department */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Engineering Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="CSE">Computer Science & Engineering (CSE)</option>
                <option value="AIDS">Artificial Intelligence & Data Science (AIDS)</option>
                <option value="IT">Information Technology (IT)</option>
                <option value="ETC">Electronics & Telecommunication (ETC)</option>
                <option value="MECH">Mechanical Engineering (MECH)</option>
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Institutional Email ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name.dept@pce.edu.in"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3.5 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3.5 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/25 transition-all disabled:opacity-60 cursor-pointer"
            >
              <span>{loading ? "Authenticating..." : authMode === "signin" ? "Sign In to Department Portal" : "Register Faculty Account"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Security & Access Policy Notice */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Row Level Security (RLS) & Department Boundaries Enforced</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
