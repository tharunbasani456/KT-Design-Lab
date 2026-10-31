(() => {
  const $ = (id) => document.getElementById(id);
  const cfg = window.KT_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('YOUR-PROJECT') && !cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE'));
  const publicView=$('publicView'), authView=$('authView'), appView=$('appView');
  let supabase=null, currentProfile=null, authMode='login';
  const show=(view)=>[publicView,authView,appView].forEach(v=>v.classList.toggle('hidden',v!==view));
  const message=(txt,good=false)=>{$('authMessage').textContent=txt;$('authMessage').style.color=good?'#25875e':'#b24c43';};
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('year').textContent=new Date().getFullYear();
  function setAuthMode(mode){
    authMode=mode;const signup=mode==='signup';
    $('authTitle').textContent=signup?'Request access.':'Welcome back.';
    $('authSubtitle').textContent=signup?'Create an account request. An administrator must approve it before you can use the lab.':'Sign in with your approved KT Design Lab account.';
    $('password').autocomplete=signup?'new-password':'current-password';$('password').minLength=signup?8:1;
    $('loginButton').textContent=signup?'Create account request':'Sign in';
    $('createAccountButton').textContent=signup?'Already have an account? Sign in':'New here? Request access';
    $('forgotButton').classList.toggle('hidden',signup);message('');
  }
  function go(){
    if(!configured){show(location.hash==='#login'||location.hash==='#signup'?authView:publicView);return;}
    if(location.hash==='#login'||location.hash==='#signup'){show(authView);setAuthMode(location.hash==='#signup'?'signup':'login');}
    else if(!location.hash||location.hash==='#home'||location.hash==='#capabilities')show(publicView);
  }
  window.addEventListener('hashchange',go);
  function setPage(page){
    const pages={dashboard:'dashboardPage',library:'libraryPage',projects:'projectsPage',admin:'adminPage'};
    Object.entries(pages).forEach(([key,id])=>{if($(id))$(id).classList.toggle('hidden',key!==page);});
    document.querySelectorAll('.side-link[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    $('pageTitle').textContent=({dashboard:'Engineering dashboard',library:'Tool library',projects:'My projects',admin:'Access management'})[page]||'Engineering dashboard';
    $('crumb').textContent=page.toUpperCase();if(page==='admin')loadPendingUsers();
  }
  document.querySelectorAll('.side-link[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
  async function loadProfile(user){
    const {data,error}=await supabase.from('profiles').select('id,email,role,status').eq('id',user.id).maybeSingle();
    if(error)throw error;if(!data)throw new Error('Your account profile is not ready. Please contact an administrator.');return data;
  }
  async function renderSession(user){
    if(!user){currentProfile=null;show(location.hash==='#login'||location.hash==='#signup'?authView:publicView);return;}
    try{
      const profile=await loadProfile(user);currentProfile=profile;
      if(profile.status!=='approved'){
        await supabase.auth.signOut();show(authView);setAuthMode('login');
        message(profile.status==='rejected'?'Your access request was not approved. Please contact a lab administrator.':'Your account is awaiting administrator approval. You can sign in after approval.');return;
      }
      showApp(user,profile);
    }catch(error){await supabase.auth.signOut();show(authView);setAuthMode('login');message(error.message||'Unable to verify your account permissions.');}
  }
  function showApp(user,profile){
    show(appView);$('userEmail').textContent=user.email||'Member';$('userInitial').textContent=(user.email||'K').charAt(0).toUpperCase();
    $('userRole').textContent=String(profile.role||'engineer').toUpperCase();$('adminNav').classList.toggle('hidden',profile.role!=='admin');setPage('dashboard');
  }
  async function loadPendingUsers(){
    if(currentProfile?.role!=='admin')return;const host=$('pendingUsers');host.textContent='Loading access requests…';
    const {data,error}=await supabase.from('profiles').select('id,email,created_at').eq('status','pending').order('created_at',{ascending:true});
    if(error){host.textContent='Unable to load requests: '+error.message;return;}
    if(!data.length){host.textContent='There are no pending access requests.';return;}
    host.innerHTML=data.map(u=>'<div class="pending-user" data-user-id="'+esc(u.id)+'"><div class="pending-user-email">'+esc(u.email)+'</div><select aria-label="Role for '+esc(u.email)+'" class="pending-role"><option value="engineer">Engineer</option><option value="viewer">Viewer</option><option value="admin">Administrator</option></select><button type="button" class="approve-user">Approve</button><button type="button" class="reject-user">Reject</button></div>').join('');
  }
  $('pendingUsers').addEventListener('click',async(event)=>{
    const row=event.target.closest('[data-user-id]');if(!row||(!event.target.matches('.approve-user')&&!event.target.matches('.reject-user')))return;
    const approve=event.target.matches('.approve-user'),role=row.querySelector('.pending-role').value;
    const {error}=await supabase.rpc('review_kt_user',{target_user_id:row.dataset.userId,decision:approve?'approved':'rejected',assigned_role:role});
    if(error){$('adminMessage').textContent='Action failed: '+error.message;return;}
    $('adminMessage').textContent=approve?'User approved.':'Access request rejected.';await loadPendingUsers();
  });
  if(configured&&window.supabase?.createClient){
    supabase=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    supabase.auth.getSession().then(({data:{session}})=>renderSession(session?.user||null));
    supabase.auth.onAuthStateChange((_event,session)=>{Promise.resolve().then(()=>renderSession(session?.user||null));});
  }else{
    go();$('authSubtitle').textContent='Authentication setup is incomplete. Please contact the site administrator.';
    message('Authentication is not configured. Check config.js and the Supabase project settings.');
    $('loginButton').disabled=true;$('createAccountButton').disabled=true;$('forgotButton').disabled=true;
  }
  $('loginForm').addEventListener('submit',async(event)=>{
    event.preventDefault();if(!supabase)return;const email=$('email').value.trim(),password=$('password').value;
    $('loginButton').disabled=true;message(authMode==='signup'?'Submitting access request…':'Signing in…',true);
    try{
      if(authMode==='signup'){
        const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname+'#login'}});
        if(error)throw error;
        message(data.session?.user?'Your request was submitted. Your account will remain locked until an administrator approves it.':'Check your email to confirm your address. Your access request will then await administrator approval.',true);
      }else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}
    }catch(error){message(error.message||'Unable to complete the request.');}finally{$('loginButton').disabled=false;}
  });
  $('createAccountButton').addEventListener('click',()=>{const next=authMode==='signup'?'login':'signup';setAuthMode(next);location.hash=next;});
  $('forgotButton').addEventListener('click',async()=>{
    if(!supabase)return;const email=$('email').value.trim();if(!email){message('Enter your email address first.');$('email').focus();return;}
    const redirectTo=window.location.origin+window.location.pathname+'#login';const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
    message(error?error.message:'If the address is registered, a password-reset email will be sent.',!error);
  });
  $('logoutButton').addEventListener('click',async()=>{if(supabase)await supabase.auth.signOut();currentProfile=null;show(publicView);location.hash='#home';});
  go();
})();