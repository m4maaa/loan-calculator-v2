export const currency = (value = 0, decimals = 1) =>
  new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

export const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const monthlyPayment = ({ principal, annualRate, termMonths }) => {
  const p = toNumber(principal);
  const r = toNumber(annualRate) / 100 / 12;
  const n = toNumber(termMonths);

  if (p <= 0 || n <= 0) return 0;
  if (r <= 0) return Math.round(p / n);

  return Math.round((p * r * (1 + r) ** n) / ((1 + r) ** n - 1));
};

export const formatCurrencyText = (value) => `${currency(value, 1)} บาท`;

export const nowThai = () =>
  new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export const downloadFile = (filename, content, type = 'application/json') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};
