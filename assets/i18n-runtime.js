/* Exact authored-copy translation. Source records and user notes are separate. */
(function (root) {
  'use strict';
  let locale = 'ru';
  const originals = new WeakMap();
  const sourceCopy = '.mc-name,.matrix-col-title,.result-name,.result-summary,#modal-title,.obj-summary,.obj-link-name,.pb-name,.pb-counter-title,.incident-card__title,.incident-title,.incident-name,.incident-summary,.inc-name,.compare-row__label,textarea,[data-source-copy]';
  const clean = value => value.replace(/\s+/g, ' ').trim();
  const patterns = Object.entries(root.DisarmLocaleCatalog).filter(([key]) => key.includes('{n}')).sort((a,b) => b[0].length-a[0].length).map(([key, value]) => ({ key, regex: new RegExp('^'+key.split('{n}').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('(.+?)')+'$'), value }));
  function text(value) {
    if (typeof value !== 'string') return value;
    if (locale === 'ru') {
      const forms = { 'техник':['техника','техники','техник'], 'контрмер':['контрмера','контрмеры','контрмер'], 'тактик':['тактика','тактики','тактик'], 'инцидентов':['инцидент','инцидента','инцидентов'] };
      return value.replace(/(\d+) (техник|контрмер|тактик|инцидентов)(?=\s|[;.,:)]|$)/g,(_,n,word)=>{
        const rule=new Intl.PluralRules('ru').select(Number(n));
        return n+' '+forms[word][rule==='one'?0:rule==='few'?1:2];
      });
    }
    const key = clean(value), direct = root.DisarmLocaleCatalog[key]?.[locale];
    const padding = translated => (value.match(/^\s*/)?.[0] || '') + translated + (value.match(/\s*$/)?.[0] || '');
    if (direct) return padding(direct);
    for (const pattern of patterns) {
      const match = key.match(pattern.regex);
      // Bare count patterns must not partially translate arbitrary sentences.
      if (match && /^\{n\} (?:тактик[аи]?|техник[аи]?|контрмер[аы]?|кейс(?:а|ов)?|стран[аы]?|год[а]?|лет)$/.test(pattern.key) && !/^\d[\d.,\s]*$/.test(match[1])) continue;
      if (match) { let i=1; let result = pattern.value[locale].replaceAll('{n}', () => text(match[i++]));
        if (locale === 'en') result = result.replace(/\b1 (techniques|tactics|cases|incidents|countermeasures|counters|years|countries)\b/g, (_, word) => '1 '+(word === 'countries' ? 'country' : word.slice(0,-1)));
        return padding(result); }
    }
    return value;
  }
  function reportDate(value) {
    const date = new Date(value);
    // Some browser ICU builds emit "M10" for kk-KZ medium dates.
    // Use the reviewed Kazakh month names consistently in this authored output.
    if (locale === 'kk') {
      const months = ['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'];
      return `${date.getFullYear()} ж. ${date.getDate()} ${months[date.getMonth()]}`;
    }
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', {dateStyle:'medium'}).format(date);
  }
  function project(node, key, value, setter) {
    const map = originals.get(node) || new Map();
    const old = map.get(key);
    const original = old && old.rendered === value ? old.original : value;
    const rendered = text(original);
    setter(rendered); map.set(key, { original, rendered }); originals.set(node,map);
  }
  function render(container = document) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node=walker.currentNode, parent=node.parentElement;
      if (!parent || parent.closest('script,style,noscript,'+sourceCopy) && !(parent.tagName === 'SMALL' && parent.closest('.pb-name'))) continue;
      project(node,'text',node.nodeValue,value=>{ node.nodeValue=value; });
    }
    container.querySelectorAll('[title],[placeholder],[aria-label],[data-label],meta[name="description"],meta[property="og:description"],meta[property="og:title"]').forEach(node=>{
      if (node.closest(sourceCopy) && node.tagName !== 'TEXTAREA') return;
      for (const key of ['title','placeholder','aria-label','content','data-label']) if(node.hasAttribute(key)) project(node,key,node.getAttribute(key),value=>node.setAttribute(key,value));
    });
  }
  root.DisarmI18n = { text, render, reportDate, setLocale: value => { locale=value; } };
})(globalThis);
