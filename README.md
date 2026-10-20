# salary — калькулятор зарплати (PWA)

Орієнтовний розрахунок зарплати brutto/netto для польського ринку праці (UA/PL інтерфейс, світла/темна тема, робота як встановлюваний застосунок).
Результат є прогнозом і не замінює розрахунковий лист роботодавця.

**Демо:** https://savoj13.github.io/salary/

## Режими

- **Гість** — усі дані зберігаються лише в `localStorage` на цьому пристрої.
- **PRO (після входу)** — синхронізація місяців і профілю в Firebase (Firestore), відпускні, донорство крові, лікарняний L4.
- **Офлайн** — якщо Firebase недоступний, застосунок стартує як гостьовий калькулятор, хмарні кнопки показують повідомлення.

## Структура

```
index.html          розмітка
css/styles.css      стилі
js/calc.js          уся математика (без DOM і Firebase)
js/app.js           UI, профіль, хмара, події
js/i18n.js          переклади UA/PL
js/firebase.js      ініціалізація Firebase
js/utils.js         formatPLN, showToast
js/sw-register.js   реєстрація service worker
sw.js               кеш для офлайн-роботи
tests/              golden-тест математики, i18n, офлайн-старт, безпека
firestore.rules     правила Firestore
firebase.json, .firebaserc   деплой правил
```

## Запуск і тести

Модулі ES не працюють з `file://`, потрібен локальний сервер:

```bash
npx serve .
npm test           # golden-тест математики + перевірка i18n (Node 22+)
npm run test:update   # лише якщо формули змінено свідомо
```

`tests/golden.json` фіксує результати `compute()` на наборі сценаріїв. Якщо `npm test` падає після рефакторингу, значить змінилися цифри.

## Деплой (GitHub Pages)

Settings → Pages → Deploy from a branch → `main` / `(root)`.
**Після кожної зміни файлів підіймай `VERSION` у `sw.js`**, інакше користувачі бачитимуть кешовану версію.

## Дані в Firebase

- `users/{uid}/months/{YYYY-MM}` — введені значення за місяць
- `users/{uid}/profile/userProfile` — профіль

## Безпека

- **Правила Firestore** лежать у `firestore.rules`: доступ лише власнику (`request.auth.uid == uid`), усе інше заборонено.
  Деплой: `npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules`
  (проєкт задано в `.firebaserc`). Перед деплоєм перевір правила в консолі Firebase → Firestore → Rules → Playground.
- **API-ключ** у `firebase.js` публічний за задумом Firebase. Обмеж його за доменом (HTTP referrers) у Google Cloud Console → Credentials: твій домен GitHub Pages і `localhost`.
- **CSP** задано через `<meta>` в `index.html` (GitHub Pages не дає ставити заголовки). Тому в розмітці немає inline-коду (`onchange=`, `style=`, `<script>` без `src`), це перевіряє `tests/security.mjs`.
  Якщо після змін вхід чи хмара не працюють, відкрий DevTools → Console, знайди «Refused to … Content Security Policy» і додай потрібне джерело в CSP. Вхід через popup/redirect (Google тощо) потребує додаткових дозволів (`frame-src` на `*.firebaseapp.com`, `script-src` на `apis.google.com`); для email/пароля вони не потрібні.
- **Firebase SDK** закріплено на версії 12.13.0 у `js/firebase.js` (однакова у всіх імпортах). Оновлюй усі три файли разом і перевіряй вхід та збереження місяця.
- **Вихід з акаунта** видаляє локальну копію профілю (`user_profile_<uid>`); гостьові дані лишаються.
- Тести безпеки: `npm test` (CSP, відсутність inline-коду, правила, версія SDK, `permissions` у CI). Вони статичні й не замінюють перевірку в браузері.
