import { APP_CONFIG } from '../data/config.js';
import { monthlyPayment, toNumber } from './utils.js';

export function getAllowedSalaryLevelsByRank(rank) {
  return APP_CONFIG.rankSalaryLevelMap[rank] ?? [];
}

export function getRequiredGuarantorInfo({ loanMode, overDepositAmount }) {
  if (loanMode === 'deposit_only') {
    return APP_CONFIG.guarantorThresholds[0];
  }

  const over = toNumber(overDepositAmount);
  return APP_CONFIG.guarantorThresholds.find((item) => over <= item.max) ?? APP_CONFIG.guarantorThresholds.at(-1);
}

export function calculateCoreMetrics(formData) {
  const salary = toNumber(formData.salaryAmount);
  const totalIncome = toNumber(formData.totalIncome);
  const totalDeductions = toNumber(formData.totalDeductions);
  const oneThird = totalIncome * APP_CONFIG.oneThirdRatio;
  const preLoanBalance = totalIncome - totalDeductions;

  const depositAmount = toNumber(formData.depositAmount);
  const eligibleDepositAmount = Math.floor(depositAmount / 1000) * 1000;
  const overDepositAmount = formData.loanMode === 'over_deposit' ? toNumber(formData.overDepositAmount) : 0;
  const rawRequestedAmount = depositAmount + overDepositAmount;
  const requestedAmount = eligibleDepositAmount + overDepositAmount;

  const autoInstallment = monthlyPayment({
    principal: requestedAmount,
    annualRate: APP_CONFIG.fixedAnnualInterestRate,
    termMonths: toNumber(formData.termMonths),
  });

  const refinanceRelief = formData.isRefinance ? toNumber(formData.existingAtbInstallment) : 0;
  const postLoanBalance = preLoanBalance + refinanceRelief - autoInstallment;

  const guarantorRule = getRequiredGuarantorInfo({
    loanMode: formData.loanMode,
    overDepositAmount,
  });

  const guarantorReadyCount = (formData.guarantors ?? []).filter((item) => item.name?.trim() && item.unit?.trim()).length;
  const guarantorIncomeReadyCount = (formData.guarantors ?? []).filter((item) => item.incomePass === true).length;

  return {
    salary,
    totalIncome,
    totalDeductions,
    oneThird,
    preLoanBalance,
    depositAmount,
    eligibleDepositAmount,
    overDepositAmount,
    rawRequestedAmount,
    requestedAmount,
    autoInstallment,
    effectiveInstallment: autoInstallment,
    refinanceRelief,
    postLoanBalance,
    guarantorRule,
    guarantorReadyCount,
    guarantorIncomeReadyCount,
    recommendedMaxPrincipal: requestedAmount,
    trimmedDepositAmount: depositAmount - eligibleDepositAmount,
  };
}

export function evaluateLoan(formData) {
  const metrics = calculateCoreMetrics(formData);
  const rules = [];
  let score = 0;

  const oneThirdPass = metrics.postLoanBalance > metrics.oneThird;
  rules.push({
    key: 'oneThird',
    title: 'เหลือรับหลังกู้ต้องมากกว่า 1 ใน 3 ของรายรับ',
    pass: oneThirdPass,
    detail: `เหลือรับหลังกู้ ${metrics.postLoanBalance.toLocaleString('th-TH')} เทียบกับเกณฑ์ ${metrics.oneThird.toLocaleString('th-TH')} บาท`,
  });
  if (oneThirdPass) score += APP_CONFIG.scoreWeights.oneThird;

  const minBalancePass = metrics.postLoanBalance > APP_CONFIG.minPostLoanBalance;
  rules.push({
    key: 'minBalance',
    title: `เหลือรับหลังกู้ต้องมากกว่า ${APP_CONFIG.minPostLoanBalance.toLocaleString('th-TH')} บาท`,
    pass: minBalancePass,
    detail: `เหลือรับหลังกู้ ${metrics.postLoanBalance.toLocaleString('th-TH')} บาท`,
  });
  if (minBalancePass) score += APP_CONFIG.scoreWeights.minBalance;

  const enoughGuarantors = metrics.guarantorReadyCount >= metrics.guarantorRule.count;
  rules.push({
    key: 'guarantorCount',
    title: `จำนวนผู้ค้ำครบตามเกณฑ์ (${metrics.guarantorRule.count} คน)`,
    pass: enoughGuarantors,
    detail: `กรอกข้อมูลผู้ค้ำครบชื่อและสังกัดแล้ว ${metrics.guarantorReadyCount} จากที่ต้องใช้ ${metrics.guarantorRule.count} คน`,
  });
  if (enoughGuarantors) score += APP_CONFIG.scoreWeights.guarantorCount;

  const enoughGuarantorIncome = metrics.guarantorIncomeReadyCount >= metrics.guarantorRule.count;
  rules.push({
    key: 'guarantorIncomeReady',
    title: 'ผู้ค้ำมีสถานะรายได้ผ่านเกณฑ์ 1 ใน 3 ครบตามจำนวนที่ใช้',
    pass: enoughGuarantorIncome,
    detail: `ติ๊กยืนยันแล้ว ${metrics.guarantorIncomeReadyCount} จากที่ต้องใช้ ${metrics.guarantorRule.count} คน`,
  });
  if (enoughGuarantorIncome || metrics.guarantorRule.count === 0) score += APP_CONFIG.scoreWeights.guarantorIncomeReady;

  const failedCount = rules.filter((item) => !item.pass).length;
  let decision = 'pass';
  let decisionTitle = 'ข้อมูลการกู้ดี มีโอกาสผ่านเกณฑ์เบื้องต้น';
  let decisionMessage = 'ข้อมูลชุดนี้ผ่านเกณฑ์หลักทั้งหมด สามารถใช้เป็นแนวทางก่อนยื่นจริงได้';

  if (failedCount === 1) {
    decision = 'warn';
    decisionTitle = 'ข้อมูลการกู้พอมีลุ้น แต่ควรปรับก่อนยื่น';
    decisionMessage = 'ยังมีบางเงื่อนไขที่ควรแก้ไขหรือเตรียมผู้ค้ำเพิ่มเติม เพื่อเพิ่มโอกาสอนุมัติ';
  } else if (failedCount >= 2) {
    decision = 'fail';
    decisionTitle = 'ข้อมูลการกู้ยังไม่ผ่านเกณฑ์เบื้องต้น';
    decisionMessage = 'ควรลดวงเงิน เพิ่มจำนวนงวด หรือเตรียมผู้ค้ำให้ครบก่อนยื่น';
  }

  const advice = [];
  if (metrics.trimmedDepositAmount > 0) {
    advice.push(`เงินฝากส่วนที่กู้ไม่ได้ตามเกณฑ์คือ ${metrics.trimmedDepositAmount.toLocaleString('th-TH')} บาท เพราะระบบตัดเศษต่ำกว่า 1,000 บาทออก`);
  }
  if (!oneThirdPass) {
    advice.push(`เหลือรับหลังกู้ยังต่ำกว่าเกณฑ์ 1 ใน 3 อยู่ ${(metrics.oneThird - metrics.postLoanBalance).toLocaleString('th-TH')} บาท`);
  }
  if (!minBalancePass) {
    advice.push(`เหลือรับหลังกู้ยังต่ำกว่า ${APP_CONFIG.minPostLoanBalance.toLocaleString('th-TH')} บาท อยู่ ${(APP_CONFIG.minPostLoanBalance - metrics.postLoanBalance).toLocaleString('th-TH')} บาท`);
  }
  if (!enoughGuarantors) {
    advice.push(`ต้องกรอกผู้ค้ำให้ครบ ${metrics.guarantorRule.count} คน พร้อมชื่อและสังกัด`);
  }
  if (!enoughGuarantorIncome && metrics.guarantorRule.count > 0) {
    advice.push('ควรยืนยันสถานะรายได้ของผู้ค้ำให้ครบว่าแต่ละคนผ่านเกณฑ์ 1 ใน 3');
  }
  if (metrics.requestedAmount > 0) {
    advice.push(`ค่างวดต่อเดือนที่คำนวณจากดอกเบี้ยคงที่ ${APP_CONFIG.fixedAnnualInterestRate}% อยู่ที่ประมาณ ${metrics.autoInstallment.toLocaleString('th-TH')} บาท/เดือน`);
  }
  if (advice.length === 0) {
    advice.push('ข้อมูลครบและผ่านเกณฑ์หลัก สามารถพิมพ์สรุปหรือบันทึกเป็นหลักฐานประกอบการตรวจสอบภายในได้');
  }

  return { metrics, rules, decision, decisionTitle, decisionMessage, score, advice };
}

export function buildScenarioTable(formData) {
  return APP_CONFIG.terms.map((term) => {
    const evaluation = evaluateLoan({ ...formData, termMonths: term });
    return {
      term,
      installment: evaluation.metrics.autoInstallment,
      postLoanBalance: evaluation.metrics.postLoanBalance,
      decision: evaluation.decision,
    };
  });
}
