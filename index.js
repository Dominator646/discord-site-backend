const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 1. ГЛАВНАЯ СТРАНИЦА (Твой профиль, монетки, аватарка)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 2. СТРАНИЦА ВХОДА (Кнопка "Войти через Дискорд")
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 3. ОБРАБОТКА ВХОДА (То самое маленькое окошко)
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://discord-site-backend-production.up.railway.app/auth/callback',
                scope: 'identify',
            }).toString(), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        // Запись в базу
        await supabase.from('users_data').upsert({ 
            id: String(user.id), 
            username: user.username, 
            avatar: avatarUrl,
            last_login: new Date().toISOString()
        });

        // СКРИПТ ЗАКРЫТИЯ МАЛЕНЬКОГО ОКНА
        res.send(`
            <script>
                localStorage.setItem('logged_user_id', '${user.id}');
                localStorage.setItem('user_name', '${user.username}');
                localStorage.setItem('user_avatar', '${avatarUrl}');
                if (window.opener) {
                    window.opener.postMessage("login_success", "*");
                }
                window.close();
            </script>
        `);
    } catch (err) {
        console.error(err);
        res.send("<script>window.close();</script>");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');
