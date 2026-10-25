/* Шкала PIT за роками: 2026 — 12%/32% з порогом 120 000; 2027 — 12%/24%/32% з порогами 130 000 і 150 000 (js/pit.js). Незалежні еталони — приклади розрахунку з опублікованих джерел,
   а не числа, згенеровані з цього коду. Нижче порога результат має збігатися з calc.js до злотого. */
import assert from 'node:assert/strict';
import { CONFIG, compute } from '../js/calc.js';
import { PIT_SCALES, pitScaleFor, pitThreshold, pitBaseOf, pitForMonth, pitExtra, inputsFromSaved, yearToDate } from '../js/pit.js';

// 1. Приклади з джерел: (накопичена база до місяця, база місяця) → аванс PIT у місяць перетину порога
const examples = [
  // poradnikprzedsiebiorcy.pl, травень 2024: 20 000 під порогом (12%) і 5 000 понад ним (32%), знижка 300
  { name: 'приклад 20 000 + 5 000',        ytdPrev: 100000, base: 25000, expected: 3700 },
  // fakturaxl.pl: база 25 637, накопичено січ–трав 128 185; 2 094,24 + 2 619,20 − 300 = 4 413,44 → 4 413
  { name: 'fakturaxl (травень)',           ytdPrev: 128185 - 25637, base: 25637, expected: 4413 },
  // poradnikprzedsiebiorcy.pl, серпень 2026: 2 820,12 + 2 064,16 − 300 = 4 584,28 → 4 584 (база там 29 951,50, тут округлено до 29 952)
  { name: 'poradnikprzedsiebiorcy (серпень)', ytdPrev: 96499, base: 29952, expected: 4584 },
  // той самий сайт, листопад 2026: 115 000 накопичено, база 26 089 → 600 + 6 748,48 − 300 = 7 048,48 → 7 048
  { name: 'листопад: 12% з 5 000 + 32% з 21 089', ytdPrev: 115000, base: 26089, expected: 7048 }
];
for (const e of examples) assert.equal(pitForMonth(e.base, e.ytdPrev, 2026), e.expected, `${e.name}: очікувалось ${e.expected}`);

// 2. Після перетину порога весь місяць — 32% мінус 300 (поріг вже вичерпано)
assert.equal(pitForMonth(10000, 130000, 2026), Math.round(10000 * 0.32 - 300));

// 3. Нижче порога — точно та сама формула, що в compute() (жодних змін для звичайних зарплат)
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
for (let i = 0; i < 20000; i++) {
  const year = rnd() < 0.5 ? 2026 : 2027, limit = year === 2026 ? 120000 : 130000;     // перший поріг (незалежно від коду)
  const base = Math.round(rnd() * 40000);
  const ytdPrev = Math.round(rnd() * Math.max(0, limit - base));            // ytdPrev + base ≤ перший поріг
  assert.equal(pitForMonth(base, ytdPrev, year), Math.max(0, Math.round(base * 0.12 - 300)), `нижче порога ${year} base=${base} ytd=${ytdPrev}`);
}

// 4. pitBaseOf() відтворює базу з compute(): збираємо netto назад із res і порівнюємо з res.net
for (let i = 0; i < 5000; i++) {
  const g = 3000 + rnd() * 20000, l4 = rnd() < 0.2 ? rnd() * 1500 : 0;
  const under26 = rnd() < 0.2, ppk = rnd() < 0.4, ins = rnd() < 0.5;
  const inputs = {
    baseSalary: Math.round(g), stateDays: 21, schedDays: 21, regWorkedDays: Math.round(rnd() * 21),
    morningShifts: Math.round(rnd() * 10), nightShifts: Math.round(rnd() * 8),
    overtimeMorningShifts: 0, overtimeNightShifts: 0, weekendDays: Math.round(rnd() * 4), overtimeDays: Math.round(rnd() * 3),
    vacDays: 0, dailyUrlopBonus: 0, extraBonus: Math.round(rnd() * 800), bloodDonationDays: 0,
    l4Days: l4 ? 5 : 0, isPremium: !!l4, isUnder26: under26, ppkActive: ppk, insuranceActive: ins, l4DailyRateCached: null,
    presenceBonusPct: 5, qualityBonusPct: 10, year: 2026
  };
  const res = compute(inputs);
  const zus = (res.gross - res.l4Pay) * CONFIG.ZUS, nfz = Math.round((res.gross - zus) * CONFIG.NFZ * 100) / 100;
  const pit = under26 ? 0 : pitForMonth(pitBaseOf(res), 0, 2026);
  const net = res.gross - zus - nfz - pit - (ppk ? res.gross * 0.02 : 0) - (ins ? CONFIG.EXTRA_INSURANCE_RATE : 0)
    - (CONFIG.BENEFIT_ZUS_NFZ + CONFIG.BENEFIT_TAX) + res.laundryAllowance;
  assert.ok(Math.abs(net - res.net) < 1e-9, `pitBaseOf не збігається з compute(): ${net} ≠ ${res.net}`);
  assert.equal(pitExtra(res, 0, 2026), 0, 'без накопиченого доходу додаткового податку немає');
}

// 5. Річна узгодженість: сума місячних авансів = податок за шкалою (10 800 + 32% надлишку), ±0,5 zł на місяць округлення
for (const monthly of [9000, 10000, 11500, 13000, 20000]) {
  let ytd = 0, total = 0;
  let ytd27 = 0, total27 = 0;
  for (let m = 1; m <= 12; m++) { total += pitForMonth(monthly, ytd, 2026); ytd += monthly; total27 += pitForMonth(monthly, ytd27, 2027); ytd27 += monthly; }
  const annual = ytd <= 120000 ? ytd * 0.12 - 3600 : 10800 + 0.32 * (ytd - 120000);
  assert.ok(Math.abs(total - annual) <= 6, `2026, щомісячно ${monthly}: сума авансів ${total}, за шкалою ${annual}`);
  // 2027: податок за шкалою 12/24/32 мінус 3 600 (окрема арифметика за щаблями)
  const annual27 = ytd27 <= 130000 ? ytd27 * 0.12 - 3600
    : ytd27 <= 150000 ? 15600 + (ytd27 - 130000) * 0.24 - 3600
    : 15600 + 4800 + (ytd27 - 150000) * 0.32 - 3600;
  assert.ok(Math.abs(total27 - annual27) <= 6, `2027, щомісячно ${monthly}: сума авансів ${total27}, за шкалою ${annual27}`);
}

// 6. pitExtra: різниця проти compute() невід'ємна й дорівнює різниці формул
const resHigh = compute({
  baseSalary: 15000, stateDays: 21, schedDays: 21, regWorkedDays: 21, morningShifts: 21, nightShifts: 0,
  overtimeMorningShifts: 0, overtimeNightShifts: 0, weekendDays: 0, overtimeDays: 0, vacDays: 0, dailyUrlopBonus: 0,
  extraBonus: 0, bloodDonationDays: 0, l4Days: 0, isPremium: true, isUnder26: false, ppkActive: false, insuranceActive: true,
  l4DailyRateCached: null, presenceBonusPct: 5, qualityBonusPct: 10, year: 2026
});
const b = pitBaseOf(resHigh);
assert.equal(pitExtra(resHigh, 0, 2026), 0);
assert.equal(pitExtra(resHigh, 120000, 2026), Math.round(b * 0.32 - 300) - Math.round(b * 0.12 - 300), 'повністю над порогом');
assert.ok(pitExtra(resHigh, 115000, 2026) > 0 && pitExtra(resHigh, 115000, 2026) < pitExtra(resHigh, 120000, 2026), 'часткове перевищення менше за повне');

// 7. yearToDate: беруться лише місяці цього року ПЕРЕД поточним; відсутні — рахуються як 0 і видно з found/expected
const profile = { baseSalary: 5750, under26: 'no', ppk: 'no', insurance: 'yes' };
const rec = { baseSalary: '10000', morningShifts: '20', scheduleDays: '20', bonusPctSelect: '10', presencePctSelect: '5' };
const oneMonth = id => pitBaseOf(compute(inputsFromSaved(rec, id, profile)));
let y = yearToDate({ '2026-01': rec, '2026-02': rec, '2026-03': rec, '2026-04': rec, '2025-12': rec }, '2026-04', profile);
assert.deepEqual([y.found, y.expected], [3, 3], 'квітень: Січ–Бер; свій місяць і минулий рік не рахуються');
assert.equal(y.prev, oneMonth('2026-01') + oneMonth('2026-02') + oneMonth('2026-03'));
y = yearToDate({ '2026-01': rec, '2026-03': rec }, '2026-04', profile);
assert.deepEqual([y.found, y.expected], [2, 3], 'пропущений місяць видно');
y = yearToDate({}, '2026-01', profile);
assert.deepEqual([y.prev, y.found, y.expected], [0, 0, 0], 'січень: нічого накопичувати');
y = yearToDate({ '2026-01': rec }, '2026-02', { ...profile, under26: 'yes' });
assert.deepEqual([y.prev, y.found, y.expected], [0, 0, 0], 'до 26 років PIT = 0 — поріг не діє');

// 8. inputsFromSaved: значення за замовчуванням, як у fillFrom() (премія якості 10%, присутності за L4)
let inp = inputsFromSaved({ baseSalary: '8000' }, '2026-05', profile);
assert.equal(inp.qualityBonusPct, 10); assert.equal(inp.presenceBonusPct, 5);
inp = inputsFromSaved({ baseSalary: '8000', l4Days: '2' }, '2026-05', profile);
assert.equal(inp.presenceBonusPct, 2.5);
inp = inputsFromSaved({ baseSalary: '8000', l4Days: '9' }, '2026-05', profile);
assert.equal(inp.presenceBonusPct, 0);
inp = inputsFromSaved({ bonusPctSelect: '0', presencePctSelect: '0' }, '2026-05', profile);
assert.equal(inp.baseSalary, 5750, 'без окладу в записі — ставка з профілю'); assert.equal(inp.qualityBonusPct, 0);

// 9. Шкала 2027 (12% до 130 000, 24% до 150 000, 32% вище): ручні приклади по щаблях, мінус 300
const ex27 = [
  { name: 'під порогом 130 000 — як compute()',  ytdPrev: 100000, base: 20000, expected: 2100 },           // 20 000 × 12% − 300
  { name: 'перетин 130 000: 5 000 × 12% + 5 000 × 24%', ytdPrev: 125000, base: 10000, expected: 1500 },  // 600 + 1 200 − 300
  { name: 'увесь місяць у щаблі 24%',               ytdPrev: 130000, base: 10000, expected: 2100 },       // 2 400 − 300
  { name: 'перетин 150 000: 5 000 × 24% + 5 000 × 32%', ytdPrev: 145000, base: 10000, expected: 2500 },  // 1 200 + 1 600 − 300
  { name: 'над 150 000 — 32%',                       ytdPrev: 150000, base: 10000, expected: 2900 },       // 3 200 − 300
  { name: 'один місяць через усі щаблі',            ytdPrev: 100000, base: 60000, expected: 11300 }       // 3 600 + 4 800 + 3 200 − 300
];
for (const e of ex27) assert.equal(pitForMonth(e.base, e.ytdPrev, 2027), e.expected, `2027 ${e.name}`);
assert.equal(pitForMonth(10000, 125000, 2026), 2900, 'ті самі дані за шкалою 2026 дають інший податок (32% одразу над 120 000)');
assert.ok(pitForMonth(10000, 125000, 2027) < pitForMonth(10000, 125000, 2026), '2027 вигідніша за 2026 у проміжку 120–150 тис.');

// 10. Вибір шкали за роком: невідомі роки — найближча попередня (після останньої — остання), нечисловий рік — помилка
assert.equal(pitScaleFor(2025), PIT_SCALES[2026], 'до першої шкали — перша');
assert.equal(pitScaleFor(2026), PIT_SCALES[2026]); assert.equal(pitScaleFor(2027), PIT_SCALES[2027]);
assert.equal(pitScaleFor(2030), PIT_SCALES[2027], 'після останньої — остання, поки не додано нову');
assert.deepEqual([2026, 2027, 2028].map(pitThreshold), [120000, 130000, 130000]);
assert.throws(() => pitScaleFor(undefined), /потрібен рік/, 'рік не можна пропустити (інакше мовчки взялась би не та шкала)');
assert.throws(() => pitForMonth(1000, 0), /потрібен рік/);
for (const sc of Object.values(PIT_SCALES)) {                       // шкала впорядкована, закінчується безкінечним щаблем, ставки зростають
  assert.ok(sc.every((b, i) => i === 0 || (b.upTo > sc[i - 1].upTo && b.rate > sc[i - 1].rate)));
  assert.equal(sc[sc.length - 1].upTo, Infinity); assert.equal(sc[0].rate, CONFIG.PIT, 'перший щабель = ставка 12% з calc.js');
}

// 11. pitExtra за 2027: різниця проти compute() дорівнює різниці формул по щаблях
const resHigh27 = compute({ ...{
  baseSalary: 15000, stateDays: 21, schedDays: 21, regWorkedDays: 21, morningShifts: 21, nightShifts: 0,
  overtimeMorningShifts: 0, overtimeNightShifts: 0, weekendDays: 0, overtimeDays: 0, vacDays: 0, dailyUrlopBonus: 0,
  extraBonus: 0, bloodDonationDays: 0, l4Days: 0, isPremium: true, isUnder26: false, ppkActive: false, insuranceActive: true,
  l4DailyRateCached: null, presenceBonusPct: 5, qualityBonusPct: 10 }, year: 2027 });
const b27 = pitBaseOf(resHigh27);
assert.equal(pitExtra(resHigh27, 0, 2027), 0, 'без накопиченого доходу додаткового податку немає');
assert.equal(pitExtra(resHigh27, 130000, 2027), Math.round(b27 * 0.24 - 300) - Math.round(b27 * 0.12 - 300), 'щабель 24%');
assert.equal(pitExtra(resHigh27, 150000, 2027), Math.round(b27 * 0.32 - 300) - Math.round(b27 * 0.12 - 300), 'щабель 32%');

// 12. yearToDate для 2027 бере місяці 2027 року
const y27 = yearToDate({ '2027-01': { baseSalary: '10000', morningShifts: '20', scheduleDays: '20' }, '2026-12': { baseSalary: '10000', morningShifts: '20' } }, '2027-02', { baseSalary: 5750, under26: 'no', ppk: 'no', insurance: 'yes' });
assert.deepEqual([y27.found, y27.expected], [1, 1], '2027: рахується лише січень 2027, грудень 2026 — ні');

console.log('OK: шкала PIT за роками (2026: 120 000; 2027: 130 000 / 150 000; приклади по щаблях, збіг з calc.js нижче порога, річна узгодженість, накопичення)');
