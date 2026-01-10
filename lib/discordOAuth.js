import { supabase } from './supabaseClient';

export async function loginWithDiscord() {
  const redirectUrl = `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: redirectUrl,
      scopes: 'identify email', // Запрашиваем доступ к данным пользователя
    },
  });
}

// Обработка коллбэка (на отдельной странице /auth/callback)
// Создайте страницу CallbackPage.jsx с примерно таким кодом:
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Проверяем, есть ли профиль в нашей таблице
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // Если профиля нет — создаем, используя данные из Discord
        if (!profile) {
          const { user } = session;
          const { data: newProfile, error } = await supabase
            .from('profiles')
            .insert([
              {
                id: user.id,
                discord_id: user.user_metadata.provider_id,
                username: user.user_metadata.full_name || user.email,
                avatar_url: user.user_metadata.avatar_url,
                coins: 100, // Стартовый бонус
              },
            ])
            .select()
            .single();
        }

        // Закрываем попап и обновляем основное окно
        if (window.opener) {
          window.opener.location.reload(); // Обновляем главную страницу
          window.close(); // Закрываем попап
        } else {
          navigate('/'); // Если не попап, просто редирект
        }
      }
    });
  }, [navigate]);

  return <div className="p-8 text-center">Авторизация...</div>;
}
