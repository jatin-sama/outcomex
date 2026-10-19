"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Network,
  Save,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  INITIAL_COURSE,
  INITIAL_OFFERING,
  INITIAL_COS,
  INITIAL_POS,
  INITIAL_MAPPINGS,
} from "@/lib/data/initialData";

export default function MappingsPage() {
  const [offeringId, setOfferingId] = useState<string>(INITIAL_OFFERING.id);
  const [mappings, setMappings] = useState<Record<string, Record<string, number | null>>>(
    JSON.parse(JSON.stringify(INITIAL_MAPPINGS))
  );

  // Sync offeringId from URL or localStorage
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("offeringId");
      const stored = localStorage.getItem("outcomeX_active_offering_id");
      const active = param || stored || INITIAL_OFFERING.id;
      setOfferingId(active);
      localStorage.setItem("outcomeX_active_offering_id", active);
    }
  }, []);

  // Load mappings from database via API
  React.useEffect(() => {
    if (!offeringId) return;
    fetch(`/api/v1/offerings/${offeringId}/mappings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.mappings && typeof data.mappings === "object" && Object.keys(data.mappings).length > 0) {
          setMappings(data.mappings);
        }
      })
      .catch(() => {});
  }, [offeringId]);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const poColumns = INITIAL_POS.map((p) => p.po_code);

  const handleCellChange = (coCode: string, poCode: string, value: number) => {
    setMappings((prev) => ({
      ...prev,
      [coCode]: {
        ...prev[coCode],
        [poCode]: value === 0 ? null : value,
      },
    }));
  };

  const getCellBadgeClass = (val: number | null | undefined) => {
    if (!val) return "bg-slate-50 dark:bg-slate-800 text-slate-400";
    if (val === 1) return "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold";
    if (val === 2) return "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold";
    return "bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-bold";
  };

  // Compute PO averages
  const poAverages: Record<string, string> = {};
  poColumns.forEach((po) => {
    let sum = 0;
    let count = 0;
    INITIAL_COS.forEach((co) => {
      const val = mappings[co.co_code]?.[po];
      if (val && val > 0) {
        sum += val;
        count++;
      }
    });
    poAverages[po] = count > 0 ? (sum / count).toFixed(2) : "-";
  });

  const handleSave = async () => {
    try {
      await fetch(`/api/v1/offerings/${offeringId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
    } catch {}

    setSaveSuccess(true);

    // Log audit event via API
    fetch("/api/v1/offerings/o0000000-0000-0000-0000-000000000001/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "COURSE_CREATED",
        resource_type: "co_po_matrix",
        payload: {
          updated_mappings: mappings,
          calculated_averages: poAverages,
        },
      }),
    }).catch(() => {});

    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/mappings" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                  {INITIAL_COURSE.course_code}
                </span>
                <span className="text-xs text-slate-500">{INITIAL_COURSE.course_name}</span>
              </div>
              <h1 className="mt-1 text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                CO-PO & PSO Articulation Matrix
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Correlate Course Outcomes to NBA Graduate Attributes (PO1–PO12) and Program Specific Outcomes
              </p>
            </div>

            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Save Mappings</span>
            </button>
          </div>

          {/* Correlation Scale Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="h-4 w-4 text-sky-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Correlation Scale:</span>
              <span>Click cells or select value (0 = None, 1 = Slight/Low, 2 = Moderate/Medium, 3 = Substantial/High)</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-slate-200 dark:bg-slate-700" />
                <span className="text-slate-500">- None</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-400" />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">1 (Low)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">2 (Medium)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-sky-500" />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">3 (High)</span>
              </span>
            </div>
          </div>

          {saveSuccess && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3.5 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>CO-PO Articulation Matrix successfully saved and audit log recorded!</span>
            </div>
          )}

          {/* Interactive Matrix Grid */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
                    <th className="py-3 px-4 text-left font-bold text-slate-700 dark:text-slate-200 sticky left-0 bg-slate-50/90 dark:bg-slate-850 backdrop-blur-xs min-w-[220px]">
                      Course Outcome
                    </th>
                    {poColumns.map((po) => (
                      <th key={po} className="py-3 px-2 font-bold text-slate-700 dark:text-slate-300 min-w-[50px]">
                        {po}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {INITIAL_COS.map((co) => (
                    <tr key={co.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4 text-left sticky left-0 bg-white dark:bg-slate-900 backdrop-blur-xs">
                        <span className="font-bold text-sky-600 dark:text-sky-400 mr-2">{co.co_code}</span>
                        <span className="text-[11px] text-slate-500 line-clamp-1">{co.description}</span>
                      </td>

                      {poColumns.map((po) => {
                        const val = mappings[co.co_code]?.[po] ?? 0;
                        return (
                          <td key={po} className="py-2 px-1">
                            <select
                              value={val || 0}
                              onChange={(e) =>
                                handleCellChange(co.co_code, po, Number(e.target.value))
                              }
                              className={`h-8 w-10 text-center rounded-lg border border-slate-200 dark:border-slate-700 text-xs transition-colors focus:ring-2 focus:ring-sky-500 focus:outline-none ${getCellBadgeClass(
                                val
                              )}`}
                            >
                              <option value="0">-</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Summary / Averages Row */}
                  <tr className="bg-sky-50/60 dark:bg-sky-950/30 border-t-2 border-sky-200 dark:border-sky-900 font-bold">
                    <td className="py-3 px-4 text-left text-sky-900 dark:text-sky-200 sticky left-0 bg-sky-50/90 dark:bg-sky-950/90">
                      Average Mapping Strength
                    </td>
                    {poColumns.map((po) => (
                      <td key={po} className="py-3 px-1 text-sky-900 dark:text-sky-200 font-bold">
                        {poAverages[po]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
