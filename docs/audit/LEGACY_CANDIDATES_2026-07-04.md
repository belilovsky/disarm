# DISARM — legacy candidates, 2026-07-04

## likely dead

Пока не подтверждено ничего, что можно безопасно удалить без source-trace и live-reference proof.

## duplicate / superseded

- `docs/DESIGN_PASS_*.md`
  - на первый взгляд похожи на исторические промежуточные отчёты
  - но сейчас **сохраняем**, потому что они явно referenced из `README.md`

- `docs/FINAL_QA_PASS_2026-06-12.md`
  - частично пересекается с новым audit-слоем
  - но это отдельный финальный исторический срез, поэтому **оставить**

## generated drift

- `data/disarm.json`
  - содержит признаки ручного локализационного слоя поверх upstream corpus
  - stale refs на `T0005` уже убраны после upstream-сверки
  - полный data-pass всё равно требует осторожности и source-trace

- `extended_techniques` внутри `data/disarm.json`
  - выглядит как исторически импортированный расширенный слой
  - местами содержит тяжёлые авто-собранные формулировки
  - требуется отдельный data-pass, не удалять автоматически

## keep because referenced

- `docs/DESIGN_BASELINE_2026-06-11.md`
- `docs/DESIGN_PASS_OVERVIEW_2026-06-11.md`
- `docs/DESIGN_PASS_RED_2026-06-11.md`
- `docs/DESIGN_PASS_BLUE_2026-06-11.md`
- `docs/DESIGN_PASS_SEARCH_2026-06-11.md`
- `docs/DESIGN_PASS_INCIDENTS_2026-06-11.md`
- `docs/DESIGN_PASS_PLAYBOOK_2026-06-12.md`
- `docs/DESIGN_PASS_ABOUT_2026-06-12.md`
- `docs/DISARM_PUBLIC_CLEANUP_2026-06-12.md`
- `docs/OFFICIAL_SOURCE_SYNC_2026-06-12.md`
- `docs/FINAL_QA_PASS_2026-06-12.md`

Причина: README ссылается на них как на историю production/design проходов.

## needs owner decision

- `.mcp.json`
  - должен считаться локальным private file, не частью публичного source tree
  - с точки зрения гигиены его нужно держать вне versioned tree
  - но удалять/перемещать автоматически нельзя, потому что он может быть нужен локальному workflow

- отсутствие `.git/`
  - это не файл, а состояние дерева
  - прежде чем делать более агрессивную cleanup-нормализацию, нужен owner-level выбор canonical repo/source-of-truth

- остальные возможные drift-места в `data/disarm.json`
  - локальный корпус сочетает upstream DISARM и ручной локализационный слой, поэтому более широкие правки всё ещё требуют source-trace
