let me = null;

async function loadUser() {
  const r = await fetch('/api/me');
  if (r.status === 401) { location = '/'; return; }
  me = await r.json();
  renderTop();
  showHome();
  document.getElementById('loader').style.display = 'none';
}

function getAvatar(u) {
  // Если в поле avatar ссылка (http), используем её, иначе — стандарт Discord
  if (u.avatar && u.avatar.startsWith('http')) return u.avatar;
  return `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png`;
}

function renderTop() {
  const userDiv = document.getElementById('user');
  userDiv.innerHTML = `
    <div class="avatar-wrapper" onclick="toggleUserMenu()">
      <div class="coins-container">💰 ${me.coins}</div>
      <img src="${getAvatar(me)}" style="width:40px; height:40px; border-radius:50%;">
    </div>
    <div id="userMenu" class="user-menu">
      <button onclick="openProfile()">Профиль</button>
      <button onclick="location='/logout'">Выйти</button>
    </div>`;
}

function toggleUserMenu() {
  document.getElementById('userMenu').classList.toggle('active');
}

async function showUsers() {
  const content = document.getElementById('content');
  content.innerHTML = '<p>Загрузка пользователей...</p>';
  
  const r = await fetch('/api/users');
  const users = await r.json();
  
  content.innerHTML = `
    <h1>Пользователи</h1>
    <div class="users-grid">
      ${users.map(u => `
        <div class="user-card">
          <img src="${getAvatar(u)}">
          <h3>${u.username || 'Аноним'}</h3>
          <p>${u.bio || ''}</p>
        </div>
      `).join('')}
    </div>`;
}

async function saveProfile() {
  const name = document.getElementById('profileName').value;
  const bio = document.getElementById('profileBio').value;
  const avatar = document.getElementById('profileAvatarUrl')?.value || me.avatar;

  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, bio: bio, avatar: avatar })
  });
  location.reload(); // Перезагружаем для подгрузки новых данных
}

loadUser();
