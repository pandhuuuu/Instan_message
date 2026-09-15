#!/usr/bin/env python3
"""
Generate Word (.docx) documents from Markdown source files.

Converts three milestone documents:
  1. Concurrency Strategy
  2. Testing Strategy
  3. Critical Risk Analysis

Each document includes:
  - Cover page with title, author, date
  - Table of Contents
  - Numbered headings (1, 1.1, 1.2, etc.)
  - Formatted code blocks with monospace font
  - Tables with proper borders and header styling
  - Footer with page numbers

Usage:
    python backend/scripts/generate_milestone_docs.py

Output:
    docs/Concurrency_Strategy.docx
    docs/Testing_Strategy.docx
    docs/Critical_Risk_Analysis.docx
"""

import os
import re
import sys
from datetime import datetime

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml


# ==============================================================================
# Configuration
# ==============================================================================

DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs")

DOCUMENTS = [
    {
        "md_file": "concurrency-strategy.md",
        "docx_file": "Concurrency_Strategy.docx",
        "title": "Concurrency Strategy",
        "subtitle": "Thread-Safety, Deadlock-Freedom & Race Condition Analysis",
    },
    {
        "md_file": "testing-strategy.md",
        "docx_file": "Testing_Strategy.docx",
        "title": "Testing Strategy & Test Plan",
        "subtitle": "Comprehensive Test Suite Specification & Verification Strategy",
    },
    {
        "md_file": "critical-risk-analysis.md",
        "docx_file": "Critical_Risk_Analysis.docx",
        "title": "Critical & High-Risk Areas of the Design",
        "subtitle": "Design Vulnerability Assessment & Mitigation Recommendations",
    },
]

AUTHOR = "IM Project Development Team"
PROJECT = "Real-Time Instant Messaging System"
SYSTEM = "MERN Stack (MongoDB, Express.js, React, Node.js) + Socket.IO"
DATE_STR = datetime.now().strftime("%B %d, %Y")

# Font settings
FONT_BODY = "Calibri"
FONT_HEADING = "Calibri"
FONT_CODE = "Consolas"
FONT_SIZE_BODY = Pt(11)
FONT_SIZE_CODE = Pt(9)


# ==============================================================================
# Markdown Parser
# ==============================================================================

def parse_markdown(md_text):
    """Parse markdown text into a list of content blocks."""
    lines = md_text.split("\n")
    blocks = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Skip the document title line (first # heading) and metadata lines
        if i < 10 and (line.startswith("**Deliverable") or line.startswith("**System") or
                       line.startswith("**Architecture") or line.startswith("**Scope") or
                       line.startswith("**Test Suite") or line.startswith("**Current") or
                       line.startswith("**Course") or line.startswith("**Document")):
            # Metadata lines — add as metadata block
            blocks.append({"type": "metadata", "content": line.strip("* \n")})
            i += 1
            continue

        # Horizontal rule
        if line.strip() == "---":
            i += 1
            continue

        # Headings
        heading_match = re.match(r'^(#{1,4})\s+(.*)', line)
        if heading_match:
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()
            blocks.append({"type": "heading", "level": level, "content": text})
            i += 1
            continue

        # Code blocks (fenced)
        if line.strip().startswith("```"):
            lang = line.strip().lstrip("`").strip()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            blocks.append({"type": "code", "language": lang, "content": "\n".join(code_lines)})
            continue

        # Table
        if "|" in line and i + 1 < len(lines) and re.match(r'^\s*\|[\s:|-]+\|', lines[i + 1]):
            table_lines = []
            while i < len(lines) and "|" in lines[i]:
                stripped = lines[i].strip()
                # Skip separator rows
                if not re.match(r'^\|[\s:|-]+\|$', stripped):
                    table_lines.append(stripped)
                i += 1
            blocks.append({"type": "table", "rows": table_lines})
            continue

        # Empty line
        if not line.strip():
            i += 1
            continue

        # Regular paragraph (collect consecutive non-empty lines)
        para_lines = []
        while i < len(lines) and lines[i].strip() and not lines[i].startswith("#") \
                and not lines[i].strip().startswith("```") and not lines[i].strip().startswith("---") \
                and not ("|" in lines[i] and i + 1 < len(lines) and "|" in lines[i + 1]):
            para_lines.append(lines[i].strip())
            i += 1

        if para_lines:
            text = " ".join(para_lines)
            blocks.append({"type": "paragraph", "content": text})

    return blocks


# ==============================================================================
# Word Document Builder
# ==============================================================================

def set_cell_shading(cell, color_hex):
    """Set cell background shading."""
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}" w:val="clear"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def set_cell_borders(cell, color="000000", size="4"):
    """Set borders for a cell."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'  <w:top w:val="single" w:sz="{size}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="single" w:sz="{size}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="single" w:sz="{size}" w:space="0" w:color="{color}"/>'
        f'  <w:right w:val="single" w:sz="{size}" w:space="0" w:color="{color}"/>'
        f'</w:tcBorders>'
    )
    tcBorders_existing = tcPr.find(qn('w:tcBorders'))
    if tcBorders_existing is not None:
        tcPr.remove(tcBorders_existing)
    tcPr.append(tcBorders)


def add_page_number(doc):
    """Add page numbers to the footer of the document."""
    for section in doc.sections:
        footer = section.footer
        footer.is_linked_to_previous = False
        p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Clear existing
        p.clear()

        run = p.add_run()
        run.font.size = Pt(9)
        run.font.name = FONT_BODY
        run.font.color.rgb = RGBColor(128, 128, 128)

        # "Page " text
        run.text = "Page "

        # Page number field
        fldChar1 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
        run1 = p.add_run()
        run1._r.append(fldChar1)

        instrText = parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> PAGE </w:instrText>')
        run2 = p.add_run()
        run2._r.append(instrText)

        fldChar2 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
        run3 = p.add_run()
        run3._r.append(fldChar2)

        # " of " text
        run4 = p.add_run(" of ")
        run4.font.size = Pt(9)
        run4.font.name = FONT_BODY
        run4.font.color.rgb = RGBColor(128, 128, 128)

        # Total pages field
        fldChar3 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
        run5 = p.add_run()
        run5._r.append(fldChar3)

        instrText2 = parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> NUMPAGES </w:instrText>')
        run6 = p.add_run()
        run6._r.append(instrText2)

        fldChar4 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
        run7 = p.add_run()
        run7._r.append(fldChar4)


def add_cover_page(doc, title, subtitle):
    """Add a professional cover page."""
    # Add several empty paragraphs for spacing
    for _ in range(6):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)

    # Project name
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(PROJECT)
    run.font.size = Pt(14)
    run.font.name = FONT_HEADING
    run.font.color.rgb = RGBColor(100, 100, 100)
    p.paragraph_format.space_after = Pt(8)

    # Horizontal line
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("━" * 50)
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(44, 62, 80)

    # Main title
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(title)
    run.font.size = Pt(28)
    run.font.name = FONT_HEADING
    run.font.bold = True
    run.font.color.rgb = RGBColor(44, 62, 80)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(8)

    # Subtitle
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(subtitle)
    run.font.size = Pt(13)
    run.font.name = FONT_HEADING
    run.font.italic = True
    run.font.color.rgb = RGBColor(100, 100, 100)
    p.paragraph_format.space_after = Pt(6)

    # Horizontal line
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("━" * 50)
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(44, 62, 80)

    # Spacing
    for _ in range(4):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)

    # System info
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(SYSTEM)
    run.font.size = Pt(11)
    run.font.name = FONT_BODY
    run.font.color.rgb = RGBColor(100, 100, 100)
    p.paragraph_format.space_after = Pt(20)

    # Author
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f"Author: {AUTHOR}")
    run.font.size = Pt(12)
    run.font.name = FONT_BODY
    p.paragraph_format.space_after = Pt(4)

    # Date
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f"Date: {DATE_STR}")
    run.font.size = Pt(12)
    run.font.name = FONT_BODY
    p.paragraph_format.space_after = Pt(4)

    # Page break after cover
    doc.add_page_break()


def add_toc(doc):
    """Add a Table of Contents placeholder that Word will update."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run("Table of Contents")
    run.font.size = Pt(18)
    run.font.name = FONT_HEADING
    run.font.bold = True
    run.font.color.rgb = RGBColor(44, 62, 80)
    p.paragraph_format.space_after = Pt(12)

    # TOC field
    p = doc.add_paragraph()
    run = p.add_run()
    fldChar1 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
    run._r.append(fldChar1)

    run2 = p.add_run()
    instrText = parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText>')
    run2._r.append(instrText)

    run3 = p.add_run()
    fldChar2 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="separate"/>')
    run3._r.append(fldChar2)

    run4 = p.add_run("[Right-click here and select 'Update Field' to generate Table of Contents]")
    run4.font.size = Pt(10)
    run4.font.color.rgb = RGBColor(150, 150, 150)
    run4.font.italic = True

    run5 = p.add_run()
    fldChar3 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
    run5._r.append(fldChar3)

    doc.add_page_break()


def add_formatted_text(paragraph, text, font_name=FONT_BODY, font_size=FONT_SIZE_BODY):
    """Add text with inline formatting (bold, italic, code) to a paragraph."""
    # Process inline formatting: **bold**, *italic*, `code`, $$math$$
    parts = re.split(r'(\*\*.*?\*\*|\*.*?\*|`[^`]+`|\$\$.*?\$\$|\$[^$]+\$)', text)

    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            run.font.bold = True
            run.font.name = font_name
            run.font.size = font_size
        elif part.startswith("*") and part.endswith("*") and not part.startswith("**"):
            run = paragraph.add_run(part[1:-1])
            run.font.italic = True
            run.font.name = font_name
            run.font.size = font_size
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            run.font.name = FONT_CODE
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(192, 57, 43)
        elif part.startswith("$$") and part.endswith("$$"):
            run = paragraph.add_run(part[2:-2])
            run.font.italic = True
            run.font.name = font_name
            run.font.size = font_size
        elif part.startswith("$") and part.endswith("$"):
            run = paragraph.add_run(part[1:-1])
            run.font.italic = True
            run.font.name = font_name
            run.font.size = font_size
        else:
            run = paragraph.add_run(part)
            run.font.name = font_name
            run.font.size = font_size


def parse_table_row(row_str):
    """Parse a markdown table row into cells."""
    cells = [c.strip() for c in row_str.strip("|").split("|")]
    return cells


def add_table(doc, rows):
    """Add a formatted table to the document."""
    if not rows:
        return

    parsed_rows = [parse_table_row(r) for r in rows]
    if not parsed_rows:
        return

    num_cols = max(len(r) for r in parsed_rows)
    # Pad rows to have consistent column count
    for r in parsed_rows:
        while len(r) < num_cols:
            r.append("")

    table = doc.add_table(rows=len(parsed_rows), cols=num_cols)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = True

    for row_idx, row_data in enumerate(parsed_rows):
        for col_idx, cell_text in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            cell.text = ""  # Clear default
            p = cell.paragraphs[0]
            add_formatted_text(p, cell_text, font_size=Pt(9))

            # Set borders
            set_cell_borders(cell, color="AAAAAA", size="4")

            # Header row styling
            if row_idx == 0:
                set_cell_shading(cell, "2C3E50")
                for run in p.runs:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
                    run.font.size = Pt(9)
            else:
                # Alternating row colors
                if row_idx % 2 == 0:
                    set_cell_shading(cell, "F8F9FA")

    doc.add_paragraph()  # spacing after table


def add_code_block(doc, code_text, language=""):
    """Add a code block with monospace font and background shading."""
    # Add a light gray box for code
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.right_indent = Cm(0.5)

    # Language label if present
    if language and language not in ("text", "bnf", ""):
        run = p.add_run(f"[{language}]\n")
        run.font.name = FONT_CODE
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(100, 100, 100)
        run.font.italic = True

    # Code content
    run = p.add_run(code_text)
    run.font.name = FONT_CODE
    run.font.size = FONT_SIZE_CODE
    run.font.color.rgb = RGBColor(40, 40, 40)

    # Add background shading to the paragraph
    pPr = p._p.get_or_add_pPr()
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F4F4F4" w:val="clear"/>')
    pPr.append(shading)


def build_document(doc_config):
    """Build a complete Word document from a markdown source file."""
    md_path = os.path.join(DOCS_DIR, doc_config["md_file"])
    docx_path = os.path.join(DOCS_DIR, doc_config["docx_file"])

    print(f"\n{'='*60}")
    print(f"  Processing: {doc_config['md_file']}")
    print(f"  Output:     {doc_config['docx_file']}")
    print(f"{'='*60}")

    # Read markdown
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    # Parse
    blocks = parse_markdown(md_text)

    # Create document
    doc = Document()

    # Set default font
    style = doc.styles["Normal"]
    style.font.name = FONT_BODY
    style.font.size = FONT_SIZE_BODY

    # Configure heading styles
    for level in range(1, 5):
        style_name = f"Heading {level}"
        if style_name in doc.styles:
            h_style = doc.styles[style_name]
            h_style.font.name = FONT_HEADING
            h_style.font.color.rgb = RGBColor(44, 62, 80)
            if level == 1:
                h_style.font.size = Pt(20)
            elif level == 2:
                h_style.font.size = Pt(16)
            elif level == 3:
                h_style.font.size = Pt(13)
            else:
                h_style.font.size = Pt(11.5)

    # Set margins
    for section in doc.sections:
        section.top_margin = Cm(2.54)
        section.bottom_margin = Cm(2.54)
        section.left_margin = Cm(2.54)
        section.right_margin = Cm(2.54)

    # Build document structure
    add_cover_page(doc, doc_config["title"], doc_config["subtitle"])
    add_toc(doc)

    # Process content blocks
    first_heading = True
    for block in blocks:
        if block["type"] == "metadata":
            p = doc.add_paragraph()
            add_formatted_text(p, block["content"], font_size=Pt(10))
            p.paragraph_format.space_after = Pt(2)

        elif block["type"] == "heading":
            level = block["level"]
            # Skip the document's main title (level 1) — it's on the cover page
            if level == 1 and first_heading:
                first_heading = False
                continue
            first_heading = False

            heading = doc.add_heading(block["content"], level=min(level, 4))

        elif block["type"] == "paragraph":
            p = doc.add_paragraph()
            add_formatted_text(p, block["content"])
            p.paragraph_format.space_after = Pt(6)

        elif block["type"] == "code":
            add_code_block(doc, block["content"], block.get("language", ""))

        elif block["type"] == "table":
            add_table(doc, block["rows"])

    # Add page numbers
    add_page_number(doc)

    # Save
    try:
        doc.save(docx_path)
    except PermissionError:
        alt_path = docx_path.replace(".docx", "_updated.docx")
        print(f"  [!] Notice: {os.path.basename(docx_path)} is locked (likely open in Word).")
        print(f"  [!] Saving to alternative path: {os.path.basename(alt_path)}")
        doc.save(alt_path)
        docx_path = alt_path

    file_size = os.path.getsize(docx_path)
    print(f"  [OK] Generated: {docx_path}")
    print(f"  [OK] File size: {file_size:,} bytes")

    return docx_path


# ==============================================================================
# Main Entry Point
# ==============================================================================

def main():
    target_filter = sys.argv[1].lower() if len(sys.argv) > 1 else None

    print("\n" + "=" * 60)
    print("  MILESTONE DOCUMENT GENERATOR")
    print(f"  Output directory: {os.path.abspath(DOCS_DIR)}")
    if target_filter:
        print(f"  Target filter: {target_filter}")
    else:
        print(f"  Generating {len(DOCUMENTS)} Word documents from Markdown sources")
    print("=" * 60)

    docs_to_process = [
        d for d in DOCUMENTS
        if not target_filter or target_filter in d["md_file"].lower() or target_filter in d["docx_file"].lower()
    ]

    generated = []
    for doc_config in docs_to_process:
        md_path = os.path.join(DOCS_DIR, doc_config["md_file"])
        if not os.path.exists(md_path):
            print(f"\n  [X] ERROR: Source file not found: {md_path}")
            continue
        try:
            path = build_document(doc_config)
            generated.append(path)
        except Exception as e:
            print(f"\n  [X] ERROR processing {doc_config['md_file']}: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n{'='*60}")
    print(f"  SUMMARY: {len(generated)}/{len(docs_to_process)} documents generated successfully")
    for path in generated:
        print(f"  -> {os.path.basename(path)}")
    print(f"{'='*60}\n")

    return 0 if len(generated) == len(docs_to_process) else 1


if __name__ == "__main__":
    sys.exit(main())
