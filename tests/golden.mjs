import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compute } from '../js/calc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenPath = path.join(__dirname, 'golden.json');

const scenarios = [
  {
    id: 'scenario_1',
    name: 'Сценарій 1: Базовий (без надгодин і нічних)',
    input: {
      year: 2026, month: 5, baseSalary: 5750, isUnder26: false, hasPpk: false, hasIns: true,
      presencePct: 5, bonusPct: 10, extraBonus: 0, scheduleDays: 20, morningShifts: 10,
      afternoonShifts: 10, nightShifts: 0, weekendDays: 0, overtimeDays: 0, overtimeMorningShifts: 0,
      overtimeNightShifts: 0, vacationDays: 0, urlopBonus: 0, bloodDonationDays: 0, bloodBonus: 0,
      l4Days: 0, l4MissedShifts: 0
    }
  },
  {
    id: 'scenario_2',
    name: 'Сценарій 2: Інтенсив (Нічні, надгодини, до 26 років)',
    input: {
      year: 2026, month: 5, baseSalary: 5750, isUnder26: true, hasPpk: false, hasIns: true,
      presencePct: 5, bonusPct: 10, extraBonus: 150, scheduleDays: 21, morningShifts: 8,
      afternoonShifts: 5, nightShifts: 8, weekendDays: 1, overtimeDays: 2, overtimeMorningShifts: 1,
      overtimeNightShifts: 1, vacationDays: 0, urlopBonus: 0, bloodDonationDays: 0, bloodBonus: 0,
      l4Days: 0, l4MissedShifts: 0
    }
  },
  {
    id: 'scenario_3',
    name: 'Сценарій 3: PRO-акаунт (L4, відпустка, донація)',
    input: {
      year: 2026, month: 5, baseSalary: 5200, isUnder26: false, hasPpk: true, hasIns: true,
      presencePct: 0, bonusPct: 10, extraBonus: 0, scheduleDays: 20, morningShifts: 5,
      afternoonShifts: 5, nightShifts: 3, weekendDays: 0, overtimeDays: 0, overtimeMorningShifts: 0,
      overtimeNightShifts: 0, vacationDays: 2, urlopBonus: 220.5, bloodDonationDays: 1, bloodBonus: 0,
      l4Days: 4, l4MissedShifts: 3
    }
  }
];

if (!fs.existsSync(goldenPath)) {
  console.error('❌ Файл golden.json не знайдено.');
  process.exit(1);
}

const goldenData = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
let hasError = false;

for (const sc of scenarios) {
  const actual = compute(sc.input);
  const expected = goldenData[sc.id]?.output;

  if (!expected) {
    console.error(`❌ Відсутній еталон для ${sc.name}`);
    hasError = true;
    continue;
  }

  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      console.error(`❌ ${sc.name} -> ${key}: отримано ${actual[key]}, очікувалося ${expected[key]}`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.error('\n⚠️ Виявлено розбіжності між calc.js та golden.json');
  process.exit(1);
} else {
  console.log('✅ Усі golden-тести математики успішно пройдено!');
}
