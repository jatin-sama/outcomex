# OutcomeX — Excel Template Cell Mapping

> **Document Status:** Complete Stage 1 Template Map  
> **Reference File:** `reference/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx`  
> **Templates Documented:** `For 60_40 (final)` and `For 30_20 (Final)`

---

## 1. Template: `For 60_40 (final)`

### 1.1 Course Metadata & Header Cells
| Field Name | Coordinate | Type | Value in Reference | Editable / Source |
|---|---|---|---|---|
| Institution Name | `N1` | Static string | PRIYADARSHINI COLLEGE OF ENGINEERING , NAGPUR | Fixed / Config |
| Institution Status | `N2` | Static string | An Autonomous Institution | Fixed / Config |
| Branch / Department | `O3` (merged O3:P3) | String | CSE | Department entity |
| Year / Semester | `R3` | String | Year / Semester :3rd yr/5th sem | Academic Year / Semester |
| Class Division | `T3` | String | IInd / IIIrd | Course Offering |
| Subject Name | `O4` (merged O4:P4) | String | IDS | Course Name |
| Course Code | `O5` | String | 25UCS623T | Course Code |
| Academic Year | `R5` | String | Year of Study : 2025-26 | Academic Year |

### 1.2 Configuration & Rubrics Cells
| Parameter | Coordinate | Type | Value | Formula / Role |
|---|---|---|---|---|
| Threshold Percentage | `AG16` | Float | `45.0` | Threshold % for student attainment |
| Level 3 Min % | `AE19` | Float | `55.0` | Class % required for Level 3 |
| Level 3 Max % | `AF19` | Float | `100.0` | Display upper bound |
| Level 3 Value | `AG19` | Float | `3.0` | Attainment Level 3 |
| Level 2 Min % | `AE20` | Float | `45.0` | Class % required for Level 2 |
| Level 2 Max % | `AF20` | Float | `54.0` | Upper bound for Level 2 |
| Level 2 Value | `AG20` | Float | `2.0` | Attainment Level 2 |
| Level 1 Min % | `AE21` | Float | `0.0` | Lower bound for Level 1 |
| Level 1 Max % | `AF21` | Float | `44.0` | Class % ceiling for Level 1 |
| Level 1 Value | `AG21` | Float | `1.0` | Attainment Level 1 |

### 1.3 Assessment Structure & Maximum Marks (Rows 26–28)
| Assessment Name | Column Range | CO Headers (Row 27) | Max Marks (Row 28) | Formula in Row 28 |
|---|---|---|---|---|
| **Mid Term-I** | `C` to `E` | C27=CO1, D27=CO2, E27=CO3 | C28=10, D28=10, E28=10 | F28 = `SUM(C28:E28)` (Total: 30)<br>G28 = `F28*100/$F$28` (100%) |
| **Mid Term-II** | `H` to `J` | H27=CO4, I27=CO5, J27=CO6 | H28=10, I28=10, J28=10 | K28 = `SUM(H28:J28)` (Total: 30)<br>L28 = `K28*100/$K$28` (100%) |
| **Endsem Exam** | `M` to `R` | M27=CO1, N27=CO2, O27=CO3, P27=CO4, Q27=CO5, R27=CO6 | M28=10, N28=12, O28=12, P28=10, Q28=8, R28=8 | S28 = 60 (Total ESE Marks) |
| **Teacher Assessment (TA)** | `T` | (Covers all COs) | T28=10 | Fixed max mark = 10 |
| **Student CO% Headers** | `U` to `Z` | U27=CO1%, V27=CO2%, W27=CO3%, X27=CO4%, Y27=CO5%, Z27=CO6% | Max % = 100% | U28..Z28 = Combined formula evaluated for 100% |

### 1.4 Student Marks Entry Grid (Rows 29–109, 81 Students)
| Column | Header | Data Type | Notes |
|---|---|---|---|
| `A` | Roll No. | Number / String | Student Roll Number |
| `B` | Name of Student | String | Full Name |
| `C` | Mid Term-I (CO1) | Float / Blank | Marks out of 10 |
| `D` | Mid Term-I (CO2) | Float / Blank | Marks out of 10 |
| `E` | Mid Term-I (CO3) | Float / Blank | Marks out of 10 |
| `F` | Total MT-I | Formula | `=SUM(C29:E29)` |
| `G` | MT-I Result % | Formula | `=F29*100/$F$28` |
| `H` | Mid Term-II (CO4) | Float / Blank | Marks out of 10 |
| `I` | Mid Term-II (CO5) | Float / Blank | Marks out of 10 |
| `J` | Mid Term-II (CO6) | Float / Blank | Marks out of 10 |
| `K` | Total MT-II | Formula | `=SUM(H29:J29)` |
| `L` | MT-II Result % | Formula | `=K29*100/$K$28` |
| `M` | ESE CO1 | Float / Blank | Marks out of 10 |
| `N` | ESE CO2 | Float / Blank | Marks out of 12 |
| `O` | ESE CO3 | Float / Blank | Marks out of 12 |
| `P` | ESE CO4 | Float / Blank | Marks out of 10 |
| `Q` | ESE CO5 | Float / Blank | Marks out of 8 |
| `R` | ESE CO6 | Float / Blank | Marks out of 8 |
| `S` | Total ESE | Formula | `=SUM(M29:R29)` |
| `T` | Teacher Assessment | Float / Blank | Marks out of 10 |
| `U`–`Z` | Overall CO1% to CO6% | Formula | Combined 40% IAM + 60% ESE formula |

### 1.5 Class Summary & Attainment Statistics (Rows 111–115)
| Metric | Row | Formula Template | Example (Col C) |
|---|---|---|---|
| CO Label | 111 | `='=C27'` | `=C27` |
| Total Strength | 112 | `='=COUNT($A$29:$A$109)'` | `=COUNT($A$29:$A$109)` (81) |
| Students Attained $\ge$ Threshold | 113 | `='=COUNTIF(col29:col109, ">="&(col$28*$AG$16/100))'` | `=COUNTIF(C29:C109,">="&(C$28*$AG$16/100))` (64) |
| Attainment % | 114 | `='=col113*100/col112'` | `=C113*100/C112` (79.01%) |
| Attainment Level (1–3) | 115 | `='=IF(col114>=$AE$19,3,IF(col114>=$AE$20,2,1))'` | `=IF(C114>=$AE$19,3,IF(C114>=$AE$20,2,1))` (3) |

### 1.6 CO Attainment Summary Table (Top Right, Rows 2–13)
| Assessment Tool | Row | CO1 (Col Y) | CO2 (Col Z) | CO3 (Col AA) | CO4 (Col AB) | CO5 (Col AC) | CO6 (Col AD) |
|---|---|---|---|---|---|---|---|
| Mid Term-1 | 4 | Lookup into C115..E115 | Lookup into C115..E115 | Lookup into C115..E115 | - | - | - |
| Mid Term-2 | 5 | - | - | - | Lookup into H115..J115 | Lookup into H115..J115 | Lookup into H115..J115 |
| Teacher Assessment | 6 | `=$T$115` | `=$T$115` | `=$T$115` | `=$T$115` | `=$T$115` | `=$T$115` |
| Endsem Exam | 7 | Lookup M115 | Lookup N115 | Lookup O115 | Lookup P115 | Lookup Q115 | Lookup R115 |
| **Average of all Assessment** | 8 | `=AVERAGE(Y4:Y7)` | `=AVERAGE(Z4:Z7)` | `=AVERAGE(AA4:AA7)` | `=AVERAGE(AB4:AB7)` | `=AVERAGE(AC4:AC7)` | `=AVERAGE(AD4:AD7)` |
| **Direct CO Attainment** | 11 | `=$U$115` | `=$V$115` | `=$W$115` | `=$X$115` | `=$Y$115` | `=$Z$115` |
| **Indirect CO Attainment** | 12 | Input float (3.0) | Input float (3.0) | Input float (3.0) | Input float (3.0) | Input float (3.0) | Input float (3.0) |
| **Final CO Attainment** | 13 | `=Y11*0.8+Y12*0.2` | `=Z11*0.8+Z12*0.2` | `=AA11*0.8+AA12*0.2` | `=AB11*0.8+AB12*0.2` | `=AC11*0.8+AC12*0.2` | `=AD11*0.8+AD12*0.2` |

### 1.7 PO & PSO Attainment Matrix (Rows 14–21, Columns O–AB)
- Headers (Row 14): O14=PO1, P14=PO2, ..., Z14=PO12, AA14=PSO 1, AB14=PSO 2.
- CO-PO Mapping Strengths (Rows 15–20): Rows represent CO1 to CO6. Cell values $\in \{1, 2, 3\}$ or empty.
- Final PO Attainment (Row 21): Static values in reference workbook `[FACULTY-VERIFY]`. Formula equivalent:
  $$\text{Cell}(j, 21) = \frac{\sum_{r=15}^{20} (\text{Cell}(j, r) \times \text{FinalCO}_r)}{\sum_{r=15}^{20} \text{Cell}(j, r)}$$

---

## 2. Template: `For 30_20 (Final)`

### 2.1 Course Metadata & Header Cells
| Field Name | Coordinate | Type | Value in Reference |
|---|---|---|---|
| Institution Header | `N1:N2` | Static string | Same as 60/40 |
| Branch | `N3` | Label | Value empty in template |
| Subject | `N4` | Label | Value empty in template |
| Course Code | `N5` | Label | Value empty in template |

### 2.2 Assessment Structure & Maximum Marks (Rows 26–28)
| Assessment Name | Column Range | CO Headers (Row 27) | Max Marks (Row 28) | Formula in Row 28 |
|---|---|---|---|---|
| **Mid Term-I** | `C` to `D` | C27=CO1, D27=CO2 | C28=10, D28=10 | E28 = `SUM(C28:D28)` (Total: 20)<br>F28 = `E28*100/$E$28` (100%) |
| **Mid Term-II** | `G` to `H` | G27=CO4, H27=CO5 *(Typo: Should be CO3, CO4)* | G28=10, H28=10 | I28 = `SUM(G28:H28)` (Total: 20)<br>J28 = `I28*100/$I$28` (100%) |
| **Endsem Exam** | `K` to `N` | K27=CO1, L27=CO2, M27=CO3, N27=CO4 | K28=9, L28=6, M28=6, N28=9 | O28 = `SUM(K28:N28)` (Total: 30) |
| **Teacher Assessment (TA)** | `P` | (All COs) | P28=10 | Fixed max mark = 10 |
| **Overall CO% Headers** | `Q` to `T` | Q27=CO1%, R27=CO2%, S27=CO3%, T27=CO4% | Max % = 100% | Q28..T28 = Evaluated formula |

### 2.3 Student Marks Grid (Rows 29–93, 65 rows allocated)
Currently 0 students populated in reference file. Pre-filled with empty/zero-default formulas:
- Total MT-I: `E29 = SUM(C29:D29)`
- Result MT-I %: `F29 = E29*100/$E$28`
- Total MT-II: `I29 = SUM(G29:H29)`
- Result MT-II %: `J29 = I29*100/$I$28`
- Total ESE: `O29 = SUM(K29:N29)`
- Student CO1% to CO4%: Columns Q to T.

### 2.4 Class Summary & Attainment Statistics (Rows 94–98)
- Row 94: CO labels (`C94=C27`, `D94=D27`, etc.)
- Row 95: Total strength (`=COUNT($A$29:$A$93)`)
- Row 96: Number of students attained $\ge 45\%$ threshold
- Row 97: Attainment % (`=col96*100/col95`)
- Row 98: Attainment level (`=IF(col97>=$AE$19,3,IF(col97>=$AE$20,2,1))`)

### 2.5 PO & PSO Attainment Matrix (Rows 14–19, Columns O–AB)
Unlike 60/40, the 30/20 template **has live Excel formulas** in row 19:
```excel
O19 = =IF(SUM(O15:O18)=0, " ", ((O15*$Y$13 + O16*$Z$13 + O17*$AA$13 + O18*$AB$13) / SUM(O15:O18)))
```
This proves conclusively that the intended college formula for PO attainment is the **weighted average of Final CO Attainment weighted by mapping strength**.
