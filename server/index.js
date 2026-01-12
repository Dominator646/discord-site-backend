import express from 'express';
import fetch from 'node-fetch';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PORT = process.env.PORT || 3000;

// --- НАСТРОЙКА CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gallery',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage });

// --- AUTH ROUTES ---
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
      await supabase.from('users').insert({
        discord_id: user.id,
        username: user.username,
        avatar: user.avatar
      });
    }

    const token = jwt.sign({ discord_id: user.id }, process.env.JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/app.html');
  } catch(e) {
    res.redirect('/');
  }
});

app.get('/api/me', async (req,res)=>{
  try {
    const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const { data } = await supabase.from('users').select('*').eq('discord_id', d.discord_id).single();
    res.json(data);
  } catch(e) {
    res.status(401).json({error: 'Unauthorized'});
  }
});

// --- GALLERY API ---
app.get('/api/gallery', async (req, res) => {
  const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
  res.json(data);
});

app.post('/api/gallery/upload', upload.single('photo'), async (req, res) => {
  try {
    const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const { data: user } = await supabase.from('users').select('username').eq('discord_id', d.discord_id).single();
    
    // ВАЖНО: используем req.file.path для ссылки из Cloudinary
    const url = req.file.path;
    
    const { error } = await supabase.from('gallery').insert({
      url: url,
      user_id: d.discord_id,
      username: user.username
    });

    if (error) throw error;
    
    res.json({ ok: true });
  } catch (e) {
    console.error("Upload Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT,()=>console.log('NeСкам running on port ' + PORT));
