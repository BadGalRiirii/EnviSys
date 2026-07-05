"""Digital defense certificate — a PDF mirror of the paper form, generated
once instead of manually retyped, and emailed to everyone involved so
printing is optional (only needed if the department requires a physical
signed copy for filing)."""
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_certificate_pdf(schedule) -> bytes:
    group = schedule.group
    result = schedule.result
    styles = getSampleStyleSheet()
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, title="EnviSys Defense Certificate")
    story = []

    story.append(Paragraph("EnviSys — Defense Certificate", styles["Title"]))
    story.append(Paragraph(
        f"{schedule.get_stage_display()} Defense — {group.name}", styles["Heading2"]
    ))
    story.append(Spacer(1, 0.15 * inch))

    details = [
        ["Thesis title", group.thesis_title or "—"],
        ["Date / Time", f"{schedule.date} at {schedule.time.strftime('%H:%M')}"],
        ["Duration", f"{schedule.duration_minutes} minutes"],
        ["Location", schedule.location],
        ["Adviser", group.adviser.get_full_name() if group.adviser else "—"],
        ["Members", ", ".join(m.student.get_full_name() for m in group.members.all())],
    ]
    story.append(_table(details))
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph("Panel Evaluations", styles["Heading3"]))
    panel_rows = [["Panelist", "Verdict", "Comments"]]
    for evaluation in schedule.evaluations.select_related("evaluator").all():
        panel_rows.append([
            evaluation.evaluator.get_full_name(),
            evaluation.get_verdict_display(),
            evaluation.comments or "—",
        ])
    if len(panel_rows) == 1:
        panel_rows.append(["—", "—", "—"])
    story.append(_table(panel_rows, header=True))
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph("Final Result", styles["Heading3"]))
    story.append(_table([
        ["Verdict", result.get_verdict_display()],
        ["Remarks", result.remarks or "—"],
        ["Recorded by", result.recorded_by.get_full_name() if result.recorded_by else "—"],
        ["Recorded on", result.created_at.strftime("%Y-%m-%d %H:%M")],
    ]))
    story.append(Spacer(1, 0.4 * inch))

    story.append(Paragraph(
        "Signatures (for physical filing, if required)", styles["Heading3"]
    ))
    story.append(Spacer(1, 0.3 * inch))
    signature_lines = ["Adviser"] + [
        assignment.faculty.get_full_name()
        for assignment in group.panel_assignments.filter(status="APPROVED")
    ] + ["Chairperson"]
    for label in signature_lines:
        story.append(Paragraph("_" * 40, styles["Normal"]))
        story.append(Paragraph(label, styles["Normal"]))
        story.append(Spacer(1, 0.25 * inch))

    doc.build(story)
    return buffer.getvalue()


def _table(rows, header=False):
    style = [
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke))
        style.append(("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"))
    else:
        style.append(("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"))
    return Table(rows, colWidths=None, style=TableStyle(style), hAlign="LEFT")
