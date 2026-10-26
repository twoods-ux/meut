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
  display: flex;
  flex-direction: column;
  margin: 0 auto 1.25rem;
  width: 7.7in;
  max-width: 100%;
  min-height: 10.2in;
  padding: 0.16in 0 0.5in;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 9pt;
  line-height: 1.3;
}

.pm-compact-scale {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.14in;
  min-height: 100%;
  box-sizing: border-box;
}

.pm-compact-top,
.pm-compact-mid,
.pm-compact-foot {
  width: 100%;
}

.pm-compact-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.16in;
  margin: 0 0 0.1in;
  padding-bottom: 0.08in;
  border-bottom: 1.5pt solid #1c4587;
}

.pm-compact-brand {
  display: flex;
  align-items: center;
  gap: 0.12in;
  min-width: 0;
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
  text-align: right;
}

.pm-compact-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
  border-top: 0.6pt solid #e2e8f0;
  border-left: 0.6pt solid #e2e8f0;
}

.pm-compact-grid div {
  min-width: 0;
  padding: 0.05in 0.08in;
  border-right: 0.6pt solid #e2e8f0;
  border-bottom: 0.6pt solid #e2e8f0;
}

.pm-compact-grid span {
  display: block;
  margin: 0 0 0.01in;
  color: #64748b;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.2;
  text-transform: uppercase;
}

.pm-compact-grid strong {
  display: block;
  font-size: 8pt;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.pm-compact-section {
  margin: 0 0 0.05in;
  padding-bottom: 0.03in;
  border-bottom: 0.75pt solid #94a3b8;
  color: #334155;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.2;
  text-transform: uppercase;
}

.pm-compact-foot .pm-compact-section {
  margin-top: 0.1in;
}

.pm-compact-foot .pm-compact-section:first-child {
  margin-top: 0;
}

.pm-compact-steps,
.pm-compact-reopen {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 8pt;
  line-height: 1.25;
}

.pm-compact-steps th,
.pm-compact-steps td,
.pm-compact-reopen th,
.pm-compact-reopen td {
  padding: 0.035in 0.06in;
  vertical-align: top;
  text-align: left;
  overflow-wrap: anywhere;
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
  width: 0.38in;
  color: #64748b;
  text-align: right;
}

.pm-compact-steps .result {
  width: 0.72in;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
}

.pm-compact-steps .reading {
  width: 1.45in;
}

.pm-compact-reopen .when {
  width: 1.85in;
}

.pm-compact-reopen .who {
  width: 1.45in;
}

.pm-compact-note {
  margin: 0.04in 0 0;
  font-size: 9pt;
  line-height: 1.3;
}

.pm-compact-note span {
  display: inline-block;
  min-width: 1.15in;
  color: #64748b;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pm-compact-signs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.28in;
  margin-top: 0.02in;
}

.pm-compact-signs div {
  position: relative;
  border-bottom: 0.6pt solid #64748b;
  padding-top: 0.28in;
  color: #64748b;
  font-size: 7pt;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pm-compact-sign-fill {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  height: 0.28in;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.12in;
  padding-bottom: 1px;
  color: #0f172a;
  font-size: 8pt;
  font-weight: 600;
  letter-spacing: normal;
  line-height: 1.1;
  text-transform: none;
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
    min-height: 0;
    margin: 0 !important;
    padding: 0 0 0.48in;
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
