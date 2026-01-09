const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;

    // Если кода нет — просто отдаем страницу входа
    if (!code) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    try {
        // 1. Обмен кода на токен Discord
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
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

        // 2. Получение данных пользователя
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        // 3. ЗАПИСЬ В БАЗУ (Если тут ошибка, скрипт пойдет дальше благодаря try-catch)
        try {
            const { error } = await supabase.from('users_data').upsert({ 
                id: String(user.id), 
                username: user.username, 
                avatar: avatarUrl,
                last_login: new Date().toISOString()
            });
            if (error) console.error("Supabase Error:", error.message);
        } catch (dbErr) {
            console.error("DB Connection Error:", dbErr.message);
        }

        // 4. ФИНАЛЬНЫЙ ОТВЕТ (Маленькое окно получит это и закроется)
        res.send(`
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="background: #05050a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                <script>
                    // Записываем данные в память
                    localStorage.setItem('logged_user_id', '${user.id}');
                    localStorage.setItem('user_name', '${user.username}');
                    localStorage.setItem('user_avatar', '${avatarUrl}');
                    
                    // Пытаемся закрыть окно
                    console.log("Авторизация завершена. Закрываю окно...");
                    window.close();
                    
                    // Если вдруг window.close() заблокирован, делаем редирект внутри
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 500);
                </script>
            </body>
            </html>
        `);

    } catch (err) {
        console.error("Auth Error:", err.message);
        res.send("<script>window.close();</script>");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');
