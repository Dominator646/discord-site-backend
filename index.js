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
        // 1. Токен
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

        // 2. Юзер
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        // 3. Запись в Supabase (Важно: String для ID)
        const { error } = await supabase.from('users_data').upsert({ 
            id: String(user.id), 
            username: user.username, 
            avatar: avatarUrl,
            last_login: new Date().toISOString()
        });

        if (error) console.error("Supabase Error:", error.message);

        // 4. ФИНАЛ: Передаем данные через куки или localStorage и ЗАКРЫВАЕМ
        res.send(`
            <script>
                localStorage.setItem('logged_user_id', '${user.id}');
                localStorage.setItem('user_name', '${user.username}');
                localStorage.setItem('user_avatar', '${avatarUrl}');
                window.close(); // Окно просто закрывается
            </script>
        `);
    } catch (err) {
        res.send("<script>window.close();</script>");
    }
});

app.listen(process.env.PORT || 3000);
