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
    res.redirect('/app.html');
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

app.listen(PORT,()=>console.log('NeСкам running on port ' + PORT));
