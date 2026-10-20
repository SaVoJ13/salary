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
      presencePct: 5, bonusPct: 10, extraBonus: 0, schedDays: 20, morningShifts: 10,
      afternoonShifts: 10, nightShifts: 0, weekendDays: 0, overtimeDays: 0, overtimeMorning: 0,
      overtimeNight: 0, vacationDays: 0, customUrlopRate: 0, bloodDays: 0, customBloodRate: 0,
      l4Days: 0, l4MissedShifts: 0
    }
  },
  {
    id: 'scenario_2',
    name: 'Сценарій 2: Інтенсив (Нічні, надгодини, до 26 років)',
    input: {
      year: 2026, month: 5, baseSalary: 5750, isUnder26: true, hasPpk: false, hasIns: true,
      presencePct: 5, bonusPct: 10, extraBonus: 150, schedDays: 21, morningShifts: 8,
      afternoonShifts: 5, nightShifts: 8, weekendDays: 1, overtimeDays: 2, overtimeMorning: 1,
      overtimeNight: 1, vacationDays: 0, customUrlopRate: 0, bloodDays: 0, customBloodRate: 0,
      l4Days: 0, l4MissedShifts: 0
    }
  },
  {
    id: 'scenario_3',
    name: 'Сценарій 3: PRO-акаунт (L4, відпустка, донація)',
    input: {
      year: 2026, month: 5, baseSalary: 5200, isUnder26: false, hasPpk: true, hasIns: true,
      presencePct: 0, bonusPct: 10, extraBonus: 0, schedDays: 20, morningShifts: 5,
      afternoonShifts: 5, nightShifts: 3, weekendDays: 0, overtimeDays: 0, overtimeMorning: 0,
      overtimeNight: 0, vacationDays: 2, customUrlopRate: 220.5, bloodDays: 1, customBloodRate: 0,
      l4Days: 4, l4MissedShifts: 3
    }
  }
];

const isUpdate = process.argv.includes('--update');

if (isUpdate) {
  const newGolden = {};
  for (const sc of scenarios) {
    newGolden[sc.id] = { name: sc.name, output: compute(sc.input) };
  }
  fs.writeFileSync(goldenPath, JSON.stringify(newGolden, null, 2), 'utf8');
  console.log('✅ golden.json успішно оновлено!');
  process.exit(0);
}

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

  let scFailed = false;
  for (const key of Object.keys(actual)) {
    if (actual[key] !== expected[key]) {
      if (!scFailed) {
        console.error(`\n❌ ${sc.name}`);
        scFailed = true;
      }
      console.error(`   • ${key}: отримано ${actual[key]}, очікувалося ${expected[key]}`);
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
