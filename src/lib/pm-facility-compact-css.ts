/**
 * Print CSS for the facility batch only. Injected by that page so the
 * single-work-order report and the list summary keep the 0.6in page.
 */
export const PM_FACILITY_COMPACT_CSS = `
@page pm-facility-compact {
  size: letter;
  margin: 0.4in;
}

.pm-compact-sheet {
  position: relative;
  box-sizing: border-box;
  margin: 0 auto 1.25rem;
  max-width: 7.7in;
  padding: 0.7rem 0.85rem 0.55in;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 9pt;
  line-height: 1.25;
}

.pm-compact-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  margin-bottom: 0.28rem;
  padding-bottom: 0.18rem;
  border-bottom: 1.5pt solid #1c4587;
}

.pm-compact-banner img {
  height: 0.32in;
  width: auto;
  max-width: 1.35in;
  object-fit: contain;
}

.pm-compact-kicker {
  margin: 0;
  color: #1c4587;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pm-compact-title {
  margin: 0;
  font-size: 11pt;
  font-weight: 700;
  line-height: 1.15;
}

.pm-compact-org {
  margin: 0;
  color: #475569;
  font-size: 8pt;
}

.pm-compact-meta,
.pm-compact-steps,
.pm-compact-reopen {
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  line-height: 1.15;
}

.pm-compact-meta {
  margin: 0 0 0.28rem;
}

.pm-compact-meta th,
.pm-compact-meta td,
.pm-compact-steps th,
.pm-compact-steps td,
.pm-compact-reopen th,
.pm-compact-reopen td {
  padding: 1px 4px;
  vertical-align: top;
  text-align: left;
}

.pm-compact-meta th {
  width: 0.82in;
  color: #64748b;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.pm-compact-meta td {
  font-weight: 600;
}

.pm-compact-section {
  margin: 0.22rem 0 0.08rem;
  color: #334155;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.pm-compact-steps th,
.pm-compact-reopen th {
  border-bottom: 0.75pt solid #94a3b8;
  color: #475569;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pm-compact-steps td,
.pm-compact-reopen td {
  border-bottom: 0.4pt solid #e2e8f0;
}

.pm-compact-steps .num {
  width: 0.28in;
  color: #64748b;
  text-align: right;
}

.pm-compact-steps .result {
  width: 0.48in;
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}

.pm-compact-steps .reading {
  width: 1.35in;
  white-space: nowrap;
}

.pm-compact-note {
  margin: 0.12rem 0 0;
  font-size: 9pt;
  line-height: 1.25;
}

.pm-compact-note strong {
  color: #475569;
  font-size: 7.5pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pm-compact-signs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
  margin-top: 0.35rem;
}

.pm-compact-signs div {
  border-bottom: 0.6pt solid #64748b;
  padding-top: 0.28in;
  color: #64748b;
  font-size: 7pt;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pm-compact-watermark {
  position: absolute;
  right: 0;
  bottom: 0.02in;
  left: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  opacity: 0.22;
}

.pm-compact-watermark img {
  height: 0.38in;
  width: auto;
  max-width: 1.5in;
  object-fit: contain;
}

@media print {
  html,
  body,
  main,
  main > div,
  .pm-compact-packet,
  .pm-compact-sheet {
    page: pm-facility-compact;
  }

  .pm-compact-sheet {
    width: 7.7in;
    height: 10.2in;
    max-height: 10.2in;
    margin: 0 !important;
    padding: 0 0 0.46in;
    overflow: hidden;
    border: none !important;
    border-radius: 0;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .pm-compact-sheet:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .pm-compact-watermark {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
