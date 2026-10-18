"""
OutcomeX — Python Calculation Engine Core
Implements approved PCE Autonomous college rules with full audit explanation trails.
Used by unit tests and workbook export adapters.
"""

def evaluate_attainment_level(percentage, level_3_threshold=55.0, level_2_threshold=45.0):
    if percentage is None or percentage < 0:
        return 1
    if percentage >= level_3_threshold:
        return 3
    if percentage >= level_2_threshold:
        return 2
    return 1

def calculate_student_co_percent(
    mt1_percent, mt2_percent, ta_percent, ese_percent,
    has_mt1=True, has_mt2=False, iam_weight=0.40, esam_weight=0.60
):
    """
    IAM = (Sum of internal tests assessing this CO + TA) / (testCount + 1)
    Combined CO% = IAM * iam_weight + ESE * esam_weight
    """
    tests = []
    if has_mt1:
        tests.append(mt1_percent)
    if has_mt2:
        tests.append(mt2_percent)
    
    test_count = len(tests)
    iam_divisor = test_count + 1
    iam_percent = (sum(tests) + ta_percent) / iam_divisor if iam_divisor > 0 else 0.0
    
    combined = iam_percent * iam_weight + ese_percent * esam_weight
    return round(combined, 4)

def calculate_class_component_attainment(marks_list, max_marks, threshold_percent=45.0):
    """
    Threshold Mark = max_marks * (threshold_percent / 100)
    Attained Count = students scoring >= threshold_mark
    """
    threshold_mark = max_marks * (threshold_percent / 100.0)
    total_eligible = len(marks_list)
    
    if total_eligible == 0:
        return {
            "threshold_mark": threshold_mark,
            "total_eligible": 0,
            "attained_count": 0,
            "attainment_percent": 0.0,
            "level": 1
        }
        
    attained_count = sum(1 for m in marks_list if m is not None and m >= threshold_mark)
    percent = (attained_count / total_eligible) * 100.0
    level = evaluate_attainment_level(percent)
    
    return {
        "threshold_mark": round(threshold_mark, 4),
        "total_eligible": total_eligible,
        "attained_count": attained_count,
        "attainment_percent": round(percent, 4),
        "level": level
    }

def calculate_final_co_attainment(direct_level, indirect_level=3.0, direct_weight=0.80, indirect_weight=0.20):
    return round(direct_level * direct_weight + indirect_level * indirect_weight, 4)

def calculate_po_attainment(mappings, final_co_map, aggregation_method="WEIGHTED_AVERAGE"):
    """
    mappings: dict of {co_code: strength} e.g. {'CO1': 3, 'CO2': 2}
    final_co_map: dict of {co_code: final_attainment} e.g. {'CO1': 3.0, 'CO2': 3.0}
    """
    weighted_sum = 0.0
    total_strength = 0.0
    mapped_count = 0
    
    for co_code, strength in mappings.items():
        if strength is not None and strength > 0:
            final_co = final_co_map.get(co_code, 3.0)
            weighted_sum += strength * final_co
            total_strength += strength
            mapped_count += 1
            
    if total_strength == 0 or mapped_count == 0:
        return {
            "mapped_count": 0,
            "total_strength": 0.0,
            "average_strength": None,
            "achieved_attainment": None,
            "is_mapped": False
        }
        
    if aggregation_method == "WEIGHTED_AVERAGE":
        achieved = weighted_sum / total_strength
    else: # MAPPING_AVERAGE
        achieved = total_strength / mapped_count
        
    return {
        "mapped_count": mapped_count,
        "total_strength": total_strength,
        "average_strength": round(total_strength / mapped_count, 4),
        "achieved_attainment": round(achieved, 4),
        "is_mapped": True
    }
