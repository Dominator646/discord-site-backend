async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = 'index.html'; // Выкидываем, если не вошел
    } else {
        // Отображаем данные
        document.getElementById('nickname').innerText = user.user_metadata.full_name;
        document.getElementById('avatar').src = user.user_metadata.avatar_url;
        
        // Монетки тянем из таблицы profiles
        let { data: profile } = await supabase
            .from('profiles')
            .select('coins')
            .eq('id', user.id)
            .single();
            
        document.getElementById('coins').innerText = profile?.coins || 0;
    }
}
checkUser();
