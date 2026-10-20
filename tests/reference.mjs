/* Диференціальний тест: js/calc.js проти оригінальної математики (tests/reference/original-pure.js).
   На відміну від golden.json, еталон тут — НЕ згенерований із поточного коду, а взятий з оригіналу.
   Детермінований генератор випадкових чисел, тож збій завжди відтворюється. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import * as mine from '../js/calc.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'reference/original-pure.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(src + '\n;this.api={CONFIG,getNormHours,stateDaysFor,getMinWage,compute,computeDailyUrlopBonus};', ctx);
const ref = ctx.api;

// mulberry32
let seed = 20261020;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[int(0, arr.length - 1)];
const same = (a, b, where) => {
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${where}: різні ключі`);
  for (const k of Object.keys(a)) assert.ok(Object.is(a[k], b[k]), `${where}: "${k}" ${a[k]} ≠ ${b[k]}`);
};

// 1. Константи
assert.equal(JSON.stringify(mine.CONFIG), JSON.stringify(ref.CONFIG), 'CONFIG відрізняється від оригіналу');

// 2. Норма годин: усі місяці 2000–2040
for (let y = 2000; y <= 2040; y++) for (let m = 0; m < 12; m++)
  assert.equal(mine.getNormHours(y, m), ref.getNormHours(y, m), `getNormHours ${y}-${m + 1}`);

// 3. compute(): 30 000 випадкових наборів
const N = 30000;
for (let i = 0; i < N; i++) {
  const year = int(2024, 2028), month = int(0, 11);
  const stateDays = ref.getNormHours(year, month) / 8;
  const m = int(0, 22), a = int(0, 22), n = int(0, 22);
  const inputs = {
    baseSalary: rnd() < 0.5 ? int(3000, 15000) : Math.round(rnd() * 1500000) / 100,
    stateDays, year, schedDays: pick([0, int(10, 26), stateDays]),
    regWorkedDays: m + a + n, morningShifts: m, nightShifts: n,
    overtimeMorningShifts: int(0, 6), overtimeNightShifts: int(0, 6),
    weekendDays: int(0, 8), overtimeDays: pick([0, int(0, 12), int(0, 24) / 2]),
    vacDays: int(0, 10), dailyUrlopBonus: pick([0, Math.round(rnd() * 30000) / 100]),
    extraBonus: pick([0, int(0, 2000)]), bloodDonationDays: int(0, 3), l4Days: pick([0, 0, int(1, 31)]),
    isPremium: rnd() < 0.5, isUnder26: rnd() < 0.3, ppkActive: rnd() < 0.4, insuranceActive: rnd() < 0.6,
    l4DailyRateCached: pick([null, 0, Math.round(rnd() * 25000) / 100]),
    presenceBonusPct: pick([undefined, 0, 2.5, 5]), qualityBonusPct: pick([undefined, 0, 5, 10])
  };
  same(mine.compute({ ...inputs }), ref.compute({ ...inputs }), `compute #${i}`);
}

// 4. Відпускні: 8 000 випадкових наборів записів (рядкові поля, як у Firestore)
const field = (lo, hi) => (rnd() < 0.25 ? undefined : String(int(lo, hi)));
for (let i = 0; i < 8000; i++) {
  const records = {};
  for (let mo = 1; mo <= 12; mo++) if (rnd() < 0.8) {
    records[`2026-${String(mo).padStart(2, '0')}`] = {
      baseSalary: field(4000, 9000), scheduleDays: field(16, 23),
      morningShifts: field(0, 12), afternoonShifts: field(0, 12), nightShifts: field(0, 12),
      overtimeDays: field(0, 6), overtimeMorningShifts: field(0, 3), overtimeNightShifts: field(0, 3),
      weekendDays: field(0, 5), vacationDays: field(0, 5), bloodDonationDays: field(0, 2),
      l4Days: field(0, 10), l4MissedShifts: field(0, 6),
      bonusPctSelect: pick([undefined, '0', '5', '10']), presencePctSelect: pick([undefined, '0', '2.5', '5'])
    };
  }
  const target = `2026-${String(int(1, 12)).padStart(2, '0')}`;
  const cur = { baseSalary: int(4000, 9000), minWage: pick([4666, 4806]) };
  assert.ok(Object.is(mine.computeDailyUrlopBonus(records, target, cur), ref.computeDailyUrlopBonus(records, target, cur)), `відпускні #${i}`);
}

console.log(`OK: calc.js збігається з оригіналом (${N} compute, 8000 відпускних, норми годин 2000–2040)`);
