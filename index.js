const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.sendFile(path.join(__dirname, 'public', 'index.html'));

    try {
        // 1. Обмен кода на токен
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

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        // 2. Запись в базу (обернута в try-catch, чтобы не вешать окно при ошибке базы)
        try {
            await supabase.from('users_data').upsert({ 
                id: String(user.id), 
                username: user.username, 
                avatar: avatarUrl,
                last_login: new Date().toISOString()
            });
        } catch (dbErr) {
            console.error("Ошибка Supabase:", dbErr.message);
        }

        // 3. ОТВЕТ: ТОЛЬКО СКРИПТ, НИКАКОГО ЛИШНЕГО HTML
        res.send(`
            <script>
                if (window.opener) {
                    // Передаем данные в БОЛЬШОЕ окно
                    window.opener.localStorage.setItem('logged_user_id', '${user.id}');
                    window.opener.localStorage.setItem('user_name', '${user.username}');
                    window.opener.localStorage.setItem('user_avatar', '${avatarUrl}');
                    
                    // Редиректим БОЛЬШОЕ окно
                    window.opener.location.href = '/dashboard.html';
                    
                    // МГНОВЕННО ЗАКРЫВАЕМ МАЛЕНЬКОЕ
                    window.close();
                } else {
                    window.location.href = '/dashboard.html';
                }
            </script>
        `);
    } catch (err) {
        console.error("Ошибка:", err.message);
        res.send("<script>window.close();</script>"); // Закрываем в любом случае
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');
