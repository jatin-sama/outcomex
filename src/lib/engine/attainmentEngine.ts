/**
 * OutcomeX — Deterministic OBE Attainment Calculation Engine
 * Pure TypeScript implementation independent of frontend and Excel exporters.
 * Implements approved PCE Autonomous college rules with full audit explanation trails.
 */

export interface SchemeConfig {
  threshold_percent: number; // e.g. 45.0
  level_3_threshold: number; // e.g. 55.0
  level_2_threshold: number; // e.g. 45.0
  iam_weight: number; // e.g. 0.40
  esam_weight: number; // e.g. 0.60
  direct_weight: number; // e.g. 0.80
  indirect_weight: number; // e.g. 0.20
  po_aggregation_method: "WEIGHTED_AVERAGE" | "MAPPING_AVERAGE";
}

export interface StudentInput {
  student_id: string;
  roll_no: string;
  student_name: string;
  marks: Record<string, number | string | null | undefined>;
}

export interface ComponentConfig {
  key: string;
  label: string;
  category: "MID_TERM_1" | "MID_TERM_2" | "TEACHER_ASSESSMENT" | "END_SEM" | "ASSIGNMENT" | "LAB";
  max_marks: number;
  co_code?: string; // which CO this question assesses (e.g. 'CO1')
}

export interface CalculationExplanation {
  formula: string;
  inputs: Record<string, any>;
  steps: string[];
  result: number | string | null;
}

export interface ComponentAttainmentResult {
  key: string;
  label: string;
  category: string;
  max_marks: number;
  threshold_mark: number;
  total_eligible: number;
  attained_count: number;
  attainment_percent: number;
  attainment_level: number;
  explanation: CalculationExplanation;
}

export interface StudentCOResult {
  student_id: string;
  roll_no: string;
  student_name: string;
  co_percentages: Record<string, number>;
  co_attained: Record<string, boolean>; // scored >= threshold_percent overall
}

export interface COAttainmentResult {
  co_code: string;
  total_students: number;
  attained_students: number;
  class_percentage: number;
  direct_level: number;
  indirect_level: number;
  final_attainment: number;
  attainment_level: number;
  explanation: CalculationExplanation;
}

export interface POAttainmentResult {
  po_code: string;
  po_type: "PO" | "PSO";
  mapped_cos_count: number;
  average_mapping_strength: number | null;
  achieved_attainment: number | null;
  is_mapped: boolean;
  explanation: CalculationExplanation;
}

export interface EngineCalculationOutput {
  scheme: SchemeConfig;
  total_students_enrolled: number;
  student_results: StudentCOResult[];
  component_results: ComponentAttainmentResult[];
  co_results: COAttainmentResult[];
  po_results: POAttainmentResult[];
  summary: {
    all_cos_level_3: boolean;
    average_final_co_attainment: number;
    highest_attained_co: string;
    lowest_attained_co: string;
  };
}

export class AttainmentEngine {
  private scheme: SchemeConfig;

  constructor(scheme?: Partial<SchemeConfig>) {
    this.scheme = {
      threshold_percent: scheme?.threshold_percent ?? 45.0,
      level_3_threshold: scheme?.level_3_threshold ?? 55.0,
      level_2_threshold: scheme?.level_2_threshold ?? 45.0,
      iam_weight: scheme?.iam_weight ?? 0.4,
      esam_weight: scheme?.esam_weight ?? 0.6,
      direct_weight: scheme?.direct_weight ?? 0.8,
      indirect_weight: scheme?.indirect_weight ?? 0.2,
      po_aggregation_method: scheme?.po_aggregation_method ?? "WEIGHTED_AVERAGE",
    };
  }

  /**
   * Assign attainment level based on class percentage.
   * Boundary rules:
   * Level 3: percent >= level_3_threshold (e.g. 55.0)
   * Level 2: percent >= level_2_threshold (e.g. 45.0) and < level_3_threshold
   * Level 1: percent < level_2_threshold
   */
  public evaluateAttainmentLevel(percentage: number): number {
    if (isNaN(percentage) || percentage < 0) return 1;
    if (percentage >= this.scheme.level_3_threshold) return 3;
    if (percentage >= this.scheme.level_2_threshold) return 2;
    return 1;
  }

  /**
   * Execute complete attainment calculation workflow
   */
  public calculate(
    students: StudentInput[],
    components: ComponentConfig[],
    coCodes: string[],
    poList: Array<{ po_code: string; po_type: "PO" | "PSO" }>,
    mappings: Record<string, Record<string, number | null>>,
    indirectAttainmentMap?: Record<string, number>
  ): EngineCalculationOutput {
    const totalEnrolled = students.length;

    // 1. Calculate Component-Level Attainments
    const componentResults: ComponentAttainmentResult[] = components.map((comp) => {
      const thresholdMark = (comp.max_marks * this.scheme.threshold_percent) / 100.0;
      let attainedCount = 0;
      let eligibleCount = 0;

      students.forEach((s) => {
        const val = s.marks[comp.key];
        eligibleCount++; // All enrolled students in roster are counted per college practice
        if (typeof val === "number" && !isNaN(val) && val >= thresholdMark) {
          attainedCount++;
        }
      });

      const attainmentPercent =
        eligibleCount > 0 ? (attainedCount / eligibleCount) * 100.0 : 0.0;
      const level = this.evaluateAttainmentLevel(attainmentPercent);

      return {
        key: comp.key,
        label: comp.label,
        category: comp.category,
        max_marks: comp.max_marks,
        threshold_mark: Math.round(thresholdMark * 100) / 100,
        total_eligible: eligibleCount,
        attained_count: attainedCount,
        attainment_percent: Math.round(attainmentPercent * 10000) / 10000,
        attainment_level: level,
        explanation: {
          formula: `(AttainedCount / TotalEligible) * 100`,
          inputs: {
            max_marks: comp.max_marks,
            threshold_percent: this.scheme.threshold_percent,
            threshold_mark: thresholdMark,
            attained_students: attainedCount,
            total_students: eligibleCount,
          },
          steps: [
            `Threshold Mark = ${comp.max_marks} * ${this.scheme.threshold_percent}% = ${thresholdMark.toFixed(2)}`,
            `Students scoring >= ${thresholdMark.toFixed(2)} = ${attainedCount} out of ${eligibleCount}`,
            `Attainment % = (${attainedCount} / ${eligibleCount}) * 100 = ${attainmentPercent.toFixed(2)}%`,
            `Attainment Level = ${level} (since ${attainmentPercent.toFixed(2)}% ${
              level === 3 ? ">= 55%" : level === 2 ? ">= 45% and < 55%" : "< 45%"
            })`,
          ],
          result: level,
        },
      };
    });

    // 2. Calculate Student Overall CO Percentages
    // Group components by CO and type
    const coComponents: Record<string, { internal: ComponentConfig[]; esam: ComponentConfig[] }> = {};
    coCodes.forEach((code) => {
      coComponents[code] = { internal: [], esam: [] };
    });

    const taComp = components.find((c) => c.category === "TEACHER_ASSESSMENT");

    components.forEach((comp) => {
      if (comp.co_code && coComponents[comp.co_code]) {
        if (comp.category === "END_SEM") {
          coComponents[comp.co_code].esam.push(comp);
        } else if (comp.category === "MID_TERM_1" || comp.category === "MID_TERM_2") {
          coComponents[comp.co_code].internal.push(comp);
        }
      }
    });

    const studentResults: StudentCOResult[] = students.map((s) => {
      const coPercentages: Record<string, number> = {};
      const coAttained: Record<string, boolean> = {};

      const taMark = typeof s.marks["ta"] === "number" ? (s.marks["ta"] as number) : 0;
      const taMax = taComp ? taComp.max_marks : 10;
      const taPercent = taMax > 0 ? (taMark / taMax) * 100.0 : 0.0;

      coCodes.forEach((code) => {
        const conf = coComponents[code];
        // Calculate Internal percentage:
        // Average of test percentages assessing this CO PLUS Teacher Assessment percentage
        let testPercentsSum = 0;
        let testCount = conf.internal.length;

        conf.internal.forEach((c) => {
          const rawMark = s.marks[c.key];
          const markVal = typeof rawMark === "number" ? rawMark : 0;
          testPercentsSum += c.max_marks > 0 ? (markVal / c.max_marks) * 100.0 : 0;
        });

        // IAM = (Sum of test percentages + TA percentage) / (testCount + 1)
        const iamDivisor = testCount + 1;
        const iamPercent = iamDivisor > 0 ? (testPercentsSum + taPercent) / iamDivisor : 0.0;

        // Calculate ESAM percentage:
        let esamPercentsSum = 0;
        let esamCount = conf.esam.length;

        conf.esam.forEach((c) => {
          const rawMark = s.marks[c.key];
          const markVal = typeof rawMark === "number" ? rawMark : 0;
          esamPercentsSum += c.max_marks > 0 ? (markVal / c.max_marks) * 100.0 : 0;
        });

        const esamPercent = esamCount > 0 ? esamPercentsSum / esamCount : 0.0;

        // Combined Overall CO% = IAM% * iam_weight + ESAM% * esam_weight
        const combinedPercent =
          iamPercent * this.scheme.iam_weight + esamPercent * this.scheme.esam_weight;

        const rounded = Math.round(combinedPercent * 100) / 100;
        coPercentages[code] = rounded;
        coAttained[code] = rounded >= this.scheme.threshold_percent;
      });

      return {
        student_id: s.student_id,
        roll_no: s.roll_no,
        student_name: s.student_name,
        co_percentages: coPercentages,
        co_attained: coAttained,
      };
    });

    // 3. Class Direct, Indirect, and Final CO Attainment
    const coResults: COAttainmentResult[] = coCodes.map((code) => {
      let attainedStudents = 0;
      studentResults.forEach((sr) => {
        if (sr.co_attained[code]) attainedStudents++;
      });

      const classPercent =
        totalEnrolled > 0 ? (attainedStudents / totalEnrolled) * 100.0 : 0.0;
      const directLevel = this.evaluateAttainmentLevel(classPercent);

      const indirectLevel = indirectAttainmentMap?.[code] ?? 3.0; // Default 3.0 per college sheet

      const finalAttainment =
        directLevel * this.scheme.direct_weight + indirectLevel * this.scheme.indirect_weight;
      const roundedFinal = Math.round(finalAttainment * 100) / 100;

      return {
        co_code: code,
        total_students: totalEnrolled,
        attained_students: attainedStudents,
        class_percentage: Math.round(classPercent * 10000) / 10000,
        direct_level: directLevel,
        indirect_level: indirectLevel,
        final_attainment: roundedFinal,
        attainment_level: this.evaluateAttainmentLevel(classPercent),
        explanation: {
          formula: `FinalCO = DirectLevel * ${this.scheme.direct_weight} + IndirectLevel * ${this.scheme.indirect_weight}`,
          inputs: {
            students_scoring_ge_45: attainedStudents,
            total_students: totalEnrolled,
            class_percentage: classPercent,
            direct_level: directLevel,
            indirect_level: indirectLevel,
          },
          steps: [
            `Students with Overall ${code}% >= ${this.scheme.threshold_percent}% = ${attainedStudents} / ${totalEnrolled}`,
            `Class Attainment % = (${attainedStudents} / ${totalEnrolled}) * 100 = ${classPercent.toFixed(2)}%`,
            `Direct Attainment Level = ${directLevel} (since ${classPercent.toFixed(2)}% ${
              directLevel === 3 ? ">= 55%" : directLevel === 2 ? ">= 45%" : "< 45%"
            })`,
            `Final ${code} Attainment = (${directLevel} * ${this.scheme.direct_weight}) + (${indirectLevel} * ${this.scheme.indirect_weight}) = ${roundedFinal.toFixed(2)}`,
          ],
          result: roundedFinal,
        },
      };
    });

    // 4. Program Outcome (PO / PSO) Attainment Aggregation
    const finalCOMap: Record<string, number> = {};
    coResults.forEach((r) => {
      finalCOMap[r.co_code] = r.final_attainment;
    });

    const poResults: POAttainmentResult[] = poList.map((po) => {
      let weightedSum = 0;
      let totalMappingStrength = 0;
      let mappedCOsCount = 0;

      coCodes.forEach((coCode) => {
        const strength = mappings[coCode]?.[po.po_code];
        if (typeof strength === "number" && strength > 0) {
          const coFinal = finalCOMap[coCode] ?? 3.0;
          weightedSum += strength * coFinal;
          totalMappingStrength += strength;
          mappedCOsCount++;
        }
      });

      if (totalMappingStrength === 0 || mappedCOsCount === 0) {
        return {
          po_code: po.po_code,
          po_type: po.po_type,
          mapped_cos_count: 0,
          average_mapping_strength: null,
          achieved_attainment: null,
          is_mapped: false,
          explanation: {
            formula: "Unmapped",
            inputs: {},
            steps: [`${po.po_code} has no mapped Course Outcomes.`],
            result: null,
          },
        };
      }

      const achieved =
        this.scheme.po_aggregation_method === "WEIGHTED_AVERAGE"
          ? weightedSum / totalMappingStrength
          : totalMappingStrength / mappedCOsCount;

      const roundedAchieved = Math.round(achieved * 100) / 100;
      const avgStrength = Math.round((totalMappingStrength / mappedCOsCount) * 100) / 100;

      return {
        po_code: po.po_code,
        po_type: po.po_type,
        mapped_cos_count: mappedCOsCount,
        average_mapping_strength: avgStrength,
        achieved_attainment: roundedAchieved,
        is_mapped: true,
        explanation: {
          formula: `PO_Attainment = SUM(Strength_k * FinalCO_k) / SUM(Strength_k)`,
          inputs: {
            mapped_cos: mappedCOsCount,
            total_strength: totalMappingStrength,
            weighted_sum: weightedSum,
          },
          steps: [
            `Mapped to ${mappedCOsCount} Course Outcomes with total strength sum = ${totalMappingStrength}`,
            `Sum of (Strength * FinalCO) = ${weightedSum.toFixed(4)}`,
            `Final Attainment = ${weightedSum.toFixed(4)} / ${totalMappingStrength} = ${roundedAchieved.toFixed(2)}`,
          ],
          result: roundedAchieved,
        },
      };
    });

    // 5. Summary metrics
    const finalAttainments = coResults.map((r) => r.final_attainment);
    const avgFinalCO =
      finalAttainments.length > 0
        ? finalAttainments.reduce((a, b) => a + b, 0) / finalAttainments.length
        : 0;

    return {
      scheme: this.scheme,
      total_students_enrolled: totalEnrolled,
      student_results: studentResults,
      component_results: componentResults,
      co_results: coResults,
      po_results: poResults,
      summary: {
        all_cos_level_3: coResults.every((r) => r.direct_level === 3),
        average_final_co_attainment: Math.round(avgFinalCO * 100) / 100,
        highest_attained_co: coResults.reduce((max, r) => (r.class_percentage > max.class_percentage ? r : max), coResults[0]).co_code,
        lowest_attained_co: coResults.reduce((min, r) => (r.class_percentage < min.class_percentage ? r : min), coResults[0]).co_code,
      },
    };
  }
}
