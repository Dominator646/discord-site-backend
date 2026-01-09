// 1. Импортируем библиотеку
const { createClient } = require('@supabase/supabase-js');

// 2. Инициализируем клиент (Railway возьмет эти данные из настроек)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Твоя функция теперь будет видеть переменную supabase
async function checkUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error("Ошибка получения юзера:", error.message);
        return;
    }
    console.log("Юзер найден:", user);
}

checkUser();
