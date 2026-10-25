/* Адаптація до 2027 року: норма годин (ручний підрахунок за календарем), мінімальна зарплата 4 950 zł → нічна ставка,
   ставки внесків працівника без змін. Шкала PIT 2027 перевіряється в tests/pit.mjs. */
import assert from 'node:assert/strict';
import { CONFIG, compute, getNormHours, getMinWage } from '../js/calc.js';

// 1. Норма годин 2027, підрахована вручну: будні мінус будні-свята мінус по одному дню за кожне свято в суботу.
//    Свята 2027: 1.01 (пт), 6.01 (ср), Великдень 28.03 (нд), 29.03 (пн), 1.05 (сб), 3.05 (пн), Зелені свята 16.05 (нд),
//    Boże Ciało 27.05 (чт), 15.08 (нд), 1.11 (пн), 11.11 (чт), 24.12 (пт, вихідний із 2025), 25.12 (сб), 26.12 (нд).
const expected = [152, 160, 176, 176, 144, 176, 176, 176, 176, 168, 160, 168];
expected.forEach((h, m) => assert.equal(getNormHours(2027, m), h, `норма 2027-${String(m + 1).padStart(2, '0')}`));
assert.equal(expected.reduce((a, v) => a + v, 0), 2008, 'у 2027 році 251 робочий день = 2 008 год');

// 2. Мінімальна зарплата 2027 — 4 950 zł (Dz.U. 2026 poz. 1213); нічна ставка береться від неї
assert.equal(getMinWage(2027), 4950);
const base = {
  baseSalary: 6000, stateDays: 19, schedDays: 19, regWorkedDays: 19, morningShifts: 0, nightShifts: 4,
  overtimeMorningShifts: 0, overtimeNightShifts: 0, weekendDays: 0, overtimeDays: 0, vacDays: 0, dailyUrlopBonus: 0,
  extraBonus: 0, bloodDonationDays: 0, l4Days: 0, isPremium: false, isUnder26: false, ppkActive: false, insuranceActive: false,
  l4DailyRateCached: null, presenceBonusPct: 5, qualityBonusPct: 10
};
const r27 = compute({ ...base, year: 2027 });
assert.equal(r27.nightTariff, 6.51, 'січень 2027: 4 950 / 152 год × 20% = 6,5132 → 6,51');
assert.equal(compute({ ...base, year: 2026 }).nightTariff, 6.32, 'при тих самих вхідних 2026: 4 806 / 152 × 20% = 6,32');
assert.ok(r27.totalNightTimePay > compute({ ...base, year: 2026 }).totalNightTimePay, 'вища мінімалка → вища нічна надбавка');

// 3. Ставки внесків працівника: ZUS 9,76 + 1,5 + 2,45 = 13,71%, здоров'я 9%, знижка 300 zł — без змін у 2027
assert.equal(+(CONFIG.ZUS * 100).toFixed(2), +(9.76 + 1.5 + 2.45).toFixed(2));
assert.equal(CONFIG.NFZ, 0.09); assert.equal(CONFIG.PIT, 0.12); assert.equal(CONFIG.KWOTA_WOLNA, 300);

console.log('OK: 2027 (норма годин за календарем, мінімалка 4 950 → нічна ставка, ставки внесків)');
