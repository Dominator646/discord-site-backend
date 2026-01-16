let me = null;
let siteSettings = {}; // Сюда загрузим настройки
let heartbeatInterval = null;
let wheelCanvas = null;
let wheelCtx = null;
let wheelItems = [];
let wheelState = {};
let currentAngle = 0;
let animationFrameId = null;
let startTime = null;
let startRotation = 0;
let finalRotation = 0;

// Загрузка данных при входе
async function loadUser() {
    try {
        const r = await fetch('/api/me');
        if (r.status === 401) { location = '/'; return; }
        me = await r.json();
        
        renderTop();
        
        // --- ЛОГИКА АДМИНКИ ---
        const sidebar = document.getElementById('sidebar');
        
        // 1. Добавляем кнопку Админ-панели, если админ
        if (me.is_admin) {
            if (!document.getElementById('adminBtn')) {
                const btn = document.createElement('button');
                btn.id = 'adminBtn';
                btn.className = 'nav-btn admin-link';
                btn.innerText = '⚙️ Админ Панель';
                btn.onclick = showAdminPanel;
                sidebar.appendChild(btn);
            }
        }

        // 2. Скрываем разделы для обычных смертных
        if (!me.is_admin) {
            applyVisibility('showGallery()', siteSettings.nav_gallery_visible);
            applyVisibility('showUsers()', siteSettings.nav_users_visible);
        }

        // 3. Запускаем "Сердцебиение" (Онлайн и Звуки)
        startHeartbeat();

        route(); // Переходим на нужную вкладку
    } catch (err) { console.error(err); } 
    finally { document.getElementById('loader').style.display = 'none'; }
}

function applyVisibility(onclickFunc, isVisible) {
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => {
        if(b.getAttribute('onclick') === onclickFunc && !isVisible) {
            b.style.display = 'none';
        }
    });
}

// Функция определения аватарки (Discord или ссылка)
function getAvatar(user) {
    if (!user) return 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    // 1. Если пользователь вставил свою прямую ссылку (через настройки профиля)
    if (user.avatar && user.avatar.startsWith('http')) {
        return user.avatar;
    }
    
    // 2. Если у пользователя есть аватарка от самого Discord (хэш)
    if (user.avatar && user.avatar.length > 0) {
        return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`;
    }
    
    // 3. Если поле пустое (null или ""), отдаем стандартный аватар Discord
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
    sidebar.classList.toggle('hidden');

    const overlay = document.getElementById('sidebarOverlay');

    overlay.classList.toggle('active');
}

// Добавляем обработчик клика по самому слою затемнения
document.getElementById('sidebarOverlay').addEventListener('click', () => {
    const overlay = document.getElementById('sidebarOverlay');

    sidebar.classList.toggle('hidden');
    overlay.classList.remove('active');
});

// Вкладка: Главная
function showHome() {
    window.location.hash = 'home';
    document.getElementById('content').innerHTML = `
        <h1>NeСкам</h1>
        <p>Сайт для вечерних просмотров и выбора случайных фильмов в кругу близких друзей.</p>
    `;
}

// Вкладка: Пользователи (Исправлено!)
async function showUsers() {
    window.location.hash = 'users';
    const content = document.getElementById('content');
    
    // Показываем лоадер ТОЛЬКО если контент пустой (первый заход)
    if (!content.innerHTML || content.innerHTML.includes('spinner')) {
        content.innerHTML = '<div class="spinner"></div>';
    }
    
    await refreshUsersData(true); // true означает "полная перерисовка"
}

// Легкая функция для обновления только статусов без перезагрузки списка
async function refreshUserStatuses() {
    // В идеале можно сделать отдельный легкий API для статусов, но пока перерисуем showUsers, 
    // или (сложнее) найдем карточки по ID и сменим классы.
    // Для простоты пока оставим так: статус обновится при следующем входе, 
    // но если хочешь реалтайм прямо на глазах:
    showUsers(); 
}

async function refreshUsersData(fullRender = false) {
    try {
        const r = await fetch('/api/users');
        const users = await r.json();

        if (fullRender) {
            renderUsersGrid(users);
        } else {
            updateOnlyStatuses(users);
        }
    } catch (e) { console.error("Ошибка обновления юзеров", e); }
}

function updateOnlyStatuses(users) {
    users.forEach(u => {
        const card = document.querySelector(`.user-card[data-id="${u.discord_id}"]`);
        if (card) {
            const dot = card.querySelector('.status-dot');
            const isOnline = checkOnline(u.last_seen);
            if (isOnline) dot.classList.add('online');
            else dot.classList.remove('online');
        }
    });
}

function checkOnline(lastSeenTimestamp) {
    if (!lastSeenTimestamp) return false;

    const lastSeen = parseInt(lastSeenTimestamp);
    const now = Date.now();

    const diff = now - lastSeen;

    // Для отладки: раскомментируй строку ниже и посмотри в консоль браузера (F12)
    // console.log(`Разница для юзера: ${diff}мс`);

    // Если запрос был меньше 40 секунд назад — он онлайн
    return diff < 40000;
}

function renderUsersGrid(users) {
    const content = document.getElementById('content');
    let html = '<h1>Пользователи</h1><div class="users-grid" id="usersGrid">';
    
    users.forEach(u => {
        const isOnline = checkOnline(u.last_seen);
        html += `
            <div class="user-card" data-id="${u.discord_id}">
                <div class="avatar-container">
                    <img src="${getAvatar(u)}">
                    <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                </div>
                <h3>${u.username}</h3>
                <p>${u.bio || '<i>Нет описания</i>'}</p>
                <div class="coins-badge">💰 ${u.coins || 0}</div>
            </div>`;
    });
    html += '</div>';
    content.innerHTML = html;
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
    const avatar = document.getElementById('profileAvatarUrl').value;
    const bio = document.getElementById('profileBio').value;

    try {
        const r = await fetch('/api/save-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, avatar, bio })
        });

        const result = await r.json();

        if (result.ok) {
            alert('Профиль успешно сохранен!');
            closeProfile();
            // Сразу обновляем данные на странице без перезагрузки
            loadUser(); 
        } else {
            alert('Ошибка при сохранении: ' + result.error);
        }
    } catch (err) {
        console.error("Ошибка сети:", err);
    }
}

loadUser();

// Добавь в начало файла переменную для хранения фото
let galleryImages = [];
let currentImageIndex = 0;

// Добавь в сайдбар кнопку (в HTML или через JS)
// <button class="nav-btn" onclick="showGallery()">🖼 Галерея</button>

async function showGallery() {
    window.location.hash = 'gallery';
    
    if (window.galleryInterval) {
        clearInterval(window.galleryInterval);
        window.galleryInterval = null;
    }

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="gallery-header">
            <h1>Галерея событий</h1>
            <label class="upload-btn">
                <input type="file" id="photoInput" accept="image/*" onchange="uploadPhoto()" style="display:none">
                📸 Загрузить фото
            </label>
        </div>
        <div id="galleryGrid" class="gallery-grid"></div>
    `;

    // Просто загружаем список фото один раз при открытии
    await loadGalleryData();
}

async function loadGalleryData() {
    window.location.hash = 'gallery';
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    try {
        const r = await fetch('/api/gallery');
        const images = await r.json();
        galleryImages = images;

        grid.innerHTML = images.map((img, index) => `
            <div class="gallery-item" onclick="openLightbox(${index})">
                <img src="${img.url}" loading="lazy">
                <div class="item-info">@${img.username}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Ошибка загрузки галереи:", err);
    }
}

function renderGallery() {
    window.location.hash = 'gallery';
    const container = document.getElementById('galleryContainer');
    let html = `
        <div class="gallery-item add-photo-btn" onclick="triggerUpload()">
            + <span>Добавить фото</span>
            <input type="file" id="photoInput" hidden accept="image/*" onchange="uploadPhoto(this)">
        </div>
    `;
    
    galleryImages.forEach((img, index) => {
        html += `
            <div class="gallery-item" onclick="openLightbox(${index})">
                <img src="${img.url}">
            </div>
        `;
    });
    container.innerHTML = html;
}

function triggerUpload() { document.getElementById('photoInput').click(); }

async function uploadPhoto() {
    const fileInput = document.getElementById('photoInput');
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);

    // Показываем, что загрузка пошла (опционально)
    const btn = document.querySelector('.upload-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Загрузка...";

    try {
        const r = await fetch('/api/gallery/upload', {
            method: 'POST',
            body: formData
        });

        if (r.ok) {
            await loadGalleryData(); // Обновляем список фото сразу после загрузки
        } else {
            alert('Ошибка при загрузке фото');
        }
    } catch (err) {
        alert('Ошибка сети');
    } finally {
        btn.innerHTML = originalText;
        fileInput.value = ''; // Сбрасываем инпут
    }
}

function openLightbox(index) {
    currentImageIndex = index;
    const img = galleryImages[index];
    const isOwner = img.user_id === me.discord_id;

    const div = document.createElement('div');
    div.id = 'lightbox';
    div.className = 'lightbox';
    
    // Закрытие при клике на пустое место (на сам div .lightbox)
    div.onclick = (e) => {
        if (e.target.id === 'lightbox') {
            div.remove();
        }
    };

    div.innerHTML = `
        <div class="lightbox-content">
            <button class="nav-arrow arrow-left" onclick="event.stopPropagation(); changeLightboxImg(-1)">❮</button>
            <img src="${img.url}" onclick="event.stopPropagation()">
            <button class="nav-arrow arrow-right" onclick="event.stopPropagation(); changeLightboxImg(1)">❯</button>
            
            <div class="lightbox-info" onclick="event.stopPropagation()">
                <span class="author">@${img.username}</span>
                <span class="date">${new Date(img.created_at).toLocaleDateString()}</span>
                <br>
                ${isOwner ? `<button class="delete-photo-btn" onclick="deletePhoto('${img.id}')">Удалить</button>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

function changeLightboxImg(step) {
    currentImageIndex += step;
    if (currentImageIndex < 0) currentImageIndex = galleryImages.length - 1;
    if (currentImageIndex >= galleryImages.length) currentImageIndex = 0;
    
    document.getElementById('lightbox').remove();
    openLightbox(currentImageIndex);
}

async function deletePhoto(id) {
    if (!confirm('Удалить фото?')) return;
    const r = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    if (r.ok) {
        // Закрываем лайтбокс и перерисовываем галерею
        document.getElementById('lightbox').remove();
        showGallery(); 
    } else {
        alert('Ошибка при удалении');
    }
}

let galleryInterval = null; // Переменная для хранения таймера

async function showGallery() {
    window.location.hash = 'gallery';
    
    if (galleryInterval) clearInterval(galleryInterval);

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="gallery-header">
            <h1>Галерея событий</h1>
            <label class="upload-btn">
                <input type="file" id="photoInput" accept="image/*" onchange="uploadPhoto()" style="display:none">
                📸 Загрузить фото
            </label>
        </div>
        <div id="galleryGrid" class="gallery-grid"></div>
    `;

    // Загружаем фото сразу
    await refreshGalleryGrid();

    // Запускаем проверку новых фото каждые 5 секунд
    galleryInterval = setInterval(async () => {
        // Проверяем, находится ли пользователь всё еще в галерее
        const gridExists = document.getElementById('galleryGrid');
        if (gridExists) {
            await refreshGalleryGrid();
        } else {
            // Если ушел из галереи — выключаем таймер
            clearInterval(galleryInterval);
            galleryInterval = null;
        }
    }, 5000); 
}

async function refreshGalleryGrid() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    try {
        const r = await fetch('/api/gallery');
        const images = await r.json();

        // Если количество фото не изменилось, ничего не делаем (экономим ресурсы)
        if (window.lastGalleryCount === images.length) return;
        
        window.lastGalleryCount = images.length;
        galleryImages = images;

        grid.innerHTML = images.map((img, index) => `
            <div class="gallery-item" onclick="openLightbox(${index})">
                <img src="${img.url}" loading="lazy">
                <div class="item-info">@${img.username}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Ошибка обновления галереи:", err);
    }
}

async function uploadPhoto() {
    const fileInput = document.getElementById('photoInput');
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);

    const r = await fetch('/api/gallery/upload', {
        method: 'POST',
        body: formData
    });

    if (r.ok) {
        // Сбрасываем счетчик, чтобы refreshGalleryGrid точно сработал
        window.lastGalleryCount = 0; 
        await refreshGalleryGrid(); 
    }
}

function login() {
    const width = 500, height = 750;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    
    // Открываем окно по центру
    window.open('/auth/discord', 'Discord Auth', 
        `width=${width},height=${height},top=${top},left=${left}`);
}

// Слушаем клики по всему документу
document.addEventListener('click', (event) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.menu-btn'); // Убедись, что у кнопки открытия есть этот класс

    // Проверяем, открыта ли панель
    if (sidebar && sidebar.classList.contains('active')) {
        // Если клик был НЕ по панели И НЕ по кнопке меню (чтобы она не закрылась в момент открытия)
        const isClickInsideSidebar = sidebar.contains(event.target);
        const isClickOnMenuBtn = menuBtn && menuBtn.contains(event.target);

        if (!isClickInsideSidebar && !isClickOnMenuBtn) {
            sidebar.classList.remove('active');
        }
    }
});

// Функция, которая решает, какой раздел показать
function route() {
    // Убираем решетку из хеша (например #wheel -> wheel)
    const hash = window.location.hash.replace('#', '');
    
    switch(hash) {
        case 'gallery':
            showGallery();
            break;
        case 'users':
            showUsers();
            break;
            
        // ДОБАВЛЯЕМ ЭТОТ БЛОК
        case 'wheel':
            showWheel();
            break;
            
        case 'home':
        default:
            showHome();
            break;
    }
}
async function loadSettings() {
    try {
        const r = await fetch('/api/settings');
        siteSettings = await r.json();

        // Применяем настройки
        // 1. Фон
        if (siteSettings.bg_url) {
            document.body.style.backgroundImage = `url('${siteSettings.bg_url}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
        }
        
        // 2. Названия кнопок меню
        // Ищем кнопки по onclick, так как у них нет ID (лучше добавить ID в HTML, но сделаем гибко)
        updateNavText('showHome()', siteSettings.nav_home_text);
        updateNavText('showGallery()', siteSettings.nav_gallery_text);
        updateNavText('showUsers()', siteSettings.nav_users_text);
        
        // 3. Видимость разделов (скрываем кнопку, если настройка false И пользователь не админ)
        // Но пока мы не знаем админ ли юзер, применим это внутри loadUser
    } catch (e) { console.error("Settings load error", e); }
}

function updateNavText(onclickFunc, text) {
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => {
        if(b.getAttribute('onclick') === onclickFunc) b.innerText = text;
    });
}

// Запускаем сразу
loadSettings().then(() => loadUser());

async function showAdminPanel() {
    window.location.hash = 'admin';
    const content = document.getElementById('content');
    
    content.innerHTML = `
        <h1>⚙️ Админ Панель</h1>
        
        <div class="admin-tabs">
            <button class="tab-btn active" onclick="switchAdminTab('general')">Общие</button>
            <button class="tab-btn" onclick="switchAdminTab('users')">Пользователи</button>
        </div>

        <div id="tab-general" class="admin-section">
            <div class="input-group">
                <label>Фоновое изображение (URL)</label>
                <input type="text" id="setBg" value="${siteSettings.bg_url || ''}">
            </div>
            
            <h3>Названия разделов</h3>
            <div class="row">
                <input type="text" id="setNavHome" value="${siteSettings.nav_home_text}">
                <input type="text" id="setNavGallery" value="${siteSettings.nav_gallery_text}">
                <input type="text" id="setNavUsers" value="${siteSettings.nav_users_text}">
            </div>

            <h3>Видимость для обычных юзеров</h3>
            <div class="row">
                <label><input type="checkbox" id="visGallery" ${siteSettings.nav_gallery_visible ? 'checked' : ''}> Галерея</label>
                <label><input type="checkbox" id="visUsers" ${siteSettings.nav_users_visible ? 'checked' : ''}> Пользователи</label>
            </div>

            <button class="btn btn-primary" style="margin-top:20px" onclick="saveSiteSettings()">💾 Сохранить настройки</button>
        </div>

        <div id="tab-users" class="admin-section" style="display:none;">
            <p>Загрузка списка...</p>
        </div>
    `;

    // Подгружаем список юзеров для админки
    loadAdminUsersList();
}

function switchAdminTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
    
    // В этом примере простая реализация, ищем кнопки по тексту (лучше по ID)
    event.target.classList.add('active'); 
    document.getElementById(`tab-${tab}`).style.display = 'block';
}

async function saveSiteSettings() {
    const updates = {
        bg_url: document.getElementById('setBg').value,
        nav_home_text: document.getElementById('setNavHome').value,
        nav_gallery_text: document.getElementById('setNavGallery').value,
        nav_users_text: document.getElementById('setNavUsers').value,
        nav_gallery_visible: document.getElementById('visGallery').checked,
        nav_users_visible: document.getElementById('visUsers').checked
    };

    const r = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
    });
    
    if (r.ok) {
        alert('Сохранено! Обновите страницу.');
        location.reload();
    } else {
        alert('Ошибка сохранения');
    }
}

async function loadAdminUsersList() {
    const container = document.getElementById('tab-users');
    const r = await fetch('/api/users');
    const users = await r.json();

    container.innerHTML = `
        <div class="admin-edit-grid">
            ${users.map(u => `
                <div class="admin-user-card" id="admin-card-${u.discord_id}">
                    <div class="card-header">
                        <img src="${getAvatar(u)}" class="admin-avatar">
                        <div class="card-title">
                            <input type="text" value="${u.username}" id="edit-name-${u.discord_id}" placeholder="Никнейм">
                            <span class="id-badge">${u.discord_id}</span>
                        </div>
                    </div>
                    
                    <div class="card-body">
                        <div class="input-field">
                            <label>💰 Монеты</label>
                            <input type="number" value="${u.coins}" id="edit-coins-${u.discord_id}">
                        </div>
                        <div class="input-field">
                            <label>📝 Описание</label>
                            <textarea id="edit-bio-${u.discord_id}">${u.bio || ''}</textarea>
                        </div>
                        <div class="input-field">
                            <label>🖼 Ссылка на аватар</label>
                            <input type="text" value="${u.avatar || ''}" id="edit-avatar-${u.discord_id}">
                        </div>
                    </div>

                    <div class="card-footer">
                        <button class="btn-save-mini" onclick="saveUserByAdmin('${u.discord_id}')">✅ Сохранить</button>
                        
                        <label class="btn-sound-mini">
                            <input type="file" hidden accept="audio/*" onchange="uploadAdminSound(this, '${u.discord_id}')">
                            🔊 Звук
                        </label>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Сохранение данных пользователя админом
async function saveUserByAdmin(id) {
    const updates = {
        username: document.getElementById(`edit-name-${id}`).value,
        coins: parseInt(document.getElementById(`edit-coins-${id}`).value),
        bio: document.getElementById(`edit-bio-${id}`).value,
        avatar: document.getElementById(`edit-avatar-${id}`).value
    };

    const r = await fetch('/api/admin/user-edit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ target_id: id, updates })
    });

    if (r.ok) {
        alert('Данные пользователя обновлены!');
    }
}

// Загрузка звукового файла
async function uploadAdminSound(input, targetId) {
    if (!input.files[0]) return;
    
    const formData = new FormData();
    formData.append('sound', input.files[0]);
    formData.append('target_id', targetId);

    const btn = input.parentElement;
    btn.innerHTML = "⌛..."; // Индикация загрузки

    const r = await fetch('/api/admin/upload-sound', {
        method: 'POST',
        body: formData
    });

    if (r.ok) {
        alert('Звук отправлен пользователю!');
    } else {
        alert('Ошибка при загрузке звука');
    }
    loadAdminUsersList(); // Перерисовать, чтобы вернуть кнопку
}

async function adminEditUser(id, oldName, oldCoins) {
    const newName = prompt('Новый ник:', oldName);
    const newCoins = prompt('Монеты:', oldCoins);
    
    if (newName && newCoins) {
        await fetch('/api/admin/user-edit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                target_id: id,
                updates: { username: newName, coins: parseInt(newCoins) }
            })
        });
        loadAdminUsersList(); // Обновить список
    }
}

async function adminPlaySound(id) {
    const url = prompt('Введите прямую ссылку на MP3/WAV файл:');
    if (!url) return;

    await fetch('/api/admin/play-sound', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ target_id: id, sound_url: url })
    });
    alert('Команда отправлена!');
}

function startHeartbeat() {
    if (window.heartbeatActive) return;
    window.heartbeatActive = true;

    setInterval(async () => {
        const r = await fetch('/api/heartbeat', { method: 'POST' });
        const data = await r.json();

        // Обработка звуков (как была раньше)
        if (data.commands?.length > 0) {
            data.commands.forEach(c => new Audio(c.payload).play());
        }

        // Если мы в разделе пользователей, обновляем только статусы (без лоадера!)
        if (window.location.hash === '#users') {
            refreshUsersData(false); 
        }
    }, 20000); // 20 секунд
}

async function showWheel() {
    window.location.hash = 'wheel';
    localStorage.setItem('lastPage', 'wheel');
    const content = document.getElementById('content');

    // Структура страницы (Layout PointAuc)
    content.innerHTML = `
        <div class="wheel-container">
            <div class="wheel-stats">
                <h3>Шансы</h3>
                <div id="chanceList" class="chance-list"></div>
            </div>

            <div class="wheel-wrapper">
                <div class="wheel-pointer-value" id="currentWinnerLabel">???</div>
                <div class="wheel-pointer">▼</div>
                <canvas id="wheelCanvas" width="600" height="600"></canvas>
                <div class="wheel-center-btn" onclick="uploadCenterImage()">
                    <img id="centerImageDisplay" src="">
                    <input type="file" id="centerInput" hidden accept="image/*" onchange="sendCenterImage(this)">
                </div>
            </div>

            <div class="wheel-controls" id="adminControls" style="display:none">
                <h3>Управление</h3>
                <div class="control-group">
                    <label>Время (мс)</label>
                    <input type="number" id="spinTime" value="5000" onchange="updateSettings()">
                </div>
                <div class="control-group">
                    <label>Режим</label>
                    <select id="spinMode" onchange="updateSettings()">
                        <option value="normal">Обычный</option>
                        <option value="elimination">На выбывание</option>
                    </select>
                </div>
                <button class="spin-btn" onclick="spinTheWheel()">КРУТИТЬ!</button>
            </div>
        </div>

        <div class="wheel-options-panel">
            <div class="options-header">
                <h2>Варианты</h2>
                <div class="add-option-form">
                    <input type="text" id="newOptionLabel" placeholder="Название варианта">
                    <button onclick="addWheelOption()">Добавить</button>
                </div>
            </div>
            <div id="optionsGrid" class="options-grid"></div>
        </div>
    `;

    // Инициализация Canvas
    wheelCanvas = document.getElementById('wheelCanvas');
    wheelCtx = wheelCanvas.getContext('2d');

    // Загрузка данных
    await loadWheelData();
    
    // Подписка на Realtime
    subscribeToWheel();
}

async function loadWheelData() {
    const r = await fetch('/api/wheel/state');
    const data = await r.json();
    wheelItems = data.items;
    wheelState = data.state;

    // Настраиваем интерфейс
    if (me.is_admin) {
        document.getElementById('adminControls').style.display = 'block';
        document.getElementById('spinTime').value = wheelState.spin_duration;
        document.getElementById('spinMode').value = wheelState.mode;
    }

    // Центральная картинка
    if (wheelState.center_image) {
        document.getElementById('centerImageDisplay').src = wheelState.center_image;
        document.getElementById('centerImageDisplay').style.display = 'block';
    }

    // Если колесо крутится или уже прокручено, ставим угол
    if (!wheelState.is_spinning) {
        currentAngle = wheelState.target_rotation % 360; 
        // Или полностью wheelState.current_rotation, если хотим хранить историю оборотов
        currentAngle = wheelState.target_rotation; 
    } else {
        // Если зашли во время вращения — начинаем анимацию
        animateSpin(); 
    }

    renderWheelList();
    renderChances();
    drawWheel();
}

// Отрисовка самого колеса (Canvas)
function drawWheel() {
    if (!wheelCtx) return;
    const ctx = wheelCtx;
    const W = wheelCanvas.width;
    const H = wheelCanvas.height;
    const CX = W / 2;
    const CY = H / 2;
    const R = W / 2 - 20; // Радиус

    ctx.clearRect(0, 0, W, H);

    // Фильтруем выбывших, если режим elimination (но в базе они есть)
    // В режиме выбывания они просто серые или скрытые? Обычно скрытые.
    // Но если "можно вернуть", значит они есть в списке внизу.
    // В колесе рисуем только активных.
    const activeItems = wheelItems.filter(i => !i.is_eliminated);
    const totalWeight = activeItems.reduce((sum, i) => sum + i.weight, 0);

    if (totalWeight === 0) return;

    let startAngle = (currentAngle * Math.PI) / 180; // Переводим градусы в радианы

    // Рисуем сектора
    activeItems.forEach(item => {
        const sliceAngle = (item.weight / totalWeight) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.arc(CX, CY, R, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.stroke();

        // Текст
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px Arial";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText(item.label, R - 20, 5);
        ctx.restore();

        startAngle += sliceAngle;
    });

    // Определяем, кто сейчас под стрелкой (270 градусов / -90)
    // Нормализуем текущий угол
    updateCurrentWinnerLabel(activeItems, totalWeight);
}

function updateCurrentWinnerLabel(activeItems, totalWeight) {
    // Сложная математика для определения сектора под стрелкой
    const pointerAngle = (270 - (currentAngle % 360) + 360) % 360;
    
    let accumulated = 0;
    let found = null;

    for (let item of activeItems) {
        const sliceDegrees = (item.weight / totalWeight) * 360;
        if (pointerAngle >= accumulated && pointerAngle < accumulated + sliceDegrees) {
            found = item;
            break;
        }
        accumulated += sliceDegrees;
    }

    if (found) {
        document.getElementById('currentWinnerLabel').innerText = found.label;
        document.getElementById('currentWinnerLabel').style.color = found.color;
    }
}

function animateSpin(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = timestamp - startTime;
    const duration = wheelState.spin_duration;

    if (progress < duration) {
        // Easing function (easeOutQuart) для плавного замедления
        const t = progress / duration;
        const ease = 1 - Math.pow(1 - t, 4); 

        currentAngle = startRotation + (finalRotation - startRotation) * ease;
        drawWheel();
        animationFrameId = requestAnimationFrame(animateSpin);
    } else {
        // Конец вращения
        currentAngle = finalRotation;
        drawWheel();
        startTime = null;
        
        // Эффект победы
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });

        // Если режим выбывания - отправляем запрос на удаление (если админ)
        if (me.is_admin && wheelState.mode === 'elimination') {
             // Тут логика поиска победителя и пометка eliminated=true
             // Сделаем это на фронте, но лучше бы сервер это делал сам при завершении.
             // Для простоты оставим ручное управление пока.
        }
    }
}

function subscribeToWheel() {
    // Слушаем изменения в настройках/состоянии
    supabase
        .channel('public:wheel_state')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wheel_state' }, payload => {
            const newState = payload.new;
            wheelState = newState;
            
            // Если включилось вращение
            if (newState.is_spinning && newState.target_rotation !== currentAngle) {
                // Запускаем анимацию
                startRotation = currentAngle;
                finalRotation = newState.target_rotation;
                startTime = null; // сброс таймера анимации
                cancelAnimationFrame(animationFrameId);
                requestAnimationFrame(animateSpin);
            }
        })
        .subscribe();

    // Слушаем добавление/удаление вариантов
    supabase
        .channel('public:wheel_items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wheel_items' }, () => {
            loadWheelData(); // Просто перезагружаем данные, чтобы не мучаться с массивами
        })
        .subscribe();
}

async function spinTheWheel() {
    await fetch('/api/wheel/spin', { method: 'POST' });
}

// Добавление варианта
async function addWheelOption() {
    const label = document.getElementById('newOptionLabel').value;
    if(!label) return;
    await fetch('/api/wheel/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ label })
    });
    document.getElementById('newOptionLabel').value = '';
}

// Рендер списка внизу (с настройками)
function renderWheelList() {
    const grid = document.getElementById('optionsGrid');
    grid.innerHTML = wheelItems.map(item => `
        <div class="option-card ${item.is_eliminated ? 'eliminated' : ''}" style="border-left: 5px solid ${item.color}">
            <div class="opt-info">
                <strong>${item.label}</strong>
                <small>Создал: ...${item.created_by.substr(-4)}</small>
            </div>
            <div class="opt-controls">
                ${me.is_admin ? `
                    <input type="number" value="${item.weight}" 
                        onchange="updateOption('${item.id}', 'weight', this.value)" class="weight-input">
                    <button onclick="updateOption('${item.id}', 'eliminated', ${!item.is_eliminated})">
                        ${item.is_eliminated ? '♻️' : '❌'}
                    </button>
                    <button onclick="deleteOption('${item.id}')">🗑</button>
                ` : `
                   <span>${item.weight} очков</span>
                   ${item.created_by === me.discord_id ? `<button onclick="deleteOption('${item.id}')">🗑</button>` : ''}
                `}
            </div>
        </div>
    `).join('');
}

function renderChances() {
    const list = document.getElementById('chanceList');
    const active = wheelItems.filter(i => !i.is_eliminated);
    const total = active.reduce((a,b) => a + b.weight, 0);
    
    list.innerHTML = active.map(i => {
        const percent = ((i.weight / total) * 100).toFixed(1);
        return `
            <div class="chance-row">
                <span class="dot" style="background:${i.color}"></span>
                <span class="lbl">${i.label}</span>
                <span class="pct">${percent}%</span>
            </div>
        `;
    }).join('');
}

async function updateOption(id, type, value) {
    let body = {};
    if (type === 'weight') body.weight = parseInt(value);
    if (type === 'eliminated') {
        body.action = 'update';
        body.is_eliminated = value;
    } else {
        body.action = 'update';
    }
    
    await fetch(`/api/wheel/item/${id}`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
    });
}

async function deleteOption(id) {
    if(!confirm('Удалить?')) return;
    await fetch(`/api/wheel/item/${id}`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'delete' })
    });
}

// Загрузка фото центра
function uploadCenterImage() {
    if(!me.is_admin) return;
    document.getElementById('centerInput').click();
}

// Функция sendCenterImage аналогична загрузке аватарки (через FormData), только шлет на /api/wheel/settings
// Реализуй её по аналогии с аватарками, если нужно, или просто отправляй URL.

// Вызывай route() вместо showHome() после того, как данные пользователя загружены
// Например:
// loadUser().then(() => route());

