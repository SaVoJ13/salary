/* Інтеграційний тест залогіненого сценарію: app.js + фейковий Firebase (через тестовий шов __salaryTest).
   Перевіряє: кеш місяця офлайн, збереження без мережі й із зависанням, очищення при виході, банер оновлення. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installFakeDom } from './helpers/fake-dom.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Статичні перевірки скидання пароля: експорт із firebase.js і кнопка всередині форми входу (type=button — не відправляє форму)
assert.ok(/sendPasswordResetEmail/.test(readFileSync(join(root, 'js/firebase.js'), 'utf8')), 'firebase.js не експортує sendPasswordResetEmail');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const formHtml = html.slice(html.indexOf('<form id="auth-form"'), html.indexOf('</form>'));
assert.ok(/<button type="button" id="btn-reset-password"/.test(formHtml), '«Забули пароль?» має бути type="button" усередині форми входу');

const { getEl, fire, fireWindow, store } = installFakeDom();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { dict } = await import('../js/i18n.js');
const toast = () => getEl('toast').innerText;

// ---- фейковий Firebase ----
const cloud = new Map();                 // path -> дані
const calls = { setDoc: [] };
let getDocMode = 'ok', setDocMode = 'ok';
const auth = { currentUser: null };
const resets = []; let resetMode = 'ok';
let authCb = null;
const stub = {
  auth, db: {},
  signInWithEmailAndPassword: async () => {}, createUserWithEmailAndPassword: async () => {},
  sendPasswordResetEmail: async (a, email) => {
    resets.push({ email, lang: a.languageCode });
    if (resetMode !== 'ok') throw Object.assign(new Error(resetMode), { code: resetMode });
  },
  signOut: async a => { a.currentUser = null; await authCb(null); },
  onAuthStateChanged: (_a, cb) => { authCb = cb; },
  doc: (_db, ...p) => ({ path: p.join('/') }),
  collection: (_db, ...p) => ({ path: p.join('/') }),
  getDoc: async ref => {
    if (getDocMode === 'fail') throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    const d = cloud.get(ref.path); return { exists: () => !!d, data: () => d };
  },
  setDoc: async (ref, data) => {
    calls.setDoc.push({ path: ref.path, data });
    if (setDocMode === 'hang') return new Promise(() => {});
    cloud.set(ref.path, data);
  },
  getDocs: async () => ({ forEach() {} })
};
globalThis.__salaryTest = { cloudLoader: async () => stub, saveTimeoutMs: 60, resetCooldownMs: 120 };
console.warn = () => {};

await import('../js/app.js');
await sleep(100);
assert.ok(authCb, 'застосунок має підписатися на onAuthStateChanged після завантаження хмари');

// 0. Скидання пароля (до входу в акаунт)
const resetBtn = getEl('btn-reset-password');
const emailEl = getEl('email');
const wait = ms => sleep(ms);
// 0a. Порожній email: підказка, жодного запиту
emailEl.value = ''; getEl('toast').innerText = '';
await fire(resetBtn, 'click');
assert.equal(toast(), dict.uk.toastResetNeedEmail); assert.equal(resets.length, 0);
// 0b. Успіх: email обрізано від пробілів, мова листа = мова інтерфейсу, кнопка розблокована
emailEl.value = '  user@example.com  ';
await fire(resetBtn, 'click');
assert.equal(resets.length, 1); assert.equal(resets[0].email, 'user@example.com'); assert.equal(resets[0].lang, 'uk');
assert.equal(toast(), dict.uk.toastResetSent); assert.equal(resetBtn.disabled, false);
// 0c. Повторне натискання одразу: пауза, другого запиту немає
await fire(resetBtn, 'click');
assert.equal(resets.length, 1, 'у період паузи другого листа не надсилаємо');
assert.ok(toast().startsWith(dict.uk.toastResetWait.split('{n}')[0]), `очікувалось повідомлення про паузу, а не "${toast()}"`);
// 0d. Акаунта не існує: відповідь та сама (не розкриваємо, які email зареєстровані)
await wait(150); resetMode = 'auth/user-not-found'; getEl('toast').innerText = '';
await fire(resetBtn, 'click');
assert.equal(resets.length, 2); assert.equal(toast(), dict.uk.toastResetSent, 'user-not-found не має відрізнятися від успіху');
// 0e. Помилки Firebase → зрозумілі повідомлення; після помилки паузи немає
await wait(150);
for (const [code, key] of [['auth/invalid-email', 'errInvalidEmail'], ['auth/too-many-requests', 'errTooMany'], ['auth/network-request-failed', 'errNetwork']]) {
  resetMode = code; getEl('toast').innerText = '';
  await fire(resetBtn, 'click');
  assert.equal(toast(), dict.uk.toastResetErr + dict.uk[key], `${code}: очікувалось локалізоване повідомлення`);
  assert.equal(resetBtn.disabled, false);
}
assert.equal(resets.length, 5, 'після помилок повторна спроба одразу дозволена');
// 0f. Мова листа слідує за мовою інтерфейсу
resetMode = 'ok'; await wait(150);
getEl('langSelect').value = 'pl'; await fire(getEl('langSelect'), 'change');
await fire(resetBtn, 'click');
assert.equal(resets.at(-1).lang, 'pl'); assert.equal(toast(), dict.pl.toastResetSent);
getEl('langSelect').value = 'uk'; await fire(getEl('langSelect'), 'change');
emailEl.value = '';

const month = getEl('monthSelect').value;
const monthPath = `users/u1/months/${month}`;
const cacheKey = `cloud_month_u1_${month}`;

// 1. Вхід: місяць з хмари заповнює поля і потрапляє в локальну копію
cloud.set(monthPath, { baseSalary: '6100', morningShifts: '10', nightShifts: '4' });
auth.currentUser = { uid: 'u1', email: 'user@example.com' };
await authCb(auth.currentUser);
assert.equal(getEl('morningShifts').value, '10', 'поля заповнені з хмари');
assert.ok(store.has(cacheKey), 'після успішного завантаження є локальна копія місяця');
assert.equal(JSON.parse(store.get(cacheKey)).data.morningShifts, '10');

// 2. Хмара недоступна: показується копія з повідомленням (а не порожні поля)
getDocMode = 'fail';
getEl('morningShifts').value = '0';
getEl('toast').innerText = '';
await fire(getEl('btn-sync-down'), 'click');
assert.equal(getEl('morningShifts').value, '10', 'при збої хмари поля беруться з локальної копії');
assert.ok(toast().startsWith(dict.uk.toastLoadCached), `очікувався тост про копію, а не "${toast()}"`);

// 2b. Без мережі (navigator.onLine=false) — те саме, без очікування таймауту Firestore
navigator.onLine = false; getDocMode = 'ok';
getEl('morningShifts').value = '0'; getEl('toast').innerText = '';
await fire(getEl('btn-sync-down'), 'click');
assert.equal(getEl('morningShifts').value, '10', 'офлайн: поля з локальної копії');
assert.ok(toast().startsWith(dict.uk.toastLoadCached));

// 3. Збереження без мережі: setDoc не викликається, кнопка не лишається заблокованою
calls.setDoc.length = 0; getEl('toast').innerText = '';
await fire(getEl('btn-sync-up-calc'), 'click');
assert.equal(calls.setDoc.length, 0, 'без мережі setDoc не має викликатись');
assert.equal(toast(), dict.uk.toastSaveOffline);
assert.equal(getEl('btn-sync-up-calc').disabled, false);

// 3b. Мережа «є», але запис висне: таймаут → повідомлення, кнопка розблокована
navigator.onLine = true; setDocMode = 'hang'; getEl('toast').innerText = '';
await fire(getEl('btn-sync-up-calc'), 'click');
assert.equal(toast(), dict.uk.toastSaveOffline, 'зависання запису не має мовчки блокувати кнопку');
assert.equal(getEl('btn-sync-up-calc').disabled, false);
assert.equal(calls.setDoc.length, 1);

// 4. Звичайне збереження: запис у правильний шлях + оновлена локальна копія
setDocMode = 'ok'; calls.setDoc.length = 0; getEl('morningShifts').value = '12'; getEl('toast').innerText = '';
await fire(getEl('btn-sync-up-info'), 'click');
assert.equal(calls.setDoc.length, 1);
assert.equal(calls.setDoc[0].path, monthPath);
assert.equal(calls.setDoc[0].data.morningShifts, '12');
assert.equal(toast(), dict.uk.toastSaveCloud);
assert.equal(JSON.parse(store.get(cacheKey)).data.morningShifts, '12', 'копія оновлена після збереження');

// 5. Вихід: копія місяців і профіль акаунта прибрані, гостьові дані лишаються
store.set('user_profile_u1', '{"baseSalary":6100}');
store.set('guest_month_2026-01', '{"baseSalary":"5000"}');
await fire(getEl('btn-logout'), 'click');
assert.ok(![...store.keys()].some(k => k.startsWith('cloud_month_u1_')), 'копії місяців акаунта видалені');
assert.ok(!store.has('user_profile_u1'), 'локальна копія профілю акаунта видалена');
assert.ok(store.has('guest_month_2026-01'), 'гостьові дані не чіпаємо');

// 6. Банер нової версії: подія від sw-register показує, «Пізніше» ховає, «Оновити» перезавантажує
const banner = getEl('update-banner'); banner.classList.add('hidden');
await fireWindow('salary:update-ready');
assert.equal(banner.classList.contains('hidden'), false, 'банер має з\'явитись');
await fire(getEl('btn-update-later'), 'click');
assert.equal(banner.classList.contains('hidden'), true, '«Пізніше» ховає банер');
await fireWindow('salary:update-ready');
assert.equal(banner.classList.contains('hidden'), false);
await fire(getEl('btn-update'), 'click');
assert.equal(location.reloads, 1, '«Оновити» перезавантажує сторінку');

console.log('OK: хмара (скидання пароля, кеш офлайн, збереження без мережі й зі зависанням, вихід, банер оновлення)');
process.exit(0);
