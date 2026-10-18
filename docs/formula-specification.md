# OutcomeX — Formula & Attainment Engine Specification

> **Document Status:** Complete Stage 1 Audit & Specification  
> **Reference File:** `reference/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx`  
> **SHA-256 Checksum:** `497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477`  
> **College Scheme:** Priyadarshini College of Engineering, Nagpur (Autonomous Institution)

---

## 1. Executive Summary of Workbook Audit

The reference workbook provides two worksheet templates used for OBE (Outcome-Based Education) attainment calculations:

1. **`For 60_40 (final)`**: Active reference sheet containing 81 students, 6 Course Outcomes (CO1–CO6), 12 Program Outcomes (PO1–PO12), and 2 Program Specific Outcomes (PSO1–PSO2). Assessment split is 40% Internal Assessment Mark (IAM) + 60% End Semester Assessment Mark (ESAM).
2. **`For 30_20 (Final)`**: An unpopulated template intended for 4 Course Outcomes (CO1–CO4) with 30 marks Endsem and 20 marks Internal (hence "30_20"). This sheet contains critical broken formula references (`#REF!`), circular-like layout omissions, and cascades of `#DIV/0!` due to having 0 student rows.

---

## 2. Core Attainment Rules & Configuration Scheme

### 2.1 Thresholds & Rubrics (Configurable)
- **Student Performance Threshold ($AG$16):** `45%`
  - A student "attains" a threshold in an assessment component if $\text{Marks Scored} \ge \text{Max Marks} \times 45\%$.
- **Attainment Level Rubrics (Cells AE18:AG21):**
  - **Level 3:** $\ge 55\%$ of eligible students score $\ge 45\%$ threshold.
  - **Level 2:** $\ge 45\%$ and $< 55\%$ of eligible students score $\ge 45\%$ threshold.
  - **Level 1:** $< 45\%$ of eligible students score $\ge 45\%$ threshold.
- **Direct vs. Indirect Attainment Weighting:**
  - $\text{Final CO Attainment} = 0.80 \times \text{Direct CO Attainment} + 0.20 \times \text{Indirect CO Attainment}$
  - Default Indirect CO Attainment = `3.0` (configurable or derived from exit surveys).

---

## 3. Detailed Mathematical Formulas: 60/40 Scheme

### 3.1 Individual Student CO Percentage (Columns U–Z, Rows 29–109)
For each student $i$ and each Course Outcome $\text{CO}_k$:
$$\text{CO}_k\%(i) = 0.40 \times \text{IAM}_k(i) + 0.60 \times \text{ESAM}_k(i)$$

Where:
$$\text{IAM}_k(i) = \frac{\sum_{m \in \text{MidTerms}} \left(\frac{\text{Marks}_{m,k}(i)}{\text{MaxMarks}_{m,k}} \times 100\right) + \left(\frac{\text{TA}(i)}{\text{MaxTA}} \times 100\right)}{N_{\text{tests}, k} + 1}$$

- $N_{\text{tests}, k}$ is the number of Mid-Term tests assessing $\text{CO}_k$ (calculated via `COUNTIF($C$27:$L$27, "CO_k")`).
- $\text{TA}(i)$ is the Teacher Assessment mark (out of 10).
- $\text{ESAM}_k(i) = \frac{\text{ESE}_k(i)}{\text{MaxESE}_k} \times 100$.

#### Excel Formula Implementation (Cell U28 / Row 29 for CO1):
```excel
=((IF($C$27="CO1",C29*100/$C$28,IF($D$27="CO1",D29*100/$D$28,IF($E$27="CO1",E29*100/$E$28)))
  +IF($H$27="CO1",H29*100/$H$28,IF($I$27="CO1",I29*100/$I$28,IF($J$27="CO1",J29*100/$J$28)))
  +(T29*100/$T$28)) / (COUNTIF($C$27:$L$27,"CO1")+1))*0.4 + ((M29*100/$M$28)*0.6)
```

### 3.2 Component Attainment Levels (Rows 111–115)
For each assessment component column $c \in \{C..J, M..R, T\}$:
1. **Total Eligible Students (Row 112):**
   $$\text{Total}(c) = \text{COUNT}(\$A\$29:\$A\$109)$$
   *(Note: Counts all enrolled students present in roll number column A)*
2. **Number of Students Attained (Row 113):**
   $$\text{Attained}(c) = \text{COUNTIF}\left(\text{col}_{29:109}, \ge \text{MaxMarks}_c \times \frac{\text{Threshold}}{100}\right)$$
3. **Attainment Percentage (Row 114):**
   $$\text{Attainment}\%(c) = \frac{\text{Attained}(c)}{\text{Total}(c)} \times 100$$
4. **Attainment Level (Row 115):**
   $$\text{Level}(c) = \begin{cases} 3 & \text{if } \text{Attainment}\%(c) \ge 55\% \\ 2 & \text{if } \text{Attainment}\%(c) \ge 45\% \\ 1 & \text{otherwise} \end{cases}$$

### 3.3 Direct CO Attainment Value (Rows 8, 11)
The workbook features two methods present in the template:
- **Method A (Summary Table Row 8 - "Average of all Assessment"):**
  $$\text{CO}_k^{\text{avg}} = \text{AVERAGE}(\text{MT1}_k, \text{MT2}_k, \text{TA}_k, \text{ESE}_k)$$
  *(Cells Y8:AD8)*
- **Method B (Row 11 - Direct Overall CO Level):**
  Points directly to the attainment level evaluated from the student combined overall percentage (columns U–Z):
  $$Y11 = U115, \quad Z11 = V115, \quad AA11 = W115, \quad AB11 = X115, \quad AC11 = Y115, \quad AD11 = Z115$$
  > [!IMPORTANT]
  > The formula in row 13 ($\text{Final CO Attainment}$) uses **Row 11** ($\text{Final CO} = Y11 \times 0.8 + Y12 \times 0.2$), NOT Row 8! Row 8 is an informative component average.

### 3.4 Program Outcome (PO & PSO) Attainment Calculation
In the 60/40 reference sheet:
- Let $M_{j,k} \in \{1, 2, 3\}$ be the mapping strength of $\text{CO}_k$ to $\text{PO}_j$ (where 0 or blank indicates unmapped).
- **The Theoretical / Autonomous OBE Formula (and 30/20 formula):**
  $$\text{PO}_j = \frac{\sum_{k \in \text{mapped}} \left(M_{j,k} \times \text{FinalCO}_k\right)}{\sum_{k \in \text{mapped}} M_{j,k}}$$
- **Discrepancy Detected in Reference Workbook (Cell O21–AB21):**
  In the reference sheet `For 60_40 (final)`, cells O21:AB21 contain hard-coded static numbers equal to:
  $$\text{PO}_j = \frac{\sum_{k \in \text{mapped}} M_{j,k}}{N_{\text{mapped}}}$$
  (The average mapping strength, without multiplying by CO attainment!)
  *(See Section 5 for `[FACULTY-VERIFY]` details).*

---

## 4. Detailed Mathematical Formulas: 30/20 Scheme

### 4.1 Structural Differences from 60/40
1. **Scope:** 4 Course Outcomes (CO1–CO4) instead of 6.
2. **Marks Distribution:**
   - Mid Term-I (CO1, CO2): $10 + 10 = 20$ marks.
   - Mid Term-II: Header has CO4 and CO5 (Discrepancy: should be CO3, CO4).
   - Teacher Assessment: 10 marks.
   - End Semester Exam: 30 marks total ($9 + 6 + 6 + 9$ marks across CO1..CO4).
3. **Internal vs Endsem Weighting:**
   - Student overall CO% (Columns Q–T, Rows 29–93):
     $$\text{CO}_k\%(i) = 0.40 \times \text{IAM}_k(i) + 0.60 \times \text{ESAM}_k(i)$$
   - Notice: Despite the name "30/20", the weighting in formulas is **still 40% Internal + 60% End Semester**! "30/20" denotes the raw marks scale (30 ESE / 20 Internal).

---

## 5. Audit Findings & List of Broken / Ambiguous Formulas

| ID | Location | Issue Description | Root Cause | Impact | Recommended Resolution `[FACULTY-VERIFY]` |
|---|---|---|---|---|---|
| **ERR-01** | `For 30_20 (Final)` cells Y7:AB7 | Formula contains `#REF!`: `=IF($K$94="CO1",$K$98,...,IF(#REF!="CO1",#REF!))` | Columns were deleted from the 60/40 template when creating 30/20. | ESE CO attainment level displays `#DIV/0!` and cannot evaluate. | Reconstruct ESE lookup formula for the 4 available ESE columns K, L, M, N: `=IF($K$94="CO1",$K$98,IF($L$94="CO1",$L$98,IF($M$94="CO1",$M$98,IF($N$94="CO1",$N$98,""))))` |
| **ERR-02** | `For 30_20 (Final)` cells Y4:AB5 | Cell Y4 references `$E$97` instead of `$E$98` | Typo in nested IF: references Attainment % row instead of Attainment Level row. | If CO1 was in column E, attainment would be a percentage (e.g. 75) instead of level (1–3). | Fix reference to `$E$98`. |
| **ERR-03** | `For 30_20 (Final)` cells G27:H27 & G94:H94 | Mid Term-II headers are labeled `CO4` and `CO5` | Copied from 60/40 without renaming for a 4-CO course. | Formula Q28 looks for CO1..CO4 and completely misses MT-II for CO3. | Verify with faculty if MT-II covers CO3 and CO4 (columns G & H). |
| **ERR-04** | `For 60_40 (final)` cells O21:AB21 | PO attainment values are static floats (e.g., 2.67) matching average mapping weight, NOT OBE attainment. | Faculty entered static numbers calculated as `AVERAGE(mappings)` instead of formula `SUM(M*CO)/SUM(M)`. | PO attainment is decoupled from actual student performance! | `[FACULTY-VERIFY]`: Confirm whether PO attainment should follow the standard OBE formula: $\frac{\sum(M_{j,k} \times \text{CO}_k)}{\sum M_{j,k}}$, as implemented in the 30/20 formula. |
| **ERR-05** | `For 60_40 (final)` cell D94 (Roll 138) | Mark is `19.0`, but Max Marks in D28 is `10.0` | Data entry typo (student scored 9 or 10, entered as 19). | Skews CO2 MT-1 count. | Flag in validation wizard as `Critical: Mark exceeds maximum allowed (19 > 10)`. |
| **ERR-06** | `For 60_40 (final)` cell Q55 (Roll 218) | Mark is `9.0`, but Max Marks in Q28 is `8.0` | Data entry typo. | Skews ESE CO5 calculation. | Flag in validation wizard as `Critical: Mark exceeds maximum allowed (9 > 8)`. |
| **ERR-07** | `For 60_40 (final)` Rows 29–109 | 31 students have empty cells for MT1 or MT2 (not 0). | Absent students left blank. | `COUNTIF(..., ">=4.5")` treats blank as not attained, but `COUNT($A$29:$A$109)` counts student in denominator. | Engine must explicitly distinguish `ABSENT`, `EXEMPT`, and `0`. Configurable whether absent students are included in denominator. |
| **ERR-08** | `For 60_40 (final)` Roll numbers | Duplicate roll numbers: 117 (rows 38 & 78), 127 (rows 43 & 84), 158 (rows 49 & 108), 148 (rows 44 & 102). | Combined sections or DSE students appended. | Violates uniqueness if roll number is primary key. | Use `(offering_id, student_id)` or unique university registration ID / roll number with section distinction. |

---

## 6. Reference Calculation Cases (Verified Against Workbook)

The following reference cases are extracted directly from `For 60_40 (final)` to validate the deterministic calculation engine:

### Case 1: Student Row 29 (Roll 102 — BHAIRAVI SANJAY BHENDARKAR)
- **Inputs:**
  - MT-1: C29=8.0 (max 10), D29=10.0 (max 10), E29=5.0 (max 10)
  - MT-2: H29=10.0 (max 10), I29=8.0 (max 10), J29=9.0 (max 10)
  - TA: T29=10.0 (max 10)
  - ESE: M29=9.0 (max 10), N29=9.0 (max 12), O29=8.0 (max 12), P29=3.0 (max 10), Q29=7.0 (max 8), R29=8.0 (max 8)
- **CO1 Calculation:**
  - MT1 CO1: $8 / 10 \times 100 = 80\%$
  - MT2 CO1: Not assessed ($0$)
  - TA: $10 / 10 \times 100 = 100\%$
  - $N_{\text{tests}} + 1 = 1 + 1 = 2$
  - $\text{IAM}_1 = (80 + 100) / 2 = 90.0\%$
  - $\text{ESAM}_1 = 9 / 10 \times 100 = 90.0\%$
  - $\text{Overall CO1}\% = 0.40 \times 90.0 + 0.60 \times 90.0 = \mathbf{90.0\%}$
  - Workbook Cell U29 evaluates to: **`90`** (Match verified).

### Case 2: Class Attainment for MT-1 CO1 (Column C)
- Total enrolled students in column A ($C112$): **81**
- Max Marks ($C28$): **10**
- Threshold: $10 \times 45\% = \mathbf{4.5}$
- Number of students with marks $\ge 4.5$ ($C113$): **64**
- Attainment % ($C114$): $64 \times 100 / 81 = \mathbf{79.0123\%}$
- Attainment Level ($C115$): Since $79.01\% \ge 55\% \implies \mathbf{3}$ (Match verified).

### Case 3: Overall Direct CO Attainment (Column U)
- Number of students with overall CO1% $\ge 45\%$ ($U113$): **72**
- Attainment % ($U114$): $72 \times 100 / 81 = \mathbf{88.8889\%}$
- Attainment Level ($U115$): Since $88.89\% \ge 55\% \implies \mathbf{3}$
- Direct CO1 Attainment ($Y11$): **3**
- Indirect CO1 Attainment ($Y12$): **3**
- Final CO1 Attainment ($Y13$): $3 \times 0.8 + 3 \times 0.2 = \mathbf{3.0}$ (Match verified).
