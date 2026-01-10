import { useEffect, useState } from 'react';
import { LogIn, Sparkles, Film, Clock, Users } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { loginWithDiscord } from '../lib/discordOAuth';

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Проверяем, есть ли активная сессия
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      }
    });

    // Слушаем изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId) {
    const { data, error } = await supabase
      .from('profiles') // Таблица, которую вы создадите
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setUserProfile(data);
  }

  const handleDiscordLogin = () => {
    loginWithDiscord(); // Функция, которая перенаправит на Discord OAuth
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-950 text-white overflow-hidden">
      {/* Фоновые элементы: частицы, свечение */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-900/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl"></div>

      <main className="container mx-auto px-4 py-16 relative z-10">
        {/* Шапка */}
        <header className="flex justify-between items-center mb-20">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight">Ne<span className="text-cyan-400">Скам</span></h1>
          </div>
          {!session ? (
            <button
              onClick={handleDiscordLogin}
              className="flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/30"
            >
              <LogIn size={20} />
              Войти через Discord
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{userProfile?.username || 'Путешественник'}</p>
                <div className="flex items-center justify-end gap-1 text-amber-300">
                  <Coin size={16} />
                  <span className="font-bold">{userProfile?.coins || 0}</span>
                </div>
              </div>
              <img
                src={userProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`}
                alt="Аватар"
                className="w-12 h-12 rounded-2xl border-2 border-cyan-400/50"
              />
            </div>
          )}
        </header>

        {/* Герой-секция */}
        <section className="text-center max-w-4xl mx-auto mb-32">
          <h2 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Субботнее <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">кино</span> магия
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Каждую субботу, ближе к ночи, мы собираемся вместе, чтобы случай выбрать фильм, который запомнится.
            Присоединяйся к нашему ламповому ритуалу.
          </p>

          {/* Статистика / фичи */}
          <div className="flex flex-wrap justify-center gap-8 mt-16">
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-sm p-5 rounded-3xl border border-white/10">
              <Film className="w-10 h-10 text-purple-400" />
              <div>
                <p className="text-2xl font-bold">Фильмов выбрано</p>
                <p className="text-4xl font-black text-cyan-300">42</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-sm p-5 rounded-3xl border border-white/10">
              <Clock className="w-10 h-10 text-amber-400" />
              <div>
                <p className="text-2xl font-bold">Следующий NeСкам</p>
                <p className="text-2xl font-black">Суббота, 23:59</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-sm p-5 rounded-3xl border border-white/10">
              <Users className="w-10 h-10 text-green-400" />
              <div>
                <p className="text-2xl font-bold">Участников</p>
                <p className="text-4xl font-black text-green-300">17</p>
              </div>
            </div>
          </div>
        </section>

        {/* Если пользователь авторизован, показываем его профиль */}
        {userProfile && (
          <section className="max-w-2xl mx-auto bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-center">Твой ламповый профиль</h3>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <img
                src={userProfile.avatar_url}
                alt="Аватар"
                className="w-40 h-40 rounded-3xl border-4 border-cyan-400/50 shadow-2xl"
              />
              <div className="flex-1">
                <h4 className="text-3xl font-bold mb-2">{userProfile.username}</h4>
                <p className="text-gray-300 mb-4">ID: {userProfile.discord_id}</p>
                <div className="flex items-center gap-2 mb-6">
                  <div className="bg-amber-500/20 text-amber-300 py-1 px-4 rounded-full font-bold flex items-center gap-2">
                    <Coin size={18} /> {userProfile.coins} монет
                  </div>
                  <div className="bg-cyan-500/20 text-cyan-300 py-1 px-4 rounded-full font-bold">
                    Уровень {Math.floor(userProfile.coins / 100) + 1}
                  </div>
                </div>
                <p className="text-gray-400">
                  Участник NeСкам с {new Date(userProfile.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-8 text-gray-500 text-sm relative z-10">
        Создано с ❤️ для ламповых суббот. NeСкам {new Date().getFullYear()}
      </footer>
    </div>
  );
}

// Иконка монетки (можно вынести в отдельный файл)
function Coin({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 9h6M9 15h6" />
    </svg>
  );
}
