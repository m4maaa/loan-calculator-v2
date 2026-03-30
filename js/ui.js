import { APP_CONFIG } from '../data/config.js';
import { SALARY_LEVEL_OPTIONS, getSalaryStepsByLevel } from '../data/salary.js';
import { currency, escapeHtml, formatCurrencyText, nowThai } from './utils.js';

export function populateStaticOptions(elements) {
  elements.rank.innerHTML = APP_CONFIG.rankOptions
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join('');

  elements.loanMode.innerHTML = APP_CONFIG.loanModes
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join('');

  elements.loanReason.innerHTML = APP_CONFIG.loanReasons
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join('');

  elements.salaryLevel.innerHTML = SALARY_LEVEL_OPTIONS
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join('');

  elements.termMonths.innerHTML = APP_CONFIG.terms
    .map((term) => `<option value="${term}">${term}</option>`)
    .join('');
}

export function renderSalaryLevelOptions(select, allowedLevels = []) {
  const filtered = SALARY_LEVEL_OPTIONS.filter((item) => allowedLevels.includes(item.value));
  select.innerHTML = filtered.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
}

export function renderSalaryStepOptions(select, levelCode, preferredValue = '') {
  const steps = getSalaryStepsByLevel(levelCode);
  select.innerHTML = steps
    .map((step) => `<option value="${escapeHtml(step)}">${escapeHtml(step)}</option>`)
    .join('');

  if (preferredValue && steps.includes(String(preferredValue))) {
    select.value = String(preferredValue);
    return;
  }

  select.value = steps[0] ?? '';
}

export function renderGuarantorFields(container, banner, count, description, existing = []) {
  banner.textContent = description;
  if (count === 0) {
    container.innerHTML = '<div class="small-muted">กรณีนี้ไม่ต้องใช้ผู้ค้ำประกัน</div>';
    return;
  }

  container.innerHTML = Array.from({ length: count }, (_, index) => {
    const current = existing[index] ?? {};
    return `
      <section class="guarantor-card">
        <h4>ผู้ค้ำคนที่ ${index + 1}</h4>
        <div class="guarantor-meta guarantor-meta-3">
          <label class="field">
            <span>ชื่อผู้ค้ำ</span>
            <input data-guarantor-index="${index}" data-field="name" type="text" value="${escapeHtml(current.name ?? '')}" placeholder="ชื่อ-สกุลผู้ค้ำ" />
          </label>
          <label class="field">
            <span>สังกัด</span>
            <input data-guarantor-index="${index}" data-field="unit" type="text" value="${escapeHtml(current.unit ?? '')}" placeholder="สังกัดของผู้ค้ำ" />
          </label>
          <label class="field checkbox-field guarantor-checkbox">
            <span>รายได้ผู้ค้ำผ่านเกณฑ์ 1 ใน 3</span>
            <input data-guarantor-index="${index}" data-field="incomePass" type="checkbox" ${current.incomePass ? 'checked' : ''} />
          </label>
        </div>
      </section>
    `;
  }).join('');
}

export function renderPreview(elements, metrics) {
  elements.totalIncomePreview.textContent = formatCurrencyText(metrics.totalIncome);
  elements.oneThirdPreview.textContent = formatCurrencyText(metrics.oneThird);
  elements.recommendedMaxPreview.textContent = formatCurrencyText(metrics.recommendedMaxPrincipal);
  elements.monthlyInstallment.value = formatCurrencyText(metrics.autoInstallment);
  elements.requestedAmount.value = currency(metrics.requestedAmount);
}

export function renderResult(elements, evaluation) {
  const badgeText = evaluation.decision === 'pass' ? 'ผ่านเกณฑ์' : evaluation.decision === 'warn' ? 'ควรปรับ' : 'ไม่ผ่านเกณฑ์';
  elements.resultSummary.className = `result-summary ${evaluation.decision}`;
  elements.resultSummary.innerHTML = `
    <div class="badge ${evaluation.decision}">${badgeText}</div>
    <h3>${evaluation.decisionTitle}</h3>
    <p>${evaluation.decisionMessage}</p>
  `;

  elements.postLoanBalanceValue.textContent = formatCurrencyText(evaluation.metrics.postLoanBalance);
  elements.effectiveInstallmentValue.textContent = formatCurrencyText(evaluation.metrics.effectiveInstallment);
  elements.requiredGuarantorValue.textContent = `${evaluation.metrics.guarantorRule.count} คน`;
  elements.scoreValue.textContent = `${evaluation.score} / 100`;

  elements.ruleChecklist.innerHTML = evaluation.rules
    .map((rule) => `
      <article class="rule-item ${rule.pass ? 'pass' : 'fail'}">
        <div class="rule-status">${rule.pass ? '✓' : '!'}</div>
        <div class="rule-detail">
          <strong>${rule.title}</strong>
          <span>${rule.detail}</span>
        </div>
      </article>
    `)
    .join('');

  elements.adviceList.innerHTML = evaluation.advice.map((item) => `<li>${item}</li>`).join('');
}

export function renderScenarioTable(tbody, rows, selectedTerm) {
  tbody.innerHTML = rows
    .map((row) => `
      <tr class="${row.term === selectedTerm ? 'highlight-row' : ''}">
        <td>${row.term}</td>
        <td>${formatCurrencyText(row.installment)}</td>
        <td>${formatCurrencyText(row.postLoanBalance)}</td>
        <td>${row.decision === 'pass' ? 'ผ่าน' : row.decision === 'warn' ? 'ควรปรับ' : 'ไม่ผ่าน'}</td>
      </tr>
    `)
    .join('');
}

export function buildHistoryEntry(formData, evaluation) {
  return {
    timestamp: nowThai(),
    borrowerName: formData.borrowerName || 'ไม่ระบุชื่อ',
    rank: formData.rank,
    unit: formData.unit,
    requestedAmount: evaluation.metrics.requestedAmount,
    postLoanBalance: evaluation.metrics.postLoanBalance,
    decision: evaluation.decision,
    score: evaluation.score,
  };
}

export function renderHistory(container, items = []) {
  if (!items.length) {
    container.innerHTML = '<div class="small-muted">ยังไม่มีประวัติการคำนวณในเครื่องนี้</div>';
    return;
  }

  container.innerHTML = items
    .map((item) => `
      <article class="history-item">
        <header>
          <div>
            <h4>${escapeHtml(item.borrowerName)}</h4>
            <p>${escapeHtml(item.rank)} · ${escapeHtml(item.unit || 'ไม่ระบุสังกัด')}</p>
          </div>
          <div class="badge ${item.decision}">${item.decision === 'pass' ? 'ผ่าน' : item.decision === 'warn' ? 'ควรปรับ' : 'ไม่ผ่าน'}</div>
        </header>
        <p>วงเงินคำนวณ: ${formatCurrencyText(item.requestedAmount)} · เหลือรับหลังกู้: ${formatCurrencyText(item.postLoanBalance)} · คะแนน ${item.score}/100</p>
        <p>คำนวณเมื่อ ${item.timestamp}</p>
      </article>
    `)
    .join('');
}
