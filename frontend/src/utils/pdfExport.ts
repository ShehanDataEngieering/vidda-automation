import type { PipelinePlan, TrainingPlan } from '../types-v6';

/**
 * Minimal HTML escape to prevent malformed PDF when AI content contains `<`, `&`, etc.
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate an audit-ready HTML string for printing/PDF export
 * Uses @media print CSS for clean output
 */
export function generateAuditHtml(plan: PipelinePlan): string {
  const trainingPlan = plan.training_plan as TrainingPlan | null;
  const roleProfile = plan.role_profile;
  const riskMatrix = plan.risk_matrix;
  const amlrMappings = plan.amlr_mappings;

  const now = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const modulesHtml = trainingPlan
    ? trainingPlan.quarters
        .map(
          (q) => `
    <div class="quarter">
      <h3>${escapeHtml(q.quarter)} — ${escapeHtml(q.name)} (${escapeHtml(q.months)})</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Module</th>
            <th style="width: 8%;">Hours</th>
            <th style="width: 15%;">Risk</th>
            <th style="width: 12%;">Article</th>
            <th style="width: 35%;">Why Included</th>
          </tr>
        </thead>
        <tbody>
          ${q.modules
            .map(
              (m, i) => `
          <tr>
            <td><strong>${i + 1}.</strong> ${escapeHtml(m.module_name)}</td>
            <td>${m.duration_hours}h</td>
            <td>${escapeHtml(m.risk_dimension)}</td>
            <td>${escapeHtml(m.amlr_article)}</td>
            <td class="justification">${escapeHtml(m.why_included)}</td>
          </tr>
          `
            )
            .join('')}
          ${q.modules.length === 0 ? '<tr><td colspan="5" class="empty">No modules in this quarter.</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `
        )
        .join('')
    : '<p class="no-data">Training plan not generated.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AMLR Training Plan — Audit Report</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .page-break { page-break-before: always; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      border-bottom: 3px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }
    .header .meta {
      color: #64748b;
      font-size: 13px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .field {
      margin-bottom: 12px;
    }
    .field-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 14px;
      color: #1e293b;
    }
    .risk-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 13px;
    }
    .risk-table th, .risk-table td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .risk-table th {
      background: #f8fafc;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .score-critical { color: #dc2626; font-weight: 700; }
    .score-high { color: #ea580c; font-weight: 700; }
    .score-medium { color: #d97706; font-weight: 700; }
    .score-low { color: #059669; font-weight: 700; }
    .quarter {
      margin-bottom: 24px;
    }
    .quarter h3 {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #f1f5f9;
      border-radius: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      text-align: left;
      padding: 10px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    tr:nth-child(even) { background: #fafafa; }
    .justification { font-style: italic; color: #334155; }
    .empty { color: #94a3b8; text-align: center; padding: 20px; }
    .no-data { color: #94a3b8; font-style: italic; padding: 20px; text-align: center; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #0f172a;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #0f172a;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .print-btn:hover { background: #1e293b; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

    <div class="header">
    <h1>AMLR Training Plan — Audit Report</h1>
    <div class="meta">
      Role: ${escapeHtml(plan.role_title || 'Untitled')} &nbsp;|&nbsp;
      Plan ID: ${plan.id} &nbsp;|&nbsp;
      Version: ${plan.version} &nbsp;|&nbsp;
      Generated: ${now} &nbsp;|&nbsp;
      Status: ${plan.status === 'approved' ? 'APPROVED' : 'DRAFT'}
      ${plan.reviewer ? `&nbsp;|&nbsp; Reviewer: ${escapeHtml(plan.reviewer)}` : ''}
    </div>
  </div>

  <!-- Page 1: Role Profile + Risk Matrix -->
  <div class="section">
    <h2>Role Profile</h2>
    <div class="grid-2">
      <div class="field">
        <div class="field-label">Role Title</div>
        <div class="field-value">${escapeHtml(roleProfile?.role_title || plan.role_title || '—')}</div>
      </div>
      <div class="field">
        <div class="field-label">Line of Defence</div>
        <div class="field-value">${escapeHtml(roleProfile?.line_of_defence || plan.line_of_defence || '—')}</div>
      </div>
      <div class="field">
        <div class="field-label">Classification</div>
        <div class="field-value">${escapeHtml(roleProfile?.classified_as || '—')} (${Math.round((roleProfile?.classification_confidence || 0) * 100)}% confidence)</div>
      </div>
      <div class="field">
        <div class="field-label">Archetype Match</div>
        <div class="field-value">${roleProfile?.classified_as ? 'Yes — deterministic fallback available' : 'No archetype match'}</div>
      </div>
    </div>
    <div class="field" style="margin-top: 16px;">
      <div class="field-label">Daily Activities</div>
      <div class="field-value">${escapeHtml(roleProfile?.daily_activities || '—')}</div>
    </div>
    <div class="field">
      <div class="field-label">Key Decisions</div>
      <div class="field-value">${escapeHtml(roleProfile?.key_decisions || '—')}</div>
    </div>
    <div class="field">
      <div class="field-label">Consequences of Mistakes</div>
      <div class="field-value">${escapeHtml(roleProfile?.mistake_consequences || '—')}</div>
    </div>
  </div>

  <div class="section">
    <h2>Risk Assessment Matrix</h2>
    <table class="risk-table">
      <thead>
        <tr><th>Risk Dimension</th><th>Score</th><th>Justification</th></tr>
      </thead>
      <tbody>
        ${riskMatrix?.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.dimension)}</strong></td>
            <td class="score-${escapeHtml(r.score.toLowerCase())}">${escapeHtml(r.score)}</td>
            <td>${escapeHtml(r.justification)}</td>
          </tr>
        `).join('') || '<tr><td colspan="3" class="empty">No risk assessment completed.</td></tr>'}
      </tbody>
    </table>
    ${plan.quality_score ? `
    <div style="margin-top: 16px; padding: 12px; background: #f0f9ff; border-radius: 6px; border-left: 3px solid #0284c7;">
      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #0369a1;">Quality Score: ${plan.quality_score}/100</p>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Automated assessment of coverage, consistency, citation depth and coherence.</p>
    </div>
    ` : ''}
  </div>

  <div class="page-break"></div>

  <!-- Page 2: AMLR Mappings -->
  <div class="section">
    <h2>AMLR 2024/1624 Article Mappings</h2>
    ${amlrMappings?.map(m => `
    <div style="margin-bottom: 16px; padding: 16px; background: #fafafa; border-radius: 8px; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px; color: #0f172a;">${escapeHtml(m.article)} — ${escapeHtml(m.article_name)}</p>
      <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Applies because:</strong> ${escapeHtml(m.applies_because)}</p>
      <p style="margin: 0; font-size: 12px; color: #374151;"><strong>Training obligation:</strong> ${escapeHtml(m.training_obligation)}</p>
    </div>
    `).join('') || '<p class="no-data">No AMLR mappings completed.</p>'}
  </div>

  <div class="page-break"></div>

  <!-- Page 3+: Training Plan -->
  <div class="section">
    <h2>Training Plan</h2>
    <p style="font-size: 13px; color: #475569; margin-bottom: 20px; font-style: italic;">
      ${escapeHtml(trainingPlan?.training_philosophy || '')}
    </p>
    ${modulesHtml}
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Generated by Vidda Automation — Audit-ready AMLR compliance training</span>
    <span>This document is part of the regulatory audit trail. Plan ID: ${plan.id}</span>
  </div>
</body>
</html>`;
}

/**
 * Trigger browser print dialog with audit report
 */
export function printAuditReport(plan: PipelinePlan) {
  const html = generateAuditHtml(plan);
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow popups to print the audit report');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Auto-print after a brief delay for styles to apply
  setTimeout(() => printWindow.print(), 500);
}
