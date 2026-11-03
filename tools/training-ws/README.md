# Training WS (опционально)

Быстрый путь сохранения attempt по WebSocket → MySQL в обход Laravel HTTP.

**Прод / дешёвый хост:** не нужен — фронт по умолчанию шлёт `POST /api/training/attempt`.

**Локалка:** включи на фронте:

```env
NEXT_PUBLIC_TRAINING_ATTEMPT_TRANSPORT=ws
NEXT_PUBLIC_TRAINING_WS_URL=ws://localhost:8091
```

## Запуск

```bash
cd tools/training-ws
npm install
npm start
```

Читает `DB_*` и `TRAINING_WS_PORT` из корневого `.env` (`../../.env`).

По умолчанию: `ws://localhost:8091`.

## Синхронизация алгоритма

`updateAttempts.mjs` — зеркало `App\Services\TrainingProgressService::updateAttempts`.  
При правке scoring меняй оба файла. Правило: `.cursor/rules/training-attempts-sync.mdc`.
