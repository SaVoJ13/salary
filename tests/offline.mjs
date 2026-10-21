/* Офлайн-тест: app.js запускається на мінімальному фейковому DOM, а імпорт Firebase з CDN
   падає (Node не вміє https-модулі — так само, як браузер без мережі).
   Перевіряємо, що гостьовий калькулятор усе одно працює і хмарні кнопки дають тост. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installFakeDom } from './helpers/fake-dom.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(here, '../js/app.js'), 'utf8');

// 1. Статична перевірка: жодного top-level await і статичного імпорту firebase.js
assert.ok(!/^(?:const|let|var)\s[^\n]*=\s*await\s/m.test(appSrc) && !/^await\s/m.test(appSrc), 'app.js не має top-level await');
assert.ok(!/^import[^\n]*firebase\.js/m.test(appSrc), 'app.js не має статично імпортувати firebase.js');

// 2. Фейковий DOM (спільний хелпер)
const { getEl, fire, store } = installFakeDom();
const originalWarn = console.warn; console.warn = () => {};

globalThis.APP_VERSION = '9.9.9';   // у браузері його задає js/version.js
// 3. Запуск застосунку: модуль має завершитись без Firebase
await import('../js/app.js');
await new Promise(r => setTimeout(r, 100));

// 4. Гостьовий розрахунок відпрацював (база за замовчуванням 5750 → NETTO > 0)
const net = getEl('netResult').innerText, gross = getEl('grossResult').innerText;
assert.ok(net && !net.startsWith('0,00'), `NETTO має бути розраховано, а не "${net}"`);
assert.ok(gross && !gross.startsWith('0,00'), `BRUTTO має бути розраховано, а не "${gross}"`);

// 5. Кнопки хмари без мережі показують тост і не падають
const { dict } = await import('../js/i18n.js');
for (const id of ['btn-login', 'btn-register']) {
  getEl('toast').innerText = '';
  await fire(getEl(id), 'click');
  assert.equal(getEl('toast').innerText, dict.uk.toastOffline, `${id}: очікувався тост про офлайн`);
}

// 5b. Скидання пароля без мережі: спершу вимога email, потім повідомлення про недоступну хмару
getEl('email').value = ''; getEl('toast').innerText = '';
await fire(getEl('btn-reset-password'), 'click');
assert.equal(getEl('toast').innerText, dict.uk.toastResetNeedEmail, 'без email — підказка');
getEl('email').value = 'user@example.com';
await fire(getEl('btn-reset-password'), 'click');
assert.equal(getEl('toast').innerText, dict.uk.toastOffline, 'без хмари — повідомлення про офлайн');
getEl('email').value = '';

// 6. Очищення поля: торкнулись і вийшли — значення повертається; стерли свідомо — лишається порожнім
const body = getEl('app-body');
const field = getEl('morningShifts');
Object.assign(field, { tagName: 'INPUT', type: 'number', readOnly: false });

field.value = '5';
await fire(body, 'focusin', field);
assert.equal(field.value, '', 'при фокусі поле очищується');
await fire(body, 'focusout', field);
assert.equal(field.value, '5', 'без введення старе значення повертається');

field.value = '5';
await fire(body, 'focusin', field);
field.value = '3'; await fire(body, 'input', field);
field.value = '';  await fire(body, 'input', field);
await fire(body, 'focusout', field);
assert.equal(field.value, '', 'свідомо стерте значення не повертається');
assert.equal(JSON.parse(store.get(`guest_month_${getEl('monthSelect').value}`)).morningShifts, '', 'збережене значення збігається з екраном');

// 7. Порожня ставка після свідомого стирання = ставка з профілю
const base = getEl('baseSalary');
Object.assign(base, { tagName: 'INPUT', type: 'number', readOnly: false, value: '7000' });
await fire(body, 'focusin', base);
base.value = '1'; await fire(body, 'input', base);
base.value = '';  await fire(body, 'input', base);
await fire(body, 'focusout', base);
assert.equal(String(base.value), '5750', 'порожня ставка замінюється ставкою з профілю');

// 8. Вибір мови працює без inline onchange
const langSel = getEl('langSelect');
langSel.value = 'pl'; await fire(langSel, 'change');
assert.equal(document.documentElement.lang, 'pl', 'зміна мови через listener');
langSel.value = 'uk'; await fire(langSel, 'change');
assert.equal(document.documentElement.lang, 'uk');

// 9. Версія показується в шапці
assert.equal(getEl('appVersion').textContent, 'v9.9.9', 'версія в шапці');

console.warn = originalWarn;
console.log('OK: офлайн-старт — гостьовий калькулятор працює, хмара вимкнена');
process.exit(0);
