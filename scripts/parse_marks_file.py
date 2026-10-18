"""
OutcomeX — Excel & CSV Marks Parser & Validation Service
Uses openpyxl to safely inspect and parse uploaded workbooks without executing macros
"""

import sys
import os
import json
import csv

def parse_marks_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".csv":
        return parse_csv(file_path)
    elif ext in [".xlsx", ".xlsm"]:
        return parse_xlsx(file_path)
    else:
        return {"error": f"Unsupported file extension: {ext}. Only .xlsx and .csv files are supported."}

def parse_csv(file_path):
    rows = []
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.reader(f)
        for r in reader:
            rows.append(r)
    
    if not rows:
        return {"error": "File is empty"}
    
    headers = rows[0]
    data_rows = rows[1:]
    
    return {
        "format": "csv",
        "sheet_names": ["Sheet1"],
        "active_sheet": "Sheet1",
        "headers": headers,
        "total_rows": len(data_rows),
        "preview_rows": data_rows[:20],
        "all_rows": data_rows,
    }

def parse_xlsx(file_path):
    import openpyxl
    
    # data_only=True ensures formulas are read as evaluated values, never executing external code
    wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
    sheet_names = wb.sheetnames
    
    if not sheet_names:
        return {"error": "Workbook contains no sheets"}
    
    sheet = wb[sheet_names[0]]
    raw_rows = []
    for row in sheet.iter_rows(values_only=True):
        if any(v is not None for v in row):
            raw_rows.append([str(v) if v is not None else "" for v in row])
            if len(raw_rows) >= 200:
                break
    wb.close()
    
    if not raw_rows:
        return {"error": "Sheet is empty"}
    
    headers = raw_rows[0]
    data_rows = raw_rows[1:]
    
    return {
        "format": "xlsx",
        "sheet_names": sheet_names,
        "active_sheet": sheet_names[0],
        "headers": headers,
        "total_rows": len(data_rows),
        "preview_rows": data_rows[:20],
        "all_rows": data_rows,
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "File path argument required"}))
        sys.exit(1)
        
    res = parse_marks_file(sys.argv[1])
    print(json.dumps(res, default=str))
