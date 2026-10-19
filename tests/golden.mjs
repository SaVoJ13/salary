import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compute } from '../js/calc.js';

// Налаштування шляхів (оскільки ми використовуємо ES-модулі)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenPath = path.join(__dirname, 'golden.json');

// 1. Еталонні сценарії (різні комбінації змін, надгодин, L4)
const scenarios = [
  {
    name: "Сценарій 1: Базовий (без надгодин і нічних)",
    inputs: {
      baseSalary: 5750, stateDays: 20, schedDays: 20, regWorkedDays: 20,
      morningShifts: 10, afternoonShifts: 10, nightShifts: 0,
      overtimeMorningShifts: 0, overtimeNightShifts: 0,
      weekendDays: 0, overtimeDays: 0, vacDays: 0, dailyUrlopBonus: 0, extraBonus: 0,
      bloodDonationDays: 0, l4Days: 0, isPremium: false,
      isUnder26: false, ppkActive: false, insuranceActive: true, l4DailyRateCached: null,
      year: 2026, presenceBonusPct: 5, qualityBonusPct: 10
    }
  },
  {
    name: "Сценарій 2: Інтенсив (Нічні, надгодини, до 26 років)",
    inputs: {
      baseSalary: 5750, stateDays: 21, schedDays: 21, regWorkedDays: 21,
      morningShifts: 7, afternoonShifts: 7, nightShifts: 7,
      overtimeMorningShifts: 1, overtimeNightShifts: 1,
      weekendDays: 2, overtimeDays: 2, vacDays: 0, dailyUrlopBonus: 0, extraBonus: 150,
      bloodDonationDays: 0, l4Days: 0, isPremium: false,
      isUnder26: true, ppkActive: true, insuranceActive: true, l4DailyRateCached: null,
      year: 2026, presenceBonusPct: 5, qualityBonusPct: 10
    }
  },
  {
    name: "Сценарій 3: PRO-акаунт (L4, відпустка, донація)",
    inputs: {
      baseSalary: 6000, stateDays: 20, schedDays: 20, regWorkedDays: 13,
      morningShifts: 5, afternoonShifts: 5, nightShifts: 3,
      overtimeMorningShifts: 0, overtimeNightShifts: 0,
      weekendDays: 0, overtimeDays: 0, vacDays: 2, dailyUrlopBonus: 220.50, extraBonus: 0,
      bloodDonationDays: 1, l4Days: 4, isPremium: true,
      isUnder26: false, ppkActive: false, insuranceActive: true, l4DailyRateCached: 165.20,
      year: 2026, presenceBonusPct: 0, qualityBonusPct: 10
    }
  }
];

// 2. Функція прогону тестів
function runTests() {
  const results = {};
  scenarios.forEach((scenario, index) => {
    // Робимо копію вхідних даних
    const inputs = JSON.parse(JSON.stringify(scenario.inputs));
    results[`scenario_${index + 1}`] = {
      name: scenario.name,
      output: compute(inputs)
    };
  });
  return results;
}

// 3. Логіка порівняння або запису
const args = process.argv.slice(2);
const isUpdate = args.includes('--update');
const currentResults = runTests();

if (isUpdate) {
  // Записуємо як еталон
  fs.writeFileSync(goldenPath, JSON.stringify(currentResults, null, 2));
  console.log('✅ Еталонні дані успішно збережено у tests/golden.json!');
} else {
  // Перевіряємо з еталоном
  if (!fs.existsSync(goldenPath)) {
    console.error('❌ Файл golden.json не знайдено. Спочатку оновіть еталон.');
    process.exit(1);
  }

  const goldenResults = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  let hasErrors = false;

  for (const key in currentResults) {
    const current = JSON.stringify(currentResults[key].output);
    const golden = JSON.stringify(goldenResults[key].output);

    if (current !== golden) {
      console.error(`❌ Тест провалено: ${currentResults[key].name}`);
      hasErrors = true;
    } else {
      console.log(`✅ Тест пройдено: ${currentResults[key].name}`);
    }
  }

  if (hasErrors) {
    console.error('\n⚠️ Виявлено розбіжності! Ви випадково зламали математику в calc.js.');
    process.exit(1);
  } else {
    console.log('\n🚀 Всі тести пройшли успішно! Ядро працює ідеально.');
  }
}

