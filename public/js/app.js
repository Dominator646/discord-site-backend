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
    // Останавливаем все таймеры, если они остались от прошлых попыток
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
    // Очищаем старый таймер, если он был
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

