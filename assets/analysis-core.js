/* Pure analysis helpers shared by the browser app and Node smoke tests. */
(function initDisarmAnalysis(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DisarmAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('ru-RU')
      .replaceAll('ё', 'е')
      .replace(/[^\p{L}\p{N}._-]+/gu, ' ')
      .trim();
  }

  function tokenize(value) {
    const normalized = normalizeSearchText(value);
    return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
  }

  function tokenMatches(candidate, queryToken) {
    if (candidate === queryToken) return true;
    if (queryToken.length >= 3 && candidate.startsWith(queryToken)) return true;
    const cyrillicWord = /^[\p{Script=Cyrillic}-]+$/u;
    if (!cyrillicWord.test(candidate) || !cyrillicWord.test(queryToken)) return false;
    if (candidate.length < 5 || queryToken.length < 5) return false;
    let shared = 0;
    const limit = Math.min(candidate.length, queryToken.length);
    while (shared < limit && candidate[shared] === queryToken[shared]) shared += 1;
    return shared >= 4 && shared / Math.max(candidate.length, queryToken.length) >= 0.55;
  }

  function termFrequency(tokens, queryToken) {
    return tokens.reduce((count, token) => count + (tokenMatches(token, queryToken) ? 1 : 0), 0);
  }

  function createSearchIndex(documents) {
    const indexed = (documents || []).map((document, order) => {
      const fields = {
        id: tokenize(document.id),
        name: tokenize(document.name),
        summary: tokenize(document.summary),
      };
      return {
        document,
        order,
        normalized: {
          id: normalizeSearchText(document.id),
          name: normalizeSearchText(document.name),
          summary: normalizeSearchText(document.summary),
        },
        fields,
      };
    });
    const averageLength = ['id', 'name', 'summary'].reduce((acc, field) => {
      const total = indexed.reduce((sum, item) => sum + item.fields[field].length, 0);
      acc[field] = indexed.length ? Math.max(1, total / indexed.length) : 1;
      return acc;
    }, {});
    const fieldWeights = { id: 8, name: 4, summary: 1 };
    const k1 = 1.2;
    const b = 0.75;

    function search(query, options = {}) {
      const queryText = normalizeSearchText(query);
      const queryTokens = tokenize(queryText);
      if (!queryTokens.length) return [];
      const allowedTypes = options.types ? new Set(options.types) : null;
      const candidates = allowedTypes
        ? indexed.filter(item => allowedTypes.has(item.document.type))
        : indexed;
      const corpusSize = Math.max(1, candidates.length);
      const documentFrequency = new Map(queryTokens.map(token => [
        token,
        candidates.filter(item => Object.values(item.fields)
          .some(tokens => tokens.some(candidate => tokenMatches(candidate, token)))).length,
      ]));

      return candidates.map(item => {
        const everyTokenPresent = queryTokens.every(token => Object.values(item.fields)
          .some(tokens => tokens.some(candidate => tokenMatches(candidate, token))));
        if (!everyTokenPresent) return null;

        let score = 0;
        queryTokens.forEach(token => {
          const df = documentFrequency.get(token) || 0;
          const idf = Math.log(1 + ((corpusSize - df + 0.5) / (df + 0.5)));
          Object.keys(fieldWeights).forEach(field => {
            const tf = termFrequency(item.fields[field], token);
            if (!tf) return;
            const length = Math.max(1, item.fields[field].length);
            const saturation = (tf * (k1 + 1))
              / (tf + k1 * (1 - b + b * (length / averageLength[field])));
            score += idf * saturation * fieldWeights[field];
          });
        });

        if (item.normalized.id === queryText) score += 1000;
        else if (item.normalized.id.startsWith(queryText)) score += 300;
        if (item.normalized.name === queryText) score += 220;
        else if (item.normalized.name.startsWith(queryText)) score += 120;
        else if (item.normalized.name.includes(queryText)) score += 60;
        if (queryText.length >= 3 && item.normalized.summary.includes(queryText)) score += 15;

        return { document: item.document, score, order: item.order };
      })
        .filter(Boolean)
        .sort((left, right) => (
          right.score - left.score
          || String(left.document.id).localeCompare(String(right.document.id), 'ru')
          || left.order - right.order
        ));
    }

    return { search, size: indexed.length };
  }

  function createLogHeatScale(counts, bucketCount = 5) {
    const buckets = clamp(Math.trunc(Number(bucketCount) || 5), 2, 9);
    const positive = (counts || [])
      .map(Number)
      .filter(value => Number.isFinite(value) && value > 0);
    const min = positive.length ? Math.min(...positive) : 0;
    const max = positive.length ? Math.max(...positive) : 0;
    const logMin = min ? Math.log1p(min) : 0;
    const logRange = max > min ? Math.log1p(max) - logMin : 0;

    function bucketFor(value) {
      const count = Number(value);
      if (!Number.isFinite(count) || count <= 0 || !max) return 0;
      if (!logRange) return 1;
      const normalized = clamp((Math.log1p(count) - logMin) / logRange, 0, 1);
      return 1 + Math.min(buckets - 1, Math.floor(normalized * buckets));
    }

    const ranges = Array.from({ length: buckets }, (_, index) => {
      const values = positive.filter(value => bucketFor(value) === index + 1);
      return {
        bucket: index + 1,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
      };
    });
    return { min, max, bucketCount: buckets, bucketFor, ranges };
  }

  function analyzeCounterCoverage(selectedIds, counters) {
    const selected = new Set((selectedIds || []).filter(Boolean));
    const candidates = (counters || []).map(counter => {
      const matched = Array.from(new Set(counter.techniques || []))
        .filter(id => selected.has(id))
        .sort();
      return { counter, matched };
    }).filter(candidate => candidate.matched.length > 0);

    const ranked = candidates.slice().sort((left, right) => (
      right.matched.length - left.matched.length
      || String(left.counter.disarm_id).localeCompare(String(right.counter.disarm_id))
    ));
    const linked = new Set(candidates.flatMap(candidate => candidate.matched));
    const uncovered = Array.from(selected).filter(id => !linked.has(id)).sort();
    const covered = new Set();
    const remaining = new Map(candidates.map(candidate => [candidate.counter.disarm_id, candidate]));
    const portfolio = [];

    while (covered.size < linked.size && remaining.size) {
      const choices = Array.from(remaining.values()).map(candidate => ({
        ...candidate,
        marginal: candidate.matched.filter(id => !covered.has(id)),
      })).filter(candidate => candidate.marginal.length > 0)
        .sort((left, right) => (
          right.marginal.length - left.marginal.length
          || right.matched.length - left.matched.length
          || String(left.counter.disarm_id).localeCompare(String(right.counter.disarm_id))
        ));
      if (!choices.length) break;
      const choice = choices[0];
      choice.marginal.forEach(id => covered.add(id));
      remaining.delete(choice.counter.disarm_id);
      portfolio.push({
        counter: choice.counter,
        matched: choice.matched,
        marginal: choice.marginal,
        cumulativeCovered: covered.size,
      });
    }

    const selectedCount = selected.size;
    const linkedCount = linked.size;
    return {
      selectedCount,
      candidateCount: candidates.length,
      linkedCount,
      linkedCoveragePct: selectedCount ? Math.round((linkedCount / selectedCount) * 100) : 0,
      uncovered,
      ranked,
      portfolio,
    };
  }

  function clampAnalystPriority(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? clamp(Math.round(numeric), 0, 100) : 0;
  }

  return {
    analyzeCounterCoverage,
    clampAnalystPriority,
    createLogHeatScale,
    createSearchIndex,
    normalizeSearchText,
    tokenize,
  };
});
