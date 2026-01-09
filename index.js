const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;

    // Если кода нет, отдаем посадочную страницу
    if (!code) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    try {
        // 1. Получаем данные от Discord
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

        // 2. Пишем в Supabase (без await, чтобы не ждать ответа и закрыть окно БЫСТРЕЕ)
        supabase.from('users_data').upsert({ 
            id: String(user.id), 
            username: user.username, 
            avatar: avatarUrl,
            last_login: new Date().toISOString()
        }).then(({error}) => { if(error) console.log("DB Error:", error.message) });

        // 3. ФИНАЛЬНЫЙ СКРИПТ (САМЫЙ ВАЖНЫЙ)
        // Мы передаем данные через куки и localStorage и ПРИНУДИТЕЛЬНО закрываем окно
        res.send(`
            <html>
            <body style="background: #05050a;">
                <script>
                    // Передаем сигнал родителю (большому окну)
                    if (window.opener) {
                        window.opener.localStorage.setItem('logged_user_id', '${user.id}');
                        window.opener.postMessage("auth_success", "*");
                        window.close(); // ЗАКРЫВАЕМ
                    }
                    // Резервный вариант, если opener потерян
                    localStorage.setItem('logged_user_id', '${user.id}');
                    setTimeout(() => { window.close(); }, 100);
                </script>
            </body>
            </html>
        `);

    } catch (err) {
        console.error("Auth error:", err.message);
        res.send("<script>window.close();</script>");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');
