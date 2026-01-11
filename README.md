
NeСкам

1. Залей репозиторий на GitHub
2. Создай проект на Railway
3. Добавь переменные из .env в Railway
4. Supabase: создай таблицу users

SQL:

create table users (
  id uuid default gen_random_uuid() primary key,
  discord_id text unique,
  username text,
  avatar text,
  coins int default 100,
  last_login timestamp
);
