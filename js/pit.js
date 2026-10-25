/* Поріг(и) PIT за роками. Чистий модуль без DOM і Firebase. js/calc.js НЕ змінено для логіки податку: він і далі рахує PIT
   за ставкою 12% (це еталонна математика, її охороняє tests/reference.mjs). Тут рахується лише ДОДАТКОВИЙ податок,
   коли накопичена з початку року база PIT перевищує перший поріг шкали.

   ШКАЛА ЗА РОКАМИ — єдине місце, яке міняють, коли змінюється закон:
   - 2026 (і раніше): 12% до 120 000, 32% вище.
   - 2027: 12% до 130 000, 24% від 130 000 до 150 000, 32% вище. СТАТУС: закон ухвалив Сейм (22.10.2026), на момент
     написання він ще йде до Сенату й президента. Якщо його не підпишуть або змінять — виправити лише запис 2027 нижче.
   Для років після останнього в таблиці береться остання шкала (поки не вийде нова), для років до першого — перша.

   Як рахує роботодавець (метод наростаючим підсумком):
   - база PIT місяця = брутто − внески ZUS − витрати (у цьому застосунку 300 zł: праця в іншій місцевості);
   - місячна база «лягає» на шкалу поверх уже накопиченої: частина під порогом — за нижчою ставкою, решта — за вищою;
   - щомісячна знижка 300 zł (PIT-2 = 3 600 zł на рік) віднімається в усі місяці, тож за рік виходить рівно
     скільки дає шкала (kwota wolna 30 000 zł незмінна в 2027);
   - аванс округлюється до повних злотих.
   Нижче першого порога результат збігається з calc.js до злотого (це перевіряє tests/pit.mjs). */

import { CONFIG, compute, getNormHours } from './calc.js';

export const PIT_SCALES = {
  2026: [{ upTo: 120000, rate: 0.12 }, { upTo: Infinity, rate: 0.32 }],
  2027: [{ upTo: 130000, rate: 0.12 }, { upTo: 150000, rate: 0.24 }, { upTo: Infinity, rate: 0.32 }]
};

/* Шкала для року: остання, що не пізніша за рік; для року раніше за першу — перша. Рік обов'язковий (без нього
   легко мовчки взяти не ту шкалу), тому нечисловий рік — помилка. */
export function pitScaleFor(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) throw new TypeError(`PIT: потрібен рік, отримано ${year}`);
  const years = Object.keys(PIT_SCALES).map(Number).sort((a, b) => a - b);
  const pick = years.filter(k => k <= y).pop() ?? years[0];
  return PIT_SCALES[pick];
}

/* Перший поріг шкали (де закінчується ставка 12%) — для підписів і тестів. */
export const pitThreshold = year => pitScaleFor(year)[0].upTo;

/* База PIT місяця — рівно так, як її рахує compute(): (брутто − ZUS) − 300, округлено до zł, не менше 0. */
export function pitBaseOf(res) {
  const zus = (res.gross - res.l4Pay) * CONFIG.ZUS;
  const healthBase = res.gross - zus;
  return Math.round(Math.max(0, healthBase - CONFIG.KWOTA_WOLNA));
}

/* PIT-аванс місяця за наростаючим підсумком. ytdPrev — база PIT за попередні місяці цього року, year — рік місяця. */
export function pitForMonth(pitBase, ytdPrev, year) {
  const scale = pitScaleFor(year);
  const start = ytdPrev, end = ytdPrev + pitBase;
  if (end <= scale[0].upTo) return Math.max(0, Math.round(pitBase * CONFIG.PIT - CONFIG.KWOTA_WOLNA));   // точно як у compute()
  let tax = 0, from = 0;
  for (const b of scale) {                                  // частина місячної бази, що потрапила в кожен щабель шкали
    const lo = Math.max(start, from), hi = Math.min(end, b.upTo);
    if (hi > lo) tax += (hi - lo) * b.rate;
    from = b.upTo;
  }
  return Math.max(0, Math.round(tax - CONFIG.KWOTA_WOLNA));
}

/* Скільки ДОДАТКОВО податку проти compute() (завжди ≥ 0). Віднімається від netto, яке дав compute(). */
export function pitExtra(res, ytdPrev, year) {
  const base = pitBaseOf(res);
  const original = Math.max(0, Math.round(base * CONFIG.PIT - CONFIG.KWOTA_WOLNA));   // те, що вже враховано в res.net
  return pitForMonth(base, ytdPrev, year) - original;
}

/* Вхідні дані compute() із запису місяця (як у Firestore / локальній копії). Дзеркало того, як
   calculateSalary() у app.js читає поля форми, включно зі значеннями за замовчуванням з fillFrom(). */
export function inputsFromSaved(data, monthId, profile, { premium = true } = {}) {
  const [yStr, mStr] = monthId.split('-');
  const year = parseInt(yStr);
  const stateDays = getNormHours(year, parseInt(mStr) - 1) / 8;
  const int = k => Math.max(0, parseInt(data[k]) || 0);
  const flt = k => Math.max(0, parseFloat(data[k]) || 0);
  const l4Days = int('l4Days');
  const qualityBonusPct = data.bonusPctSelect === undefined ? 10 : (parseFloat(data.bonusPctSelect) || 0);
  const presenceBonusPct = data.presencePctSelect === undefined
    ? (l4Days > 0 ? (l4Days <= 2 ? 2.5 : 0) : 5)
    : (parseFloat(data.presencePctSelect) || 0);
  const inputs = {
    baseSalary: Math.max(0, parseFloat(data.baseSalary) || Number(profile.baseSalary)),
    stateDays, year,
    schedDays: parseInt(data.scheduleDays) || stateDays,
    morningShifts: int('morningShifts'), afternoonShifts: int('afternoonShifts'), nightShifts: int('nightShifts'),
    overtimeDays: flt('overtimeDays'),
    overtimeMorningShifts: int('overtimeMorningShifts'), overtimeNightShifts: int('overtimeNightShifts'),
    weekendDays: int('weekendDays'),
    vacDays: premium ? int('vacationDays') : 0, dailyUrlopBonus: premium ? flt('urlopBonus') : 0,
    extraBonus: flt('extraBonus'),
    bloodDonationDays: premium ? int('bloodDonationDays') : 0, l4Days: premium ? l4Days : 0,
    qualityBonusPct, presenceBonusPct,
    isUnder26: profile.under26 === 'yes', ppkActive: profile.ppk === 'yes', insuranceActive: profile.insurance === 'yes',
    isPremium: premium,              // за замовчуванням — місяці залогіненого акаунта; для гостя premium: false
    l4DailyRateCached: null          // для минулих місяців середнє за 12 місяців не відновлюємо: беремо ставку від окладу
  };
  inputs.regWorkedDays = inputs.morningShifts + inputs.afternoonShifts + inputs.nightShifts;
  return inputs;
}

/* Накопичена база PIT за місяці цього року ПЕРЕД monthId. records: { 'YYYY-MM': дані місяця }.
   Місяці, яких немає в records, рахуються як 0 — found/expected дозволяють попередити користувача. */
export function yearToDate(records, monthId, profile) {
  const [yStr, mStr] = monthId.split('-');
  const k = parseInt(mStr);
  if (profile.under26 === 'yes') return { monthVal: monthId, prev: 0, found: 0, expected: 0 };   // PIT 0 — поріг не діє
  let prev = 0, found = 0;
  for (let j = 1; j < k; j++) {
    const id = `${yStr}-${String(j).padStart(2, '0')}`;
    const data = records[id];
    if (!data) continue;
    found++;
    prev += pitBaseOf(compute(inputsFromSaved(data, id, profile)));
  }
  return { monthVal: monthId, prev, found, expected: k - 1 };
}
