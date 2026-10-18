"use client";

import React, { useState } from "react";
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
  Sparkles,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"teacher" | "hod" | "department_admin">("teacher");
  const [department, setDepartment] = useState("CSE");
  const [email, setEmail] = useState("teacher.cse@pce.edu.in");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message?.includes("API key") || error.message?.includes("apikey")) {
          setErrorMessage(
            "Supabase anon key missing: The NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local is still a placeholder. Please paste your anon key from Supabase Dashboard (Settings ⚙️ → API), or use the 1-Click Fast Access buttons above!"
          );
        } else {
          setErrorMessage(error.message || "Invalid credentials. Please verify your email and password.");
        }
      } else {
        const roleLabel = role === "hod" ? "Department Admin / HOD" : "Teacher / Course Coordinator";
        localStorage.setItem("outcomeX_user", email);
        localStorage.setItem("outcomeX_role", roleLabel);
        setSuccessMessage("Authentication successful! Redirecting to OutcomeX...");
        setTimeout(() => {
          router.push("/");
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (demoRole: "teacher" | "hod") => {
    const demoEmail = demoRole === "teacher" ? "teacher.cse@pce.edu.in" : "hod.cse@pce.edu.in";
    const roleLabel = demoRole === "teacher" ? "Teacher / Course Coordinator" : "Department Admin / HOD";
    localStorage.setItem("outcomeX_user", demoEmail);
    localStorage.setItem("outcomeX_role", roleLabel);
    setSuccessMessage(`Authenticated as ${roleLabel}! Entering workspace...`);
    setTimeout(() => {
      window.location.href = "/";
    }, 500);
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

        {/* Quick Staging / Faculty 1-Click Access Card */}
        <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/40 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              1-Click Fast Access (Faculty & HOD)
            </h3>
          </div>
          <p className="text-xs text-sky-700/90 dark:text-sky-300/80 mb-3">
            Select your assigned faculty profile to enter the OBE calculation workspace:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("teacher")}
              className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors shadow-xs"
            >
              <UserCheck className="h-3.5 w-3.5 text-sky-600" />
              <span>Teacher (CSE)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("hod")}
              className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors shadow-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>HOD / Admin</span>
            </button>
          </div>
        </div>

        {/* Supabase Password Sign In Form */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm space-y-5">
          {/* Role Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Sign In With Password
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "teacher", label: "Teacher / Course Coordinator", email: "teacher.cse@pce.edu.in" },
                { id: "hod", label: "Department Admin / HOD", email: "hod.cse@pce.edu.in" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id as any);
                    setEmail(r.email);
                  }}
                  className={`rounded-xl py-2 px-3 text-xs font-semibold transition-all border text-center ${
                    role === r.id
                      ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {r.id === "teacher" ? "Teacher" : "HOD / Admin"}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Department */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                Faculty Email ID
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
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{errorMessage}</p>
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    Tip: Use the 1-Click Fast Access button above to test the OBE workspace immediately.
                  </p>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-600/25 transition-all disabled:opacity-60"
            >
              <span>{loading ? "Authenticating..." : "Sign In with Password"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Database & Security Notice */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-sky-500" />
              <span>Project: twuvuovkznrksymbobav.supabase.co</span>
            </p>
            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>19 Database Tables with Row Level Security (RLS) Enforced</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
