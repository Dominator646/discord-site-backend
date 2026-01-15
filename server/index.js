import express from 'express';
import fetch from 'node-fetch';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем папку, если её нет (важно для Volume)
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PORT = process.env.PORT || 3000;

// Старый добрый конфиг Multer на диск
const storage = multer.memoryStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Роуты авторизации (оставляем как были)
app.get('/auth/discord', (req,res)=>{
  const p = new URLSearchParams({
    client_id:process.env.DISCORD_CLIENT_ID,
    redirect_uri:process.env.DISCORD_REDIRECT_URI,
    response_type:'code',
    scope:'identify'
  });
  res.redirect('https://discord.com/oauth2/authorize?'+p);
});

app.get('/auth/discord/callback', async (req,res)=>{
  const code = req.query.code;
  if(!code) return res.redirect('/');
  try {
    const t = await fetch('https://discord.com/api/oauth2/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        client_id:process.env.DISCORD_CLIENT_ID,
        client_secret:process.env.DISCORD_CLIENT_SECRET,
        grant_type:'authorization_code',
        code,
        redirect_uri:process.env.DISCORD_REDIRECT_URI
      })
    }).then(r=>r.json());
    const user = await fetch('https://discord.com/api/users/@me',{
      headers:{Authorization:`Bearer ${t.access_token}`}
    }).then(r=>r.json());
    const { data: existingUser } = await supabase.from('users').select('*').eq('discord_id', user.id).single();
    if (!existingUser) {
      await supabase.from('users').insert({ discord_id: user.id, username: user.username, avatar: user.avatar });
    }
    const token = jwt.sign({ discord_id: user.id }, process.env.JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    // Замени res.redirect('/app.html'); на этот код:
res.send(`
  <script>
    if (window.opener) {
      // Передаем сигнал родителю, что авторизация успешна
      window.opener.location.href = '/app.html';
      // Закрываем текущее всплывающее окно
      window.close();
    } else {
      // Если это не попап, просто переходим
      window.location.href = '/app.html';
    }
  </script>
`);
  } catch(e) { res.redirect('/'); }
});

app.get('/api/me', async (req,res)=>{
  try {
    const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const { data } = await supabase.from('users').select('*').eq('discord_id', d.discord_id).single();
    res.json(data);
  } catch(e) { res.status(401).json({error: 'Unauthorized'}); }
});

// API Галереи (ТВОЙ СТАРЫЙ КОД)
app.get('/api/gallery', async (req, res) => {
  const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
  res.json(data);
});

app.post('/api/gallery/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });

    // Проверяем авторизацию
    const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    
    // Генерируем уникальное имя файла
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${req.file.originalname}`;

    // 1. Загружаем файл в Storage Supabase
    const { data: storageData, error: storageError } = await supabase.storage
      .from('gallery')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (storageError) throw storageError;

    // 2. Получаем публичную прямую ссылку на файл
    const { data: { publicUrl } } = supabase.storage
      .from('gallery')
      .getPublicUrl(fileName);

    // 3. Сохраняем эту ссылку в таблицу базы данных
    const { data: user } = await supabase.from('users')
      .select('username')
      .eq('discord_id', d.discord_id)
      .single();
    
    await supabase.from('gallery').insert({
      url: publicUrl, // Теперь тут вечная ссылка из Supabase Storage
      user_id: d.discord_id,
      username: user.username
    });
    
    res.json({ ok: true });
  } catch (e) { 
    console.error("Ошибка при Redeploy-safe загрузке:", e);
    res.status(500).json({ error: 'Ошибка сохранения файла в облако' }); 
  }
});

app.post('/api/save-profile', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });

    const d = jwt.verify(token, process.env.JWT_SECRET);
    let { username, avatar, bio } = req.body;

    // Если строка аватара пустая или состоит из пробелов, ставим null
    if (!avatar || avatar.trim() === '') {
        avatar = null;
    }

    const { error } = await supabase
      .from('users')
      .update({ username, avatar, bio })
      .eq('discord_id', d.discord_id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('discord_id, username, avatar, coins, bio')
      .order('coins', { ascending: false }); // Сортировка по монетам

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error("Ошибка загрузки пользователей:", e);
    res.status(500).json([]);
  }
});

// Удаление фотографии из галереи
app.delete('/api/gallery/:id', async (req, res) => {
  try {
    // 1. Проверяем, авторизован ли пользователь
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Необходима авторизация' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const photoId = req.params.id;

    // 2. (Опционально) Проверяем, является ли пользователь владельцем фото
    // Сначала получаем данные о фото
    const { data: photo } = await supabase
      .from('gallery')
      .select('user_id')
      .eq('id', photoId)
      .single();

    if (!photo) return res.status(404).json({ error: 'Фото не найдено' });
    
    // Если id пользователя в токене не совпадает с владельцем фото — запрещаем
    if (photo.user_id !== decoded.discord_id) {
      return res.status(403).json({ error: 'Вы не можете удалять чужие фото' });
    }

    // 3. Удаляем запись из таблицы Supabase
    const { error } = await supabase
      .from('gallery')
      .delete()
      .eq('id', photoId);

    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    console.error("Ошибка при удалении фото:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- ADMIN & SYSTEM API ---

// 1. Получение настроек (доступно всем, чтобы сайт знал, как рисоваться)
app.get('/api/settings', async (req, res) => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    res.json(data);
});

// 2. Сохранение настроек (Только Админ)
app.post('/api/admin/settings', async (req, res) => {
    try {
        const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        // Проверяем админку в БД
        const { data: u } = await supabase.from('users').select('is_admin').eq('discord_id', d.discord_id).single();
        if (!u || !u.is_admin) return res.status(403).json({ error: 'Нет прав' });

        const { error } = await supabase.from('settings').update(req.body).eq('id', 1);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Редактирование любого пользователя (Только Админ)
app.post('/api/admin/user-edit', async (req, res) => {
    try {
        const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const { data: admin } = await supabase.from('users').select('is_admin').eq('discord_id', d.discord_id).single();
        if (!admin?.is_admin) return res.status(403).json({ error: 'Access denied' });

        const { target_id, updates } = req.body; // updates = { coins, username, ... }
        await supabase.from('users').update(updates).eq('discord_id', target_id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Отправка звука (Команды)
app.post('/api/admin/play-sound', async (req, res) => {
    try {
        const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const { data: admin } = await supabase.from('users').select('is_admin').eq('discord_id', d.discord_id).single();
        if (!admin?.is_admin) return res.status(403).json({ error: 'Access denied' });

        const { target_id, sound_url } = req.body;
        await supabase.from('commands').insert({
            target_user_id: target_id,
            type: 'sound',
            payload: sound_url
        });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. Heartbeat (Я тут! Я онлайн!) + Получение команд
app.post('/api/heartbeat', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.json({ commands: [] });

        const d = jwt.verify(token, process.env.JWT_SECRET);
        
        // Обновляем "был в сети"
        await supabase.from('users').update({ last_seen: new Date() }).eq('discord_id', d.discord_id);

        // Проверяем, есть ли команды для этого юзера (звуки)
        const { data: cmds } = await supabase.from('commands')
            .select('*')
            .eq('target_user_id', d.discord_id)
            .eq('executed', false);

        // Если есть команды, помечаем как выполненные
        if (cmds && cmds.length > 0) {
            await supabase.from('commands').update({ executed: true })
                .in('id', cmds.map(c => c.id));
        }

        res.json({ commands: cmds || [] });
    } catch (e) { res.json({ commands: [] }); }
});

// Загрузка звукового файла и создание команды (Только Админ)
app.post('/api/admin/upload-sound', upload.single('sound'), async (req, res) => {
    try {
        const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const { data: admin } = await supabase.from('users').select('is_admin').eq('discord_id', d.discord_id).single();
        if (!admin?.is_admin) return res.status(403).json({ error: 'Нет прав' });

        if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });

        const fileName = `sound-${Date.now()}-${req.file.originalname}`;
        const targetId = req.body.target_id;

        // 1. Загружаем в Storage "sounds"
        const { error: storageError } = await supabase.storage
            .from('sounds')
            .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

        if (storageError) throw storageError;

        // 2. Получаем ссылку
        const { data: { publicUrl } } = supabase.storage.from('sounds').getPublicUrl(fileName);

        // 3. Создаем команду для юзера
        await supabase.from('commands').insert({
            target_user_id: targetId,
            type: 'sound',
            payload: publicUrl
        });

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT,()=>console.log('NeСкам running on port ' + PORT));
