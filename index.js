const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
app.use(express.static('public'));

const app = express();

// Инициализация Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;

    // Если кода нет (просто зашли на URL бэкенда)
    if (!code) {
        return res.status(400).send("Ошибка: Код авторизации отсутствует.");
    }

    try {
        console.log('--- Начинаем процесс авторизации ---');

        // 1. Обмениваем временный код на Access Token
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

        // 2. Запрашиваем данные пользователя у Discord
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        console.log(`Пользователь получен: ${user.username}`);

        // 3. ОТПРАВКА ДАННЫХ В SUPABASE
        // Используем upsert: если пользователя нет - создаст, если есть - обновит ник и аватар
        const { error: supabaseError } = await supabase
            .from('users_data')
            .upsert({ 
                id: user.id, 
                username: user.username, 
                avatar: avatarUrl,
                last_login: new Date()
            }, { onConflict: 'id' });

        if (supabaseError) {
            console.error('Ошибка Supabase:', supabaseError);
            throw new Error('Ошибка при сохранении в базу данных');
        }

        console.log('Данные успешно сохранены в Supabase');

        // 4. ЗАКРЫТИЕ ОКНА И ПЕРЕХОД ОСНОВНОГО САЙТА
        res.send(`
            <html>
            <body style="background: #05050a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                <div style="text-align: center;">
                    <p style="font-size: 18px;">Авторизация успешна...</p>
                    <div style="border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #5865F2; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto;"></div>
                </div>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
                <script>
                    if (window.opener) {
                        // 1. Сохраняем ID пользователя в localStorage основного окна
                        window.opener.localStorage.setItem('logged_user_id', '${user.id}');
                        
                        // 2. Перенаправляем основное окно на страницу личного кабинета
                        // ВАЖНО: Укажи здесь путь к файлу твоего профиля/дашборда
                        window.opener.location.href = '/dashboard.html'; 
                        
                        // 3. Закрываем текущее маленькое окно
                        window.close();
                    } else {
                        // Если вдруг окно открыто не как popup, просто редиректим тут
                        window.location.href = '/dashboard.html';
                    }
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Критическая ошибка:', error.response ? error.response.data : error.message);
        res.status(500).send(`
            <div style="background: #0f172a; color: #ff4d4d; padding: 20px; font-family: sans-serif;">
                <h3>Ошибка авторизации</h3>
                <p>${error.message}</p>
                <button onclick="window.close()">Закрыть это окно</button>
            </div>
        `);
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер NeСкам запущен на порту ${PORT}`);
});
