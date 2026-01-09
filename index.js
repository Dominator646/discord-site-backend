const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Раздача файлов из папки public
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    try {
        // 1. Получаем токен от Discord
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

        // 2. Получаем данные пользователя
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        console.log(`Пользователь ${user.username} получен. Записываю в Supabase...`);

        // 3. Запись в базу (обязательно ждем выполнения)
        const { error: dbError } = await supabase
            .from('users_data')
            .upsert({ 
                id: String(user.id), // Принудительно в строку
                username: user.username, 
                avatar: avatarUrl,
                last_login: new Date().toISOString()
            });

        if (dbError) {
            console.error('ОШИБКА SUPABASE:', dbError.message);
            // Даже если база ошиблась, мы должны закрыть окно, чтобы юзер не ждал вечно
        }

        // 4. МГНОВЕННОЕ ЗАКРЫТИЕ И СИГНАЛ
        res.send(`
            <html>
            <script>
                if (window.opener) {
                    // Отправляем данные родителю через postMessage (самый надежный способ)
                    window.opener.postMessage({
                        type: 'AUTH_COMPLETE',
                        userId: '${user.id}',
                        username: '${user.username}',
                        avatar: '${avatarUrl}'
                    }, "*");
                    
                    // Мгновенно закрываем это маленькое окно
                    window.close();
                } else {
                    window.location.href = '/dashboard.html';
                }
            </script>
            <body style="background: #05050a;"></body>
            </html>
        `);

    } catch (error) {
        console.error('Ошибка в процессе:', error.message);
        res.status(500).send("Ошибка авторизации. Проверьте логи.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
