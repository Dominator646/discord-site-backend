import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // Твой конфиг сапабейза

export default function Home() {
  const [user, setUser] = useState(null);

  // Логика входа через Discord (через 0AUZ/Supabase)
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full"></div>
      </div>

      {!user ? (
        // ВАЙБОВОЕ МЕНЮ ВХОДА
        <div className="text-center space-y-8 animate-fade-in">
          <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
            NEСКАМ
          </h1>
          <p className="text-gray-400 text-lg font-light tracking-widest uppercase">
            Субботний кинозал для своих
          </p>
          
          <button 
            onClick={handleLogin}
            className="group relative px-8 py-4 bg-white text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            Войти через Discord
            <span className="absolute inset-0 rounded-full border border-white group-hover:animate-ping opacity-20"></span>
          </button>
        </div>
      ) : (
        // ЛИЧНЫЙ КАБИНЕТ (ПОСЛЕ РЕГИСТРАЦИИ)
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <img 
                src={user.avatar_url} 
                className="w-24 h-24 rounded-full border-2 border-purple-500 p-1"
                alt="Avatar"
              />
              <div className="absolute bottom-0 right-0 bg-green-500 w-5 h-5 rounded-full border-4 border-[#0a0a0a]"></div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold">{user.username}</h2>
              <p className="text-gray-500 text-sm">Участник клуба NeСкам</p>
            </div>

            <div className="grid grid-cols-1 w-full mt-6">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                <span className="text-gray-400">Монетки</span>
                <span className="text-xl font-mono text-yellow-500 flex items-center gap-2">
                  🪙 {user.coins || 0}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-600 mt-4 uppercase tracking-[0.2em]">
              Скоро здесь будет выбор фильма...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
