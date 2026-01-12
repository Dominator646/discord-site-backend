let me = null;

// Загрузка данных при входе
async function loadUser() {
    try {
        const r = await fetch('/api/me');
        if (r.status === 401) {
            location = '/';
            return;
        }
        me = await r.json();
        renderTop();
        showHome();
    } catch (err) {
        console.error("Ошибка загрузки:", err);
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

// Функция определения аватарки (Discord или ссылка)
function getAvatar(user) {
    if (!user) return '';
    if (user.avatar && user.avatar.startsWith('http')) return user.avatar;
    if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`;
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
}

// Рендер верхней панели (Монетки слева от ава)
function renderTop() {
    const container = document.getElementById('userContainer');
    container.innerHTML = `
        <div class="avatar-wrapper" onclick="toggleUserMenu()">
            <div class="coins-badge">💰 ${me.coins || 0}</div>
            <img src="${getAvatar(me)}">
        </div>
        <div id="userMenu" class="user-menu">
            <button onclick="openProfile()">👤 Профиль</button>
            <button onclick="location='/logout'">🚪 Выйти</button>
        </div>
    `;
}

function toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('active');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('hidden');
}

// Вкладка: Главная
function showHome() {
    document.getElementById('content').innerHTML = `
        <h1>NeСкам</h1>
        <p>Сайт для вечерних просмотров и выбора случайных фильмов в кругу близких друзей.</p>
    `;
}

// Вкладка: Пользователи (Исправлено!)
async function showUsers() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';
    
    try {
        const r = await fetch('/api/users');
        const users = await r.json();
        
        let html = '<h1>Пользователи</h1><div class="users-grid">';
        users.forEach(u => {
            html += `
                <div class="user-card">
                    <img src="${getAvatar(u)}">
                    <h3>${u.username}</h3>
                    <p>${u.bio || '<i>Нет описания</i>'}</p>
                    <div class="coins-badge" style="margin-top:10px; display:inline-block;">💰 ${u.coins || 0}</div>
                </div>
            `;
        });
        html += '</div>';
        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = '<p>Ошибка при загрузке пользователей.</p>';
    }
}

// Работа с профилем
function openProfile() {
    document.getElementById('userMenu').classList.remove('active');
    document.getElementById('profileModal').classList.remove('hidden');
    
    document.getElementById('profileName').value = me.username;
    document.getElementById('profileBio').value = me.bio || '';
    document.getElementById('profileAvatarUrl').value = (me.avatar && me.avatar.startsWith('http')) ? me.avatar : '';
    document.getElementById('profileAvatarPreview').src = getAvatar(me);
}

function updatePreview() {
    const url = document.getElementById('profileAvatarUrl').value;
    if (url) document.getElementById('profileAvatarPreview').src = url;
}

function closeProfile() {
    document.getElementById('profileModal').classList.add('hidden');
}

async function saveProfile() {
    const username = document.getElementById('profileName').value;
    const bio = document.getElementById('profileBio').value;
    const customAvatar = document.getElementById('profileAvatarUrl').value;
    
    // Если ввели URL - сохраняем его, иначе оставляем старый хеш Discord
    const avatar = customAvatar || me.avatar;

    await fetch('/api/profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, bio, avatar })
    });
    
    location.reload(); // Перезагружаем страницу, чтобы обновить данные везде
}

loadUser();
