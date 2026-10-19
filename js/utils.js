// js/utils.js
const plnFormatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
export const formatPLN = (val) => plnFormatter.format(val);

let toastTimeout = null;
export function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; 
    t.classList.add('show');
    
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('show'), 3000);
}

