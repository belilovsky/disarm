# DISARM — полный аудит Codex, 2026-07-04

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
- `python3 scripts/check_integrity.py`
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
| high | security / public surface | `/var/www/disarm.qdev.run/README.md`, `/docs/*`, `/scripts/*`, `/index.html.bak.*` | live `curl -I` отдавал `200` для служебных markdown/shell файлов и резервных HTML | публичная утечка внутренней документации, smoke-скриптов и старых ревизий интерфейса | закрыть эти маршруты в nginx, убрать `*.bak*` из web root и добавить live-smoke на forbidden paths | fixed |
| medium | source / public data drift | `/var/www/disarm.qdev.run/data/externalgroups.json` | на проде публично лежал `423674`-byte JSON, отсутствующий в локальном source и не используемый приложением | неучтённый публичный датасет усложняет source-of-truth и лишний раздувает наружный surface | закрыть route, убрать orphan file из web root, добавить проверку в live-smoke | fixed |
| medium | data integrity | `data/disarm.json` | две ссылки контрмер указывали на отсутствующий `T0005`: `C00010 -> T0005`, `C00036 -> T0005`; в актуальном upstream `DISARMFoundation/DISARMframeworks` объект `T0005` не находится | неполная/ложная связность корпуса и риск неверной аналитики | удалить stale refs и зафиксировать источник решения в audit-слое | fixed |
| medium | docs / deploy | `README.md` | placeholder-формулировки `configured web root`, `configured timestamped backup directory` не отражали реальный runtime | README вводит в заблуждение при deploy/передаче проекта | заменить на фактические пути и реальные smoke-команды | fixed |
| low | localization / UX | `assets/app.js`, live `?tab=incidents` | в каталоге инцидентов часть стран оставалась в английском виде (`USA`, `World`, `Qatar`, `Serbia`, `Taiwan`, `UK`) | визуальная неряшливость и неполная русификация живого каталога | довести `COUNTRY_RU` до полного покрытия фактических значений `found_in_country` | fixed |
| medium | frontend stability | `assets/app.js` | обработчики в red/blue/overview навешивались внутри повторных render-функций через `addEventListener()` | повторные рендеры могли накапливать listeners и давать нестабильное поведение | перевести повторно назначаемые handlers на single-binding | fixed |
| medium | security / headers | nginx live config | на live не было HTTP-заголовков `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy`; server banner светил `nginx/1.24.0` | weaker browser hardening и лишняя информация о сервере | добавить server-level hardening headers и `server_tokens off` | fixed |
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
- публичная доступность служебных маршрутов и резервных файлов

### Security

- явный секрет в `.mcp.json`
- внешние ссылки с `target="_blank"` используют `rel="noopener noreferrer"`
- inline `innerHTML` usage просмотрен вручную: в основном строится из заранее escape-нутых или контролируемых строк
- dangerous primitives `eval` / `new Function` не найдены
- live nginx-route pass показал, что markdown/shell/backup files реально раздавались наружу до hardening-прохода

### Data integrity

- `data/disarm.json` валиден
- быстрый integrity-pass показал 2 stale refs на `T0005`, затем после сверки с upstream drift был убран

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
- локальный mobile screenshot-smoke:
  - overview
  - red
  - incidents
- live screenshot-smoke `https://disarm.qdev.run/?tab=incidents`

### Docs / deploy

- README
- runtime paths на сервере
- совпадение локального дерева с реально отданными static files
- source-trace pass по локальному дереву, backup-дереву и доступным server-side путям

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
7. Добавлен `scripts/check_integrity.py` для строгой проверки HTML-слоя, локальных asset-ссылок, `robots.txt`, `sitemap.xml`, уникальности ID и связности корпуса.
8. Добавлен `scripts/smoke_live.sh` для проверки live headers и forbidden paths.
9. На live закрыта выдача `README.md`, `docs/*`, `scripts/*` и `*.bak*`; старые `index.html.bak.*` убраны из web root.
10. В nginx добавлены `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy` и `server_tokens off`.
11. Из `data/disarm.json` убраны два stale ref на несуществующий `T0005` в `C00010` и `C00036`.
12. В live-каталоге инцидентов доведена русификация фактических значений стран (`USA`, `World`, `Qatar`, `Serbia`, `Taiwan`, `UK`, `US`).
13. На live закрыт и удалён orphan `data/externalgroups.json`, отсутствующий в локальном source.
14. Аудитные артефакты обновлены до среза `2026-07-04`.

## Что намеренно не исправлялось

- `.mcp.json` не редактировался и не “санитизировался” вручную, чтобы не трогать активный секретный локальный файл.
- большой переводческий или структурный data-pass по `data/disarm.json` не делался; исправлен только подтверждённый stale ref.
- VCS-contour не восстанавливался искусственно: без подтверждённого canonical origin нельзя честно и безопасно “придумать” новый репозиторий поверх текущего дерева.

## Pre-existing

- отсутствие git-репозитория в рабочем дереве
- исторический data-drift по `T0005`, уже устранённый в этом проходе
- docs, завязанные на placeholder-описания production root
- отсутствие CI, тестов и formal smoke script

## Source-of-truth status

- локальное дерево не содержит `.git/`
- в доступных проверенных server-side путях найден production web root и набор timestamped backups, но не найден подтверждённый canonical git checkout этого проекта
- это значит, что текущий functional/live state приведён в порядок, но traceable source-of-truth всё ещё требует owner-level решения: либо восстановить исходный репозиторий, либо заново завести проект в нормальный VCS-контур как отдельное действие
- для этого подготовлен отдельный recovery note: `docs/audit/SOURCE_RECOVERY_2026-07-04.md`

## Проверки после изменений

### Run

- `node --check assets/app.js`
- `python3 -m json.tool data/disarm.json`
- `python3 scripts/check_integrity.py`
- `./scripts/smoke_static.sh`
- `./scripts/smoke_live.sh https://disarm.qdev.run`
- `python3 -m http.server` local preview
- `npx playwright screenshot` для локальных вкладок
- `npx playwright screenshot` для локальных mobile-сценариев
- live `curl -I` и live screenshot на `disarm.qdev.run`
- remote `./scripts/smoke_static.sh` из `/var/www/disarm.qdev.run`

### Result

- JS syntax: passed
- JSON validity: passed
- integrity checker: passed
- static smoke: passed
- live smoke: passed
- local preview: passed
- local screenshot smoke: passed
- local mobile screenshot smoke: passed
- remote static smoke: passed
- live screenshot smoke: passed
- live browser check for localized incident countries: passed (`США|США|Мир|...`)

## Следующий безопасный cleanup batch

1. Восстановить normal git/VCS contour.
2. Сделать выборочный upstream-pass по остальным связям корпуса, не только по уже найденным stale refs.
3. Расширить smoke script до optional playwright route pass.
4. Если проект вернётся в нормальный git checkout, перенести live nginx config рядом с source tree и добавить автоматическую header/regression-проверку в CI.
