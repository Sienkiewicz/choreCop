const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = { mon:'Пн', tue:'Вт', wed:'Ср', thu:'Чт', fri:'Пт', sat:'Сб', sun:'Нд' };
const ROLE_LABELS = { dad:'👨 Тато', mom:'👩 Мама', kid:'🧒 Дитина' };
const ROTATION_LABELS = { round_robin:'🔄 По черзі', fixed:'📌 Фіксовані', all:'👥 Всі' };

let state = { family: null, member: null, members: [], rules: [] };
let selectedDays = [];
let selectedRole = 'kid';

function initData() { return tg.initData; }

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  return res.json();
}

function show(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  tg.BackButton[screenId === 'screen-members' || screenId === 'screen-rules' ? 'show' : 'hide']();
}

tg.BackButton.onClick(() => {
  const active = document.querySelector('.screen.active')?.id;
  if (active === 'screen-rules') show('screen-members');
  else if (active === 'screen-members') show('screen-setup');
});

async function loadAndShow() {
  const me = await api('GET', '/me');
  state.family = me.family;
  state.member = me.member;

  if (!state.family) {
    prefillSetup();
    show('screen-setup');
  } else {
    await Promise.all([loadMembers(), loadRules()]);
    show('screen-members');
  }
}

function prefillSetup() {
  const chat = tg.initDataUnsafe?.chat;
  if (chat?.title) document.getElementById('family-name').value = chat.title;
}

document.getElementById('btn-create-family').addEventListener('click', async () => {
  const name = document.getElementById('family-name').value.trim();
  const chat = tg.initDataUnsafe?.chat;
  if (!name) { showError('setup-error', 'Введіть назву сім\'ї'); return; }
  if (!chat?.id) { showError('setup-error', 'Відкрийте Mini App з групи'); return; }

  const result = await api('POST', '/family', {
    name,
    chat_id: chat.id,
    first_name: tg.initDataUnsafe?.user?.first_name ?? 'Тато',
  });
  if (result?.error) { showError('setup-error', result.error); return; }

  state.family = result.family;
  state.member = result.member;
  await Promise.all([loadMembers(), loadRules()]);
  show('screen-members');
});

async function loadMembers() {
  const data = await api('GET', '/members');
  state.members = Array.isArray(data) ? data : [];
  renderMembers();
}

function renderMembers() {
  const list = document.getElementById('members-list');
  if (!state.members.length) {
    list.innerHTML = '<div class="list-item"><span class="meta">Учасників ще немає</span></div>';
    return;
  }
  list.innerHTML = state.members.map(m => `
    <div class="list-item">
      <span class="name">${ROLE_LABELS[m.role] ?? m.role} ${m.name}</span>
      ${m.telegram_id ? '<span class="badge">🔗</span>' : '<span class="badge" style="opacity:0.4">⬜</span>'}
      ${state.member?.role === 'dad' && m.id !== state.member.id
        ? `<button class="delete-btn" onclick="removeMember(${m.id})">🗑</button>` : ''}
    </div>
  `).join('');
}

window.removeMember = async (id) => {
  if (!confirm('Видалити учасника?')) return;
  await api('DELETE', `/members/${id}`);
  await loadMembers();
};

document.getElementById('btn-add-member').addEventListener('click', async () => {
  const name = document.getElementById('new-member-name').value.trim();
  if (!name) { showError('member-error', 'Введіть ім\'я'); return; }

  const result = await api('POST', '/members', { name, role: selectedRole });
  if (result?.error) { showError('member-error', result.error); return; }

  document.getElementById('new-member-name').value = '';
  await loadMembers();
  toggleCollapse('add-member-form');
});

document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedRole = btn.dataset.role;
  });
});

document.getElementById('btn-go-rules').addEventListener('click', async () => {
  await loadRules();
  show('screen-rules');
});

async function loadRules() {
  const data = await api('GET', '/rules');
  state.rules = Array.isArray(data) ? data : [];
  renderRules();
}

function renderRules() {
  const list = document.getElementById('rules-list');
  if (!state.rules.length) {
    list.innerHTML = '<div class="list-item"><span class="meta">Завдань ще немає</span></div>';
    return;
  }
  list.innerHTML = state.rules.map(r => `
    <div class="list-item">
      <div style="flex:1">
        <div class="name">${r.name}</div>
        <div class="meta">${r.schedule} · ${ROTATION_LABELS[r.rotation_mode]} · ${r.workers_count} чол.</div>
      </div>
      <button class="delete-btn" onclick="removeRule(${r.id})">🗑</button>
    </div>
  `).join('');
}

window.removeRule = async (id) => {
  if (!confirm('Видалити завдання?')) return;
  await api('DELETE', `/rules/${id}`);
  await loadRules();
};

document.getElementById('btn-add-rule').addEventListener('click', async () => {
  const name = document.getElementById('new-rule-name').value.trim();
  const workers_count = parseInt(document.getElementById('rule-workers').value, 10);
  const rotation_mode = document.getElementById('rule-rotation').value;

  if (!name) { showError('rule-error', 'Введіть назву завдання'); return; }
  if (!selectedDays.length) { showError('rule-error', 'Оберіть хоча б один день'); return; }

  const schedule = selectedDays.join(',');
  const result = await api('POST', '/rules', { name, schedule, workers_count, rotation_mode });
  if (result?.error) { showError('rule-error', result.error); return; }

  document.getElementById('new-rule-name').value = '';
  selectedDays = [];
  renderDayPicker();
  await loadRules();
  toggleCollapse('add-rule-form');
});

function renderDayPicker() {
  const container = document.getElementById('day-picker');
  container.innerHTML = DAYS.map(d => `
    <button class="day-btn ${selectedDays.includes(d) ? 'selected' : ''}" onclick="toggleDay('${d}')">${DAY_LABELS[d]}</button>
  `).join('') + `<button class="day-btn ${selectedDays.length === 7 ? 'selected' : ''}" onclick="toggleAllDays()">Щодня</button>`;
}

window.toggleDay = (day) => {
  if (selectedDays.includes(day)) selectedDays = selectedDays.filter(d => d !== day);
  else selectedDays.push(day);
  renderDayPicker();
};

window.toggleAllDays = () => {
  selectedDays = selectedDays.length === 7 ? [] : [...DAYS];
  renderDayPicker();
};

function toggleCollapse(id) {
  const el = document.getElementById(id);
  el.classList.toggle('open');
}
window.toggleCollapse = toggleCollapse;

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 3000); }
}

renderDayPicker();
loadAndShow();
