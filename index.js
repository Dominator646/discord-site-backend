const SUPABASE_URL = 'ТВОЙ_URL_ИЗ_SUPABASE';
const SUPABASE_ANON_KEY = 'ТВОЙ_КЛЮЧ_ИЗ_SUPABASE';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBtn = document.getElementById('login-btn');
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');

// 1. Функция входа
loginBtn.addEventListener('click', async () => {
    await supabase.auth.signInWithOAuth({
        provider: 'discord',
    });
});

// 2. Проверка сессии при загрузке
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        showMainScreen(user);
    }
}

function showMainScreen(user) {
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    
    document.getElementById('nickname').innerText = user.user_metadata.full_name;
    document.getElementById('avatar').src = user.user_metadata.avatar_url;
    // Здесь можно сделать запрос к таблице 'profiles' за монетками
}

// 3. Выход
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
});

checkUser();
