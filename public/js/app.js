let me = null;

// Хелпер для получения URL аватарки
function getAvatarUrl(user) {
  if (!user.avatar) return 'https://cdn.discordapp.com/embed/avatars/0.png';
  // Если аватар начинается с http, значит это кастомная ссылка
  if (user.avatar.startsWith('http')) return user.avatar;
  // Иначе это хеш Discord
  return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`;
}

async function loadUser() {
  const r = await fetch('/api/me');
  if (r.status === 401) {
    location = '/';
    return;
  }
  me = await r.json();
  renderTop();
  showHome();
  document.getElementById('loader').style.display = 'none';
}

function renderTop() {
  const container = document.getElementById('userContainer');
  const avatarUrl = getAvatarUrl(me);
  
  // Монетки слева, аватарка справа
  container.innerHTML = `
    <div class="user-display" onclick="toggleUserMenu()">
      <span class="coins-badge">💰 ${me.coins}</span>
      <img class="avatar-small" src="${avatarUrl}">
    </div>
    <div id="userMenu" class="user-menu hidden">
      <button onclick="openProfile()">Настройки профиля</button>
      <button onclick="alert('Скоро...')">Выйти</button>
    </div>
  `;
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  menu.classList.toggle('hidden');
}

// Управление сайдбаром
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('hidden');
}

// Профиль
function openProfile() {
  document.getElementById('userMenu').classList.add('hidden'); // Закрыть мини-меню если открыто
  const modal = document.getElementById('profileModal');
  const preview = document.getElementById('profileAvatarPreview');
  
  modal.classList.remove('hidden');
  
  document.getElementById('profileName').value = me.username;
  document.getElementById('profileBio').value = me.bio || '';
  
  // Если аватарка кастомная (ссылка), вставляем в инпут
  if (me.avatar && me.avatar.startsWith('http')) {
    document.getElementById('profileAvatarUrl').value = me.avatar;
  } else {
    document.getElementById('profileAvatarUrl').value = '';
  }
  
  preview.src = getAvatarUrl(me);
}

function openProfileFromMenu() {
  toggleSidebar(); // Закрываем сайдбар
  openProfile();
}

function closeProfile() {
  document.getElementById('profileModal').classList.add('hidden');
}

function updateAvatarPreview() {
  const url = document.getElementById('profileAvatarUrl').value;
  const preview = document.getElementById('profileAvatarPreview');
  // Если поле пустое, показываем текущую, иначе пробуем показать новую
  if (!url) preview.src = getAvatarUrl(me);
  else preview.src = url;
}

async function saveProfile() {
  const newName = document.getElementById('profileName').value;
  const newBio = document.getElementById('profileBio').value;
  let newAvatar = document.getElementById('profileAvatarUrl').value;

  // Если поле аватарки пустое, оставляем старую (или хеш дискорда, если он там был)
  // Но логика тут такая: если пользователь стер ссылку, мы должны вернуть старую? 
  // Упростим: если пусто, берем то, что было (если это хеш), или оставляем как есть.
  // Лучше так: если user ничего не ввел, отправляем me.avatar (текущую). 
  // Если ввел - отправляем новую.
  
  if (!newAvatar) newAvatar = me.avatar;

  const btn = document.querySelector('.btn-primary');
  btn.innerText = 'Сохранение...';

  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: newName,
      bio: newBio,
      avatar: newAvatar
    })
  });
  
  location.reload();
}

// Страницы
function showHome() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <h1>Добро пожаловать на NeСкам</h1>
    <p>Уютное камерное событие для своих.</p>
    <p>Выбирайте фильмы, общайтесь и проводите вечера в хорошей компании.</p>
    <div style="margin-top: 50px; opacity: 0.5;">
      <p>Выберите пункт в меню слева ↖</p>
    </div>
  `;
  if(!document.getElementById('sidebar').classList.contains('hidden') && window.innerWidth < 800) toggleSidebar();
}

async function showUsers() {
  if(!document.getElementById('sidebar').classList.contains('hidden') && window.innerWidth < 800) toggleSidebar();
  
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loader" style="position:relative; background:transparent;"><div class="spinner"></div></div>';
  
  const users = await fetch('/api/users').then(r => r.json());
  
  content.innerHTML = `
    <h1>Пользователи</h1>
    <div class="users-grid">
      ${users.map(u => `
        <div class="user-card">
          <img src="${getAvatarUrl(u)}">
          <h3>${u.username}</h3>
          <p>${u.bio || 'Нет описания'}</p>
        </div>
      `).join('')}
    </div>
  `;
}

loadUser();
