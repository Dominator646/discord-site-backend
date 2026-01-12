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
    const content = document.getElementById('content');
    content.innerHTML = '<h1>Галерея</h1><div id="galleryContainer" class="gallery-grid"></div>';
    
    // Подгружаем фото
    const r = await fetch('/api/gallery');
    galleryImages = await r.json();
    
    renderGallery();
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
    if (!fileInput.files[0]) return alert('Выберите файл');

    const formData = new FormData();
    // ПРОВЕРЬ ЭТУ СТРОКУ: имя 'photo' должно совпадать с тем, что в server/index.js
    formData.append('photo', fileInput.files[0]); 

    try {
        const r = await fetch('/api/gallery/upload', {
            method: 'POST',
            body: formData
        });
        const result = await r.json();
        
        if (result.ok) {
            showGallery(); // Обновляем галерею
        } else {
            // Если здесь [object Object], выведи ошибку в консоль
            console.error("Ошибка сервера:", result);
            alert('Ошибка при загрузке: ' + (result.error || 'неизвестная ошибка'));
        }
    } catch (err) {
        console.error("Ошибка сети:", err);
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
