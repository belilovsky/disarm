/* =============================================================
   DISARM explorer — клиентское приложение
   Bugfixes + P0-фичи: heatmap, добавление в плейбук, coverage,
   deep-link с состоянием, DISARM Navigator JSON, STIX 2.1 export
   ============================================================= */
(() => {
  'use strict';

  const I18N = globalThis.DisarmI18n;
  const ui = value => I18N.text(value);
  const uiFormat = (key, ...values) => { let i = 0; return ui(key).replaceAll('{n}', () => typeof values[i] === 'number' ? new Intl.NumberFormat({ru:'ru-RU',kk:'kk-KZ',en:'en-GB'}[STATE.locale]).format(values[i++]) : values[i++]); };
  const ANALYSIS = globalThis.DisarmAnalysis;
  if (!ANALYSIS) throw new Error('DisarmAnalysis core is not loaded');
  const DISARM_SOURCE_URL = 'https://github.com/DISARMFoundation/DISARMframeworks-17';

  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  /* ---- State ---- */
  const STATE = {
    data: null,
    byId: new Map(),         // disarm_id -> {obj,_type}
    incidentByTech: new Map(), // technique_id -> [incident objects]
    heatmap: false,
    initialDeepLink: null,   // {tab, technique, playbook[]}
    tabSelectedDuringLoad: null,
    modalReturnFocus: null,
    locale: 'ru',
    dataState: 'loading',
  };
  const UI_KEY = 'disarm-ui-density';
  const THEME_KEY = 'disarm-ui-theme';
  const LOCALE_KEY = 'disarm-ui-locale';
  const TEXT_SCALE_KEY = 'disarm-ui-text-scale';
  const DATA_CACHE_KEY = 'disarm-framework-data-v2';
  const DATA = globalThis.DisarmData;
  STATE.cachedAt = null;
  const AVDS_THEMES = new Set(['institutional', 'editorial', 'analytics', 'map', 'dark']);
  const AVDS_LOCALES = new Set(['ru', 'kk', 'en']);

  const LOCALE_COPY = {
    ru: {
      skip: 'Перейти к содержанию', kicker: 'Обозреватель фреймворка DISARM', title: 'Фреймворк', language: 'Язык',
      tabs: { overview: 'Обзор', red: 'Матрица атак', blue: 'Матрица защиты', search: 'Поиск', incidents: 'Инциденты', playbook: 'План реагирования', about: 'Справка' },
      search: 'Быстрый поиск: T0049, нарратив, контрмера…', shortcuts: 'Вкладки 1–7 · Enter — поиск', exampleQueries: 'Примеры запросов',
      density: { compact: 'Компактно', comfortable: 'Обычный режим' }, theme: 'Тема', textScale: 'Масштаб текста',
      themes: { institutional: 'Институциональная', editorial: 'Редакционная', analytics: 'Данные', map: 'Карта', dark: 'Тёмная' },
      retry: 'Повторить', skeleton: 'Загрузка данных DISARM',
      states: { loading: 'Загрузка проверенного среза DISARM…', ready: 'Данные загружены из локального среза DISARM.', stale: 'Показана сохранённая копия; требуется обновление.', degraded: 'Показана сохранённая копия; часть функций работает с ограничениями.', offline: 'Нет сети. Показана сохранённая копия.', error: 'Не удалось загрузить данные. Проверьте подключение и повторите попытку.' },
      localeScope: 'Полного перевода корпуса нет: часть названий и описаний DISARM остаётся на английском, если проверенный перевод отсутствует.',
      statusBadge: (version, techniques, counters) => `${version} · ${techniques} техник · ${counters} контрмер`,
      missingAttribution: 'нет сведений',
    },
    kk: {
      skip: 'Мазмұнға өту', kicker: 'DISARM фреймворкін шолу', title: 'Фреймворк', language: 'Тіл',
      localeScope: 'DISARM атаулары мен сипаттамалары тексерілген аудармасы болмаған кезде бастапқы тілінде беріледі.',
      tabs: { overview: 'Шолу', red: 'Шабуыл матрицасы', blue: 'Қорғаныс матрицасы', search: 'Іздеу', incidents: 'Оқиғалар', playbook: 'Әрекет жоспары', about: 'Анықтама' },
      search: 'Жылдам іздеу: T0049, нарратив, қарсы шара…', shortcuts: '1–7 қойынды · Enter — іздеу', exampleQueries: 'Іздеу мысалдары',
      density: { compact: 'Ықшам', comfortable: 'Қалыпты режим' }, theme: 'Тақырып', textScale: 'Мәтін масштабы',
      themes: { institutional: 'Институционалдық', editorial: 'Редакциялық', analytics: 'Деректер', map: 'Карта', dark: 'Қараңғы' },
      retry: 'Қайталау', skeleton: 'DISARM деректері жүктелуде',
      states: { loading: 'Тексерілген DISARM үзіндісі жүктелуде…', ready: 'Деректер жергілікті DISARM үзіндісінен жүктелді.', stale: 'Сақталған көшірме көрсетілуде; жаңарту қажет.', degraded: 'Сақталған көшірме көрсетілуде; кей функциялар шектеулі.', offline: 'Желі жоқ. Сақталған көшірме көрсетілуде.', error: 'Деректер жүктелмеді. Байланысты тексеріп, қайталап көріңіз.' },
      statusBadge: (version, techniques, counters) => `${version} · ${techniques} техника · ${counters} қарсы шара`,
      missingAttribution: 'дерек жоқ',
    },
    en: {
      skip: 'Skip to content', kicker: 'DISARM framework explorer', title: 'Framework', language: 'Language',
      localeScope: 'DISARM names and descriptions keep their source wording where no reviewed translation exists.',
      tabs: { overview: 'Overview', red: 'Attack matrix', blue: 'Defence matrix', search: 'Search', incidents: 'Incidents', playbook: 'Response plan', about: 'About' },
      search: 'Quick search: T0049, narrative, countermeasure…', shortcuts: 'Tabs 1–7 · Enter — search', exampleQueries: 'Example queries',
      density: { compact: 'Compact', comfortable: 'Comfortable mode' }, theme: 'Theme', textScale: 'Text scale',
      themes: { institutional: 'Institutional', editorial: 'Editorial', analytics: 'Data', map: 'Map', dark: 'Dark' },
      retry: 'Retry', skeleton: 'Loading DISARM data',
      states: { loading: 'Loading the verified DISARM snapshot…', ready: 'Data loaded from the local DISARM snapshot.', stale: 'Showing a cached copy; refresh required.', degraded: 'Showing a cached copy; some functions are limited.', offline: 'No network. Showing a cached copy.', error: 'Data could not be loaded. Check the connection and try again.' },
      statusBadge: (version, techniques, counters) => `${version} · ${techniques} techniques · ${counters} countermeasures`,
      missingAttribution: 'no attribution',
    },
  };

  const localeCopy = () => LOCALE_COPY[STATE.locale] || LOCALE_COPY.ru;
  function updateStatusBadgeText(data = STATE.data) {
    const badge = $('#status-badge');
    if (!badge || !data) return;
    const version = formatVersionLabel(data.version || '—');
    badge.textContent = localeCopy().statusBadge(version, data.techniques.length, data.counters.length);
  }

  /* ---- Utils ---- */
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const truncate = (s, n=180) => {
    s = String(s || '');
    return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
  };
  const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
  function pluralRu(count, one, few, many) {
    const n = Math.abs(Number(count) || 0);
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }
  function formatVersionLabel(version) {
    return ui(String(version || '')
      .replace('official SQLite', 'официальная SQLite-база')
      .replace('verified', 'сверено'));
  }
  function formatCachedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'сохранённой копии';
    return new Intl.DateTimeFormat({ru:'ru-RU',kk:'kk-KZ',en:'en-GB'}[STATE.locale], { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
  function displayAttribution(value) {
    const raw = String(value || '').trim();
    return raw.toLowerCase() === ['un', 'known'].join('') ? localeCopy().missingAttribution : raw;
  }
  function setDataState(state, opts = {}) {
    STATE.dataState = state;
    const panel = $('#data-state');
    const copy = $('#data-state-copy');
    const retry = $('#data-retry');
    const skeleton = $('#app-loading');
    const main = $('#main-content');
    const cachedAt = opts.cachedAt ? formatCachedAt(opts.cachedAt) : null;
    const copyMap = localeCopy().states;
    const messages = {
      ...copyMap,
      stale: `${copyMap.stale}${cachedAt ? ` · ${cachedAt}` : ''}`,
      degraded: `${copyMap.degraded}${cachedAt ? ` · ${cachedAt}` : ''}`,
      offline: `${copyMap.offline}${cachedAt ? ` · ${cachedAt}` : ''}`,
    };
    if (panel) panel.dataset.state = state;
    if (copy) copy.textContent = messages[state] || messages.error;
    if (main) main.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    if (skeleton) skeleton.hidden = state !== 'loading';
    if (retry) {
      const needsRetry = ['stale', 'degraded', 'offline', 'error'].includes(state);
      retry.hidden = !needsRetry;
      retry.disabled = state === 'loading';
    }
  }
  function announceA11y(message) {
    const transcript = $('#a11y-transcript');
    if (!transcript) return;
    transcript.textContent = '';
    requestAnimationFrame(() => { transcript.textContent = ui(message); });
  }
  async function readCachedData() {
    try { return await DATA.readCache(localStorage.getItem(DATA_CACHE_KEY)); }
    catch { return null; }
  }
  function cacheData(text) {
    STATE.cachedAt = new Date().toISOString();
    try {
      localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ schema: DATA.schema, digest: DATA.digest, savedAt: STATE.cachedAt, text }));
    } catch {}
  }
  function applyLocale(requested) {
    const locale = AVDS_LOCALES.has(requested) ? requested : 'ru';
    const previous = STATE.locale;
    STATE.locale = locale;
    I18N.setLocale(locale);
    const copy = localeCopy();
    document.documentElement.lang = locale;
    const skip = $('.skip-link');
    if (skip) skip.textContent = copy.skip;
    const kicker = $('.avds-masthead__kicker');
    if (kicker) kicker.textContent = copy.kicker;
    const title = $('#masthead-vs');
    if (title) title.textContent = copy.title;
    $$('#tabs .avds-pill-tab').forEach(tab => {
      if (copy.tabs[tab.dataset.tab]) tab.textContent = copy.tabs[tab.dataset.tab];
    });
    const quickSearch = $('#workspace-search');
    if (quickSearch) quickSearch.placeholder = copy.search;
    const shortcuts = $('.workspace-shortcuts');
    if (shortcuts) shortcuts.textContent = copy.shortcuts;
    const exampleQueries = $('#search-examples-title');
    if (exampleQueries) exampleQueries.textContent = copy.exampleQueries;
    const themeLabel = $('.avds-theme-picker > span');
    if (themeLabel) themeLabel.textContent = copy.theme;
    const localeLabel = $('.avds-locale-picker > span');
    if (localeLabel) localeLabel.textContent = copy.language;
    const themeSelect = $('#theme-select');
    if (themeSelect) {
      themeSelect.setAttribute('aria-label', copy.theme);
      $$('option', themeSelect).forEach(option => { option.textContent = copy.themes[option.value] || option.textContent; });
    }
    const localeSelect = $('#locale-select');
    if (localeSelect) {
      localeSelect.setAttribute('aria-label', copy.language);
      localeSelect.value = locale;
    }
    const localeScopeNote = $('#locale-scope-note');
    if (localeScopeNote) {
      localeScopeNote.textContent = copy.localeScope || '';
      localeScopeNote.hidden = !copy.localeScope;
    }
    const textScaleLabel = $('.avds-text-scale-picker > span');
    if (textScaleLabel) textScaleLabel.textContent = copy.textScale;
    const textScaleSelect = $('#text-scale-select');
    if (textScaleSelect) textScaleSelect.setAttribute('aria-label', copy.textScale);
    const retry = $('#data-retry');
    if (retry) retry.textContent = copy.retry;
    const skeleton = $('#app-loading');
    if (skeleton) skeleton.setAttribute('aria-label', copy.skeleton);
    const density = $('#density-toggle');
    if (density) density.textContent = document.documentElement.dataset.density === 'compact' ? copy.density.comfortable : copy.density.compact;
    if (STATE.data && previous !== locale) {
      renderOverview(); renderRedMatrix(); renderBlueMatrix(); renderIncidents();
      STATE._pb?.renderTechList($('#pb-tech-filter')?.value || '');
      STATE._pb?.renderCounters(); STATE.runSearch?.();
      if (STATE.modalId && !$('#modal').hidden) openModal(STATE.modalId);
    }
    I18N.render();
    const url = new URL(location.href); url.searchParams.set('locale', locale);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    updateStatusBadgeText();
    setDataState(STATE.dataState, { cachedAt: STATE.cachedAt });
    updateDocumentMeta($('.tabpanel.active')?.dataset.panel || 'overview');
    try { localStorage.setItem(LOCALE_KEY, locale); } catch {}
    I18N.render();
    requestAnimationFrame(() => STATE.revealSelectedTab?.());
  }
  function setupLocale() {
    let saved = 'ru';
    try { saved = localStorage.getItem(LOCALE_KEY) || saved; } catch {}
    applyLocale(new URLSearchParams(location.search).get('locale') || saved);
    $('#locale-select')?.addEventListener('change', event => applyLocale(event.target.value));
  }
  function setupTextScale() {
    const select = $('#text-scale-select');
    if (!select) return;
    const allowed = new Set(['100', '125', '150', '200']);
    const apply = requested => {
      const scale = allowed.has(String(requested)) ? String(requested) : '100';
      document.documentElement.dataset.textScale = scale;
      select.value = scale;
      try { localStorage.setItem(TEXT_SCALE_KEY, scale); } catch {}
      announceA11y(`${localeCopy().textScale}: ${scale}%`);
    };
    let saved = '100';
    try { saved = localStorage.getItem(TEXT_SCALE_KEY) || saved; } catch {}
    apply(saved);
    select.addEventListener('change', event => apply(event.target.value));
  }
  function setupTheme() {
    const picker = $('#theme-select');
    const applyTheme = (requested) => {
      const theme = AVDS_THEMES.has(requested) ? requested : 'institutional';
      const root = document.documentElement;
      root.dataset.avdsTheme = theme;
      root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
      if (picker) picker.value = theme;
      try { localStorage.setItem(THEME_KEY, theme); } catch {}
    };
    let saved = 'institutional';
    try { saved = localStorage.getItem(THEME_KEY) || saved; } catch {}
    applyTheme(saved);
    picker?.addEventListener('change', () => applyTheme(picker.value));
  }
  function setupDataRecovery() {
    $('#data-retry')?.addEventListener('click', () => location.reload());
    window.addEventListener('offline', () => {
      if (STATE.data) setDataState('offline', { cachedAt: STATE.cachedAt });
    });
    window.addEventListener('online', () => {
      if (STATE.data) setDataState('stale', { cachedAt: STATE.cachedAt });
    });
  }
  function tabHref(tab) {
    return `${location.pathname}?tab=${encodeURIComponent(tab)}&locale=${STATE.locale}`;
  }
  function renderQuickLinksRail(el, items = [], opts = {}) {
    if (!el) return;
    el.classList.toggle('quick-links-rail--wrap', !!opts.wrap);
    el.innerHTML = items.map(item => {
      const meta = item.meta ? `<span class="quick-link-pill__meta">${escape(item.meta)}</span>` : '';
      const cls = `quick-link-pill${item.active ? ' is-active' : ''}`;
      if (item.href) {
        return `<a class="${cls}" href="${escape(item.href)}"${item.external ? ' target="_blank" rel="noopener noreferrer"' : ''}${item.active ? ' aria-current="page"' : ''}>${item.icon ? `<span>${item.icon}</span>` : ''}<span>${escape(item.label)}</span>${meta}</a>`;
      }
      return `<span class="${cls}">${item.icon ? `<span>${item.icon}</span>` : ''}<span>${escape(item.label)}</span>${meta}</span>`;
    }).join('');
  }
  function renderSummaryStrip(el, items = []) {
    if (!el) return;
    el.innerHTML = items.map(item => `
      <article class="summary-card avds-surface-card">
        ${item.eyebrow ? `<div class="summary-card__eyebrow">${escape(item.eyebrow)}</div>` : ''}
        <div class="summary-card__title">${escape(item.title)}</div>
        ${item.description ? `<div class="summary-card__desc">${escape(item.description)}</div>` : ''}
      </article>
    `).join('');
  }
  function renderCompareCards(el, cards = []) {
    if (!el) return;
    el.innerHTML = cards.map(card => {
      const rows = card.rows || [];
      const maxValue = Math.max(0, ...rows.map(row => Number(row.value) || 0));
      const unit = card.unit || 'значений';
      const maxLabel = maxValue ? `${maxValue} ${escape(unit)}` : 'нет данных';
      return `
      <section class="compare-card avds-surface-card" data-viz="comparison-bar" aria-label="${escape(card.title || 'Сравнение')}" data-table-alternative="true">
        <div class="compare-card__eyebrow">${escape(card.eyebrow || 'сравнение')}</div>
        <h3 class="compare-card__title">${escape(card.title)}</h3>
        ${card.summary ? `<p class="compare-card__summary">${escape(card.summary)}</p>` : ''}
        <div class="compare-card__axis" role="img" aria-label="Шкала: от 0 до ${escape(maxLabel)}">
          <span>0</span><span>максимум ${escape(maxLabel)}</span>
        </div>
        <div class="compare-card__rows">
          ${rows.map(row => `
            <div class="compare-row"${row.valueLabel ? '' : ' data-missing="true"'}>
              <span class="compare-row__label">${escape(row.label)}</span>
              <span class="compare-row__bar" aria-hidden="true"><i class="compare-row__fill" style="width:${row.width || '8%'}"></i></span>
              <strong class="compare-row__value">${escape(row.valueLabel || 'нет данных')}</strong>
            </div>
          `).join('')}
        </div>
        <div class="compare-card__source">Источник: <a href="https://github.com/DISARMFoundation/DISARMframeworks-17" target="_blank" rel="noopener noreferrer">DISARM 1.7.0 · SQLite-ядро</a></div>
        ${card.footerNote ? `<div class="compare-card__footer">${escape(card.footerNote)}</div>` : ''}
      </section>
    `;
    }).join('');
  }
  function setInsightBar(el, lead, chips = []) {
    if (!el) return;
    el.innerHTML = `<strong>${escape(lead)}</strong>${chips.map(chip => `<span class="filter-insight-chip">${escape(chip)}</span>`).join('')}`;
    el.classList.toggle('is-active', chips.length > 0);
  }
  function topRows(items, valueSelector, labelSelector, limit = 4) {
    const rows = items
      .map(item => ({ item, value: Number(valueSelector(item)) || 0 }))
      .filter(row => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
    const max = Math.max(1, ...rows.map(row => row.value));
    return rows.map(({ item, value }) => ({
      label: labelSelector(item),
      valueLabel: String(value),
      width: `${Math.max(8, (value / max) * 100)}%`,
      value,
    }));
  }
  function highlight(text, query) {
    const safe = escape(text || '');
    const q = String(query || '').trim();
    if (!q) return safe;
    const rx = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    return safe.replace(rx, '<mark>$1</mark>');
  }
  const uuidv4 = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
  const downloadBlob = (data, filename, mime='application/json') => {
    const blob = new Blob([data], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const TYPE_LABELS = {
    technique: 'Техника',
    counter:   'Контрмера',
    incident:  'Инцидент',
    tactic:    'Тактика',
    phase:     'Этап',
    metatechnique: 'Метатехника',
    detection: 'Индикатор',
    task:      'Задача',
    tool:      'Инструмент',
  };
  const TYPE_CSS = {
    technique:'tech', counter:'counter', incident:'incident',
    tactic:'tactic', tool:'tool', detection:'detection', task:'task',
  };
  const PHASE_RU = {
    Plan: 'План',
    Prepare: 'Подготовка',
    Execute: 'Исполнение',
    Assess: 'Оценка',
  };
  const PHASE_RU_LONG = {
    Plan: 'Планирование',
    Prepare: 'Подготовка',
    Execute: 'Исполнение',
    Assess: 'Оценка',
  };
  const COUNTRY_RU = {
    Armenia: 'Армения',
    Brazil: 'Бразилия',
    China: 'Китай',
    EU: 'ЕС',
    France: 'Франция',
    Germany: 'Германия',
    Lithuania: 'Литва',
    Macedonia: 'Македония',
    'North Macedonia': 'Северная Македония',
    Mexico: 'Мексика',
    Myanmar: 'Мьянма',
    Netherlands: 'Нидерланды',
    Philippines: 'Филиппины',
    Qatar: 'Катар',
    'Saudi Arabia': 'Саудовская Аравия',
    Serbia: 'Сербия',
    Syria: 'Сирия',
    Taiwan: 'Тайвань',
    Ukraine: 'Украина',
    UK: 'Великобритания',
    US: 'США',
    USA: 'США',
    'United Kingdom': 'Великобритания',
    'United States': 'США',
    Venezuela: 'Венесуэла',
    World: 'Мир',
  };
  // Reference points are deliberately separate from the DISARM incident data:
  // they locate a country label on an equirectangular map and never claim an
  // event's exact location. Source and limits are published in the map contract.
  const COUNTRY_POINTS = {
    Armenia: [45.04, 40.07], Brazil: [-52.0, -10.0], China: [104.0, 35.0],
    EU: [10.0, 50.0], France: [2.0, 46.0], Germany: [10.0, 51.0],
    Lithuania: [24.0, 55.0], Macedonia: [21.7, 41.6], 'North Macedonia': [21.7, 41.6],
    Mexico: [-102.0, 23.0], Myanmar: [96.0, 21.0], Netherlands: [5.0, 52.0],
    Philippines: [122.0, 12.0], Qatar: [51.2, 25.3], Serbia: [21.0, 44.0],
    Taiwan: [121.0, 24.0], Ukraine: [31.0, 49.0], UK: [-3.0, 55.0],
    'United Kingdom': [-3.0, 55.0], US: [-98.0, 39.0], USA: [-98.0, 39.0],
    'United States': [-98.0, 39.0],
  };
  // The legacy Russian paraphrases have no source-bound editorial review.
  // Official record translations require an explicit review for the exact corpus.
  // Until that evidence exists, retain the complete original name and summary.
  const REVIEWED_RECORD_TRANSLATIONS = { ru: {}, kk: {}, en: {} };
  function localizeText(text) {
    return String(text || '');
  }
  function tName(obj) {
    return REVIEWED_RECORD_TRANSLATIONS[STATE.locale]?.[obj?.disarm_id]?.name || obj?.name || '—';
  }
  function tSummary(obj) {
    return REVIEWED_RECORD_TRANSLATIONS[STATE.locale]?.[obj?.disarm_id]?.summary || obj?.summary || '';
  }
  function localizeCountry(country) {
    const raw = String(country || '').trim();
    return STATE.locale === 'ru' ? COUNTRY_RU[raw] || raw : raw;
  }
  function countryFilterIncludes(country) {
    return !INCIDENT_FILTERS.country || INCIDENT_FILTERS.country.split('|').includes(country);
  }
  function groupIncidentCountries(byCountry) {
    const mapGroups = new Map();
    byCountry.forEach(item => {
      const key = ['US', 'USA', 'United States'].includes(item.code) ? 'US' : item.code;
      const group = mapGroups.get(key) || { code: key, codes: [], count: 0 };
      group.codes.push(item.code);
      group.count += item.count;
      mapGroups.set(key, group);
    });
    return Array.from(mapGroups.values()).sort((a, b) => b.count - a.count);
  }
  function renderIncidentGeoMap(countryGroups) {
    const map = $('#incident-geo-map');
    const list = $('#incident-geo-list');
    if (!map || !list) return;
    const projected = countryGroups.map(item => {
      const point = COUNTRY_POINTS[item.code];
      if (!point) return { ...item, point: null };
      const [lon, lat] = point;
      return { ...item, point: { x: ((lon + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 } };
    });
    const max = Math.max(1, ...projected.map(item => item.count));
    const grid = [125, 250, 375].map(y => `<path class="incident-geo-map__grid" d="M0 ${y}H1000" />`).join('')
      + [167, 333, 500, 667, 833].map(x => `<path class="incident-geo-map__grid" d="M${x} 0V500" />`).join('');
    const dots = projected.filter(item => item.point).map(item => {
      const radius = 7 + (item.count / max) * 13;
      const selected = item.codes.some(countryFilterIncludes) ? ' is-selected' : '';
      const label = `${localizeCountry(item.code)}: ${item.count} ${pluralRu(item.count, 'кейс', 'кейса', 'кейсов')}`;
      return `<g class="incident-geo-map__point${selected}" data-map-country="${escape(item.codes.join('|'))}" role="button" tabindex="0" aria-label="${escape(label)}">
        <circle cx="${item.point.x.toFixed(1)}" cy="${item.point.y.toFixed(1)}" r="${radius.toFixed(1)}"></circle>
        <title>${escape(label)}</title>
      </g>`;
    }).join('');
    map.innerHTML = `<svg viewBox="0 0 1000 500" role="img" aria-label="Карта стран из отфильтрованных записей DISARM; размер точки показывает число записей">
      <rect class="incident-geo-map__surface" x="0" y="0" width="1000" height="500" rx="12"></rect>${grid}${dots}
      <text class="incident-geo-map__axis" x="10" y="25">90°N</text><text class="incident-geo-map__axis" x="10" y="490">90°S</text>
    </svg>`;
    const unplaced = projected.filter(item => !item.point);
    list.innerHTML = `${projected.map(item => {
      const selected = item.codes.some(countryFilterIncludes) ? ' is-selected' : '';
      const position = item.point ? 'на карте' : 'только список';
      return `<button type="button" class="incident-geo-list__item${selected}" data-map-country="${escape(item.codes.join('|'))}" aria-pressed="${selected ? 'true' : 'false'}">
        <span>${escape(localizeCountry(item.code))}</span><strong>${item.count}</strong><small>${position}</small>
      </button>`;
    }).join('')}${unplaced.length ? '<p class="incident-geo-list__note">Региональные и глобальные записи не получают произвольную точку на карте.</p>' : ''}`;
    const selectCountry = event => {
      const target = event.target.closest('[data-map-country]');
      if (!target) return;
      INCIDENT_FILTERS.country = target.dataset.mapCountry || '';
      renderIncidents();
    };
    map.onclick = selectCountry;
    list.onclick = selectCountry;
    map.onkeydown = event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-map-country]')) {
        event.preventDefault();
        selectCountry(event);
      }
    };
  }
  function renderIncidentPeriodComparison(incidents, years) {
    const first = $('#incident-period-a');
    const second = $('#incident-period-b');
    const result = $('#incident-period-result');
    const table = $('#incident-period-table');
    if (!first || !second || !result || !table) return;
    const ascending = [...years].sort((a, b) => String(a).localeCompare(String(b)));
    const fallbackA = ascending.at(-2) || ascending[0] || '';
    const fallbackB = ascending.at(-1) || ascending[0] || '';
    if (!INCIDENT_FILTERS.periodA || !ascending.includes(INCIDENT_FILTERS.periodA)) INCIDENT_FILTERS.periodA = fallbackA;
    if (!INCIDENT_FILTERS.periodB || !ascending.includes(INCIDENT_FILTERS.periodB)) INCIDENT_FILTERS.periodB = fallbackB;
    const options = ascending.map(year => `<option value="${escape(year)}">${escape(year)}</option>`).join('');
    first.innerHTML = options;
    second.innerHTML = options;
    first.value = INCIDENT_FILTERS.periodA;
    second.value = INCIDENT_FILTERS.periodB;
    const count = year => incidents.filter(item => item.year_started === year).length;
    const aCount = count(INCIDENT_FILTERS.periodA);
    const bCount = count(INCIDENT_FILTERS.periodB);
    const delta = bCount - aCount;
    const deltaLabel = `${delta > 0 ? '+' : ''}${delta}`;
    const relativeDelta = aCount ? Math.round((delta / aCount) * 100) : null;
    const relativeLabel = relativeDelta === null
      ? 'н/д: в базовом году нет записей'
      : `${relativeDelta > 0 ? '+' : ''}${relativeDelta}% относительно ${INCIDENT_FILTERS.periodA}`;
    const direction = delta > 0 ? 'больше' : delta < 0 ? 'меньше' : 'столько же';
    result.innerHTML = `<div class="incident-period-comparison__stat"><strong>${bCount}</strong><span>записей в ${escape(INCIDENT_FILTERS.periodB)}</span></div>
      <div class="incident-period-comparison__delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-flat'}"><strong>${escape(deltaLabel)}</strong><span>${direction}, чем в ${escape(INCIDENT_FILTERS.periodA)}</span><small>${escape(relativeLabel)}</small></div>`;
    table.innerHTML = [[INCIDENT_FILTERS.periodA, aCount, 'базовый период', '—'], [INCIDENT_FILTERS.periodB, bCount, deltaLabel, relativeDelta === null ? 'н/д' : `${relativeDelta > 0 ? '+' : ''}${relativeDelta}%`]].map(([year, value, change, relative]) => `
      <tr><th scope="row">${escape(year)}</th><td>${escape(value)}</td><td>${escape(change)}</td><td>${escape(relative)}</td></tr>`).join('');
    first.onchange = event => { INCIDENT_FILTERS.periodA = event.target.value; renderIncidentPeriodComparison(incidents, years); };
    second.onchange = event => { INCIDENT_FILTERS.periodB = event.target.value; renderIncidentPeriodComparison(incidents, years); };
  }
  function isEnglishHeavy(text) {
    const s = String(text || '').trim();
    if (!s) return false;
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    const cyr = (s.match(/[А-Яа-яЁё]/g) || []).length;
    return latin > 24 && latin > cyr * 1.35;
  }
  function previewSummary(obj) {
    const summary = tSummary(obj);
    return summary || '';
  }

  const TAB_META = {
    overview: {
      title: 'Обзор · DISARM обозреватель',
      description: {
        ru: 'Обзор DISARM 1.7.0: 4 фазы, 13 тактик, 71 техника, 140 контрмер и 63 инцидента.',
        kk: 'DISARM 1.7.0 шолуы: 4 кезең, 13 тактика, 71 техника, 140 қарсы шара және 63 оқиға.',
        en: 'Overview of DISARM 1.7.0: 4 phases, 13 tactics, 71 techniques, 140 countermeasures, and 63 incidents.',
      },
    },
    red: {
      title: 'Матрица атак · DISARM обозреватель',
      description: {
        ru: 'Матрица атак DISARM: тактики и техники с фильтрами и переходами к карточкам объектов.',
        kk: 'DISARM шабуыл матрицасы: тактикалар мен техникалар, сүзгілер және нысан карточкаларына өту.',
        en: 'DISARM attack matrix: tactics and techniques, with filters and links to object details.',
      },
    },
    blue: {
      title: 'Матрица защиты · DISARM обозреватель',
      description: {
        ru: 'Матрица защиты DISARM: контрмеры и связанные техники по этапам кампании.',
        kk: 'DISARM қорғаныс матрицасы: науқан кезеңдері бойынша қарсы шаралар мен байланысты техникалар.',
        en: 'DISARM defence matrix: countermeasures and linked techniques across campaign phases.',
      },
    },
    search: {
      title: 'Поиск · DISARM обозреватель',
      description: {
        ru: 'Поиск по техникам, контрмерам, инцидентам, тактикам, индикаторам, задачам и инструментам DISARM.',
        kk: 'DISARM нысандарын іздеу: техникалар, қарсы шаралар, оқиғалар, тактикалар, индикаторлар, тапсырмалар және құралдар.',
        en: 'Search DISARM techniques, countermeasures, incidents, tactics, indicators, tasks, and tools.',
      },
    },
    incidents: {
      title: 'Каталог инцидентов · DISARM обозреватель',
      description: {
        ru: 'Каталог инцидентов DISARM: годы начала, указанные страны и связанные техники.',
        kk: 'DISARM оқиғаларының каталогы: басталған жылдары, көрсетілген елдер және байланысты техникалар.',
        en: 'DISARM incident catalogue: start years, listed countries, and linked techniques.',
      },
    },
    playbook: {
      title: 'План реагирования · DISARM обозреватель',
      description: {
        ru: 'План реагирования DISARM: выбор техник, оценка покрытия контрмерами и экспорт плана.',
        kk: 'DISARM жауап жоспары: техникаларды таңдау, қарсы шаралармен қамтуды бағалау және жоспарды экспорттау.',
        en: 'DISARM response plan: select techniques, review countermeasure coverage, and export the plan.',
      },
    },
    about: {
      title: 'Справка · DISARM обозреватель',
      description: {
        ru: 'Справка о DISARM 1.7.0: состав и источники матрицы, лицензия и отдельные версии фреймворка.',
        kk: 'DISARM 1.7.0 туралы: матрица құрамы мен дереккөздері, лицензиясы және фреймворк нұсқалары.',
        en: 'About DISARM 1.7.0: matrix contents and sources, licensing, and separate framework versions.',
      },
    },
  };
  function updateDocumentMeta(tab) {
    const meta = TAB_META[tab] || TAB_META.overview;
    const copy = localeCopy();
    const tabTitle = copy.tabs[tab] || copy.title;
    const localizedTitle = STATE.locale === 'ru' ? meta.title : `${tabTitle} · DISARM`;
    const localizedDescription = meta.description[STATE.locale] || meta.description.ru;
    document.title = localizedTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', localizedDescription);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', localizedTitle);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', localizedDescription);
  }

  /* ---- Playbook persistence ---- */
  const PLAYBOOK = { selected: new Set() };
  const PB_KEY = 'disarm.playbook.v1';

  function savePlaybook() {
    try { localStorage.setItem(PB_KEY, JSON.stringify(Array.from(PLAYBOOK.selected))); }
    catch (e) { /* ignore quota / private mode */ }
  }
  function loadPlaybook() {
    try {
      const raw = localStorage.getItem(PB_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(id => PLAYBOOK.selected.add(id));
    } catch (e) { /* ignore */ }
  }

  /* ---- Annotations (per-technique notes, manual priority 0-100, color) ---- */
  const ANN = { map: new Map() };
  const ANN_KEY = 'disarm.annotations.v1';
  const ANN_PRESET_COLORS = ['', '#fbbf24', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#64748b'];
  const SEARCH_PAGE = { limit: 18, shown: 18, query: '', filters: '' };
  const INCIDENT_FILTERS = { year: '', country: '', tactic: '', periodA: '', periodB: '' };
  const MATRIX_FILTERS = { redPhase: '', bluePhase: '' };

  function saveAnnotations() {
    try {
      const obj = {};
      ANN.map.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(ANN_KEY, JSON.stringify(obj));
    } catch (e) { /* ignore */ }
  }
  function loadAnnotations() {
    try {
      const raw = localStorage.getItem(ANN_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      Object.entries(obj || {}).forEach(([k, v]) => {
        if (v && typeof v === 'object') ANN.map.set(k, v);
      });
    } catch (e) { /* ignore */ }
  }
  function getAnn(id) {
    return ANN.map.get(id) || { note: '', score: 0, color: '' };
  }
  function setAnn(id, patch) {
    const cur = getAnn(id);
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    // If everything is empty, drop it
    if (!next.note && (!next.score || Number(next.score) === 0) && !next.color) {
      ANN.map.delete(id);
    } else {
      ANN.map.set(id, next);
    }
    saveAnnotations();
  }
  function hasAnn(id) {
    const a = ANN.map.get(id);
    if (!a) return false;
    return !!(a.note || (a.score && Number(a.score) > 0) || a.color);
  }
  // Manual analyst priority -> background tint. This is not probability or confidence.
  function scoreColor(score) {
    const s = ANALYSIS.clampAnalystPriority(score);
    if (!s) return '';
    // Map 0-100 to a HSL hue 220 (blue, low) -> 0 (red, high)
    const hue = Math.round(220 - (s / 100) * 220);
    const lightness = 95 - Math.round((s / 100) * 15); // 95% -> 80%
    return `hsl(${hue}, 75%, ${lightness}%)`;
  }
  function flashSavedHint(panel, msg) {
    const hint = panel.querySelector('.ann-saved-hint');
    if (!hint) return;
    hint.textContent = ui(msg || 'Сохранено');
    hint.classList.add('is-visible');
    clearTimeout(hint._t);
    hint._t = setTimeout(() => hint.classList.remove('is-visible'), 1400);
  }
  // Apply annotation visuals to a single matrix cell (red matrix only — techniques)
  function applyAnnToCell(cell) {
    const id = cell.dataset.id;
    if (!id) return;
    const a = ANN.map.get(id);
    cell.classList.toggle('has-ann', !!(a && (a.note || a.score || a.color)));
    // remove dot first
    let dot = cell.querySelector('.ann-dot');
    if (a && (a.note || a.color)) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'ann-dot';
        cell.appendChild(dot);
      }
      dot.style.background = a.color || 'var(--color-text-muted, #64748b)';
      dot.title = a.note ? truncate(a.note, 80) : (a.color ? ui('метка') : '');
    } else if (dot) {
      dot.remove();
    }
    // score tint — only when heatmap NOT active (to avoid clashes)
    if (!STATE.heatmap && a && a.score && Number(a.score) > 0) {
      cell.style.setProperty('--ann-tint', scoreColor(a.score));
      cell.classList.add('has-score');
    } else {
      cell.style.removeProperty('--ann-tint');
      cell.classList.remove('has-score');
    }
  }
  function applyAnnotationsToMatrix() {
    $$('#red-matrix .matrix-cell').forEach(applyAnnToCell);
  }
  function updateMatrixAnnotation(id) {
    const cell = document.querySelector(`#red-matrix .matrix-cell[data-id="${CSS.escape(id)}"]`);
    if (cell) applyAnnToCell(cell);
  }

  /* ---- Deep-link parsing (?tab=red&technique=T0001&playbook=T0001,T0002 + #fragment) ---- */
  function parseDeepLink() {
    const params = new URLSearchParams(location.search);
    const hash = (location.hash || '').replace('#','').split('?')[0];
    const tab = params.get('tab') || hash || null;
    const technique = params.get('technique') || null;
    const playbook = (params.get('playbook') || '').split(',').map(s=>s.trim()).filter(Boolean);
    return { tab, technique, playbook };
  }

  function applyDeepLinkState(dl) {
    if (dl.playbook && dl.playbook.length) {
      // merge with persisted state
      dl.playbook.forEach(id => PLAYBOOK.selected.add(id));
    }
  }

  function updateUrlState() {
    // Only updates when on Playbook tab to keep URL clean
    const activeTab = $$('#tabs .avds-pill-tab').find(t => t.classList.contains('active'));
    if (!activeTab) return;
    const tab = activeTab.dataset.tab;
    const params = new URLSearchParams();
    params.set('tab', tab);
    params.set('locale', STATE.locale);
    if (PLAYBOOK.selected.size) {
      params.set('playbook', Array.from(PLAYBOOK.selected).join(','));
    }
    const url = location.pathname + '?' + params.toString();
    if (history.replaceState) history.replaceState(null, '', url);
  }

  /* ---- Load ---- */
  function hydrateData(d) {
    DATA.validate(d);
    const normalized = DATA.normalizeSelection(Array.from(PLAYBOOK.selected), d.techniques);
    PLAYBOOK.selected = new Set(normalized.selected);
    STATE.rejectedPlaybookIds = normalized.rejected;
    savePlaybook();
    const url = new URL(location.href);
    if (PLAYBOOK.selected.size) url.searchParams.set('playbook', [...PLAYBOOK.selected].join(','));
    else url.searchParams.delete('playbook');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    STATE.data = d;
    STATE.byId.clear();
    STATE.incidentByTech.clear();

    // Build lookup
    const idx = (arr, type) => arr.forEach(o => STATE.byId.set(o.disarm_id, { ...o, _type: type }));
    idx(d.phases, 'phase');
    idx(d.tactics, 'tactic');
    idx(d.techniques, 'technique');
    idx(d.counters, 'counter');
    idx(d.incidents, 'incident');
    idx(d.metatechniques, 'metatechnique');
    idx(d.detections, 'detection');
    idx(d.tasks, 'task');
    idx(d.tools, 'tool');

    // Build incidents-by-technique map for heatmap
    d.incidents.forEach(i => {
      (i.techniques || []).forEach(tid => {
        if (!STATE.incidentByTech.has(tid)) STATE.incidentByTech.set(tid, []);
        STATE.incidentByTech.get(tid).push(i);
      });
    });

    // Update masthead meta
    $('#m-phases').textContent = d.phases.length;
    $('#m-tactics').textContent = d.tactics.length;
    $('#m-techs').textContent = d.techniques.length;
    $('#m-counters').textContent = d.counters.length;
    $('#m-incidents').textContent = d.incidents.length;

    const badge = $('#status-badge');
    updateStatusBadgeText(d);
    badge.className = 'avds-theme-chip avds-theme-chip--success';
  }
  async function load() {
    setDataState('loading');
    try {
      const r = await fetch('data/disarm.json', { cache: 'no-cache', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`DISARM data HTTP ${r.status}`);
      const text = await r.text();
      const d = await DATA.validateText(text);
      hydrateData(d);
      cacheData(text);
      setDataState('ready');
    } catch (error) {
      const cached = await readCachedData();
      if (!cached) {
        setDataState('error');
        throw error;
      }
      STATE.cachedAt = cached.savedAt;
      hydrateData(cached.data);
      setDataState(navigator.onLine ? 'degraded' : 'offline', { cachedAt: cached.savedAt });
    }
  }

  /* ---- Tabs ---- */
  function setupTabs() {
    const tabs = $$('#tabs .avds-pill-tab');
    const panels = $$('.tabpanel');
    const revealSelectedTab = () => {
      const tabList = $('#tabs');
      const activeTab = tabs.find(t => t.getAttribute('aria-selected') === 'true');
      if (!tabList || !activeTab) return;
      const listRect = tabList.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      if (tabRect.left < listRect.left || tabRect.right > listRect.right) {
        const target = tabList.scrollLeft + (tabRect.left + tabRect.right - listRect.left - listRect.right) / 2;
        tabList.scrollLeft = Math.max(0, Math.min(target, tabList.scrollWidth - tabList.clientWidth));
      }
    };
    const setTab = (name, opts={}) => {
      STATE.tabSelectedDuringLoad = name;
      tabs.forEach(t => {
        const active = t.dataset.tab === name;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.setAttribute('tabindex', active ? '0' : '-1');
      });
      revealSelectedTab();
      panels.forEach(p => {
        const active = p.dataset.panel === name;
        p.classList.toggle('active', active);
        p.hidden = !active;
      });
      if (history.replaceState && !opts.silent) {
        // preserve playbook param when switching tabs
        const params = new URLSearchParams(location.search);
        params.set('tab', name);
        params.set('locale', STATE.locale);
        if (PLAYBOOK.selected.size) params.set('playbook', Array.from(PLAYBOOK.selected).join(','));
        else params.delete('playbook');
        params.delete('technique');
        history.replaceState(null, '', location.pathname + '?' + params.toString());
      }
      updateDocumentMeta(name);
      if (!opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    STATE.setTab = setTab;
    STATE.revealSelectedTab = revealSelectedTab;
    window.addEventListener('resize', revealSelectedTab);

    tabs.forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
    tabs.forEach((t, idx) => t.addEventListener('keydown', e => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      next.focus();
      setTab(next.dataset.tab);
    }));

    // Inner anchor links #red, #playbook etc.
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (a) {
        const t = a.getAttribute('href').slice(1);
        if (tabs.find(x => x.dataset.tab === t)) {
          e.preventDefault();
          setTab(t);
        }
      }
    });

    // Hash change listener
    window.addEventListener('hashchange', () => {
      const h = (location.hash || '').replace('#','').split('?')[0];
      if (h && tabs.find(x => x.dataset.tab === h)) setTab(h, { silent: true });
    });
  }

  /* ---- Workspace toolbar ---- */
  function setupWorkspaceToolbar() {
    const densityBtn = $('#density-toggle');
    const quickSearch = $('#workspace-search');
    const tabs = $$('#tabs .avds-pill-tab');

    const applyDensity = (mode) => {
      const compact = mode === 'compact';
      document.documentElement.dataset.density = compact ? 'compact' : 'comfortable';
      if (densityBtn) {
        densityBtn.setAttribute('aria-pressed', compact ? 'true' : 'false');
        densityBtn.textContent = compact ? localeCopy().density.comfortable : localeCopy().density.compact;
      }
      try { localStorage.setItem(UI_KEY, compact ? 'compact' : 'comfortable'); } catch {}
    };

    let saved = 'compact';
    try { saved = localStorage.getItem(UI_KEY) || 'compact'; } catch {}
    applyDensity(saved);

    densityBtn?.addEventListener('click', () => {
      const next = document.documentElement.dataset.density === 'compact' ? 'comfortable' : 'compact';
      applyDensity(next);
    });

    quickSearch?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const q = quickSearch.value.trim();
      if (!q) return;
      STATE.setTab?.('search');
      const global = $('#global-search');
      if (global) {
        global.value = q;
        global.dispatchEvent(new Event('input', { bubbles: true }));
        global.focus();
      }
    });

    document.addEventListener('keydown', e => {
      const target = e.target;
      const editing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.key === '/' && !editing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        quickSearch?.focus();
        quickSearch?.select();
        return;
      }
      if (!editing && /^[1-7]$/.test(e.key)) {
        const tab = tabs[Number(e.key) - 1];
        if (tab) {
          e.preventDefault();
          STATE.setTab?.(tab.dataset.tab);
          tab.focus();
        }
      }
    });
  }

  /* ---- Overview ---- */
  function renderOverview() {
    const d = STATE.data;
    const stats = [
      ['Этапов', d.phases.length],
      ['Тактик', d.tactics.length],
      ['Техник', d.techniques.length],
      ['Контрмер', d.counters.length],
      ['Метатехник', d.metatechniques.length],
      ['Индикаторов', d.detections.length],
      ['Инцидентов', d.incidents.length],
      ['Инструментов', d.tools.length],
      ['Задач', d.tasks.length],
    ];
    $('#phase-stats').innerHTML = stats.map(([l,n]) => `
      <div class="stat-card">
        <div class="stat-num">${n}</div>
        <div class="stat-lbl">${escape(l)}</div>
      </div>`).join('');

    const PHASE_DESC = {
      'Plan': 'Стратегические цели операции, определение ключевых нарративов, целевых аудиторий и желаемых результатов.',
      'Prepare': 'Создание инфраструктуры: фейковые аккаунты, контент, рекрутинг операторов, настройка каналов.',
      'Execute': 'Распространение дезинформации через выбранные каналы — с микротаргетингом и адаптацией в реальном времени.',
      'Assess': 'Оценка эффективности кампании: охват, изменения общественного мнения, поведенческие индикаторы.',
    };
    $('#phase-list').innerHTML = d.phases.map(p => `
      <li>
        <div class="ph-name">${escape(PHASE_RU_LONG[p.name] || p.name)}</div>
        <div class="ph-sum">${escape(PHASE_DESC[p.name] || p.summary)}</div>
      </li>`).join('');

    const tacticCountByPhase = new Map(d.phases.map(p => [p.disarm_id, 0]));
    d.tactics.forEach(t => tacticCountByPhase.set(t.phase_id, (tacticCountByPhase.get(t.phase_id) || 0) + 1));
    $('#overview-phase-rail').innerHTML = d.phases.map(p => `
      <button class="overview-phase-pill" type="button" data-jump-phase="${escape(p.disarm_id)}">
        <span class="overview-phase-pill__name">${escape(PHASE_RU_LONG[p.name] || p.name)}</span>
        <span class="overview-phase-pill__meta">${tacticCountByPhase.get(p.disarm_id) || 0} ${pluralRu(tacticCountByPhase.get(p.disarm_id) || 0, 'тактика', 'тактики', 'тактик')}</span>
      </button>
    `).join('');
    $('#overview-meta-stack').innerHTML = `
      <div class="overview-meta-row"><span>Релиз</span><strong>${escape(formatVersionLabel(d.version || '—'))}</strong></div>
      <div class="overview-meta-row"><span>Лицензия</span><strong>CC-BY-SA-4.0</strong></div>
      <div class="overview-meta-row"><span>Источник</span><strong>Фонд DISARM</strong></div>
      <div class="overview-meta-row"><span>Записей в матрицах и каталоге</span><strong class="overview-meta-count">${d.techniques.length + d.counters.length + d.incidents.length}</strong></div>
    `;
    renderQuickLinksRail($('#overview-quick-links'), [
      { label: 'Матрица атак', href: tabHref('red'), meta: `${d.techniques.length}` },
      { label: 'Матрица защиты', href: tabHref('blue'), meta: `${d.counters.length}` },
      { label: 'Инциденты', href: tabHref('incidents'), meta: `${d.incidents.length}` },
      { label: 'План реагирования', href: tabHref('playbook') },
      { label: 'DISARM 1.7', href: 'https://github.com/DISARMFoundation/DISARMframeworks-17', external: true },
      { label: 'Navigator', href: 'https://github.com/DISARMFoundation/disarm-navigator-mv', external: true },
    ]);
    renderQuickLinksRail($('#about-quick-links'), [
      { label: '1.7.0', href: 'https://github.com/DISARMFoundation/DISARMframeworks-17', external: true, active: true },
      { label: '2.0 Observations', href: 'https://github.com/DISARMFoundation/DISARMframeworks-20-observable', external: true },
      { label: '2.0 Assessments', href: 'https://github.com/DISARMFoundation/DISARMframeworks-20-assessments', external: true },
      { label: 'Foundation', href: 'https://www.disarm.foundation/', external: true },
      { label: 'MISP Galaxy', href: 'https://www.misp-project.org/galaxy.html', external: true },
    ], { wrap: true });
    $('#overview-phase-rail').onclick = e => {
      const btn = e.target.closest('[data-jump-phase]');
      if (!btn) return;
      MATRIX_FILTERS.redPhase = btn.dataset.jumpPhase || '';
      STATE.setTab?.('red');
      renderRedMatrix();
    };
  }

  /* ---- Heatmap helpers ---- */
  function refreshHeatmap() {
    const cells = $$('#red-matrix .matrix-cell');
    cells.forEach(c => c.classList.remove('h1','h2','h3','h4','h5','heat-on'));
    const legend = $('#red-legend');
    if (!STATE.heatmap) {
      if (legend) legend.hidden = true;
      return;
    }
    const counts = cells.map(c => (STATE.incidentByTech.get(c.dataset.id) || []).length);
    const scale = ANALYSIS.createLogHeatScale(counts);
    cells.forEach((c, i) => {
      const cnt = counts[i];
      c.classList.add('heat-on');
      const bucket = scale.bucketFor(cnt);
      const cls = bucket ? `h${bucket}` : '';
      if (cls) c.classList.add(cls);
      // append count chip
      let chip = c.querySelector('.heat-count');
      if (cnt > 0) {
        if (!chip) {
          chip = document.createElement('span');
          chip.className = 'heat-count';
          c.appendChild(chip);
        }
        chip.textContent = cnt;
      } else if (chip) {
        chip.remove();
      }
    });
    if (legend) {
      const rangeLabel = range => {
        if (range.min === null) return '—';
        return range.min === range.max ? String(range.min) : `${range.min}–${range.max}`;
      };
      legend.hidden = false;
      legend.innerHTML = `
        <span class="legend-label">Связанных инцидентов:</span>
        <span class="legend-scale">
          ${scale.ranges.map(range => `<span class="ls h${range.bucket}">${rangeLabel(range)}</span>`).join('')}
        </span>
        <span class="legend-hint">лог-шкала · частота в корпусе, не вероятность и не риск</span>`;
    }
  }

  /* ---- Red Matrix ---- */
  function renderRedMatrix() {
    const d = STATE.data;
    const grid = $('#red-matrix');
    const phasePills = $('#red-phase-pills');
    if (phasePills) {
      phasePills.innerHTML = [
        `<button class="mini-pill ${!MATRIX_FILTERS.redPhase ? 'active' : ''}" data-phase="">Все фазы</button>`,
        ...d.phases.map(p => `<button class="mini-pill ${MATRIX_FILTERS.redPhase === p.disarm_id ? 'active' : ''}" data-phase="${escape(p.disarm_id)}">${escape(PHASE_RU[p.name] || p.name)}</button>`)
      ].join('');
    }
    const tactics = MATRIX_FILTERS.redPhase ? d.tactics.filter(t => t.phase_id === MATRIX_FILTERS.redPhase) : d.tactics;
    const cols = tactics.map(tac => {
      const techIds = (d.tactic_to_techniques[tac.disarm_id] || []);
      const techs = techIds.map(id => STATE.byId.get(id)).filter(Boolean);
      return { tac, techs };
    });
    const visibleTechs = cols.flatMap(col => col.techs);
    const tacticRows = topRows(
      cols.map(col => ({ label: tName(col.tac), count: col.techs.length })),
      row => row.count,
      row => row.label
    );
    const incidentRows = topRows(
      visibleTechs.map(t => ({ label: tName(t), count: (STATE.incidentByTech.get(t.disarm_id) || []).length })),
      row => row.count,
      row => row.label
    );
    renderCompareCards($('#red-compare-grid'), [
      {
        eyebrow: 'сравнение',
        title: 'Тактики по числу техник',
        summary: MATRIX_FILTERS.redPhase ? `Срез по фазе ${PHASE_RU[STATE.byId.get(MATRIX_FILTERS.redPhase)?.name] || PHASE_RU_LONG[STATE.byId.get(MATRIX_FILTERS.redPhase)?.name] || ''}`.trim() : 'Полный корпус тактик текущей red-матрицы',
        unit: 'техник',
        rows: tacticRows,
        footerNote: tacticRows.length ? `Видно тактик: ${cols.length}` : 'Нет данных для текущего фильтра',
      },
      {
        eyebrow: 'инцидентность',
        title: 'Техники с наибольшим числом кейсов',
        summary: 'Топ по количеству связанных инцидентов в видимом срезе матрицы',
        unit: 'инцидентов',
        rows: incidentRows,
        footerNote: incidentRows.length ? `Видно техник: ${visibleTechs.length}` : 'В этом срезе нет техник с привязанными кейсами',
      }
    ]);
    setInsightBar(
      $('#red-insight-bar'),
      `Видимый срез матрицы атак: ${cols.length} ${pluralRu(cols.length, 'тактика', 'тактики', 'тактик')} и ${visibleTechs.length} ${pluralRu(visibleTechs.length, 'техника', 'техники', 'техник')}`,
      [
        MATRIX_FILTERS.redPhase ? `фаза: ${PHASE_RU[STATE.byId.get(MATRIX_FILTERS.redPhase)?.name] || PHASE_RU_LONG[STATE.byId.get(MATRIX_FILTERS.redPhase)?.name] || MATRIX_FILTERS.redPhase}` : 'все фазы',
        STATE.heatmap ? 'тепловая карта включена' : 'тепловая карта выключена',
      ]
    );

    grid.innerHTML = cols.map(({tac, techs}) => `
      <div class="matrix-col" data-tactic="${escape(tac.disarm_id)}">
        <div class="matrix-col-head" title="${escape(tac.summary || '')}">
          <span class="mc-id">${escape(tac.disarm_id)}</span>
          ${escape(tName(tac))}
        </div>
        ${techs.map(t => `
          <div class="matrix-cell red ${t.disarm_id.includes('.') ? 'subtech' : ''}" data-id="${escape(t.disarm_id)}" role="button" tabindex="0" aria-label="${escape(`${t.disarm_id} — ${tName(t)}, ${(STATE.incidentByTech.get(t.disarm_id) || []).length} инцидентов`)}">
            <span class="mc-id">${escape(t.disarm_id)}</span>
            <span class="mc-name">${escape(tName(t))}</span>
            <span class="mc-meta">${(STATE.incidentByTech.get(t.disarm_id) || []).length} инц.</span>
          </div>`).join('')}
      </div>
    `).join('');

    grid.onclick = e => {
      // Mobile accordion: header click toggles collapse on narrow screens
      const head = e.target.closest('.matrix-col-head');
      if (head && window.matchMedia('(max-width: 720px)').matches) {
        head.parentElement.classList.toggle('collapsed');
        return;
      }
      const cell = e.target.closest('.matrix-cell');
      if (cell) openModal(cell.dataset.id);
    };
    grid.onkeydown = e => {
      const cell = e.target.closest('.matrix-cell');
      if (cell && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openModal(cell.dataset.id);
      }
    };

    $('#red-filter').oninput = e => {
      const q = e.target.value.trim().toLowerCase();
      $$('#red-matrix .matrix-cell').forEach(c => {
        const txt = c.textContent.toLowerCase();
        c.classList.toggle('hidden', q && !txt.includes(q));
      });
    };
    if (phasePills) phasePills.onclick = e => {
      const btn = e.target.closest('[data-phase]');
      if (!btn) return;
      MATRIX_FILTERS.redPhase = btn.dataset.phase || '';
      renderRedMatrix();
    };

    // Heatmap toggle
    const heatBtn = $('#red-heatmap-toggle');
    if (heatBtn) {
      heatBtn.onclick = () => {
        STATE.heatmap = !STATE.heatmap;
        heatBtn.classList.toggle('active', STATE.heatmap);
        heatBtn.textContent = STATE.heatmap ? 'Тепловая карта: включена' : 'Тепловая карта';
        refreshHeatmap();
        setInsightBar(
          $('#red-insight-bar'),
          `Видимый срез матрицы атак: ${cols.length} ${pluralRu(cols.length, 'тактика', 'тактики', 'тактик')} и ${visibleTechs.length} ${pluralRu(visibleTechs.length, 'техника', 'техники', 'техник')}`,
          [
            MATRIX_FILTERS.redPhase ? `фаза: ${PHASE_RU[STATE.byId.get(MATRIX_FILTERS.redPhase)?.name] || PHASE_RU_LONG[STATE.byId.get(MATRIX_FILTERS.redPhase)?.name] || MATRIX_FILTERS.redPhase}` : 'все фазы',
            STATE.heatmap ? 'тепловая карта включена' : 'тепловая карта выключена',
          ]
        );
        // re-apply annotations (so score tint hides under heatmap, dots stay)
        applyAnnotationsToMatrix();
      };
    }

    // Navigator JSON export
    const navBtn = $('#red-export-navigator');
    if (navBtn) navBtn.onclick = exportNavigatorJSON;

    // Apply annotations to the freshly rendered matrix
    applyAnnotationsToMatrix();
  }

  /* ---- Blue Matrix ---- */
  function renderBlueMatrix() {
    const d = STATE.data;
    const grid = $('#blue-matrix');
    const phasePills = $('#blue-phase-pills');
    if (phasePills) {
      phasePills.innerHTML = [
        `<button class="mini-pill ${!MATRIX_FILTERS.bluePhase ? 'active' : ''}" data-phase="">Все фазы</button>`,
        ...d.phases.map(p => `<button class="mini-pill ${MATRIX_FILTERS.bluePhase === p.disarm_id ? 'active' : ''}" data-phase="${escape(p.disarm_id)}">${escape(PHASE_RU[p.name] || p.name)}</button>`)
      ].join('');
    }

    const cols = d.tactics.filter(tac => !MATRIX_FILTERS.bluePhase || tac.phase_id === MATRIX_FILTERS.bluePhase).map(tac => {
      const counterIds = d.tactic_to_counters[tac.disarm_id] || [];
      const counters = counterIds.map(id => STATE.byId.get(id)).filter(Boolean);
      return { tac, counters };
    }).filter(c => c.counters.length > 0);
    const visibleCounters = cols.flatMap(col => col.counters);
    const tacticRows = topRows(
      cols.map(col => ({ label: tName(col.tac), count: col.counters.length })),
      row => row.count,
      row => row.label
    );
    const coverageRows = topRows(
      visibleCounters.map(c => ({ label: tName(c), count: (c.techniques || []).length })),
      row => row.count,
      row => row.label
    );
    renderCompareCards($('#blue-compare-grid'), [
      {
        eyebrow: 'сравнение',
        title: 'Тактики по числу контрмер',
        summary: MATRIX_FILTERS.bluePhase ? `Срез по фазе ${PHASE_RU[STATE.byId.get(MATRIX_FILTERS.bluePhase)?.name] || PHASE_RU_LONG[STATE.byId.get(MATRIX_FILTERS.bluePhase)?.name] || ''}`.trim() : 'Полный корпус blue-матрицы',
        unit: 'контрмер',
        rows: tacticRows,
        footerNote: tacticRows.length ? `Видно тактик: ${cols.length}` : 'Нет данных для текущего фильтра',
      },
      {
        eyebrow: 'покрытие',
        title: 'Контрмеры с самым широким охватом',
        summary: 'Топ по числу техник, к которым привязана контрмера',
        unit: 'техник',
        rows: coverageRows,
        footerNote: coverageRows.length ? `Видно контрмер: ${visibleCounters.length}` : 'В этом срезе нет контрмер',
      }
    ]);
    setInsightBar(
      $('#blue-insight-bar'),
      `Видимый срез матрицы защиты: ${cols.length} ${pluralRu(cols.length, 'тактика', 'тактики', 'тактик')} и ${visibleCounters.length} ${pluralRu(visibleCounters.length, 'контрмера', 'контрмеры', 'контрмер')}`,
      [
        MATRIX_FILTERS.bluePhase ? `фаза: ${PHASE_RU[STATE.byId.get(MATRIX_FILTERS.bluePhase)?.name] || PHASE_RU_LONG[STATE.byId.get(MATRIX_FILTERS.bluePhase)?.name] || MATRIX_FILTERS.bluePhase}` : 'все фазы',
      ]
    );

    grid.innerHTML = cols.map(({tac, counters}) => `
      <div class="matrix-col">
        <div class="matrix-col-head" title="${escape(tac.summary || '')}">
          <span class="mc-id">${escape(tac.disarm_id)}</span>
          ${escape(tName(tac))}
          <span class="mc-count">${counters.length} контр.</span>
        </div>
        ${counters.map(c => `
          <div class="matrix-cell blue" data-id="${escape(c.disarm_id)}" role="button" tabindex="0" aria-label="${escape(`${c.disarm_id} — ${tName(c)}, ${(c.techniques || []).length} техник`)}">
            <span class="mc-id">${escape(c.disarm_id)}</span>
            <span class="mc-name">${escape(tName(c))}</span>
            <span class="mc-meta">${(c.techniques || []).length} тех.</span>
          </div>`).join('')}
      </div>
    `).join('');

    const applyTextFilter = () => {
      const q = $('#blue-filter').value.trim().toLowerCase();
      $$('#blue-matrix .matrix-cell').forEach(c => {
        const txt = c.textContent.toLowerCase();
        c.classList.toggle('hidden', q && !txt.includes(q));
      });
    };
    applyTextFilter();

    grid.onclick = e => {
      const head = e.target.closest('.matrix-col-head');
      if (head && window.matchMedia('(max-width: 720px)').matches) {
        head.parentElement.classList.toggle('collapsed');
        return;
      }
      const cell = e.target.closest('.matrix-cell');
      if (cell) openModal(cell.dataset.id);
    };
    grid.onkeydown = e => {
      const cell = e.target.closest('.matrix-cell');
      if (cell && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openModal(cell.dataset.id);
      }
    };

    $('#blue-filter').oninput = applyTextFilter;
    if (phasePills) phasePills.onclick = e => {
      const btn = e.target.closest('[data-phase]');
      if (!btn) return;
      const selectedPhase = btn.dataset.phase || '';
      const restoreFocus = document.activeElement === btn;
      MATRIX_FILTERS.bluePhase = selectedPhase;
      renderBlueMatrix();
      if (restoreFocus) {
        [...phasePills.querySelectorAll('[data-phase]')]
          .find(pill => pill.dataset.phase === selectedPhase)
          ?.focus({ preventScroll: true });
      }
    };
  }

  /* ---- Search ---- */
  function setupSearch() {
    const input = $('#global-search');
    const out = $('#search-results');
    const more = $('#search-results-more');
    const status = $('#search-status');
    // SCOPED to .search-types — was leaking into Playbook checkboxes before
    const checkboxes = () => $$('#search-type-list input[type=checkbox]:checked').map(c => c.value);

    const corpus = () => {
      const d = STATE.data;
      return [
        ...d.techniques.map(o => ({...o, _type:'technique'})),
        ...d.counters.map(o => ({...o, _type:'counter'})),
        ...d.incidents.map(o => ({...o, _type:'incident'})),
        ...d.tactics.map(o => ({...o, _type:'tactic'})),
        ...d.tools.map(o => ({...o, _type:'tool'})),
        ...d.detections.map(o => ({...o, _type:'detection'})),
        ...d.tasks.map(o => ({...o, _type:'task'})),
      ];
    };

    const createSearchIndex = () => ANALYSIS.createSearchIndex(corpus().map(o => ({
      id: o.disarm_id,
      name: tName(o),
      summary: tSummary(o),
      type: o._type,
      object: o,
    })));

    const run = () => {
      const q = input.value.trim().toLowerCase();
      const types = new Set(checkboxes());
      const setStatus = (text, active = false) => {
        if (!status) return;
        status.textContent = text;
        status.classList.toggle('is-active', active);
      };
      if (!q) {
        out.innerHTML = '<div class="pb-empty">Введите ID, термин или фразу, чтобы увидеть результаты.</div>';
        more.innerHTML = '';
        setStatus('Введите ID, термин или фразу. Активные фильтры влияют на выдачу.');
        return;
      }

      const results = createSearchIndex().search(q, { types })
        .map(result => ({ o: result.document.object, score: result.score }));

      if (!results.length) {
        out.innerHTML = '<div class="pb-empty">Ничего не найдено. Проверьте запрос или включите больше типов объектов.</div>';
        more.innerHTML = '';
        setStatus(`Ничего не найдено по запросу «${input.value.trim()}»`, true);
        return;
      }
      const visible = results.slice(0, SEARCH_PAGE.shown);
      setStatus(`Найдено: ${results.length} · показано: ${visible.length} · фильтров: ${types.size}`, true);
      out.innerHTML = visible.map(({o}) => {
        const summary = previewSummary(o);
        return `
          <div class="result" data-id="${escape(o.disarm_id)}">
            <div class="result-h">
              <span class="result-id">${escape(o.disarm_id)}</span>
              <span class="result-name">${highlight(tName(o) || '—', q)}</span>
              <span class="result-type ${TYPE_CSS[o._type] || ''}">${escape(TYPE_LABELS[o._type] || o._type)}</span>
              <button class="result-open" type="button">Открыть</button>
            </div>
            ${summary ? `<div class="result-summary">${highlight(truncate(summary, 220), q)}</div>` : ''}
          </div>
        `;
      }).join('');
      more.innerHTML = visible.length < results.length
        ? `<button class="avds-export-btn" type="button" id="search-more-btn">Показать ещё (${results.length - visible.length})</button>`
        : `<div class="search-results-count">Показано ${visible.length} из ${results.length}</div>`;
    };

    STATE.runSearch = run;
    input.addEventListener('input', () => {
      SEARCH_PAGE.shown = SEARCH_PAGE.limit;
      run();
    });
    $$('#search-type-list input').forEach(c => c.addEventListener('change', () => {
      SEARCH_PAGE.shown = SEARCH_PAGE.limit;
      run();
    }));
    // Popular query chips
    $$('.popular-q').forEach(b => b.addEventListener('click', () => {
      input.value = b.dataset.q || '';
      input.focus();
      run();
    }));
    out.addEventListener('click', e => {
      const r = e.target.closest('.result');
      if (r) openModal(r.dataset.id);
    });
    more.addEventListener('click', e => {
      const btn = e.target.closest('#search-more-btn');
      if (!btn) return;
      SEARCH_PAGE.shown += SEARCH_PAGE.limit;
      run();
    });
    out.innerHTML = '<div class="pb-empty">Введите ID, термин или фразу, чтобы увидеть результаты.</div>';
  }

  /* ---- Incidents ---- */
  function renderIncidents() {
    const d = STATE.data;
    const list = $('#incident-list');
    const status = $('#incident-status');
    const summaryStrip = $('#incident-summary-strip');
    const years = uniq(d.incidents.map(i => i.year_started)).sort((a, b) => String(b).localeCompare(String(a)));
    const countries = uniq(d.incidents.map(i => i.found_in_country)).sort((a, b) => a.localeCompare(b));
    const tactics = uniq(d.incidents.flatMap(i => (i.techniques || []).map(tid => STATE.byId.get(tid)?.tactic_id)))
      .map(id => STATE.byId.get(id))
      .filter(Boolean);
    $('#incident-year-pills').innerHTML = [`<button class="mini-pill ${!INCIDENT_FILTERS.year ? 'active' : ''}" data-year="">Все годы</button>`, ...years.map(y => `<button class="mini-pill ${INCIDENT_FILTERS.year === y ? 'active' : ''}" data-year="${escape(y)}">${escape(y)}</button>`)].join('');
    $('#incident-country-pills').innerHTML = [`<button class="mini-pill ${!INCIDENT_FILTERS.country ? 'active' : ''}" data-country="">Все страны</button>`, ...countries.slice(0, 16).map(c => `<button class="mini-pill ${countryFilterIncludes(c) ? 'active' : ''}" data-country="${escape(c)}">${escape(localizeCountry(c))}</button>`)].join('');
    $('#incident-tactic-pills').innerHTML = [`<button class="mini-pill ${!INCIDENT_FILTERS.tactic ? 'active' : ''}" data-tactic="">Все тактики</button>`, ...tactics.slice(0, 12).map(t => `<button class="mini-pill ${INCIDENT_FILTERS.tactic === t.disarm_id ? 'active' : ''}" data-tactic="${escape(t.disarm_id)}">${escape(tName(t))}</button>`)].join('');
    renderIncidentPeriodComparison(d.incidents, years);
    const render = (q=$('#incident-filter')?.value || '') => {
      q = q.trim().toLowerCase();
      const items = d.incidents
        .filter(i => !INCIDENT_FILTERS.year || i.year_started === INCIDENT_FILTERS.year)
        .filter(i => countryFilterIncludes(i.found_in_country))
        .filter(i => !INCIDENT_FILTERS.tactic || (i.techniques || []).some(tid => STATE.byId.get(tid)?.tactic_id === INCIDENT_FILTERS.tactic))
        .filter(i => !q || `${i.disarm_id} ${i.name} ${i.summary} ${i.year_started} ${i.found_in_country}`.toLowerCase().includes(q))
        .sort((a, b) => (b.year_started || '0').localeCompare(a.year_started || '0'));
      const grouped = items.reduce((acc, item) => {
        const key = item.year_started || 'Без даты';
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(item);
        return acc;
      }, new Map());
      const filteredCountries = uniq(items.map(i => i.found_in_country).filter(Boolean));
      const byCountry = filteredCountries
        .map(code => ({ code, count: items.filter(i => i.found_in_country === code).length }))
        .sort((a, b) => b.count - a.count);
      const countryGroups = groupIncidentCountries(byCountry);
      renderIncidentGeoMap(countryGroups);
      const tacticCounts = new Map();
      items.forEach(i => {
        (i.techniques || []).forEach(tid => {
          const tacticId = STATE.byId.get(tid)?.tactic_id;
          if (tacticId) tacticCounts.set(tacticId, (tacticCounts.get(tacticId) || 0) + 1);
        });
      });
      const topTactic = Array.from(tacticCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      renderSummaryStrip(summaryStrip, [
        {
          eyebrow: 'охват',
          title: `${items.length} ${pluralRu(items.length, 'кейс', 'кейса', 'кейсов')}`,
          description: activeYearsLabel(items),
        },
        {
          eyebrow: 'география',
          title: `${countryGroups.length} ${pluralRu(countryGroups.length, 'страна', 'страны', 'стран')}`,
          description: countryGroups[0] ? `Чаще всего: ${localizeCountry(countryGroups[0].code)} (${countryGroups[0].count})` : 'Страны не указаны',
        },
        {
          eyebrow: 'таймлайн',
          title: `${grouped.size} ${pluralRu(grouped.size, 'год', 'года', 'лет')}`,
          description: yearsSpanLabel(items),
        },
        {
          eyebrow: 'тактики',
          title: topTactic ? (tName(STATE.byId.get(topTactic[0])) || topTactic[0]) : 'Нет выраженного лидера',
          description: topTactic ? `${topTactic[1]} упоминаний техник этой линии в текущем срезе` : 'Тактический лидер не определяется',
        },
      ]);
      if (status) {
        const activeFilters = [
          INCIDENT_FILTERS.year && `год ${INCIDENT_FILTERS.year}`,
          INCIDENT_FILTERS.country && `страна ${localizeCountry(INCIDENT_FILTERS.country)}`,
          INCIDENT_FILTERS.tactic && `тактика ${tName(STATE.byId.get(INCIDENT_FILTERS.tactic)) || INCIDENT_FILTERS.tactic}`,
          q && `поиск «${q}»`,
        ].filter(Boolean);
        setInsightBar(
          status,
          activeFilters.length
            ? `Показано ${items.length} из ${d.incidents.length}`
            : `Показаны все инциденты каталога: ${items.length}`,
          activeFilters.length ? activeFilters : ['без дополнительных фильтров']
        );
      }
      list.innerHTML = items.length ? Array.from(grouped.entries()).map(([year, bucket]) => `
        <section class="incident-year-group">
          <div class="incident-year-head"><strong>${escape(year)}</strong><span>${bucket.length} ${pluralRu(bucket.length, 'кейс', 'кейса', 'кейсов')}</span></div>
          <div class="incident-year-grid">
            ${bucket.map(i => {
              const title = tName(i);
              const label = `${i.disarm_id} — ${title}`;
              const summary = previewSummary({...i, _type:'incident'});
              return `
                <div class="incident-card" data-id="${escape(i.disarm_id)}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="${escape(label)}">
                  <div class="incident-meta">
                    <span class="incident-id">${escape(i.disarm_id)}</span>
                    ${i.year_started ? `<span class="incident-year">${escape(i.year_started)}</span>` : ''}
                    ${i.found_in_country ? `<span class="incident-country">${escape(localizeCountry(i.found_in_country))}</span>` : ''}
                  </div>
                  <div class="incident-name">${escape(title)}</div>
                  ${summary ? `<div class="incident-summary">${escape(truncate(summary, 150))}</div>` : ''}
                  ${(i.techniques || []).length ? `<div class="incident-techs">${i.techniques.slice(0,8).map(t => `<span class="incident-tech-tag">${escape(t)}</span>`).join('')}${i.techniques.length>8?`<span class="incident-tech-tag">+${i.techniques.length-8}</span>`:''}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `).join('') : '<div class="pb-empty">Инциденты не найдены. Измените запрос или сбросьте фильтры.</div>';
    };
    render();
    $('#incident-filter').oninput = e => render(e.target.value);
    const restorePillFocus = (groupId, key, value) => {
      const group = $(`#${groupId}`);
      const pill = Array.from(group?.querySelectorAll('button') || []).find(button => button.dataset[key] === value);
      pill?.focus({ preventScroll: true });
    };
    $('#incident-year-pills').onclick = e => {
      const btn = e.target.closest('[data-year]');
      if (!btn) return;
      const value = btn.dataset.year || '';
      const restoreFocus = document.activeElement === btn;
      INCIDENT_FILTERS.year = value;
      renderIncidents();
      if (restoreFocus) restorePillFocus('incident-year-pills', 'year', value);
    };
    $('#incident-country-pills').onclick = e => {
      const btn = e.target.closest('[data-country]');
      if (!btn) return;
      const value = btn.dataset.country || '';
      const restoreFocus = document.activeElement === btn;
      INCIDENT_FILTERS.country = value;
      renderIncidents();
      if (restoreFocus) restorePillFocus('incident-country-pills', 'country', value);
    };
    $('#incident-tactic-pills').onclick = e => {
      const btn = e.target.closest('[data-tactic]');
      if (!btn) return;
      const value = btn.dataset.tactic || '';
      const restoreFocus = document.activeElement === btn;
      INCIDENT_FILTERS.tactic = value;
      renderIncidents();
      if (restoreFocus) restorePillFocus('incident-tactic-pills', 'tactic', value);
    };
    $('#incident-clear-filters').onclick = () => {
      INCIDENT_FILTERS.year = '';
      INCIDENT_FILTERS.country = '';
      INCIDENT_FILTERS.tactic = '';
      $('#incident-filter').value = '';
      renderIncidents();
    };
    list.onclick = e => {
      const c = e.target.closest('.incident-card');
      if (c) openModal(c.dataset.id);
    };
    list.onkeydown = e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const c = e.target.closest('.incident-card[role="button"]');
      if (!c) return;
      e.preventDefault();
      openModal(c.dataset.id);
    };
  }

  function activeYearsLabel(items) {
    const ys = uniq(items.map(i => i.year_started).filter(Boolean)).sort();
    if (!ys.length) return 'Без датировки';
    return ys.length === 1 ? `Только ${ys[0]} год` : `${ys[0]}–${ys[ys.length - 1]}`;
  }
  function yearsSpanLabel(items) {
    const ys = uniq(items.map(i => i.year_started).filter(Boolean)).sort();
    if (!ys.length) return 'Без датировки';
    return ys.length === 1 ? `Весь срез относится к ${ys[0]} году` : `От ${ys[0]} до ${ys[ys.length - 1]} года`;
  }

  /* ---- Playbook ---- */
  function renderPlaybook() {
    const d = STATE.data;
    const techList = $('#pb-tech-list');
    const selectedTray = $('#pb-selected');

    const renderTechList = (q='') => {
      q = q.trim().toLowerCase();
      const techs = d.techniques
        .filter(t => !q || `${t.disarm_id} ${tName(t)} ${tSummary(t)}`.toLowerCase().includes(q));
      const groups = d.phases.map(phase => {
        const tacticIds = d.tactics.filter(t => t.phase_id === phase.disarm_id).map(t => t.disarm_id);
        const items = techs.filter(t => tacticIds.includes(t.tactic_id));
        return { phase, items };
      }).filter(group => group.items.length);
      techList.innerHTML = groups.map(({phase, items}) => `
        <details class="pb-group" open>
          <summary class="pb-group__summary">${escape(PHASE_RU_LONG[phase.name] || phase.name)} <span>${items.length}</span></summary>
          <div class="pb-group__items">
            ${items.map(t => `
              <label class="pb-list-item ${PLAYBOOK.selected.has(t.disarm_id) ? 'selected' : ''}">
                <input type="checkbox" data-id="${escape(t.disarm_id)}" ${PLAYBOOK.selected.has(t.disarm_id) ? 'checked' : ''}>
                <span class="pb-id">${escape(t.disarm_id)}</span>
                <span class="pb-name">${escape(tName(t))}</span>
              </label>
            `).join('')}
          </div>
        </details>
      `).join('');
    };

    const coverageAnalysis = () => ANALYSIS.analyzeCounterCoverage(
      Array.from(PLAYBOOK.selected),
      d.counters,
    );

    const renderHeader = () => {
      const headEl = $('#pb-coverage');
      if (!headEl) return;
      if (!PLAYBOOK.selected.size) {
        headEl.textContent = 'Техники не выбраны';
        headEl.className = 'pb-coverage-bar empty';
        return;
      }
      const analysis = coverageAnalysis();
      headEl.className = 'pb-coverage-bar';
      headEl.innerHTML = `
        <div class="cov-stat">
          <span class="cov-num">${analysis.selectedCount}</span>
          <span class="cov-lbl">техник в плейбуке</span>
        </div>
        <div class="cov-stat">
          <span class="cov-num">${analysis.candidateCount}</span>
          <span class="cov-lbl">связанных контрмер</span>
        </div>
        <div class="cov-stat">
          <span class="cov-num">${analysis.linkedCount}/${analysis.selectedCount}</span>
          <span class="cov-lbl">структурно связано (${analysis.linkedCoveragePct}%)</span>
        </div>
        <div class="cov-stat">
          <span class="cov-num">${analysis.portfolio.length}</span>
          <span class="cov-lbl">мер в опорном наборе</span>
        </div>
        <div class="cov-bar"><div class="cov-bar-fill" style="width:${analysis.linkedCoveragePct}%"></div></div>
        <div class="cov-method">Связь в DISARM показывает применимость, но не доказанную эффективность. Опорный набор рассчитан жадным set-cover по максимальному новому охвату; этичность, законность и пропорциональность проверяются аналитиком.</div>`;
    };

    const renderCounters = () => {
      if (selectedTray) {
        const ids = Array.from(PLAYBOOK.selected);
        selectedTray.hidden = ids.length === 0;
        selectedTray.classList.toggle('empty', ids.length === 0);
        selectedTray.innerHTML = ids.length
          ? ids.map(id => `<button class="pb-selected-chip" type="button" data-remove-tech="${escape(id)}">${escape(id)}<span>×</span></button>`).join('')
          : '';
      }
      const counters = $('#pb-counters');
      if (!PLAYBOOK.selected.size) {
        counters.innerHTML = '<div class="pb-empty">Выберите хотя бы одну технику слева</div>';
        togglePlaybookActions();
        renderHeader();
        return;
      }
      const analysis = coverageAnalysis();
      if (!analysis.ranked.length) {
        counters.innerHTML = '<div class="pb-empty">Для выбранных техник нет привязанных контрмер. Попробуйте техники более общего назначения.</div>';
        renderHeader();
        return;
      }
      const portfolioRank = new Map(analysis.portfolio.map((step, index) => [step.counter.disarm_id, {
        rank: index + 1,
        marginal: step.marginal.length,
      }]));
      const ordered = [
        ...analysis.portfolio.map(step => ({ counter: step.counter, matched: step.matched })),
        ...analysis.ranked.filter(item => !portfolioRank.has(item.counter.disarm_id)),
      ];
      counters.innerHTML = ordered.map(({counter, matched}) => {
        const portfolio = portfolioRank.get(counter.disarm_id);
        return `
        <div class="pb-counter-item${portfolio ? ' is-portfolio' : ''}" data-id="${escape(counter.disarm_id)}">
          <span class="pb-id">${escape(counter.disarm_id)}</span>
          <span class="pb-name">${escape(tName(counter))}${portfolio ? `<small>Опорная мера ${portfolio.rank} · новый охват +${portfolio.marginal}</small>` : ''}</span>
          <span class="pb-coverage">${matched.length}/${PLAYBOOK.selected.size}</span>
        </div>
      `; }).join('');
      togglePlaybookActions();
      renderHeader();
    };

    const togglePlaybookActions = () => {
      const hasSelection = !!PLAYBOOK.selected.size;
      ['#pb-permalink', '#pb-export', '#pb-export-navigator', '#pb-export-stix', '#pb-clear'].forEach(sel => {
        const el = $(sel);
        if (!el) return;
        el.disabled = !hasSelection;
      });
      const toolbar = document.querySelector('.pb-toolbar');
      if (toolbar) toolbar.dataset.emptyActions = hasSelection ? 'false' : 'true';
    };

    STATE._pb = { renderTechList, renderCounters };

    renderTechList();
    renderCounters();

    $('#pb-tech-filter').addEventListener('input', e => renderTechList(e.target.value));

    techList.addEventListener('change', e => {
      const cb = e.target.closest('input[type=checkbox]');
      if (!cb) return;
      const id = cb.dataset.id;
      if (cb.checked) PLAYBOOK.selected.add(id); else PLAYBOOK.selected.delete(id);
      cb.closest('.pb-list-item').classList.toggle('selected', cb.checked);
      savePlaybook();
      updateUrlState();
      renderCounters();
    });

    $('#pb-counters').addEventListener('click', e => {
      const c = e.target.closest('.pb-counter-item');
      if (c) openModal(c.dataset.id);
    });

    $('#pb-clear').addEventListener('click', () => {
      PLAYBOOK.selected.clear();
      savePlaybook();
      updateUrlState();
      renderTechList($('#pb-tech-filter').value);
      renderCounters();
    });

    $('#pb-export').addEventListener('click', exportPlaybook);
    const exNav = $('#pb-export-navigator');
    if (exNav) exNav.addEventListener('click', exportNavigatorJSON);
    const exStix = $('#pb-export-stix');
    if (exStix) exStix.addEventListener('click', exportStixBundle);

    // Copy permalink
    const linkBtn = $('#pb-permalink');
    if (linkBtn) {
      linkBtn.addEventListener('click', async () => {
        if (!PLAYBOOK.selected.size) { alert(ui('Выберите хотя бы одну технику')); return; }
        const params = new URLSearchParams();
        params.set('tab', 'playbook');
        params.set('locale', STATE.locale);
        params.set('playbook', Array.from(PLAYBOOK.selected).join(','));
        const url = location.origin + location.pathname + '?' + params.toString();
        try {
          await navigator.clipboard.writeText(url);
          const orig = linkBtn.textContent;
          linkBtn.textContent = 'Ссылка скопирована';
          setTimeout(() => { linkBtn.textContent = orig; }, 2500);
        } catch (e) {
          prompt(ui('Скопируйте ссылку:'), url);
        }
      });
    }
    selectedTray?.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove-tech]');
      if (!btn) return;
      PLAYBOOK.selected.delete(btn.dataset.removeTech);
      savePlaybook();
      updateUrlState();
      renderTechList($('#pb-tech-filter').value);
      renderCounters();
    });
  }

  function exportPlaybook() {
    if (!PLAYBOOK.selected.size) {
      alert(ui('Выберите хотя бы одну технику'));
      return;
    }
    const d = STATE.data;
    const techs = Array.from(PLAYBOOK.selected).map(id => STATE.byId.get(id)).filter(Boolean);
    const analysis = ANALYSIS.analyzeCounterCoverage(Array.from(PLAYBOOK.selected), d.counters);

    const dt = new Date().toISOString().slice(0, 10);
    const displayDate = new Intl.DateTimeFormat({ru:'ru-RU',kk:'kk-KZ',en:'en-GB'}[STATE.locale], {dateStyle:'medium'}).format(new Date());
    let md = `# ${uiFormat('DISARM Плейбук · {n}', displayDate)}\n\n`;
    md += `_${ui('Сгенерировано обозревателем для выбранных техник DISARM 1.7.0 и связанных контрмер.')}_\n\n`;
    md += `## ${uiFormat('Выбранные наблюдаемые техники ({n})', techs.length)}\n\n`;
    techs.forEach(t => {
      md += `### ${t.disarm_id} — ${tName(t)}\n`;
      if (tSummary(t)) md += `${tSummary(t)}\n\n`;
      const note = getAnn(t.disarm_id).note;
      if (note) md += `**${ui('Заметка аналитика')}:** ${note}\n\n`;
    });
    md += `## ${uiFormat('Опорный набор связанных контрмер ({n})', analysis.portfolio.length)}\n\n`;
    md += ui('Набор рассчитан жадным set-cover по максимальному новому структурному охвату. Связь в DISARM не доказывает эффективность меры; перед применением обязательна проверка этичности, законности, пропорциональности и локального контекста.') + '\n\n';
    analysis.portfolio.forEach(({counter, matched, marginal}, index) => {
      md += `### ${index + 1}. ${counter.disarm_id} — ${tName(counter)}  \n`;
      md += uiFormat('Связано: {n}/{n}; новый охват на этом шаге: {n} ({n})', matched.length, techs.length, marginal.length, marginal.join(', ')) + '  \n';
      if (tSummary(counter)) md += `\n${tSummary(counter)}\n\n`;
    });
    if (analysis.uncovered.length) md += `## ${ui('Без связанной контрмеры в корпусе')}\n\n${analysis.uncovered.join(', ')}\n\n`;
    md += '\n---\n\n' + uiFormat('Источник данных: [DISARM Foundation]({n}) · DISARM 1.7.0. Данные адаптированы для интерактивного обозревателя и этого экспорта.', DISARM_SOURCE_URL) + ' ';
    md += ui('Лицензия материалов DISARM: [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/), согласно [условиям фонда](https://www.disarm.foundation/terms-of-service) и [LICENSE.md выпуска](https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/LICENSE.md). README.md выпуска содержит отличающуюся запись CC-BY-4.0.') + '\n';

    downloadBlob(md, `disarm-playbook-${dt}.md`, 'text/markdown');
  }

  /* ---- DISARM Navigator JSON layer export ---- */
  function exportNavigatorJSON() {
    const d = STATE.data;
    const dt = new Date().toISOString().slice(0,10);
    const ids = PLAYBOOK.selected.size ? Array.from(PLAYBOOK.selected) : d.techniques.map(t=>t.disarm_id);
    const incidentCounts = ids.map(id => (STATE.incidentByTech.get(id) || []).length);
    const heatScale = ANALYSIS.createLogHeatScale(incidentCounts);

    // Score semantics are explicit: binary selection (100) or a descriptive log-frequency bucket (0..5).
    const scored = ids.map(id => {
      const t = STATE.byId.get(id);
      if (!t) return null;
      const incCount = (STATE.incidentByTech.get(id) || []).length;
      const inPlaybook = PLAYBOOK.selected.has(id);
      const score = inPlaybook ? 100 : heatScale.bucketFor(incCount);
      return {
        techniqueID: id,
        tactic: t.tactic_id.toLowerCase(),
        score: score,
        color: inPlaybook ? '#dc2626' : (incCount > 0 ? '#fb923c' : ''),
        comment: t.name + (incCount ? ` · ${uiFormat('{n} инцидентов', incCount)}` : ''),
        enabled: true,
      };
    }).filter(Boolean);

    const max = Math.max(1, ...scored.map(s=>s.score));
    const layer = {
      name: PLAYBOOK.selected.size ? uiFormat('DISARM Плейбук · {n}', dt) : uiFormat('DISARM Тепловая карта · {n}', dt),
      versions: { attack: '1', layer: '4.4', navigator: '4.8.2' },
      domain: 'disarm-1.7-sqlite',
      // Embedded source-bound domain prevents loading an incompatible upstream STIX revision.
      customDataURL: 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(DATA.navigatorBundle(d))),
      description: PLAYBOOK.selected.size
        ? uiFormat('Плейбук из обозревателя DISARM. {n} техник; связанные контрмеры и границы интерпретации см. в текстовом экспорте.', PLAYBOOK.selected.size)
        : uiFormat('Тепловая карта всех {n} техник: score — логарифмический bucket частоты 0–5, не вероятность и не риск (инцидентов в корпусе: {n}).', d.techniques.length, d.incidents.length),
      filters: { platforms: ['DISARM'] },
      sorting: 0,
      layout: { layout: 'side', aggregateFunction: 'average', showID: true, showName: true, showAggregateScores: false, countUnscored: false },
      hideDisabled: false,
      techniques: scored,
      gradient: {
        colors: ['#fee2e2', '#dc2626'],
        minValue: 0,
        maxValue: max,
      },
      legendItems: [
        { label: ui('В плейбуке'), color: '#dc2626' },
        { label: ui('В инцидентах'), color: '#fb923c' },
      ],
      metadata: [
        { name: 'source', value: ui('DISARM обозреватель') },
        { name: 'locale', value: STATE.locale },
        { name: 'generated', value: new Date().toISOString() },
        { name: 'version', value: 'DISARM 1.7.0' },
        { name: 'source_url', value: DISARM_SOURCE_URL },
        { name: 'source_revision', value: '216a8828c7d0f6a67ad2a8867c716bf961914776' },
        { name: 'source_artifact', value: 'generated_files/DISARM_database.sqlite' },
        { name: 'source_artifact_sha256', value: '753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38' },
        { name: 'layer_scope', value: 'DISARM 1.7.0 official SQLite core' },
        { name: 'license', value: 'CC-BY-SA-4.0; https://creativecommons.org/licenses/by-sa/4.0/' },
        { name: 'license_status', value: 'resolved_by_current_foundation_terms' },
        { name: 'license_terms', value: 'https://www.disarm.foundation/terms-of-service' },
        { name: 'license_readme', value: 'CC-BY-4.0; https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/README.md' },
        { name: 'license_file', value: 'CC-BY-SA-4.0; https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/LICENSE.md' },
        { name: 'score_semantics', value: PLAYBOOK.selected.size ? 'binary selection: selected=100' : 'log1p frequency bucket 0..5; raw count is in comment; not probability or risk' },
      ],
      showTacticRowBackground: false,
      tacticRowBackground: '#dddddd',
      selectTechniquesAcrossTactics: true,
      selectSubtechniquesWithParent: false,
    };

    downloadBlob(JSON.stringify(layer, null, 2), `disarm-navigator-${dt}.json`, 'application/json');
  }

  /* ---- STIX 2.1 bundle export ---- */
  function exportStixBundle() {
    const d = STATE.data;
    const techIds = PLAYBOOK.selected.size ? Array.from(PLAYBOOK.selected) : d.techniques.map(t=>t.disarm_id);
    if (!techIds.length) { alert(ui('Нет техник для экспорта')); return; }

    const now = new Date().toISOString();
    const dt = now.slice(0,10);
    const objects = [];

    // Current Foundation terms and v1.7.0 LICENSE both identify CC-BY-SA-4.0.
    const markingId = 'marking-definition--' + uuidv4();
    objects.push({
      type: 'marking-definition',
      spec_version: '2.1',
      id: markingId,
      created: now,
      definition_type: 'statement',
      definition: { statement: ui('Материалы DISARM Foundation: CC-BY-SA-4.0. Данные DISARM 1.7.0 адаптированы для интерактивного обозревателя и экспорта. https://www.disarm.foundation/terms-of-service https://creativecommons.org/licenses/by-sa/4.0/ https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/LICENSE.md') },
    });

    // Identity (creator)
    const identityId = 'identity--' + uuidv4();
    objects.push({
      type: 'identity',
      spec_version: '2.1',
      id: identityId,
      created: now,
      modified: now,
      name: ui('DISARM обозреватель'),
      lang: STATE.locale,
      identity_class: 'system',
      object_marking_refs: [markingId],
    });

    const techStixId = new Map();

    // Attack patterns from techniques
    techIds.forEach(id => {
      const t = STATE.byId.get(id);
      if (!t) return;
      const stixId = 'attack-pattern--' + uuidv4();
      techStixId.set(id, stixId);
      objects.push({
        type: 'attack-pattern',
        spec_version: '2.1',
        id: stixId,
        created: now,
        modified: now,
        created_by_ref: identityId,
        name: t.name,
        lang: 'en',
        description: t.summary || '',
        external_references: [{
          source_name: 'DISARM',
          external_id: t.disarm_id,
          url: 'https://raw.githubusercontent.com/DISARMFoundation/DISARMframeworks-17/216a8828c7d0f6a67ad2a8867c716bf961914776/generated_files/DISARM_database.sqlite',
          hashes: { 'SHA-256': '753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38' },
        }],
        kill_chain_phases: t.tactic_id ? [{
          kill_chain_name: 'disarm',
          phase_name: t.tactic_id.toLowerCase(),
        }] : [],
        object_marking_refs: [markingId],
      });
    });

    // Counters as courses-of-action
    const relevantCounters = d.counters.filter(c =>
      (c.techniques || []).some(t => PLAYBOOK.selected.has(t) || techIds.includes(t))
    );
    const counterStixId = new Map();
    relevantCounters.forEach(c => {
      const stixId = 'course-of-action--' + uuidv4();
      counterStixId.set(c.disarm_id, stixId);
      objects.push({
        type: 'course-of-action',
        spec_version: '2.1',
        id: stixId,
        created: now,
        modified: now,
        created_by_ref: identityId,
        name: c.name,
        lang: 'en',
        description: c.summary || '',
        external_references: [{
          source_name: 'DISARM',
          external_id: c.disarm_id,
          url: 'https://raw.githubusercontent.com/DISARMFoundation/DISARMframeworks-17/216a8828c7d0f6a67ad2a8867c716bf961914776/generated_files/DISARM_database.sqlite',
          hashes: { 'SHA-256': '753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38' },
        }],
        object_marking_refs: [markingId],
      });
    });

    // Relationships: counter mitigates attack-pattern
    relevantCounters.forEach(c => {
      (c.techniques || []).forEach(tid => {
        if (techStixId.has(tid)) {
          objects.push({
            type: 'relationship',
            spec_version: '2.1',
            id: 'relationship--' + uuidv4(),
            created: now,
            modified: now,
            created_by_ref: identityId,
            relationship_type: 'mitigates',
            source_ref: counterStixId.get(c.disarm_id),
            target_ref: techStixId.get(tid),
            object_marking_refs: [markingId],
          });
        }
      });
    });

    // DISARM incidents are represented as STIX campaigns, not actor-like intrusion sets.
    const relevantIncidents = d.incidents.filter(i =>
      (i.techniques || []).some(t => techStixId.has(t))
    );
    relevantIncidents.forEach(inc => {
      const isId = 'campaign--' + uuidv4();
      objects.push({
        type: 'campaign',
        spec_version: '2.1',
        id: isId,
        created: now,
        modified: now,
        created_by_ref: identityId,
        name: inc.name,
        lang: 'en',
        description: inc.summary || '',
        external_references: [{
          source_name: 'DISARM',
          external_id: inc.disarm_id,
          url: 'https://raw.githubusercontent.com/DISARMFoundation/DISARMframeworks-17/216a8828c7d0f6a67ad2a8867c716bf961914776/generated_files/DISARM_database.sqlite',
          hashes: { 'SHA-256': '753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38' },
        }],
        object_marking_refs: [markingId],
      });
      (inc.techniques || []).forEach(tid => {
        if (techStixId.has(tid)) {
          objects.push({
            type: 'relationship',
            spec_version: '2.1',
            id: 'relationship--' + uuidv4(),
            created: now,
            modified: now,
            created_by_ref: identityId,
            relationship_type: 'uses',
            source_ref: isId,
            target_ref: techStixId.get(tid),
            object_marking_refs: [markingId],
          });
        }
      });
    });

    const bundle = {
      type: 'bundle',
      id: 'bundle--' + uuidv4(),
      objects,
    };

    downloadBlob(JSON.stringify(bundle, null, 2), `disarm-stix-${dt}.json`, 'application/json');
  }

  /* ---- Modal ---- */
  function openModal(id) {
    STATE.modalId = id;
    const o = STATE.byId.get(id);
    if (!o) return;
    const d = STATE.data;
    const modal = $('#modal');
    if (modal?.hidden) {
      STATE.modalReturnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : $('#tabs [aria-selected="true"]');
    }

    let body = `<div class="modal-body" id="modal-content">`;
    body += `<div class="obj-id">${escape(o.disarm_id)}</div>`;
    body += `<h2 id="modal-title">${escape(tName(o) || '—')}</h2>`;
    body += `<div class="obj-meta">`;
    body += `<span class="result-type ${TYPE_CSS[o._type] || ''}">${escape(TYPE_LABELS[o._type] || o._type)}</span>`;
    if (o._type === 'technique' && o.tactic_id) {
      const tac = STATE.byId.get(o.tactic_id);
      if (tac) body += `<span class="avds-chip">${escape(tac.disarm_id)} · ${escape(tName(tac))}</span>`;
    }
    if (o._type === 'tactic' && o.phase_id) {
      const p = STATE.byId.get(o.phase_id);
      if (p) body += `<span class="avds-chip">Фаза: ${escape(PHASE_RU[p.name] || p.name)}</span>`;
    }
    if (o._type === 'incident') {
      if (o.year_started) body += `<span class="avds-chip">${escape(o.year_started)}</span>`;
      if (o.found_in_country) body += `<span class="avds-chip">${escape(localizeCountry(o.found_in_country))}</span>`;
      if (o.attributions_seen) body += `<span class="avds-chip">Атрибуция: ${escape(displayAttribution(o.attributions_seen))}</span>`;
    }
    if (o._type === 'technique') {
      const incCount = (STATE.incidentByTech.get(o.disarm_id) || []).length;
      if (incCount) body += `<span class="avds-chip chip-warn">${incCount} инцидентов</span>`;
    }
    body += `</div>`;

    // Action toolbar (techniques only — Add to Playbook)
    if (o._type === 'technique') {
      const inPb = PLAYBOOK.selected.has(o.disarm_id);
      body += `<div class="obj-actions">
        <button class="avds-btn ${inPb ? 'avds-btn-success' : 'avds-btn-primary'}" data-pb-toggle="${escape(o.disarm_id)}">
          ${inPb ? 'В плане — убрать' : 'Добавить в план'}
        </button>
        <button class="avds-btn" data-deeplink="${escape(o.disarm_id)}">Скопировать ссылку</button>
      </div>`;
    }

    if (previewSummary(o)) {
      body += `<div class="obj-summary">${escape(previewSummary(o))}</div>`;
      body += `<p class="obj-source-boundary">Источник описания — <a href="https://github.com/DISARMFoundation/DISARMframeworks-17" target="_blank" rel="noopener noreferrer">DISARM 1.7.0 · SQLite-ядро</a>.</p>`;
    }

    // Annotations panel for techniques
    if (o._type === 'technique') {
      const a = getAnn(o.disarm_id);
      const swatches = ANN_PRESET_COLORS.map(c => {
        const isClear = !c;
        const sel = (a.color || '') === c ? ' is-selected' : '';
        return `<button class="ann-swatch${sel}${isClear ? ' ann-swatch--clear' : ''}" data-ann-color="${escape(c)}" style="${c ? `background:${escape(c)}` : ''}" title="${isClear ? 'без цвета' : escape(c)}" aria-label="${isClear ? 'без цвета' : escape(c)}"></button>`;
      }).join('');
      body += `
        <details class="ann-panel" data-ann-for="${escape(o.disarm_id)}"${(a.note || a.score || a.color) ? ' open' : ''}>
          <summary class="ann-summary">
            <span class="ann-summary__label">Заметка аналитика</span>
            <span class="ann-summary__hint">${(a.note || a.score || a.color) ? 'есть данные' : 'нажмите, чтобы добавить'}</span>
          </summary>
          <div class="ann-body">
            <label class="ann-field">
              <span class="ann-field__label">Заметка</span>
              <textarea class="ds-input ann-note" rows="3" placeholder="наблюдение, гипотеза, источник…">${escape(a.note || '')}</textarea>
            </label>
            <div class="ann-row">
              <label class="ann-field ann-field--score">
                <span class="ann-field__label">Ручной приоритет: <strong class="ann-score-value">${ANALYSIS.clampAnalystPriority(a.score)}</strong>/100 <small>не вероятность</small></span>
                <input type="range" min="0" max="100" step="5" class="ann-score" value="${Number(a.score) || 0}">
              </label>
              <div class="ann-field ann-field--color">
                <span class="ann-field__label">Метка</span>
                <div class="ann-swatches">${swatches}</div>
              </div>
            </div>
            <div class="ann-actions">
              <button class="ann-clear" type="button">Очистить</button>
              <span class="ann-saved-hint" aria-live="polite"></span>
            </div>
          </div>
        </details>`;
    }

    const linkRow = (id) => {
      const r = STATE.byId.get(id);
      if (!r) return '';
      return `<div class="obj-link" role="button" tabindex="0" data-id="${escape(id)}">
        <span class="obj-link-id">${escape(id)}</span>
        <span class="obj-link-name">${escape(tName(r) || '')}</span>
      </div>`;
    };

    if (o._type === 'technique') {
      if (o.counters && o.counters.length) {
        body += `<div class="obj-section"><h4>Контрмеры (${o.counters.length})</h4>
          <div class="obj-link-list">${o.counters.map(linkRow).join('')}</div></div>`;
      }
      if (o.detections && o.detections.length) {
        body += `<div class="obj-section"><h4>Индикаторы обнаружения (${o.detections.length})</h4>
          <div class="obj-link-list">${o.detections.map(linkRow).join('')}</div></div>`;
      }
      if (o.incidents && o.incidents.length) {
        body += `<div class="obj-section"><h4>Связанные инциденты (${o.incidents.length})</h4>
          <div class="obj-link-list">${o.incidents.map(linkRow).join('')}</div></div>`;
      } else {
        const incs = (STATE.incidentByTech.get(o.disarm_id) || []);
        if (incs.length) {
          body += `<div class="obj-section"><h4>Связанные инциденты (${incs.length})</h4>
            <div class="obj-link-list">${incs.map(i => linkRow(i.disarm_id)).join('')}</div></div>`;
        }
      }
    } else if (o._type === 'counter') {
      if (o.metatechnique_id) {
        const m = STATE.byId.get(o.metatechnique_id);
        if (m) body += `<div class="obj-section"><h4>Метатехника</h4>
          <div class="obj-link-list">${linkRow(o.metatechnique_id)}</div></div>`;
      }
      if (o.techniques && o.techniques.length) {
        body += `<div class="obj-section"><h4>Применимо к техникам (${o.techniques.length})</h4>
          <div class="obj-link-list">${o.techniques.map(linkRow).join('')}</div></div>`;
      }
    } else if (o._type === 'incident') {
      if (o.techniques && o.techniques.length) {
        body += `<div class="obj-section"><h4>Использованные техники (${o.techniques.length})</h4>
          <div class="obj-link-list">${o.techniques.map(linkRow).join('')}</div></div>`;
      }
    } else if (o._type === 'tactic') {
      const techs = (d.tactic_to_techniques[o.disarm_id] || []);
      if (techs.length) {
        body += `<div class="obj-section"><h4>Техники тактики (${techs.length})</h4>
          <div class="obj-link-list">${techs.map(linkRow).join('')}</div></div>`;
      }
      const cs = (d.tactic_to_counters[o.disarm_id] || []);
      if (cs.length) {
        body += `<div class="obj-section"><h4>Контрмеры на этом этапе (${cs.length})</h4>
          <div class="obj-link-list">${cs.map(linkRow).join('')}</div></div>`;
      }
    }

    body += `</div>`;
    $('#modal-body').innerHTML = body;
    I18N.render($('#modal-body'));
    const m = modal || $('#modal');
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    announceA11y(`${TYPE_LABELS[o._type] || 'Объект'} ${o.disarm_id}: карточка открыта. Используйте Tab для навигации, Escape для закрытия.`);
    requestAnimationFrame(() => m.querySelector('.modal-close')?.focus());
  }

  function closeModal() {
    const m = $('#modal');
    if (!m || m.hidden) return;
    m.hidden = true;
    document.body.style.overflow = '';
    const returnFocus = STATE.modalReturnFocus;
    STATE.modalReturnFocus = null;
    if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
    else $('#tabs [aria-selected="true"]')?.focus();
    announceA11y('Карточка закрыта. Фокус возвращён к исходному элементу.');
  }

  function setupModal() {
    const m = $('#modal');
    m.addEventListener('click', async e => {
      if (e.target.closest('[data-close]')) {
        closeModal();
        return;
      }
      // Add to / remove from playbook
      const pbBtn = e.target.closest('[data-pb-toggle]');
      if (pbBtn) {
        const id = pbBtn.dataset.pbToggle;
        if (PLAYBOOK.selected.has(id)) PLAYBOOK.selected.delete(id);
        else PLAYBOOK.selected.add(id);
        savePlaybook();
        updateUrlState();
        // re-render playbook if rendered
        if (STATE._pb) {
          STATE._pb.renderTechList($('#pb-tech-filter')?.value || '');
          STATE._pb.renderCounters();
        }
        // re-open modal to refresh button state
        openModal(id);
        return;
      }
      // Copy deep link
      const dlBtn = e.target.closest('[data-deeplink]');
      if (dlBtn) {
        const id = dlBtn.dataset.deeplink;
        const url = location.origin + location.pathname + '?tab=red&locale=' + STATE.locale + '&technique=' + encodeURIComponent(id);
        try {
          await navigator.clipboard.writeText(url);
          const orig = dlBtn.textContent;
          dlBtn.textContent = 'Скопировано';
          setTimeout(() => { dlBtn.textContent = orig; }, 2000);
        } catch (err) {
          prompt(ui('Скопируйте ссылку:'), url);
        }
        return;
      }
      // Annotation: color swatch
      const swatch = e.target.closest('[data-ann-color]');
      if (swatch) {
        const panel = swatch.closest('.ann-panel');
        if (panel) {
          const id = panel.dataset.annFor;
          const color = swatch.dataset.annColor;
          setAnn(id, { color });
          panel.querySelectorAll('.ann-swatch').forEach(s =>
            s.classList.toggle('is-selected', s.dataset.annColor === color));
          flashSavedHint(panel);
          updateMatrixAnnotation(id);
        }
        return;
      }
      // Annotation: clear
      const clearBtn = e.target.closest('.ann-clear');
      if (clearBtn) {
        const panel = clearBtn.closest('.ann-panel');
        if (panel) {
          const id = panel.dataset.annFor;
          ANN.map.delete(id);
          saveAnnotations();
          // reset UI
          const note = panel.querySelector('.ann-note'); if (note) note.value = '';
          const score = panel.querySelector('.ann-score'); if (score) score.value = 0;
          const sv = panel.querySelector('.ann-score-value'); if (sv) sv.textContent = '0';
          panel.querySelectorAll('.ann-swatch').forEach(s =>
            s.classList.toggle('is-selected', !s.dataset.annColor));
          flashSavedHint(panel, 'очищено');
          updateMatrixAnnotation(id);
        }
        return;
      }
      const link = e.target.closest('.obj-link');
      if (link) openModal(link.dataset.id);
    });
    // Persist every edit before navigation; debounce only the visual acknowledgement.
    let annTimer = null;
    m.addEventListener('input', e => {
      const noteEl = e.target.closest('.ann-note');
      const scoreEl = e.target.closest('.ann-score');
      if (!noteEl && !scoreEl) return;
      const panel = (noteEl || scoreEl).closest('.ann-panel');
      if (!panel) return;
      const id = panel.dataset.annFor;
      if (scoreEl) {
        const sv = panel.querySelector('.ann-score-value');
        if (sv) sv.textContent = String(scoreEl.value);
      }
      const note = panel.querySelector('.ann-note')?.value || '';
      const score = Number(panel.querySelector('.ann-score')?.value || 0);
      setAnn(id, { note, score });
      clearTimeout(annTimer);
      annTimer = setTimeout(() => {
        flashSavedHint(panel);
        updateMatrixAnnotation(id);
      }, 300);
    });
    document.addEventListener('keydown', e => {
      if (m.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      const related = e.target.closest('.obj-link');
      if (related && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openModal(related.dataset.id); return; }
      if (e.key !== 'Tab') return;
      const focusable = $$('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])', m)
        .filter(node => !node.hidden && node.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  function setupIncidentPeriodTableScroll() {
    const viewport = $('.incident-period-comparison__table-scroll');
    if (!viewport) return;
    viewport.onkeydown = e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      let left;
      if (e.key === 'ArrowRight') left = viewport.scrollLeft + 64;
      else if (e.key === 'ArrowLeft') left = viewport.scrollLeft - 64;
      else if (e.key === 'Home') left = 0;
      else if (e.key === 'End') left = viewport.scrollWidth - viewport.clientWidth;
      else return;
      e.preventDefault();
      viewport.scrollLeft = Math.max(0, Math.min(left, viewport.scrollWidth - viewport.clientWidth));
    };
  }

  /* ---- Boot ---- */
  document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupLocale();
    setupTextScale();
    setupDataRecovery();
    setDataState('loading');
    // Parse deep-link FIRST
    const dl = parseDeepLink();
    STATE.initialDeepLink = dl;

    // Load persisted playbook + annotations
    loadPlaybook();
    loadAnnotations();
    // Apply deep-link playbook (merges in)
    applyDeepLinkState(dl);

    setupTabs();
    setupIncidentPeriodTableScroll();
    setupWorkspaceToolbar();

    try {
      await load();
    } catch (err) {
      const badge = $('#status-badge');
      badge.textContent = ui('ошибка загрузки');
      I18N.render();
      badge.className = 'avds-theme-chip avds-theme-chip--danger';
      console.error(err);
      return;
    }

    // Render all panels FIRST so deep-link tab switch lands on rendered DOM
    renderOverview();
    renderRedMatrix();
    renderBlueMatrix();
    setupSearch();
    renderIncidents();
    renderPlaybook();
    setupModal();
    if (STATE.rejectedPlaybookIds?.length) {
      const warning = document.createElement('p'); warning.id = 'playbook-import-warning';
      warning.className = 'avds-note'; warning.setAttribute('role', 'status');
      warning.textContent = ui('Исключены неизвестные техники: {n}').replace('{n}', STATE.rejectedPlaybookIds.join(', '));
      $('#panel-playbook')?.prepend(warning);
    }
    I18N.render();
    for (const event of ['click', 'input', 'change', 'keydown']) document.addEventListener(event, () => queueMicrotask(() => I18N.render()));

    // Preserve a tab chosen while the data and panels were loading.
    const tabChosenBeforeReady = STATE.tabSelectedDuringLoad;
    const readyTab = tabChosenBeforeReady || dl.tab;
    if (readyTab && $$('#tabs .avds-pill-tab').find(t => t.dataset.tab === readyTab)) {
      STATE.setTab(readyTab, { silent: true, noScroll: true });
    } else {
      updateDocumentMeta('overview');
    }
    if (!tabChosenBeforeReady && dl.technique && STATE.byId.get(dl.technique)) {
      // small delay so panel switch settles
      setTimeout(() => openModal(dl.technique), 150);
    }
  });
})();
