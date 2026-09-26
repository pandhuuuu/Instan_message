#!/usr/bin/env python3
"""
Generate both:
1. Native Microsoft Excel file (docs/Test_Cases_Matrix.xlsx) with professional styling,
   auto-width, freeze panes, filter headers, and colored status badges.
2. Formatted CSV file (docs/Test_Cases_Matrix.csv) with 'sep=;' header so Excel opens it
   cleanly regardless of Windows regional settings (US or Indonesian).
"""

import os
import csv
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Import test cases from generate_test_matrix_csv
from generate_test_matrix_csv import TEST_CASES

def generate_excel(output_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Test Execution Matrix"
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Test ID",
        "Module",
        "Category",
        "Test Scenario Description",
        "Method / Action",
        "Endpoint / Context",
        "Expected Invariant & Result",
        "Duration (ms)",
        "Status"
    ]

    # Style definitions
    header_fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    zebra_even = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    zebra_odd = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    
    pass_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
    pass_font = Font(name="Calibri", size=10, bold=True, color="065F46")
    
    text_font = Font(name="Calibri", size=10, color="1E293B")
    id_font = Font(name="Calibri", size=10, bold=True, color="1E40AF")
    
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    # Write headers
    ws.append(headers)
    for col_num, _ in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    
    ws.row_dimensions[1].height = 28

    # Write data rows
    for r_idx, tc in enumerate(TEST_CASES, start=2):
        row_data = [
            tc["id"],
            tc["module"],
            tc["category"],
            tc["scenario"],
            tc["method"],
            tc["endpoint"],
            tc["expected"],
            tc["time_ms"],
            tc["status"]
        ]
        ws.append(row_data)
        
        current_fill = zebra_even if r_idx % 2 == 0 else zebra_odd
        ws.row_dimensions[r_idx].height = 22

        for c_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.border = thin_border
            cell.fill = current_fill
            cell.font = text_font
            cell.alignment = Alignment(vertical="center")

            # ID Column
            if c_idx == 1:
                cell.font = id_font
                cell.alignment = Alignment(horizontal="center", vertical="center")
            
            # Method / Action Column
            elif c_idx == 5:
                cell.alignment = Alignment(horizontal="center", vertical="center")

            # Time ms Column
            elif c_idx == 8:
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = '#,##0'

            # Status Column (Colored Badge)
            elif c_idx == 9:
                cell.fill = pass_fill
                cell.font = pass_font
                cell.alignment = Alignment(horizontal="center", vertical="center")

    # Enable autofilter
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(TEST_CASES) + 1}"

    # Freeze top row
    ws.freeze_panes = "A2"

    # Set column widths with reasonable padding
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        # Cap max width to 50 for readability
        adjusted_width = min(max(max_len + 4, 12), 48)
        ws.column_dimensions[col_letter].width = adjusted_width

    # Specific fine-tuning for certain columns
    ws.column_dimensions["A"].width = 12  # Test ID
    ws.column_dimensions["E"].width = 15  # Method
    ws.column_dimensions["H"].width = 15  # Duration
    ws.column_dimensions["I"].width = 12  # Status

    wb.save(output_path)
    print(f"[OK] Formatted Excel file generated at: {output_path}")

def generate_compatible_csv(output_path):
    """
    Generate CSV with 'sep=;' instruction at the very first line so Microsoft Excel
    on Indonesian/European Windows locale immediately splits into columns without dumping
    everything into Column A!
    """
    fieldnames = [
        "Test_ID",
        "Module",
        "Category",
        "Test_Scenario",
        "Method_or_Action",
        "Endpoint_or_Context",
        "Expected_Result",
        "Execution_Time_ms",
        "Status"
    ]

    with open(output_path, mode="w", newline="", encoding="utf-8-sig") as f:
        # Special directive for Microsoft Excel to parse delimiter correctly
        f.write("sep=;\n")
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()

        for tc in TEST_CASES:
            writer.writerow({
                "Test_ID": tc["id"],
                "Module": tc["module"],
                "Category": tc["category"],
                "Test_Scenario": tc["scenario"],
                "Method_or_Action": tc["method"],
                "Endpoint_or_Context": tc["endpoint"],
                "Expected_Result": tc["expected"],
                "Execution_Time_ms": tc["time_ms"],
                "Status": tc["status"]
            })

    print(f"[OK] Region-compatible CSV generated at: {output_path}")

if __name__ == "__main__":
    docs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs")
    xlsx_path = os.path.join(docs_dir, "Test_Cases_Matrix.xlsx")
    csv_path = os.path.join(docs_dir, "Test_Cases_Matrix.csv")
    
    generate_excel(xlsx_path)
    generate_compatible_csv(csv_path)
