# Мой день — задачи как чаты

## Первый запуск
1. Создайте репозиторий на GitHub (например `CLUTCH`).
2. Если имя другое — поправьте `base` в `vite.config.js`.
3. В терминале, в этой папке:
   ```
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/ВАШ_ЛОГИН/CLUTCH.git
   git push -u origin main
   ```
4. На GitHub: Settings → Pages → Source: **GitHub Actions**.
5. Через минуту приложение доступно по адресу `https://ВАШ_ЛОГИН.github.io/CLUTCH/`.
6. На iPhone откройте в Safari → Поделиться → «На экран Домой».

## Локально
```
npm install
npm run dev
```

## Обновление
Меняете `src/App.jsx` → `git add . && git commit -m "..." && git push`. Сайт пересоберётся сам.
