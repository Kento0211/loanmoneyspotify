const CONFIG = window.APP_CONFIG || {};
const hasSupabaseConfig = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_PUBLISHABLE_KEY);
const supabase = hasSupabaseConfig ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY) : null;

const state = {
  loans: JSON.parse(localStorage.getItem('loan-ledger-loans') || '[]'),
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  user: null,
  authMode: 'login',
  editingId: null
};

const $ = (id) => document.getElementById(id);
const yen = (n) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Math.round(n));
const dateText = (s) => s ? new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'short', day:'numeric' }).format(new Date(`${s}T00:00:00`)) : '-';
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

function saveLocal() { localStorage.setItem('loan-ledger-loans', JSON.stringify(state.loans)); }
function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }

function setSyncStatus(text) { $('syncStatus').textContent = text; }

function normalizeLoan(loan) {
  return { ...loan, principal:Number(loan.principal), rate:Number(loan.rate), rateUnit:loan.rateUnit || 'monthly' };
}

function updateCountOnDate(startDate, updateDate, targetDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const target = new Date(`${targetDate}T00:00:00`);
  const update = new Date(`${updateDate}T00:00:00`);
  if (target < start || target < update) return 0;

  // Recurring update day is the day-of-month from the first update date.
  // Example: first update 10/10 => updates on the 10th of each following month.
  const day = update.getDate();
  let count = 0;
  let cursor = new Date(update.getFullYear(), update.getMonth(), 1);
  while (cursor <= target) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0).getDate();
    const actualDay = Math.min(day, lastDay);
    const occurrence = new Date(cursor.getFullYear(), cursor.getMonth(), actualDay);
    if (occurrence >= update && occurrence >= start && occurrence <= target) count++;
    cursor.setMonth(cursor.getMonth()+1);
    if (count > 2400) break;
  }
  return count;
}

function interestFor(loan, targetDate) {
  const cycles = updateCountOnDate(loan.startDate, loan.updateDate, targetDate);
  if (loan.rateUnit === 'yearly') {
    // For yearly rates, each annual anniversary is one cycle.
    const start = new Date(`${loan.startDate}T00:00:00`);
    const target = new Date(`${targetDate}T00:00:00`);
    if (target < start) return { cycles:0, interest:0 };
    let annual = 0;
    let cursor = new Date(start);
    cursor.setFullYear(cursor.getFullYear()+1);
    while (cursor <= target) { annual++; cursor.setFullYear(cursor.getFullYear()+1); }
    return { cycles:annual, interest:loan.principal * loan.rate / 100 * annual };
  }
  return { cycles, interest:loan.principal * loan.rate / 100 * cycles };
}

function renderLoans() {
  const list = $('loanList');
  $('emptyState').style.display = state.loans.length ? 'none' : 'block';
  list.innerHTML = '';
  state.loans.forEach(loan => {
    const l = normalizeLoan(loan);
    const result = interestFor(l, isoToday());
    const div = document.createElement('article');
    div.className = 'loan-item';
    div.innerHTML = `
      <div class="loan-top">
        <div><div class="person">${escapeHtml(l.name)}</div><div class="loan-note">${escapeHtml(l.note || 'メモなし')}</div></div>
        <div class="loan-amount">${yen(l.principal)}</div>
      </div>
      <div class="loan-meta">
        <div class="meta-box"><span>利率</span><strong>${l.rate}% / ${l.rateUnit === 'monthly' ? '月' : '年'}</strong></div>
        <div class="meta-box"><span>貸した日</span><strong>${dateText(l.startDate)}</strong></div>
        <div class="meta-box"><span>更新日</span><strong>${dateText(l.updateDate)}</strong></div>
        <div class="meta-box"><span>現在の利子</span><strong>${yen(result.interest)}</strong></div>
      </div>
      <div class="loan-actions">
        <button class="small-button" data-action="edit" data-id="${l.id}">編集</button>
        <button class="small-button danger" data-action="delete" data-id="${l.id}">削除</button>
      </div>`;
    list.appendChild(div);
  });
}

function renderCalculator() {
  const select = $('calcLoan');
  const current = select.value;
  select.innerHTML = state.loans.length ? state.loans.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('') : '<option value="">貸付を追加してください</option>';
  if (state.loans.some(l => l.id === current)) select.value = current;
  else if (state.loans[0]) select.value = state.loans[0].id;
  $('calcDate').value ||= isoToday();
  const loan = state.loans.find(l => l.id === select.value);
  const result = $('calculationResult');
  if (!loan) { result.innerHTML = '<span class="calc-label">貸付データがありません。</span>'; return; }
  const r = interestFor(normalizeLoan(loan), $('calcDate').value || isoToday());
  result.innerHTML = `<div class="calc-label">${dateText($('calcDate').value || isoToday())} 時点</div><div class="calc-interest">${yen(r.interest)}</div><div class="calc-total">更新回数 ${r.cycles}回 ・ 元金を含む合計 ${yen(loan.principal + r.interest)}</div>`;
}

function renderSummary() {
  const principal = state.loans.reduce((a,l)=>a+Number(l.principal),0);
  const interest = state.loans.reduce((a,l)=>a+interestFor(normalizeLoan(l), isoToday()).interest,0);
  $('summaryCount').textContent = `${state.loans.length}件`;
  $('summaryPrincipal').textContent = yen(principal);
  $('summaryInterest').textContent = yen(interest);
  $('summaryTotal').textContent = yen(principal + interest);
  $('heroTotal').textContent = yen(principal);
  $('heroInterest').textContent = `累計利子 ${yen(interest)}`;
}

function renderCalendar() {
  const year = state.month.getFullYear(); const month = state.month.getMonth();
  $('calendarTitle').textContent = `${year}年 ${month+1}月`;
  const calendar = $('calendar');
  const names = ['日','月','火','水','木','金','土'];
  calendar.innerHTML = names.map(n => `<div class="weekday">${n}</div>`).join('');
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month+1, 0).getDate();
  for(let i=0;i<first;i++) calendar.insertAdjacentHTML('beforeend','<div class="day empty"></div>');
  for(let day=1;day<=last;day++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const updates = state.loans.filter(l => isUpdateOccurrence(normalizeLoan(l), ds));
    const today = ds === isoToday();
    const el = document.createElement('div'); el.className = `day${today?' today':''}${updates.length?' update':''}`;
    el.innerHTML = `<div class="day-number">${day}</div>${updates.map(l=>`<div class="update-pill"><strong>更新</strong>${escapeHtml(l.name)}</div>`).join('')}`;
    calendar.appendChild(el);
  }
}

function isUpdateOccurrence(loan, dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const start = new Date(`${loan.startDate}T00:00:00`);
  const update = new Date(`${loan.updateDate}T00:00:00`);
  if (d < start || d < update) return false;
  if (loan.rateUnit === 'yearly') return d.getMonth() === start.getMonth() && d.getDate() === Math.min(start.getDate(), new Date(d.getFullYear(), d.getMonth()+1,0).getDate());
  return d.getDate() === Math.min(update.getDate(), new Date(d.getFullYear(), d.getMonth()+1,0).getDate());
}

function renderAll() { renderLoans(); renderCalculator(); renderSummary(); renderCalendar(); }
function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function openLoanDialog(id=null) {
  state.editingId = id;
  $('loanForm').reset();
  $('loanId').value = id || '';
  $('dialogTitle').textContent = id ? '貸付を編集' : '貸付を追加';
  if (id) {
    const l = state.loans.find(x=>x.id===id);
    if (!l) return;
    $('borrowerName').value=l.name; $('principal').value=l.principal; $('rate').value=l.rate; $('rateUnit').value=l.rateUnit; $('startDate').value=l.startDate; $('updateDate').value=l.updateDate; $('note').value=l.note||'';
  } else {
    $('startDate').value = isoToday(); $('updateDate').value = isoToday();
  }
  $('loanDialog').showModal();
}
function closeLoanDialog() { $('loanDialog').close(); }

async function saveLoanFromForm() {
  const data = {
    id: $('loanId').value || crypto.randomUUID(),
    name: $('borrowerName').value.trim(),
    principal: Number($('principal').value),
    rate: Number($('rate').value),
    rateUnit: $('rateUnit').value,
    startDate: $('startDate').value,
    updateDate: $('updateDate').value,
    note: $('note').value.trim()
  };
  if (!data.name || data.principal < 0 || data.rate < 0 || !data.startDate || !data.updateDate) return;
  const idx = state.loans.findIndex(l=>l.id===data.id);
  if (idx >= 0) state.loans[idx] = data; else state.loans.unshift(data);
  saveLocal(); renderAll(); closeLoanDialog();
  await syncLoans();
  showToast('貸付データを保存しました');
}

async function deleteLoan(id) {
  const l = state.loans.find(x=>x.id===id); if (!l) return;
  if (!confirm(`${l.name}さんの貸付を削除しますか？`)) return;
  state.loans = state.loans.filter(x=>x.id!==id); saveLocal(); renderAll(); await syncLoans(); showToast('削除しました');
}

async function syncLoans() {
  if (!supabase || !state.user) return;
  setSyncStatus('同期中…');
  // Replace the current user's rows with the current local state. This keeps the static app simple.
  const { error: delError } = await supabase.from('loans').delete().eq('user_id', state.user.id);
  if (delError) { setSyncStatus('同期エラー'); console.error(delError); return; }
  if (state.loans.length) {
    const rows = state.loans.map(l=>({ user_id:state.user.id, id:l.id, name:l.name, principal:l.principal, rate:l.rate, rate_unit:l.rateUnit, start_date:l.startDate, update_date:l.updateDate, note:l.note||'' }));
    const { error } = await supabase.from('loans').insert(rows);
    if (error) { setSyncStatus('同期エラー'); console.error(error); return; }
  }
  setSyncStatus('クラウド保存済み');
}

async function loadCloudLoans() {
  if (!supabase || !state.user) return;
  setSyncStatus('読み込み中…');
  const { data, error } = await supabase.from('loans').select('*').eq('user_id', state.user.id).order('created_at', { ascending:false });
  if (error) { setSyncStatus('読み込みエラー'); console.error(error); return; }
  state.loans = (data || []).map(r=>({ id:r.id, name:r.name, principal:Number(r.principal), rate:Number(r.rate), rateUnit:r.rate_unit, startDate:r.start_date, updateDate:r.update_date, note:r.note||'' }));
  saveLocal(); renderAll(); setSyncStatus('クラウド保存済み');
}

async function handleAuthSubmit(e) {
  e.preventDefault(); if (!supabase) { $('authMessage').textContent='先にconfig.jsへSupabaseの設定を入れてください。'; return; }
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  $('authMessage').textContent=''; $('authSubmit').disabled=true;
  let result;
  if (state.authMode==='login') result=await supabase.auth.signInWithPassword({email,password});
  else result=await supabase.auth.signUp({email,password});
  $('authSubmit').disabled=false;
  if (result.error) { $('authMessage').textContent=result.error.message; return; }
  if (state.authMode==='signup') { $('authMessage').textContent='確認メールを送信しました。メールを確認してください。'; return; }
  $('authDialog').close(); showToast('ログインしました');
}

async function signOut() { if (supabase) await supabase.auth.signOut(); state.user=null; $('authButton').textContent='ログイン'; setSyncStatus('ローカル保存'); showToast('ログアウトしました'); }

function updateAuthButton() {
  $('authButton').textContent = state.user ? 'ログアウト' : 'ログイン';
  setSyncStatus(state.user ? 'クラウド保存済み' : 'ローカル保存');
}

$('addLoanButton').addEventListener('click',()=>openLoanDialog());
$('closeDialog').addEventListener('click',closeLoanDialog); $('cancelDialog').addEventListener('click',closeLoanDialog);
$('loanForm').addEventListener('submit',e=>{e.preventDefault();saveLoanFromForm();});
$('loanList').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;b.dataset.action==='edit'?openLoanDialog(b.dataset.id):deleteLoan(b.dataset.id);});
$('prevMonth').addEventListener('click',()=>{state.month.setMonth(state.month.getMonth()-1);renderCalendar();});
$('nextMonth').addEventListener('click',()=>{state.month.setMonth(state.month.getMonth()+1);renderCalendar();});
$('calcLoan').addEventListener('change',renderCalculator); $('calcDate').addEventListener('change',renderCalculator);
$('authButton').addEventListener('click',()=>{ if(state.user){signOut();return;} $('authDialog').showModal(); });
$('closeAuth').addEventListener('click',()=> $('authDialog').close());
$('toggleAuthMode').addEventListener('click',()=>{state.authMode=state.authMode==='login'?'signup':'login';$('authTitle').textContent=state.authMode==='login'?'ログイン':'新規登録';$('authSubmit').textContent=state.authMode==='login'?'ログイン':'アカウントを作成';$('toggleAuthMode').textContent=state.authMode==='login'?'新規登録':'ログインへ';$('authMessage').textContent='';});
$('authForm').addEventListener('submit',handleAuthSubmit);

if (supabase) {
  supabase.auth.onAuthStateChange(async (_event, session)=>{ state.user=session?.user||null; updateAuthButton(); if(state.user) await loadCloudLoans(); });
}

renderAll();
if (!hasSupabaseConfig) setSyncStatus('ローカル保存 / 未接続');
