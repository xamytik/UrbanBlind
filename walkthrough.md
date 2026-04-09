# UrbanBlind — Полный итог сессии (Фазы 1–4)

**GitHub:** [https://github.com/smokingtakeslifeoryou/urban-blind](https://github.com/smokingtakeslifeoryou/urban-blind)  
**Ветка:** `main` | **Текущий статус:** ✅ MVP РАБОТАЕТ, ИНЦИДЕНТЫ И КОНСЕНСУС ВНЕДРЕНЫ

---

## 🏗️ Что реализовано (Кратко)

1.  **Phase 1-2: Основа и Safe Routing**
    *   Фронтенд на Next.js + MapLibre + Deck.gl.
    *   Бэкенд на FastAPI + PostGIS + PostgreSQL.
    *   Маршрутизация по графу (Dijkstra) с учетом весов рисков.
    *   Голосовое сопровождение (Web Speech API).

2.  **Phase 3: AI-Vision & Crowdsourcing (Шаг 19)**
    *   Интеграция с Gemini 2.0 Flash для анализа препятствий через камеру.
    *   Динамическое обновление графа: при обнаружении опасности улица на карте становится красной.
    *   Фикс "Stale Closures" в React для корректной передачи координат GPS на бэкенд.

3.  **Phase 4: Incident Management & Consensus (Шаг 20)**
    *   **Модель `Incident`:** Каждое обнаружение теперь — это запись в БД со статусом `pending`.
    *   **Консенсус:** Риск на графе обновляется только если получено **≥2 подтверждения** (инцидента) на одном участке в течение **15 минут**. Это защищает от ложных срабатываний камеры.
    *   **Reset API:** Добавлен эндпоинт `/api/map/reset_risks` для сброса демо-данных.

---

## 🛠️ Технический стек и БД

*   **Database:** PostgreSQL 15 + PostGIS.
*   **Migrations:** Alembic (последняя: `1a33ab06a7d8_add_incidents_table`).
*   **AI:** Google GenAI SDK (Gemini 2.0 Flash).
*   **Frontend:** React, Tailwind CSS, Deck.gl (GeoJsonLayer с `updateTriggers`).

---

## 🐛 Основные исправленные баги

*   **Alembic vs PostGIS:** Исправлены конфликты при удалении системных таблиц `topology` и `spatial_ref_sys`.
*   **Alembic vs GeoAlchemy2:** Исправлен баг с дублированием индекса `idx_incidents_geom`.
*   **React State:** Координаты не попадали в замыкание `setInterval` — исправлено через `useRef`.

---

## 🚀 Как запустить (Для нового чата)

1.  **Бэкенд:**
    ```powershell
    cd backend
    .\venv\Scripts\activate
    uvicorn main:app --reload --port 8000
    ```
2.  **Фронтенд:**
    ```powershell
    cd frontend
    npm run dev
    ```
3.  **Data:** Убедись, что `.env` содержит `DATABASE_URL` и `GEMINI_API_KEY`.

---

## 📋 План на Шаг 21 (Будущее)

1.  **Dashboard Инцидентов:** UI для модерации и просмотра архива обнаруженных угроз.
2.  **WebSockets:** Переход от polling (запросов каждые 60с) к real-time push уведомлениям.
3.  **Авто-очистка:** Cron-задача на бэкенде для автоматического снятия риска через X часов.

---
**Architect Log:** Система переведена из режима "прототип" в "Enterprise-каркас". Код полностью синхронизирован с GitHub.
