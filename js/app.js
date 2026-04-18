import { APP_CONFIG } from '../data/config.js';
import { getSalaryByLevelAndStep, getSalaryStepsByLevel } from '../data/salary.js';
import { buildScenarioTable, calculateCoreMetrics, evaluateLoan, getAllowedSalaryLevelsByRank, getRequiredGuarantorInfo } from './calculator.js';
import { buildHistoryEntry, populateStaticOptions, renderGuarantorFields, renderHistory, renderPreview, renderResult, renderSalaryLevelOptions, renderSalaryStepOptions, renderScenarioTable } from './ui.js';
import { currency, formatCurrencyText, toNumber } from './utils.js';

const elements = {
  loanForm: document.querySelector('#loanForm'),
  rank: document.querySelector('#rank'),
  borrowerName: document.querySelector('#borrowerName'),
  unit: document.querySelector('#unit'),
  salaryLevel: document.querySelector('#salaryLevel'),
  salaryStep: document.querySelector('#salaryStep'),
  salaryAmount: document.querySelector('#salaryAmount'),
  totalIncome: document.querySelector('#totalIncome'),
  totalDeductions: document.querySelector('#totalDeductions'),
  totalIncomePreview: document.querySelector('#totalIncomePreview'),
  oneThirdPreview: document.querySelector('#oneThirdPreview'),
  recommendedMaxPreview: document.querySelector('#recommendedMaxPreview'),
  loanMode: document.querySelector('#loanMode'),
  loanReason: document.querySelector('#loanReason'),
  isRefinance: document.querySelector('#isRefinance'),
  depositAmount: document.querySelector('#depositAmount'),
  overDepositAmount: document.querySelector('#overDepositAmount'),
  existingAtbInstallment: document.querySelector('#existingAtbInstallment'),
  requestedAmount: document.querySelector('#requestedAmount'),
  termMonths: document.querySelector('#termMonths'),
  monthlyInstallment: document.querySelector('#monthlyInstallment'),
  guarantorBanner: document.querySelector('#guarantorBanner'),
  guarantorContainer: document.querySelector('#guarantorContainer'),
  resetBtn: document.querySelector('#resetBtn'),
  loadDemoBtn: document.querySelector('#loadDemoBtn'),
  printBtn: document.querySelector('#printBtn'),
  savePdfBtn: document.querySelector('#savePdfBtn'),
  resultSummary: document.querySelector('#resultSummary'),
  postLoanBalanceValue: document.querySelector('#postLoanBalanceValue'),
  effectiveInstallmentValue: document.querySelector('#effectiveInstallmentValue'),
  requiredGuarantorValue: document.querySelector('#requiredGuarantorValue'),
  scoreValue: document.querySelector('#scoreValue'),
  ruleChecklist: document.querySelector('#ruleChecklist'),
  adviceList: document.querySelector('#adviceList'),
  scenarioTableBody: document.querySelector('#scenarioTableBody'),
  historyList: document.querySelector('#historyList'),
  clearHistoryBtn: document.querySelector('#clearHistoryBtn'),
};

let guarantorState = [];
let currentEvaluation = null;

function exportPdf() {
  const target = document.querySelector('.app-shell');
  if (!target || typeof window.html2pdf === 'undefined') {
    window.alert('ไม่สามารถสร้าง PDF ได้ในขณะนี้');
    return;
  }

  const previousScrollX = window.scrollX;
  const previousScrollY = window.scrollY;
  document.body.classList.add('pdf-export-mode');

  const opt = {
    margin: [5, 5, 5, 5],
    filename: `loan-calculator-a4-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff',
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
    },
  };

  window.html2pdf()
    .set(opt)
    .from(target)
    .save()
    .finally(() => {
      document.body.classList.remove('pdf-export-mode');
      window.scrollTo(previousScrollX, previousScrollY);
    });
}

function formatMoneyInputValue(rawValue) {
  const value = toNumber(rawValue);
  return currency(value, 1);
}

function bindMoneyInput(input) {
  if (!input) return;

  input.addEventListener('focus', () => {
    const value = toNumber(input.value);
    input.value = value ? String(value) : '';
  });

  input.addEventListener('blur', () => {
    input.value = formatMoneyInputValue(input.value);
  });
}

function initMoneyInputs() {
  [
    elements.totalIncome,
    elements.totalDeductions,
    elements.depositAmount,
    elements.overDepositAmount,
    elements.existingAtbInstallment,
  ].forEach(bindMoneyInput);
}

function getFormData() {
  return {
    rank: elements.rank.value,
    borrowerName: elements.borrowerName.value.trim(),
    unit: elements.unit.value.trim(),
    salaryLevel: elements.salaryLevel.value,
    salaryStep: elements.salaryStep.value,
    salaryAmount: toNumber(elements.salaryAmount.dataset.value),
    totalIncome: toNumber(elements.totalIncome.value),
    totalDeductions: toNumber(elements.totalDeductions.value),
    loanMode: elements.loanMode.value,
    loanReason: elements.loanReason.value,
    isRefinance: elements.isRefinance.checked,
    depositAmount: toNumber(elements.depositAmount.value),
    overDepositAmount: toNumber(elements.overDepositAmount.value),
    existingAtbInstallment: toNumber(elements.existingAtbInstallment.value),
    termMonths: toNumber(elements.termMonths.value),
    guarantors: guarantorState,
  };
}

function syncSalaryStepByLevel(preferredStep = '') {
  renderSalaryStepOptions(elements.salaryStep, elements.salaryLevel.value, preferredStep);
}

function syncSalaryLevelByRank(preferredLevel = '', preferredStep = '') {
  const allowedLevels = getAllowedSalaryLevelsByRank(elements.rank.value);
  renderSalaryLevelOptions(elements.salaryLevel, allowedLevels);

  if (preferredLevel && allowedLevels.includes(preferredLevel)) {
    elements.salaryLevel.value = preferredLevel;
  } else if (!allowedLevels.includes(elements.salaryLevel.value)) {
    elements.salaryLevel.value = allowedLevels[0] ?? '';
  }

  syncSalaryStepByLevel(preferredStep);
}

function setAutoSalary() {
  const salary = getSalaryByLevelAndStep(elements.salaryLevel.value, elements.salaryStep.value);
  elements.salaryAmount.dataset.value = String(salary ?? 0);
  elements.salaryAmount.value = salary ? formatCurrencyText(salary) : 'ไม่พบข้อมูล';
}

function updateRequestedAmountAndPreview() {
  const metrics = calculateCoreMetrics(getFormData());
  renderPreview(elements, metrics);
}

function syncGuarantorFields() {
  const rule = getRequiredGuarantorInfo({
    loanMode: elements.loanMode.value,
    overDepositAmount: toNumber(elements.overDepositAmount.value),
  });

  guarantorState = Array.from({ length: rule.count }, (_, index) => guarantorState[index] ?? { name: '', unit: '', incomePass: false });
  renderGuarantorFields(elements.guarantorContainer, elements.guarantorBanner, rule.count, rule.label, guarantorState);
}

function saveDraft() {
  localStorage.setItem(APP_CONFIG.draftStorageKey, JSON.stringify({ ...getFormData(), guarantors: guarantorState }));
}

function loadDraft() {
  const raw = localStorage.getItem(APP_CONFIG.draftStorageKey);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    elements.rank.value = draft.rank ?? elements.rank.value;
    syncSalaryLevelByRank(draft.salaryLevel ?? '', draft.salaryStep ?? '');
    elements.borrowerName.value = draft.borrowerName ?? '';
    elements.unit.value = draft.unit ?? '';
    elements.totalIncome.value = draft.totalIncome ?? 0;
    elements.totalDeductions.value = draft.totalDeductions ?? 0;
    elements.loanMode.value = draft.loanMode ?? elements.loanMode.value;
    elements.loanReason.value = draft.loanReason ?? '';
    elements.isRefinance.checked = draft.isRefinance ?? false;
    elements.depositAmount.value = draft.depositAmount ?? 0;
    elements.overDepositAmount.value = draft.overDepositAmount ?? 0;
    elements.existingAtbInstallment.value = draft.existingAtbInstallment ?? 0;
    elements.termMonths.value = draft.termMonths ?? elements.termMonths.value;
    guarantorState = Array.isArray(draft.guarantors) ? draft.guarantors : [];
  } catch {
    localStorage.removeItem(APP_CONFIG.draftStorageKey);
  }
}

function saveHistory(formData, evaluation) {
  const existing = JSON.parse(localStorage.getItem(APP_CONFIG.historyStorageKey) ?? '[]');
  const next = [buildHistoryEntry(formData, evaluation), ...existing].slice(0, 10);
  localStorage.setItem(APP_CONFIG.historyStorageKey, JSON.stringify(next));
  renderHistory(elements.historyList, next);
}

function loadHistory() {
  const existing = JSON.parse(localStorage.getItem(APP_CONFIG.historyStorageKey) ?? '[]');
  renderHistory(elements.historyList, existing);
}

function validateForm(formData) {
  const errors = [];
  const validSteps = getSalaryStepsByLevel(formData.salaryLevel);

  if (!formData.rank) errors.push('กรุณาเลือกยศ');
  if (!formData.salaryLevel || !formData.salaryStep || formData.salaryAmount <= 0 || !validSteps.includes(formData.salaryStep)) {
    errors.push('กรุณาเลือกข้อมูลระดับและชั้นเงินเดือนให้ถูกต้อง');
  }
  if (formData.totalIncome <= 0) errors.push('กรุณากรอกรวมรับ');
  if (formData.totalDeductions < 0) errors.push('รวมหักต้องไม่ติดลบ');
  if (formData.depositAmount < 0 || formData.overDepositAmount < 0) errors.push('ยอดเงินฝากและยอดเกินเงินฝากต้องไม่ติดลบ');
  if (formData.loanMode === 'deposit_only' && formData.overDepositAmount > 0) errors.push('กู้เฉพาะเงินฝากไม่ควรมียอดเกินเงินฝาก');
  if (formData.loanMode === 'over_deposit' && formData.overDepositAmount <= 0) errors.push('เลือกกู้เกินเงินฝาก ต้องมียอดเกินเงินฝากมากกว่า 0');

  return errors;
}

function submitEvaluation() {
  const formData = getFormData();
  const errors = validateForm(formData);

  if (errors.length) {
    elements.resultSummary.className = 'result-summary fail';
    elements.resultSummary.innerHTML = `
      <div class="badge fail">ข้อมูลไม่ครบ</div>
      <h3>ยังไม่สามารถประเมินได้</h3>
      <p>${errors.join(' / ')}</p>
    `;
    return;
  }

  const evaluation = evaluateLoan(formData);
  currentEvaluation = { formData, evaluation };
  renderResult(elements, evaluation);
  renderScenarioTable(elements.scenarioTableBody, buildScenarioTable(formData), formData.termMonths);
  saveHistory(formData, evaluation);
  saveDraft();
}

function resetAll() {
  elements.loanForm.reset();
  elements.loanMode.value = APP_CONFIG.loanModes[0].value;
  elements.termMonths.value = String(APP_CONFIG.terms[0]);
  elements.rank.value = APP_CONFIG.rankOptions[0];
  syncSalaryLevelByRank('', '1');
  elements.totalIncome.value = 0;
  elements.totalDeductions.value = 0;
  elements.depositAmount.value = 0;
  elements.overDepositAmount.value = 0;
  elements.existingAtbInstallment.value = 0;
  guarantorState = [];
  syncGuarantorFields();
  setAutoSalary();
  updateRequestedAmountAndPreview();
  saveDraft();

  [
    elements.totalIncome,
    elements.totalDeductions,
    elements.depositAmount,
    elements.overDepositAmount,
    elements.existingAtbInstallment,
  ].forEach((input) => {
    input.value = formatMoneyInputValue(input.value);
  });
}

function loadDemo() {
  elements.rank.value = 'ร้อยเอก';
  syncSalaryLevelByRank('น.1', '10');
  elements.borrowerName.value = 'ร.อ.สมชาย ใจดี';
  elements.unit.value = 'กองร้อยตัวอย่าง';
  elements.totalIncome.value = 32000;
  elements.totalDeductions.value = 7000;
  elements.loanMode.value = 'over_deposit';
  elements.loanReason.value = 'housing';
  elements.depositAmount.value = 130743;
  elements.overDepositAmount.value = 100000;
  elements.isRefinance.checked = false;
  elements.existingAtbInstallment.value = 0;
  elements.termMonths.value = '84';
  guarantorState = [{ name: 'พ.ต.ทดสอบ ผู้ค้ำ', unit: 'หน่วยข้างเคียง', incomePass: true }];
  syncGuarantorFields();
  setAutoSalary();
  updateRequestedAmountAndPreview();
  saveDraft();

  [
    elements.totalIncome,
    elements.totalDeductions,
    elements.depositAmount,
    elements.overDepositAmount,
    elements.existingAtbInstallment,
  ].forEach((input) => {
    input.value = formatMoneyInputValue(input.value);
  });
}

function bindEvents() {
  elements.rank.addEventListener('change', () => {
    syncSalaryLevelByRank();
    setAutoSalary();
    saveDraft();
  });

  elements.salaryLevel.addEventListener('change', () => {
    syncSalaryStepByLevel();
    setAutoSalary();
    saveDraft();
  });

  elements.salaryStep.addEventListener('change', () => {
    setAutoSalary();
    saveDraft();
  });

  ['totalIncome', 'totalDeductions', 'depositAmount', 'overDepositAmount', 'termMonths', 'existingAtbInstallment'].forEach((key) => {
    elements[key].addEventListener('input', () => {
      syncGuarantorFields();
      updateRequestedAmountAndPreview();
      saveDraft();
    });
    elements[key].addEventListener('change', () => {
      syncGuarantorFields();
      updateRequestedAmountAndPreview();
      saveDraft();
    });
  });

  elements.loanMode.addEventListener('change', () => {
    if (elements.loanMode.value === 'deposit_only') {
      elements.overDepositAmount.value = formatMoneyInputValue(0);
    }
    syncGuarantorFields();
    updateRequestedAmountAndPreview();
    saveDraft();
  });

  elements.loanReason.addEventListener('change', saveDraft);
  elements.isRefinance.addEventListener('change', () => {
    updateRequestedAmountAndPreview();
    saveDraft();
  });
  elements.borrowerName.addEventListener('input', saveDraft);
  elements.unit.addEventListener('input', saveDraft);

  elements.guarantorContainer.addEventListener('input', (event) => {
    const target = event.target;
    const index = Number(target.dataset.guarantorIndex);
    const field = target.dataset.field;
    if (!Number.isInteger(index) || !field) return;
    guarantorState[index] = guarantorState[index] ?? { name: '', unit: '', incomePass: false };
    guarantorState[index][field] = target.type === 'checkbox' ? target.checked : target.value;
    saveDraft();
  });

  elements.loanForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitEvaluation();
  });

  elements.resetBtn.addEventListener('click', resetAll);
  elements.loadDemoBtn.addEventListener('click', loadDemo);
  elements.printBtn.addEventListener('click', () => window.print());
  elements.savePdfBtn?.addEventListener('click', exportPdf);
  elements.clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem(APP_CONFIG.historyStorageKey);
    loadHistory();
  });
}

function init() {
  populateStaticOptions(elements);
  syncSalaryLevelByRank('', '1');
  loadDraft();
  setAutoSalary();
  syncGuarantorFields();
  updateRequestedAmountAndPreview();
  loadHistory();
  bindEvents();
  initMoneyInputs();

  [
    elements.totalIncome,
    elements.totalDeductions,
    elements.depositAmount,
    elements.overDepositAmount,
    elements.existingAtbInstallment,
  ].forEach((input) => {
    input.value = formatMoneyInputValue(input.value);
  });
}

init();
