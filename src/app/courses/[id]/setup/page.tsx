"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Settings,
  Layers,
  Network,
  Calculator,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sliders,
  Award,
  MessageSquare,
} from "lucide-react";
import {
  INITIAL_COURSE,
  INITIAL_OFFERING,
  INITIAL_COS,
  INITIAL_POS,
  INITIAL_MAPPINGS,
  INITIAL_SCHEMES,
  INITIAL_ASSESSMENTS,
} from "@/lib/data/initialData";
import { CourseOutcome, AssessmentComponent } from "@/types/database";

export default function CourseSetupPage() {
  const params = useParams();
  const offeringId = (params?.id as string) || INITIAL_OFFERING.id;

  const [activeTab, setActiveTab] = useState<"scheme" | "cos" | "mappings" | "assessments" | "indirect">("cos");

  // State
  const [courseInfo, setCourseInfo] = useState({
    code: INITIAL_COURSE.course_code,
    name: INITIAL_COURSE.course_name,
    semester: INITIAL_COURSE.semester,
    yearOfStudy: INITIAL_COURSE.year_of_study,
    section: INITIAL_OFFERING.section,
    schemeId: INITIAL_SCHEMES[0].id,
    threshold: 45,
    level3: 55,
    level2: 45,
    directWeight: 80,
    indirectWeight: 20,
    iamWeight: 40,
    esamWeight: 60,
  });

  const [cos, setCos] = useState<CourseOutcome[]>(JSON.parse(JSON.stringify(INITIAL_COS)));
  const [mappings, setMappings] = useState<Record<string, Record<string, number | null>>>(
    JSON.parse(JSON.stringify(INITIAL_MAPPINGS))
  );
  const [assessments, setAssessments] = useState<AssessmentComponent[]>(
    JSON.parse(JSON.stringify(INITIAL_ASSESSMENTS))
  );
  const [indirectRatings, setIndirectRatings] = useState<Array<{
    co_code: string;
    survey_score: number;
    normalized_level: number;
    sample_size: number;
    question_prompt?: string;
  }>>([]);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved setup on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`outcomeX_setup_${offeringId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.courseInfo) setCourseInfo(parsed.courseInfo);
        if (parsed.cos && Array.isArray(parsed.cos) && parsed.cos.length > 0) setCos(parsed.cos);
        if (parsed.mappings) setMappings(parsed.mappings);
        if (parsed.assessments && Array.isArray(parsed.assessments) && parsed.assessments.length > 0) {
          setAssessments(parsed.assessments);
        }
      }
    } catch {}

    // Fetch from API to ensure cross-device consistency
    if (offeringId) {
      fetch(`/api/v1/offerings/${offeringId}/outcomes`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.outcomes && Array.isArray(data.outcomes) && data.outcomes.length > 0) {
            setCos(data.outcomes);
          }
        })
        .catch(() => {});

      fetch(`/api/v1/offerings/${offeringId}/mappings`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.mappings && typeof data.mappings === "object" && Object.keys(data.mappings).length > 0) {
            setMappings(data.mappings);
          }
        })
        .catch(() => {});

      fetch(`/api/v1/offerings/${offeringId}/assessments`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.components && Array.isArray(data.components) && data.components.length > 0) {
            setAssessments(data.components);
          }
        })
        .catch(() => {});
    }
  }, [offeringId]);

  // Auto-clear notification after 4s
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Handle CO management
  const handleAddCO = () => {
    const nextIdx = cos.length + 1;
    const newCO: CourseOutcome = {
      id: `co-new-${Date.now()}`,
      course_id: INITIAL_COURSE.id,
      co_code: `CO${nextIdx}`,
      description: `New course outcome ${nextIdx}`,
      sort_order: nextIdx,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCos([...cos, newCO]);

    // Initialize mapping row for new CO
    setMappings({
      ...mappings,
      [`CO${nextIdx}`]: {},
    });
  };

  const handleRemoveCO = (index: number) => {
    if (cos.length <= 1) {
      setStatusMessage({ type: "error", text: "A course must have at least one Course Outcome." });
      return;
    }
    const removedCode = cos[index].co_code;
    const updated = cos.filter((_, idx) => idx !== index);
    setCos(updated);

    const updatedMappings = { ...mappings };
    delete updatedMappings[removedCode];
    setMappings(updatedMappings);
  };

  const handleCOChange = (index: number, field: "co_code" | "description", value: string) => {
    const updated = [...cos];
    updated[index] = { ...updated[index], [field]: value };
    setCos(updated);
  };

  // Save COs via API
  const handleSaveCOs = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomes: cos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save outcomes");
      try {
        localStorage.setItem(
          `outcomeX_setup_${offeringId}`,
          JSON.stringify({ courseInfo, cos, mappings, assessments })
        );
      } catch {}
      setStatusMessage({ type: "success", text: `Successfully saved ${data.count} Course Outcomes!` });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Mapping Strength change
  const handleMappingChange = (coCode: string, poCode: string, value: string) => {
    const strength = value === "" ? null : Number(value);
    setMappings((prev) => ({
      ...prev,
      [coCode]: {
        ...(prev[coCode] || {}),
        [poCode]: strength,
      },
    }));
  };

  // Save Mappings via API
  const handleSaveMappings = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save mappings");
      try {
        localStorage.setItem(
          `outcomeX_setup_${offeringId}`,
          JSON.stringify({ courseInfo, cos, mappings, assessments })
        );
      } catch {}
      setStatusMessage({ type: "success", text: "CO-PO mapping matrix updated successfully!" });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Assessment Component management
  const handleAddAssessment = () => {
    const nextIdx = assessments.length + 1;
    const newComp: AssessmentComponent = {
      id: `ac-new-${Date.now()}`,
      course_offering_id: offeringId,
      category: "MID_TERM_1",
      component_name: `Component ${nextIdx}`,
      max_marks: 10,
      sort_order: nextIdx,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAssessments([...assessments, newComp]);
  };

  const handleRemoveAssessment = (index: number) => {
    setAssessments(assessments.filter((_, idx) => idx !== index));
  };

  const handleAssessmentChange = (index: number, field: keyof AssessmentComponent, value: any) => {
    const updated = [...assessments];
    updated[index] = { ...updated[index], [field]: value };
    setAssessments(updated);
  };

  // Save Assessments via API
  const handleSaveAssessments = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ components: assessments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save assessment components");
      try {
        localStorage.setItem(
          `outcomeX_setup_${offeringId}`,
          JSON.stringify({ courseInfo, cos, mappings, assessments })
        );
      } catch {}
      setStatusMessage({ type: "success", text: `Successfully saved ${data.count} Assessment Components!` });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Load indirect survey ratings on mount
  useEffect(() => {
    fetch(`/api/v1/offerings/${offeringId}/indirect`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ratings && Array.isArray(data.ratings)) {
          setIndirectRatings(data.ratings);
        }
      })
      .catch(() => {});
  }, [offeringId]);

  // Save Indirect Exit Survey ratings
  const handleSaveIndirect = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/offerings/${offeringId}/indirect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: indirectRatings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save exit survey ratings");
      setStatusMessage({ type: "success", text: "Successfully saved Course Exit Survey ratings!" });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      <Navbar departmentCode="CSE" userRole="Teacher / Course Coordinator" />

      <div className="flex">
        <Sidebar currentPath="/courses" />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl">
          {/* Breadcrumb & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Courses Catalog
              </Link>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Course Offering Setup Wizard
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Configure {courseInfo.code} • {courseInfo.name} ({courseInfo.section})
              </p>
            </div>

            {/* Notification message */}
            {statusMessage && (
              <div
                className={`rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                  statusMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Setup Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
            {[
              { id: "cos", label: `Course Outcomes (${cos.length})`, icon: Layers },
              { id: "mappings", label: "CO-PO Mapping Matrix", icon: Network },
              { id: "assessments", label: `Assessments (${assessments.length})`, icon: Calculator },
              { id: "indirect", label: "Exit Survey (Indirect)", icon: MessageSquare },
              { id: "scheme", label: "Attainment Scheme & Weights", icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? "border-sky-600 text-sky-600 dark:text-sky-400"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: COURSE OUTCOMES (DYNAMIC CO CONFIGURATION) */}
          {activeTab === "cos" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Course Outcomes Definition
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Define the Course Outcomes for this offering. You can configure any number of COs (e.g. 4 for 30/20 or 6 for 60/40).
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAddCO}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Outcome (CO{cos.length + 1})
                    </button>

                    <button
                      onClick={handleSaveCOs}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? "Saving..." : "Save Outcomes"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {cos.map((co, idx) => (
                    <div
                      key={co.id || idx}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 transition-all"
                    >
                      <div className="w-24 shrink-0">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                          Code
                        </label>
                        <input
                          type="text"
                          value={co.co_code}
                          onChange={(e) => handleCOChange(idx, "co_code", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                          Outcome Description (Syllabus Statement)
                        </label>
                        <input
                          type="text"
                          value={co.description || ""}
                          placeholder="e.g. Apply classification, clustering and unsupervised learning..."
                          onChange={(e) => handleCOChange(idx, "description", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div className="pt-6">
                        <button
                          onClick={() => handleRemoveCO(idx)}
                          title="Delete CO"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CO-TO-PO/PSO MAPPINGS */}
          {activeTab === "mappings" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      CO-to-PO and CO-to-PSO Mapping Matrix
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Assign mapping strength: <strong>1</strong> (Slight/Low), <strong>2</strong> (Moderate/Medium), <strong>3</strong> (Substantial/High), or leave blank for unmapped.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveMappings}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? "Saving..." : "Save Mapping Matrix"}
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-center text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                        <th className="py-3 px-3 text-left w-20">Course Outcome</th>
                        {INITIAL_POS.map((po) => (
                          <th key={po.po_code} className="py-3 px-2 min-w-[52px]">
                            {po.po_code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {cos.map((co) => (
                        <tr key={co.co_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-bold text-left text-slate-900 dark:text-white bg-slate-50/30 dark:bg-slate-800/20">
                            {co.co_code}
                          </td>
                          {INITIAL_POS.map((po) => {
                            const val = mappings[co.co_code]?.[po.po_code] ?? "";
                            return (
                              <td key={po.po_code} className="py-1 px-1">
                                <select
                                  value={val === null ? "" : String(val)}
                                  onChange={(e) => handleMappingChange(co.co_code, po.po_code, e.target.value)}
                                  className={`w-full rounded-md py-1.5 text-center text-xs font-bold transition-all ${
                                    val === 3
                                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300"
                                      : val === 2
                                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200"
                                      : val === 1
                                      ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200"
                                      : "bg-transparent text-slate-400 border-transparent hover:border-slate-200"
                                  }`}
                                >
                                  <option value="">-</option>
                                  <option value="1">1</option>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Average Mapping Row */}
                      <tr className="bg-slate-100/60 dark:bg-slate-800/60 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="py-2.5 px-3 text-left text-slate-800 dark:text-slate-200">
                          Average Target
                        </td>
                        {INITIAL_POS.map((po) => {
                          const nonZeros: number[] = [];
                          cos.forEach((co) => {
                            const v = mappings[co.co_code]?.[po.po_code];
                            if (v && v > 0) nonZeros.push(v);
                          });
                          const avg = nonZeros.length ? (nonZeros.reduce((a, b) => a + b, 0) / nonZeros.length).toFixed(2) : "-";
                          return (
                            <td key={po.po_code} className="py-2 px-1 text-slate-700 dark:text-slate-300 font-extrabold">
                              {avg}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ASSESSMENTS CONFIG */}
          {activeTab === "assessments" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Assessment Components & Max Marks
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configure Mid Term-I, Mid Term-II, Teacher Assessment, and End Semester Exam questions and maximum marks.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAddAssessment}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Component
                    </button>

                    <button
                      onClick={handleSaveAssessments}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? "Saving..." : "Save Assessments"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-bold">
                        <th className="py-3 px-3">Component Name</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Max Marks</th>
                        <th className="py-3 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {assessments.map((comp, idx) => (
                        <tr key={comp.id || idx}>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={comp.component_name}
                              onChange={(e) => handleAssessmentChange(idx, "component_name", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-medium text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={comp.category}
                              onChange={(e) => handleAssessmentChange(idx, "category", e.target.value)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-white"
                            >
                              <option value="MID_TERM_1">Mid Term-I</option>
                              <option value="MID_TERM_2">Mid Term-II</option>
                              <option value="TEACHER_ASSESSMENT">Teacher Assessment</option>
                              <option value="END_SEM">End Semester Exam</option>
                              <option value="ASSIGNMENT">Assignment</option>
                              <option value="LAB">Laboratory</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 w-32">
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              value={comp.max_marks}
                              onChange={(e) => handleAssessmentChange(idx, "max_marks", Number(e.target.value))}
                              className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => handleRemoveAssessment(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCHEME & WEIGHTS */}
          {activeTab === "scheme" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Attainment Calculation Scheme & Parameters
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configurable approved rules according to PCE Autonomous regulations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Scheme Selection */}
                  <div className="space-y-4">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Approved Template Scheme
                    </label>
                    <div className="space-y-2">
                      {INITIAL_SCHEMES.map((scheme) => (
                        <div
                          key={scheme.id}
                          onClick={() => {
                            const updated = { ...courseInfo, schemeId: scheme.id };
                            setCourseInfo(updated);
                            try {
                              localStorage.setItem(
                                `outcomeX_setup_${offeringId}`,
                                JSON.stringify({ courseInfo: updated, cos, mappings, assessments })
                              );
                            } catch {}
                            setStatusMessage({ type: "success", text: `Active scheme set to ${scheme.scheme_name}` });
                          }}
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            courseInfo.schemeId === scheme.id
                              ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/40"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {scheme.scheme_name}
                            </span>
                            <span className="rounded bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-300">
                              v{scheme.version}.0
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {scheme.iam_weight * 100}% Internal (IAM) + {scheme.esam_weight * 100}% Endsem (ESAM)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weights and Rubrics */}
                  <div className="space-y-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Approved Rubrics & Thresholds
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300">Student Threshold Value</span>
                        <span className="font-bold text-slate-900 dark:text-white">45% of max marks</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300">Level 3 (High Attainment)</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">≥ 55% students</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300">Level 2 (Moderate Attainment)</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">45% to 54% students</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300">Level 1 (Low Attainment)</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">&lt; 45% students</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-600 dark:text-slate-300">Direct vs Indirect Weighting</span>
                        <span className="font-bold text-slate-900 dark:text-white">80% Direct + 20% Indirect</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EXIT SURVEY (INDIRECT ATTAINMENT) */}
          {activeTab === "indirect" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Course Exit Survey & Indirect Attainment
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configure survey questions, student response counts, and attainment rubric levels (0.0 to 3.0) contributing 20% to final CO attainment.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveIndirect}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? "Saving..." : "Save Exit Survey Ratings"}
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cos.map((co) => {
                    const currentRating = indirectRatings.find((r) => r.co_code === co.co_code) || {
                      co_code: co.co_code,
                      survey_score: 4.5,
                      normalized_level: 3.0,
                      sample_size: 78,
                      question_prompt: `Rate your proficiency in applying concepts from ${co.description || co.co_code}`,
                    };

                    const updateRating = (field: string, value: any) => {
                      setIndirectRatings((prev) => {
                        const exists = prev.some((r) => r.co_code === co.co_code);
                        if (!exists) {
                          return [...prev, { ...currentRating, [field]: value }];
                        }
                        return prev.map((r) => (r.co_code === co.co_code ? { ...r, [field]: value } : r));
                      });
                    };

                    return (
                      <div key={co.id || co.co_code} className="py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-sky-600 dark:text-sky-400">
                              {co.co_code}
                            </span>
                            <span className="text-xs text-slate-500 truncate max-w-md">
                              {co.description || "Course outcome statement"}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Level: {currentRating.normalized_level} / 3.0
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Exit Survey Question Prompt
                            </label>
                            <input
                              type="text"
                              value={currentRating.question_prompt || ""}
                              onChange={(e) => updateRating("question_prompt", e.target.value)}
                              placeholder={`Survey question prompt for ${co.co_code}`}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Sample Size
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={200}
                                value={currentRating.sample_size}
                                onChange={(e) => updateRating("sample_size", Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Attainment Level (0-3)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={3}
                                step={0.1}
                                value={currentRating.normalized_level}
                                onChange={(e) => updateRating("normalized_level", Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white font-bold text-sky-600"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
