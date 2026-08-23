# DISARM — сверка с официальными источниками, 2026-06-12

## Цель

Проверить локальный публичный обозреватель против актуального сайта DISARM Foundation и репозиториев организации, чтобы не выдавать старый или неполный корпус за весь DISARM.

## Проверенные источники

- `https://www.disarm.foundation/`
- `https://www.disarm.foundation/framework`
- `https://github.com/DISARMFoundation/DISARMframeworks`
- `https://github.com/DISARMFoundation/DISARMframeworks-17`
- `https://github.com/DISARMFoundation/DISARMframeworks-20-observable`
- `https://github.com/DISARMFoundation/DISARMframeworks-20-assessments`
- `https://github.com/DISARMFoundation/disarm-navigator-mv`

## Состояние официальных репозиториев

| Линия | Репозиторий | HEAD | Последний коммит | Статус для нашего сайта |
|---|---|---:|---|---|
| DISARM 1.x core | `DISARMframeworks` | `49df5f649e16dfbf11e3859913c256c875c02692` | 2025-02-10 | Основной режим сайта |
| DISARM 1.7 | `DISARMframeworks-17` | `deed7a2041eb19a1bfd2ae3eeee875677fe03b9e` | 2026-05-21 | Нужен отдельный data-pass |
| DISARM 2.0 Observations | `DISARMframeworks-20-observable` | `8eb881c5e90f97c18d9e0391537ea8d9b72bddda` | 2026-05-05 | Нужен отдельный режим |
| DISARM 2.0 Assessments | `DISARMframeworks-20-assessments` | `b9cc02e449c3a104e7c126323e7d4f346cf4ff51` | 2026-05-05 | Нужен отдельный режим |

## Сверка текущей матрицы

Наш `data/disarm.json` содержит тот же основной набор, что и официальная сгенерированная SQLite-база `DISARM_database.sqlite`:

| Объект | Наш сайт | Официальная SQLite |
|---|---:|---:|
| Фазы | 4 | 4 |
| Тактики | 13 | 13 |
| Техники core | 71 | 71 |
| Контрмеры | 140 | 140 |
| Инциденты | 63 | 63 |
| Метатехники | 14 | 14 |
| Индикаторы | 95 | 95 |
| Задачи | 42 | 42 |
| Инструменты | 151 | 151 |
| Примеры | 43 | 43 |

SHA-256 официальной SQLite-базы одинаков во всех проверенных репозиториях:

```text
753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38
```

## Что не покрыто текущим интерфейсом

Текущий интерфейс не является полным multi-version DISARM Navigator. Он покрывает рабочий слой `DISARM 1.x core`, а не все новые Excel-мастеры:

| Источник | Техники / строки в Excel | Покрытие сейчас |
|---|---:|---|
| `DISARMframeworks` | 391 | core-матрица + частичный extended-слой |
| `DISARMframeworks-17` | 446 | не подключено как отдельная версия |
| `DISARMframeworks-20-observable` | 315 | не подключено; другая модель данных |
| `DISARMframeworks-20-assessments` | 70 | не подключено; другая модель данных |

Важно: DISARM 2.0 Observations официально описан как beta-компонент будущего Red Framework. Он не состоит из техник и не структурирован как kill-chain. Поэтому его нельзя механически сливать в текущие вкладки Red/Blue.

## Что изменено

- В интерфейсе уточнено, что основной режим сайта — `DISARM 1.x core`.
- В справке добавлен блок актуальных линий DISARM: 1.x core, 1.7, 2.0 Observations, 2.0 Assessments.
- В подвал добавлены ссылки на актуальные официальные линии и multi-version Navigator.
- Метаданные `data/disarm.json.version` обновлены до `DISARM 1.x core (official SQLite, 2025-02)`.
- Метаданные лицензии и публичные подписи обновлены до `CC-BY-SA-4.0`, согласно текущим `LICENSE.md` официальных репозиториев.
- Markdown/Navigator export больше не ссылается на устаревший `master-2025-03`.
- Cache-bust обновлён до `20260612-source-sync1`.

## Deferred

- Отдельный импорт DISARM 1.7 с переключателем версии.
- Отдельный экран DISARM 2.0 Observations.
- Отдельный экран DISARM 2.0 Assessments.
- Полная нормализация extended-слоя из Excel, включая очистку старых архивных названий и дубликатов.

## Проверка

- Сверены HEAD и даты коммитов официальных репозиториев.
- Сверены счетчики локального `data/disarm.json` с официальным `DISARM_database.sqlite`.
- Проверено, что SQLite во всех проверенных официальных линиях сейчас одинаковая, а отличия находятся в Excel-мастерах.
- Изменения ограничены справкой, подвалом, метаданными версии и документацией; матрица и связи объектов не менялись.
