export const currency = (value = 0) =>
  new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

export const toNumber = (value) => {
  const parsed = Number(value);
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

export const formatCurrencyText = (value) => `${currency(value)} บาท`;

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
