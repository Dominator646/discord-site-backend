const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 1. Раздача статики (HTML файлы должны лежать в папке public)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Инициализация Supabase (Переменные берутся из настроек Railway)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;

    // Если кода нет (просто зашли на сайт), отдаем главную страницу
    if (!code) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    try {
        console.log('--- Начинаю обмен кода на токен ---');

        // 3. Получаем Access Token от Discord
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://discord-site-backend-production.up.railway.app',
                scope: 'identify',
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;

        // 4. Получаем данные пользователя Discord
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        console.log(`Пользователь ${user.username} получен. Записываю в базу...`);

        // 5. Запись в Supabase (Upsert)
        // Используем String(user.id), чтобы избежать проблем с типами данных
        const { error: dbError } = await supabase
            .from('users_data')
            .upsert({ 
                id: String(user.id), 
                username: user.username, 
                avatar: avatarUrl,
                last_login: new Date().toISOString()
            });

        if (dbError) {
            console.error('Ошибка Supabase (продолжаю без записи):', dbError.message);
        }

        // 6. ОТВЕТ ДЛЯ МАЛЕНЬКОГО ОКНА (ЗАКРЫТИЕ)
        // Этот скрипт гарантированно закрывает окно и сохраняет данные в localStorage
        res.send(`
            <html>
            <head><title>Авторизация...</title></head>
            <body style="background: #05050a; display: flex; align-items: center; justify-content: center; height: 100vh;">
                <script>
                    // 1. Сохраняем данные в локальное хранилище
                    localStorage.setItem('logged_user_id', '${user.id}');
                    localStorage.setItem('user_name', '${user.username}');
                    localStorage.setItem('user_avatar', '${avatarUrl}');
                    
                    // 2. Сигнализируем главному окну
                    if (window.opener) {
                        window.opener.postMessage("auth_complete", "*");
                    }
                    
                    // 3. Немедленно закрываем это маленькое окно
                    console.log("Закрываю окно...");
                    window.close();
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Критическая ошибка бэкенда:', error.message);
        // В случае ошибки тоже закрываем окно, чтобы оно не висело белым
        res.send("<script>window.close();</script>");
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер NeСкам запущен на порту ${PORT}`);
});
