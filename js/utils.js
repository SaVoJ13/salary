/* Дрібні UI-утиліти без стану застосунку. */

export const formatPLN = val => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(val);

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
