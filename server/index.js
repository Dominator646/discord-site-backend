import express from 'express';
import fetch from 'node-fetch';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';

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

  const {data:ex} = await supabase.from('users').select('*').eq('discord_id',user.id).single();

  if(!ex){
    await supabase.from('users').insert({
      discord_id:user.id,
      username:user.username,
      avatar:user.avatar, // Сохраняем хеш аватарки discord
      bio:'',
      coins:100,
      last_login:new Date().toISOString()
    });
  } else {
    await supabase.from('users').update({last_login:new Date().toISOString()}).eq('discord_id',user.id);
  }

  const jwtToken = jwt.sign({discord_id:user.id},process.env.JWT_SECRET,{expiresIn:'7d'});
  res.cookie('token',jwtToken,{httpOnly:true});

  res.send(`<script>
    if(window.opener){window.opener.location='/app.html';window.close();}
    else location='/app.html';
  </script>`);
});

app.get('/api/me', async (req,res)=>{
  try{
    const d = jwt.verify(req.cookies.token,process.env.JWT_SECRET);
    const {data} = await supabase.from('users').select('*').eq('discord_id',d.discord_id).single();
    res.json(data);
  }catch{res.status(401).json({});}
});

app.post('/api/profile', async (req,res)=>{
  try{
    const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const { username, bio, avatar } = req.body;
    
    const { error } = await supabase.from('users')
      .update({ username, bio, avatar })
      .eq('discord_id', d.discord_id);
      
    if (error) throw error;
    res.json({ok:true});
  } catch(e) {
    res.status(401).json({error: "Unauthorized"});
  }
});

// Получение ВСЕХ пользователей (для вкладки Пользователи)
app.get('/api/users', async (req,res)=>{
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch(e) {
    res.status(500).json([]);
  }
});

app.listen(PORT,()=>console.log('NeСкам running'));

const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// API Галлереи
app.get('/api/gallery', async (req, res) => {
  const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
  res.json(data);
});

app.post('/api/gallery/upload', upload.single('photo'), async (req, res) => {
  try {
    const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const { data: user } = await supabase.from('users').select('username').eq('discord_id', d.discord_id).single();
    
    const url = `/uploads/${req.file.filename}`;
    
    await supabase.from('gallery').insert({
      url: url,
      user_id: d.discord_id,
      username: user.username
    });
    
    res.json({ ok: true });
  } catch (e) { res.status(401).send(); }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        await supabase.from('gallery').delete().eq('id', req.params.id).eq('user_id', d.discord_id);
        res.json({ ok: true });
    } catch (e) { res.status(401).send(); }
});
