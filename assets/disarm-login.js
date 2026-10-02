(() => {
  const params = new URLSearchParams(location.search);
  let saved = 'ru'; try { saved = localStorage.getItem('disarm-ui-locale') || saved; } catch {}
  const next = new URL(params.get('next') || '/', location.origin);
  for (const [key,value] of params) if (!['next','error','locale'].includes(key) && next.origin === location.origin) next.searchParams.set(key,value);
  const requested = params.get('locale') || next.searchParams.get('locale') || saved;
  const locale = ['ru','kk','en'].includes(requested) ? requested : 'ru';
  if (next.origin === location.origin) { next.searchParams.set('locale', locale); params.set('next', next.pathname + next.search); }
  params.set('locale', locale);
  history.replaceState(null, '', location.pathname + '?' + params.toString());
  document.documentElement.lang = locale; DisarmI18n.setLocale(locale);
  const picker = document.querySelector('#login-locale'); picker.value = locale;
  const error = params.get('error');
  const message = document.querySelector('#login-error');
  const messages = {
    invalid: 'PIN-код не подошёл. Проверьте код и повторите попытку.',
    limited: 'Слишком много попыток. Подождите 15 минут и повторите вход.',
  };
  if (messages[error]) { message.textContent = DisarmI18n.text(messages[error]); message.hidden = false; }
  document.title = DisarmI18n.text('Вход · DISARM'); DisarmI18n.render();
  picker.addEventListener('change', () => {
    params.set('locale',picker.value);
    const target = new URL(params.get('next') || '/', location.origin);
    if (target.origin === location.origin) { target.searchParams.set('locale',picker.value); params.set('next', target.pathname + target.search); }
    location.replace(location.pathname + '?' + params.toString());
  });
})();
