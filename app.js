(() => {
  const $ = (id) => document.getElementById(id);
  const cfg = window.KT_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('YOUR-PROJECT') && !cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  let supabase = null;
  const publicView = $('publicView'), authView = $('authView'), appView = $('appView');
  const show = (view) => [publicView, authView, appView].forEach(v => v.classList.toggle('hidden', v !== view));
  const message = (txt, good=false) => { $('authMessage').textContent = txt; $('authMessage').style.color = good ? '#25875e' : '#b24c43'; };
  const go = () => { const hash = location.hash; if (hash === '#login' || hash === '#reset') { show(authView); } else if (!hash || hash === '#home' || hash === '#capabilities') { show(publicView); } };
  $('year').textContent = new Date().getFullYear();
  window.addEventListener('hashchange', go);

  function showApp(user) {
    show(appView);
    $('userEmail').textContent = user.email || 'Member';
    $('userInitial').textContent = (user.email || 'K').charAt(0).toUpperCase();
    $('userRole').textContent = 'INVITED MEMBER';
    setPage('dashboard');
  }
  function setPage(page) {
    const pages = {dashboard:'dashboardPage', library:'libraryPage', projects:'projectsPage'};
    Object.entries(pages).forEach(([key,id]) => $(id).classList.toggle('hidden', key !== page));
    document.querySelectorAll('.side-link[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $('pageTitle').textContent = page === 'dashboard' ? 'Engineering dashboard' : page === 'library' ? 'Tool library' : 'My projects';
    $('crumb').textContent = page.toUpperCase();
  }
  document.querySelectorAll('.side-link[data-page]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.page)));

  if (configured && window.supabase?.createClient) {
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    supabase.auth.getSession().then(({data:{session}}) => { if (session?.user) showApp(session.user); else go(); });
    supabase.auth.onAuthStateChange((_event, session) => { if (session?.user) showApp(session.user); else { show(publicView); if (location.hash !== '#home') history.replaceState(null,'',location.pathname); } });
  } else {
    go();
    $('authSubtitle').textContent = 'Authentication will be enabled after the Supabase project is connected.';
    message('Setup required: add your Supabase project URL and publishable key to config.js.');
    $('loginButton').disabled = true; $('loginButton').style.opacity = '.55';
    $('forgotButton').disabled = true; $('forgotButton').style.opacity = '.55';
  }

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault(); if (!supabase) return;
    const email = $('email').value.trim(), password = $('password').value;
    $('loginButton').disabled = true; message('Signing in…', true);
    const {error} = await supabase.auth.signInWithPassword({email,password});
    $('loginButton').disabled = false;
    if (error) message(error.message); else message('Signed in successfully.', true);
  });
  $('forgotButton').addEventListener('click', async () => {
    if (!supabase) return;
    const email = $('email').value.trim();
    if (!email) { message('Enter your invited email address first.'); $('email').focus(); return; }
    const redirectTo = window.location.origin + window.location.pathname + '#login';
    const {error} = await supabase.auth.resetPasswordForEmail(email,{redirectTo});
    message(error ? error.message : 'If the address is registered, a password-reset email will be sent.', !error);
  });
  $('logoutButton').addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); show(publicView); location.hash = '#home'; });
  go();
})();
