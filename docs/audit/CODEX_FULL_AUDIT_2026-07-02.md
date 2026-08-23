# DISARM — полный аудит Codex, 2026-07-02

## Baseline

### Git status

```text
fatal: not a git repository (or any of the parent directories): .git
```

### Layout

- `index.html` — статический shell и все публичные разделы
- `assets/app.js` — клиентская логика, локализация, поиск, модалки, плейбук, экспорты
- `assets/style.css` — UI-слой поверх AV DS
- `data/disarm.json` — основной корпус данных
- `_avds/avds.css`, `fonts/avds/*` — design-system assets
- `scripts/smoke_static.sh` — локальный static/readiness smoke
- `docs/*.md` — история дизайн-проходов и source-sync

### Стек

- статический сайт
- без backend/runtime app server
- локальный preview: `python3 -m http.server`
- live runtime: nginx, web root `/var/www/disarm.qdev.run`

### Entry points

- public: `index.html`
- data: `data/disarm.json`
- UI boot: `DOMContentLoaded` в `assets/app.js`

### Docs / runbooks

- `README.md`
- `docs/DESIGN_BASELINE_2026-06-11.md`
- `docs/DISARM_PUBLIC_CLEANUP_2026-06-12.md`
- `docs/OFFICIAL_SOURCE_SYNC_2026-06-12.md`
- `docs/FINAL_QA_PASS_2026-06-12.md`

### CI / tests / lint / build

- CI-конфиги не найдены
- unit/integration tests не найдены
- build step не найден
- lint config не найден

### Repo-specific checks, которые реально доступны

- `node --check assets/app.js`
- `python3 -m json.tool data/disarm.json`
- `./scripts/smoke_static.sh`
- локальный smoke через `python3 -m http.server`
- screenshot smoke через `npx playwright screenshot`

### Runtime-sensitive зоны

- `assets/app.js`: поиск, матрицы, модалка, localStorage, clipboard, экспорты
- `data/disarm.json`: integrity ссылок между техниками, контрмерами и инцидентами
- production drift между локальной папкой и `/var/www/disarm.qdev.run`
- локальный секретный файл `.mcp.json`

## Findings table

| severity | area | path | evidence | risk | recommended action | status |
|---|---|---|---|---|---|---|
| critical | secrets / repo hygiene | `.mcp.json` | локальный файл содержит bearer token `agp_...` | при возврате git-истории или публикации дерева секрет может утечь | не коммитить, исключить через `.gitignore`, при следующем security-pass ротировать токен | fixed |
| high | repo hygiene / traceability | repo root | `git status` падает, `.git` отсутствует | невозможно честно отслеживать diff, review и source-of-truth | восстановить canonical git checkout или явно перенести проект в нормальный VCS-contour | needs owner decision |
| high | source / production drift | repo root vs `/var/www/disarm.qdev.run` | локально отсутствовали `favicon.svg`, `robots.txt`, `sitemap.xml`, но на проде они есть | локальный source не описывает реальный public surface | вернуть эти файлы в source tree и зафиксировать drift в docs | fixed |
| medium | data integrity | `data/disarm.json` | две ссылки контрмер указывают на отсутствующий `T0005`: `C00010 -> T0005`, `C00036 -> T0005` | неполная/ложная связность корпуса и риск неверной аналитики | сверить с upstream DISARM source и либо восстановить объект, либо удалить битые refs в отдельном data-pass | needs owner decision |
| medium | docs / deploy | `README.md` | placeholder-формулировки `configured web root`, `configured timestamped backup directory` не отражали реальный runtime | README вводит в заблуждение при deploy/передаче проекта | заменить на фактические пути и реальные smoke-команды | fixed |
| medium | frontend stability | `assets/app.js` | обработчики в red/blue/overview навешивались внутри повторных render-функций через `addEventListener()` | повторные рендеры могли накапливать listeners и давать нестабильное поведение | перевести повторно назначаемые handlers на single-binding | fixed |
| medium | security / CSP | `index.html` | CSP задана только через `<meta http-equiv>`; HTTP header CSP не найден | защита слабее, чем серверный header, и проще ломается внешними drift-изменениями | вынести CSP в nginx header при следующем infra-pass | documented |
| low | repo hygiene | repo root | отсутствовал `.gitignore` | локальные секреты и мусор проще случайно затянуть в будущий git checkout | добавить минимальный `.gitignore` под секреты и temp files | fixed |
| low | UX copy | `assets/app.js` | оставались тяжёлые/ломаные локализованные строки и англоязычные country pills | визуальная и редакторская неряшливость | подчистить явные строки и локализовать видимые страны | fixed |
| low | QA / automation gap | whole repo | не было CI, тестов, health script, link check | каждое изменение зависело от ручного прохода | добавлен минимальный static smoke script; CI остаётся отдельным будущим шагом | fixed |
| low | docs sprawl | `docs/*.md` | много дизайн-проходов и исторических отчётов | может казаться дублированием без явной классификации | сохранить как referenced history и отдельно классифицировать в legacy-отчёте | documented |

## Что проверено

### Structure / runtime

- дерево проекта
- наличие entrypoints
- продовый web root на `148.230.117.131`
- наличие продовых static artifacts

### Security

- явный секрет в `.mcp.json`
- внешние ссылки с `target="_blank"` используют `rel="noopener noreferrer"`
- inline `innerHTML` usage просмотрен вручную: в основном строится из заранее escape-нутых или контролируемых строк
- dangerous primitives `eval` / `new Function` не найдены

### Data integrity

- `data/disarm.json` валиден
- быстрый integrity-pass показал 2 отсутствующие ссылки на `T0005`

### Frontend

- `node --check assets/app.js`
- локальный screenshot-smoke вкладок:
  - overview
  - red
  - blue
  - search
  - incidents
  - playbook
  - about
- live screenshot-smoke `https://disarm.qdev.run/?tab=incidents`

### Docs / deploy

- README
- runtime paths на сервере
- совпадение локального дерева с реально отданными static files

## Что было исправлено

1. Добавлен `.gitignore` для локальных секретов и мусора.
2. Возвращены в source tree:
   - `favicon.svg`
   - `robots.txt`
   - `sitemap.xml`
3. Исправлена нестабильность повторно навешиваемых обработчиков в `assets/app.js`.
4. Подчищены отдельные UI-строки и локализованы видимые названия стран в инцидентах.
5. README приведён ближе к реальному operating state.
6. Добавлен `scripts/smoke_static.sh` для повторяемой локальной проверки.

## Что намеренно не исправлялось

- `.mcp.json` не редактировался и не “санитизировался” вручную, чтобы не трогать активный секретный локальный файл.
- `data/disarm.json` не редактировался в части `T0005`, потому что это уже content/source-of-truth вопрос, а не безопасный blind fix.
- nginx/CSP/HSTS не менялись из этого репо: это infra contour, не локальный cleanup.

## Pre-existing

- отсутствие git-репозитория в рабочем дереве
- data-integrity drift по `T0005`
- docs, завязанные на placeholder-описания production root
- отсутствие CI, тестов и formal smoke script

## Проверки после изменений

### Run

- `node --check assets/app.js`
- `python3 -m json.tool data/disarm.json`
- `./scripts/smoke_static.sh`
- `python3 -m http.server` local preview
- `npx playwright screenshot` для локальных вкладок
- live `curl -I` и live screenshot на `disarm.qdev.run`

### Result

- JS syntax: passed
- JSON validity: passed
- static smoke: passed with documented `T0005` warnings
- local preview: passed
- local screenshot smoke: passed
- live screenshot smoke: passed

## Следующий безопасный cleanup batch

1. Восстановить normal git/VCS contour.
2. Отдельно сверить `T0005` и другие возможные broken refs c upstream corpus.
3. Расширить smoke script до optional playwright route pass.
4. Отдельным infra-pass вынести CSP из meta в nginx headers.
