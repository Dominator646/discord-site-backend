let me = null;
let siteSettings = {}; // Сюда загрузим настройки
let heartbeatInterval = null;

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
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';
    window.location.hash = 'users';
    
    try {
        const r = await fetch('/api/users');
        const users = await r.json(); // Теперь users содержит last_seen
        
        let html = '<h1>Пользователи</h1><div class="users-grid">';
        users.forEach(u => {
            // Проверка онлайна: если last_seen был меньше 2 минут назад
            const lastSeen = new Date(u.last_seen || 0);
            const now = new Date();
            const diffSeconds = (now - lastSeen) / 1000;
            const isOnline = diffSeconds < 120; // 2 минуты таймаут
            
            const statusClass = isOnline ? 'status-online' : 'status-offline';

            html += `
                <div class="user-card">
                    <div class="avatar-container" style="position:relative; display:inline-block;">
                        <img src="${getAvatar(u)}">
                        <div class="status-dot ${statusClass}"></div>
                    </div>
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

// Легкая функция для обновления только статусов без перезагрузки списка
async function refreshUserStatuses() {
    // В идеале можно сделать отдельный легкий API для статусов, но пока перерисуем showUsers, 
    // или (сложнее) найдем карточки по ID и сменим классы.
    // Для простоты пока оставим так: статус обновится при следующем входе, 
    // но если хочешь реалтайм прямо на глазах:
    showUsers(); 
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
    const hash = window.location.hash.replace('#', '');
    
    switch(hash) {
        case 'gallery':
            showGallery();
            break;
        case 'users':
            showUsers();
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
    const r = await fetch('/api/users'); // Используем существующий API
    const users = await r.json();

    let html = '<div class="admin-users-list">';
    users.forEach(u => {
        html += `
            <div class="admin-user-row">
                <img src="${getAvatar(u)}" class="tiny-avatar">
                <div class="info">
                    <strong>${u.username}</strong>
                    <span class="coins">💰 ${u.coins}</span>
                </div>
                <div class="actions">
                    <button onclick="adminEditUser('${u.discord_id}', '${u.username}', ${u.coins})">✏️ Ред.</button>
                    <button onclick="adminPlaySound('${u.discord_id}')">🔊 Звук</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
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
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    
    // Каждые 5 секунд говорим серверу "Я тут" и спрашиваем "Есть че?"
    heartbeatInterval = setInterval(async () => {
        try {
            const r = await fetch('/api/heartbeat', { method: 'POST' });
            const data = await r.json();

            // Проигрывание звуков
            if (data.commands && data.commands.length > 0) {
                data.commands.forEach(cmd => {
                    if (cmd.type === 'sound') {
                        const audio = new Audio(cmd.payload);
                        audio.play().catch(e => console.log('Autoplay blocked:', e));
                        alert('🔊 Вам проигрывают звук!'); // Чтобы юзер кликнул и звук пошел, если браузер блокирует
                    }
                });
            }
            
            // Если мы сейчас в разделе "Пользователи", обновляем их статус (точки)
            if (window.location.hash === '#users') {
                refreshUserStatuses();
            }

        } catch (e) { console.error('Heartbeat error', e); }
    }, 5000);
}

// Вызывай route() вместо showHome() после того, как данные пользователя загружены
// Например:
// loadUser().then(() => route());

