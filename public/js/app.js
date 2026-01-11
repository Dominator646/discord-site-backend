
let me=null;
async function loadUser(){
 const r=await fetch('/api/me');
 if(r.status===401){location='/';return;}
 me=await r.json();
 renderTop();showHome();
 loader.style.display='none';
}
function renderTop(){
 user.innerHTML=`
 <div class="avatar-wrapper" onclick="toggleUserMenu()">
 <img src="https://cdn.discordapp.com/avatars/${me.discord_id}/${me.avatar}.png">
 <span class="coins">💰 ${me.coins}</span>
 </div>
 <div id="userMenu" class="user-menu hidden">
 <button onclick="openProfile()">Профиль</button>
 </div>`;
}
function toggleUserMenu(){userMenu.classList.toggle('hidden');}
function openProfile(){
 profileModal.classList.remove('hidden');
 profileAvatar.src=`https://cdn.discordapp.com/avatars/${me.discord_id}/${me.avatar}.png`;
 profileName.value=me.username;
 profileBio.value=me.bio||'';
}
function closeProfile(){profileModal.classList.add('hidden');}
async function saveProfile(){
 await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({username:profileName.value,bio:profileBio.value})});
 location.reload();
}
function toggleSidebar(){sidebar.classList.toggle('hidden');}
function showHome(){content.innerHTML=`<h1>Добро пожаловать на NeСкам</h1><p>Вечернее событие для своих</p>`;}
async function showUsers(){
 const u=await fetch('/api/users').then(r=>r.json());
 content.innerHTML=u.map(x=>`
 <div class="user-card">
 <img src="https://cdn.discordapp.com/avatars/${x.discord_id}/${x.avatar}.png">
 <h3>${x.username}</h3><p>${x.bio||''}</p>
 </div>`).join('');
}
loadUser();
