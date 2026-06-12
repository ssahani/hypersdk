#!/usr/bin/env python3
# Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
"""Generate branded PDFs from Machina markdown guides (feature release docs)."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    from fpdf import FPDF
    from fpdf.enums import XPos, YPos
except ImportError as exc:
    print(f"ERROR: fpdf2 required: {exc}", file=sys.stderr)
    sys.exit(1)

ORANGE = (249, 115, 22)
SLATE_950 = (15, 23, 42)
SLATE_800 = (30, 41, 59)
SLATE_400 = (148, 163, 184)
OFF_WHITE = (248, 250, 252)

FEATURE_GUIDES: tuple[tuple[str, str, str], ...] = (
    ("07-platform-vm-detail-ux", "docs/guides/platform-vm-detail-ux.md", "Platform VM Detail UX"),
    ("08-vm-daily-access-connect-hub", "docs/guides/vm-daily-access.md", "VM Daily Access & Connect Hub"),
    ("09-platform-feature-qa-matrix", "docs/guides/platform-feature-qa.md", "Platform Feature QA Matrix"),
    ("10-machina-cinema-mode", "docs/machina-cinema-mode.md", "Machina Cinema Mode"),
)


def _safe(text: str) -> str:
    return text.encode("latin-1", "replace").decode("latin-1")


class BrandedPDF(FPDF):
    product: str = "Machina"
    doc_title: str = ""
    logo_path: Path | None = None

    def header(self) -> None:
        self.set_fill_color(*SLATE_950)
        self.rect(0, 0, self.w, 28, style="F")
        self.set_fill_color(*ORANGE)
        self.rect(0, 28, self.w, 1.2, style="F")
        if self.logo_path and self.logo_path.is_file():
            self.image(str(self.logo_path), x=self.l_margin, y=5, h=18)
        self.set_xy(self.l_margin + 44, 8)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*ORANGE)
        self.cell(0, 6, _safe(self.product), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        if self.doc_title:
            self.set_x(self.l_margin + 44)
            self.set_font("Helvetica", "", 9)
            self.set_text_color(*SLATE_400)
            self.cell(0, 5, _safe(self.doc_title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_y(34)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_fill_color(*SLATE_950)
        self.rect(0, self.h - 14, self.w, 14, style="F")
        self.set_y(-11)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*SLATE_400)
        self.cell(
            0,
            6,
            _safe(f"Zyvor · zyvor.dev · Machina · © 2026 · page {self.page_no()}"),
            align="C",
        )


def find_logo(root: Path) -> Path | None:
    for rel in (
        "web/public/zyvor-logo.png",
        "scripts/zyvor-branding/zyvor-logo.png",
        "web/zyvor-logo.png",
    ):
        p = root / rel
        if p.is_file():
            return p
    return None


def md_to_lines(text: str) -> list[str]:
    out: list[str] = []
    in_code = False
    for raw in text.splitlines():
        line = raw.rstrip()
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            out.append(f"    {line}")
            continue
        if line.startswith("# "):
            out.append("")
            out.append(line[2:].strip().upper())
            out.append("=" * min(len(line) - 2, 40))
            continue
        if line.startswith("## "):
            out.append("")
            out.append(line[3:].strip())
            out.append("-" * min(len(line) - 3, 40))
            continue
        if line.startswith("### "):
            out.append("")
            out.append(f"{line[4:].strip()}:")
            continue
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cells):
                continue
            out.append("  · ".join(c for c in cells if c))
            continue
        line = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
        line = line.replace("`", "")
        out.append(line)
    return out


def render_line(pdf: BrandedPDF, line: str) -> None:
    pdf.set_x(pdf.l_margin)
    text = line.rstrip()
    if not text.strip():
        pdf.ln(2.5)
        return
    stripped = text.strip()
    nxt_rule = len(stripped) > 0 and len(set(stripped)) == 1 and stripped[0] in "=-"
    if nxt_rule:
        return
    prev = stripped
    if prev.isupper() and len(prev) < 72:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*ORANGE)
        pdf.multi_cell(pdf.epw, 6, _safe(stripped))
        return
    if stripped.endswith(":") and len(stripped) < 64:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*SLATE_800)
        pdf.multi_cell(pdf.epw, 5.5, _safe(stripped))
        return
    if stripped.startswith("- ") or stripped.startswith("* "):
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(40, 48, 60)
        pdf.multi_cell(pdf.epw, 4.8, _safe(stripped))
        return
    if text.startswith("    ") or stripped.startswith("./") or stripped.startswith("npm "):
        pdf.set_font("Courier", "", 8.5)
        pdf.set_fill_color(*OFF_WHITE)
        pdf.set_text_color(30, 64, 110)
        pdf.multi_cell(pdf.epw, 5, _safe(stripped), fill=True)
        pdf.ln(0.5)
        return
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(40, 48, 60)
    pdf.multi_cell(pdf.epw, 4.8, _safe(stripped))


def md_to_pdf(md_path: Path, pdf_path: Path, logo: Path | None, title: str) -> None:
    body = md_to_lines(md_path.read_text(encoding="utf-8", errors="replace"))
    pdf = BrandedPDF(format="Letter", unit="mm")
    pdf.product = "Machina"
    pdf.doc_title = title
    pdf.logo_path = logo
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(18, 36, 18)
    pdf.add_page()
    for line in body:
        render_line(pdf, line)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(pdf_path))


def write_index(out_dir: Path, names: list[str]) -> None:
    lines = [
        "Machina — feature guide PDFs",
        "═" * 40,
        "",
        "Generated from docs/guides/*.md and docs/machina-cinema-mode.md",
        "",
    ]
    for name in names:
        lines.append(f"  {name}")
    lines.extend(["", "  zyvor.dev · HyperSDK · © 2026", ""])
    (out_dir / "PDF_INDEX.txt").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Machina feature guide PDFs")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    root: Path = args.root
    out_dir = args.out or (root / "docs" / "guides" / "pdf")
    logo = find_logo(root)
    made: list[str] = []
    for stem, rel, title in FEATURE_GUIDES:
        md = root / rel
        if not md.is_file():
            print(f"  skip: missing {rel}", file=sys.stderr)
            continue
        pdf_name = f"{stem}.pdf"
        md_to_pdf(md, out_dir / pdf_name, logo, title)
        made.append(pdf_name)
        print(f"  pdf: docs/guides/pdf/{pdf_name}")
    if not made:
        print("ERROR: no guides converted", file=sys.stderr)
        return 1
    write_index(out_dir, made)
    print(f"  index: docs/guides/pdf/PDF_INDEX.txt ({len(made)} PDFs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
