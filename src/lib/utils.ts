import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if a string is a valid RFC 4122 UUID.
 */
export function isValidUuid(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Normalizes assessment component names into canonical UI keys.
 * Handles variations such as:
 * "MT1 Q1 (CO1)" -> "mt1_co1"
 * "ESE CO2" -> "ese_co2"
 * "Teacher Assessment (TA)" -> "ta"
 */
export function normalizeComponentKey(name: string): string {
  const s = String(name || "").toLowerCase().trim();
  if (s.includes("ta") || s.includes("teacher assessment")) return "ta";
  if (s.includes("mt1") && s.includes("co1")) return "mt1_co1";
  if (s.includes("mt1") && s.includes("co2")) return "mt1_co2";
  if (s.includes("mt1") && s.includes("co3")) return "mt1_co3";
  if (s.includes("mt2") && s.includes("co3")) return "mt2_co3";
  if (s.includes("mt2") && s.includes("co4")) return "mt2_co4";
  if (s.includes("mt2") && s.includes("co5")) return "mt2_co5";
  if (s.includes("mt2") && s.includes("co6")) return "mt2_co6";
  if (s.includes("ese") && s.includes("co1")) return "ese_co1";
  if (s.includes("ese") && s.includes("co2")) return "ese_co2";
  if (s.includes("ese") && s.includes("co3")) return "ese_co3";
  if (s.includes("ese") && s.includes("co4")) return "ese_co4";
  if (s.includes("ese") && s.includes("co5")) return "ese_co5";
  if (s.includes("ese") && s.includes("co6")) return "ese_co6";
  return s.replace(/[^a-z0-9_]/g, "_");
}
