import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kngwuzbuiyrzgvosckwc.supabase.co';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZ3d1emJ1aXlyemd2b3Nja3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDM2NDAsImV4cCI6MjA4OTMxOTY0MH0.jsGx34wQnL1IY3hkkPu1FLWcpEBkm8p2gHrvdGjpDQ8';
const POLL_MS      = 500;

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// ── STATE ──────────────────────────────────────────────────────────────────
let currentUser  = null;
let currentChat  = null;  // { id, type, name, ... }
let knownIds     = new Set();
let chats        = [];
let pollTimer, cTimer;

// ── DOM ────────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const authPage        = $('authPage');
const appPage         = $('appPage');
const authError       = $('authError');
const step1           = $('step1');
const step1b          = $('step1b');
const step2           = $('step2');
const step3           = $('step3');
const dots            = [$('dot1'), $('dot2'), $('dot3')];
const emailInput      = $('emailInput');
const loginEmailInput = $('loginEmailInput');
const usernameInput   = $('usernameInput');
const displayNameInput= $('displayNameInput');
const emailNextBtn    = $('emailNextBtn');
const loginBtn        = $('loginBtn');
const loginLinkBtn    = $('loginLinkBtn');
const registerLinkBtn = $('registerLinkBtn');
const otpVerifyBtn    = $('otpVerifyBtn');
const backToPhoneBtn  = $('backToPhoneBtn');
const registerBtn     = $('registerBtn');
const otpBoxes        = [...document.querySelectorAll('.otp-box')];
const headerAvatar    = $('headerAvatar');
const headerUsername  = $('headerUsername');
const logoutBtn       = $('logoutBtn');
const chatListEl      = $('chatList');
const chatView        = $('chatView');
const noChatSelected  = $('noChatSelected');
const topbarAvatar    = $('topbarAvatar');
const topbarName      = $('topbarName');
const topbarSub       = $('topbarSub');
const chatDiv         = $('chat');
const messageInput    = $('messageInput');
const sendBtn         = $('sendBtn');
const connDot         = $('connDot');
const statusText      = $('connStatus');
const sideStatusText  = $('statusText');
const dbLatency       = $('dbLatency');
const lastSyncEl      = $('lastSync');
const countdownEl     = $('countdown');
const profilePanel    = $('profilePanel');
const profileAvatar   = $('profileAvatar');
const profileUsername = $('profileUsername');
const profileDisplayName = $('profileDisplayName');
const profilePhone    = $('profilePhone');
const profileDate     = $('profileDate');
const profileDmBtn    = $('profileDmBtn');
const closeProfileBtn = $('closeProfileBtn');
const loadingOverlay  = $('loadingOverlay');
const userSearchInput = $('userSearchInput');
const searchResults   = $('searchResults');
const newDmBtn        = $('newDmBtn');
const newGroupBtn     = $('newGroupBtn');
const newDmModal      = $('newDmModal');
const newGroupModal   = $('newGroupModal');
const dmSearchInput   = $('dmSearchInput');
const dmSearchResults = $('dmSearchResults');
const dmCancelBtn     = $('dmCancelBtn');
const dmCreateBtn     = $('dmCreateBtn');
const groupNameInput  = $('groupNameInput');
const groupMemberSearch = $('groupMemberSearch');
const groupMemberResults= $('groupMemberResults');
const selectedMembersEl = $('selectedMembers');
const groupCancelBtn  = $('groupCancelBtn');
const groupCreateBtn  = $('groupCreateBtn');
const chatInfoBtn     = $('chatInfoBtn');

// ── HELPERS ────────────────────────────────────────────────────────────────
const now     = () => new Date().toLocaleTimeString('uk-UA', { hour12: false });
const esc     = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const initials= s  => String(s||'?').slice(0,1).toUpperCase();
const hideLoading = () => { loadingOverlay.style.opacity='0'; setTimeout(()=>loadingOverlay.style.display='none',400); };
const showPage    = p  => { authPage.classList.remove('active'); appPage.classList.remove('active'); p.classList.add('active'); };
const setStatus   = (cls,txt) => { connDot.className='dot '+(cls||''); statusText.textContent=txt; sideStatusText.textContent=txt; };

const showError = msg => {
    authError.textContent = '⚠ ' + msg;
    authError.classList.add('show');
    setTimeout(() => authError.classList.remove('show'), 4000);
};

// ── AUTH STEPS ─────────────────────────────────────────────────────────────
let tempPhone = '', isLoginMode = false;

const showStep = (step, dotIdx) => {
    [step1,step1b,step2,step3].forEach(s=>s.classList.remove('active'));
    step.classList.add('active');
    dots.forEach((d,i)=>{ d.classList.remove('active','done'); if(i<dotIdx)d.classList.add('done'); if(i===dotIdx)d.classList.add('active'); });
};

otpBoxes.forEach((box,i) => {
    box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g,'');
        if (box.value && i < otpBoxes.length-1) otpBoxes[i+1].focus();
    });
    box.addEventListener('keydown', e => { if(e.key==='Backspace'&&!box.value&&i>0) otpBoxes[i-1].focus(); });
});
const getOtp   = () => otpBoxes.map(b=>b.value).join('');
const clearOtp = () => otpBoxes.forEach(b=>b.value='');

// ── AUTH METHOD ────────────────────────────────────────────────────────────
let authMethod = 'phone'; // 'phone' | 'email'
let tempEmail  = '';

const setRegMethod = (m) => {
    authMethod = m;
    $('regMethodPhone').classList.toggle('active', m === 'phone');
    $('regMethodEmail').classList.toggle('active', m === 'email');
    $('regPhoneGroup').style.display = m === 'phone' ? '' : 'none';
    $('regEmailGroup').style.display = m === 'email' ? '' : 'none';
};
const setLoginMethod = (m) => {
    authMethod = m;
    $('loginMethodPhone').classList.toggle('active', m === 'phone');
    $('loginMethodEmail').classList.toggle('active', m === 'email');
    $('loginPhoneGroup').style.display  = m === 'phone' ? '' : 'none';
    $('loginEmailGroup').style.display  = m === 'email' ? '' : 'none';
};

$('regMethodPhone').onclick   = () => setRegMethod('phone');
$('regMethodEmail').onclick   = () => setRegMethod('email');
$('loginMethodPhone').onclick = () => setLoginMethod('phone');
$('loginMethodEmail').onclick = () => setLoginMethod('email');

// ── REGISTER ──────────────────────────────────────────────────────────────
$('phoneNextBtn').onclick = async () => {
    if (authMethod === 'email') {
        const email = $('emailRegInput').value.trim().toLowerCase();
        if (!email.includes('@')) { showError('Невірний email.'); return; }
        const { data: ex } = await supabase.from('profiles').select('id').eq('email', email).single();
        if (ex) { showError('Email вже зареєстровано. Увійдіть.'); return; }

        $('phoneNextBtn').textContent = 'ВІДПРАВКА...';
        $('phoneNextBtn').disabled = true;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        $('phoneNextBtn').textContent = 'ЗАРЕЄСТРУВАТИСЯ ▸';
        $('phoneNextBtn').disabled = false;
        if (error) { showError('Помилка: ' + error.message); return; }

        tempEmail = email; tempPhone = ''; isLoginMode = false; clearOtp();
        $('otpHint').textContent = '▸ КОД ВІДПРАВЛЕНО НА ' + email;
        showStep(step2, 1);
    } else {
        const phone = $('phoneInput').value.trim();
        if (!phone.match(/^\+\d{10,14}$/)) { showError('Невірний формат. Приклад: +380501234567'); return; }
        const { data: ex } = await supabase.from('profiles').select('id').eq('phone', phone).single();
        if (ex) { showError('Номер вже зареєстровано. Увійдіть.'); return; }
        tempPhone = phone; tempEmail = ''; isLoginMode = false; clearOtp();
        $('otpHint').textContent = '▸ ДЕМО: ВВЕДІТЬ БУДЬ-ЯКІ 6 ЦИФР';
        showStep(step2, 1);
    }
    setTimeout(() => otpBoxes[0].focus(), 100);
};

// ── LOGIN ─────────────────────────────────────────────────────────────────
loginBtn.onclick = async () => {
    if (authMethod === 'email') {
        const email = $('emailLoginInput').value.trim().toLowerCase();
        if (!email.includes('@')) { showError('Невірний email.'); return; }
        const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
        if (!profile) { showError('Акаунт не знайдено.'); return; }

        loginBtn.textContent = 'ВІДПРАВКА...';
        loginBtn.disabled = true;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        loginBtn.textContent = 'УВІЙТИ ▸';
        loginBtn.disabled = false;
        if (error) { showError('Помилка: ' + error.message); return; }

        tempEmail = email; tempPhone = ''; isLoginMode = true; clearOtp();
        $('otpHint').textContent = '▸ КОД ВІДПРАВЛЕНО НА ' + email;
        showStep(step2, 1);
    } else {
        const phone = $('loginPhoneInput').value.trim();
        if (!phone.match(/^\+\d{10,14}$/)) { showError('Невірний формат.'); return; }
        const { data: profile } = await supabase.from('profiles').select('*').eq('phone', phone).single();
        if (!profile) { showError('Акаунт не знайдено.'); return; }
        tempPhone = phone; tempEmail = ''; isLoginMode = true; clearOtp();
        $('otpHint').textContent = '▸ ДЕМО: ВВЕДІТЬ БУДЬ-ЯКІ 6 ЦИФР';
        showStep(step2, 1);
    }
    setTimeout(() => otpBoxes[0].focus(), 100);
};

loginLinkBtn.onclick    = () => { setLoginMethod('phone'); showStep(step1b, 0); };
registerLinkBtn.onclick = () => { setRegMethod('phone');   showStep(step1, 0); };
backToPhoneBtn.onclick  = () => showStep(isLoginMode ? step1b : step1, 0);

// ── VERIFY OTP ────────────────────────────────────────────────────────────
otpVerifyBtn.onclick = async () => {
    const token = getOtp();
    if (token.length < 6) { showError('Введіть 6 цифр.'); return; }

    if (tempEmail) {
        // Real email OTP
        otpVerifyBtn.textContent = 'ПЕРЕВІРКА...';
        otpVerifyBtn.disabled = true;
        const { error } = await supabase.auth.verifyOtp({ email: tempEmail, token, type: 'email' });
        otpVerifyBtn.textContent = 'ПІДТВЕРДИТИ ▸';
        otpVerifyBtn.disabled = false;
        if (error) { showError('Невірний код: ' + error.message); return; }

        if (isLoginMode) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('email', tempEmail).single();
            if (!profile) { showError('Профіль не знайдено.'); return; }
            currentUser = profile; enterApp();
        } else {
            showStep(step3, 2); setTimeout(() => usernameInput.focus(), 100);
        }
    } else {
        // Phone demo — any 6 digits
        if (isLoginMode) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('phone', tempPhone).single();
            if (!profile) { showError('Профіль не знайдено.'); return; }
            currentUser = profile; enterApp();
        } else {
            showStep(step3, 2); setTimeout(() => usernameInput.focus(), 100);
        }
    }
};

// ── CREATE PROFILE ────────────────────────────────────────────────────────
registerBtn.onclick = async () => {
    const username    = usernameInput.value.trim().toLowerCase();
    const displayName = displayNameInput.value.trim();
    if (!username.match(/^[a-z0-9_]{3,20}$/)) { showError('Нікнейм: 3-20 символів a-z 0-9 _'); return; }
    if (!displayName) { showError("Введіть ім'я."); return; }
    const { data: exists } = await supabase.from('profiles').select('id').eq('username', username).single();
    if (exists) { showError('Нікнейм вже зайнятий.'); return; }

    const profileData = { username, display_name: displayName };
    if (tempPhone) profileData.phone = tempPhone;
    if (tempEmail) profileData.email = tempEmail;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) profileData.auth_id = authUser.id;

    const { data, error } = await supabase.from('profiles').insert([profileData]).select().single();
    if (error) { showError('Помилка: ' + error.message); return; }
    currentUser = data; enterApp();
};

// ── ENTER APP ──────────────────────────────────────────────────────────────
const enterApp = () => {
    localStorage.setItem('massenger_user', JSON.stringify(currentUser));
    headerAvatar.textContent   = initials(currentUser.display_name || currentUser.username);
    headerUsername.textContent = '@' + currentUser.username;
    showPage(appPage);
    hideLoading();
    loadChats();
    startPolling();
};



// ── CHAT LIST ──────────────────────────────────────────────────────────────
const loadChats = async () => {
    // Get all chats where current user is a member
    const { data: memberships } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', currentUser.id);

    if (!memberships || memberships.length === 0) {
        chatListEl.innerHTML = '<div class="empty-chats">▸ НЕМАЄ ЧАТІВ<br>НАТИСНІТЬ ✉ ДЛЯ ЛС<br>АБО ⊕ ДЛЯ ГРУПИ</div>';
        return;
    }

    const chatIds = memberships.map(m => m.chat_id);
    const { data: chatData } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds)
        .order('created_at', { ascending: false });

    if (!chatData) return;
    chats = chatData;
    renderChatList();
};

const getChatDisplayName = async (chat) => {
    if (chat.type === 'group') return chat.name || 'Група';
    // For DM — get the other person's name
    const { data: members } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chat.id);
    if (!members) return 'ЛС';
    const otherId = members.find(m => m.user_id !== currentUser.id)?.user_id;
    if (!otherId) return 'ЛС';
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', otherId).single();
    return profile ? `@${profile.username}` : 'ЛС';
};

const renderChatList = async () => {
    if (chats.length === 0) {
        chatListEl.innerHTML = '<div class="empty-chats">▸ НЕМАЄ ЧАТІВ<br>НАТИСНІТЬ ✉ ДЛЯ ЛС<br>АБО ⊕ ДЛЯ ГРУПИ</div>';
        return;
    }

    chatListEl.innerHTML = '';
    for (const chat of chats) {
        const name = chat.type === 'group' ? (chat.name || 'Група') : await getChatDisplayName(chat);
        const isActive = currentChat && currentChat.id === chat.id;
        const item = document.createElement('div');
        item.className = 'chat-item' + (isActive ? ' active' : '');
        item.dataset.chatId = chat.id;
        item.innerHTML = `
            <div class="chat-item-avatar ${chat.type}">${initials(name)}</div>
            <div class="chat-item-info">
                <div class="chat-item-name">${esc(name)}</div>
                <div class="chat-item-preview">${chat.type === 'group' ? 'ГРУПА' : 'ОСОБИСТЕ'}</div>
            </div>
        `;
        item.onclick = () => openChat(chat, name);
        chatListEl.appendChild(item);
    }
};

// ── OPEN CHAT ──────────────────────────────────────────────────────────────
const openChat = async (chat, displayName) => {
    currentChat = chat;
    knownIds.clear();
    chatDiv.innerHTML = '';

    // Update UI
    noChatSelected.style.display = 'none';
    chatView.style.display = 'flex';

    const avatarClass = chat.type === 'group' ? 'group' : 'direct';
    topbarAvatar.className = `chat-topbar-avatar ${avatarClass}`;
    topbarAvatar.textContent = initials(displayName);
    topbarName.textContent = displayName;
    topbarSub.textContent = chat.type === 'group' ? 'ГРУПП​А' : 'ОСОБИСТЕ ПОВІДОМЛЕННЯ';

    // Highlight in list
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId === chat.id);
    });

    await loadChatMessages();
    subscribeRealtime();
};

// ── MESSAGES ───────────────────────────────────────────────────────────────
const loadChatMessages = async (silent = false) => {
    if (!currentChat) return;
    if (!silent) setStatus('syncing', 'SYNC...');
    const t0 = performance.now();
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', currentChat.id)
            .order('created_at', { ascending: true });

        dbLatency.textContent  = Math.round(performance.now() - t0) + 'ms';
        lastSyncEl.textContent = now();

        if (error) { setStatus('','DB ERR'); return; }
        if (data) data.forEach(renderMessage);
        if (!silent) setStatus('online','LIVE');
    } catch { setStatus('','NET ERR'); }
};

const renderMessage = (msg) => {
    if (knownIds.has(msg.id)) return;
    knownIds.add(msg.id);

    const isOwn = currentUser && msg.sender_id === currentUser.id;
    const time  = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uk-UA',{hour12:false}) : now();
    const name  = msg.sender_name || 'anon';
    const username = msg.sender_username ? '@' + msg.sender_username : name;

    const row = document.createElement('div');
    row.className = 'msg-row' + (isOwn ? ' own' : '');
    row.innerHTML = `
        <div class="msg-avatar" data-uid="${esc(msg.sender_id||'')}" title="${esc(username)}">${esc(initials(name))}</div>
        <div class="msg-right">
            <div class="msg-meta">
                <span class="msg-author" data-uid="${esc(msg.sender_id||'')}">${esc(username)}</span>
                <span class="msg-time">${time}</span>
            </div>
            <div class="msg-body">${esc(msg.content)}</div>
        </div>
    `;
    chatDiv.appendChild(row);
    chatDiv.scrollTop = chatDiv.scrollHeight;
};

// ── REALTIME ───────────────────────────────────────────────────────────────
let realtimeChannel = null;
const subscribeRealtime = () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = supabase
        .channel('chat:' + currentChat.id)
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`chat_id=eq.${currentChat.id}` }, payload => {
            if (currentUser && payload.new.sender_id === currentUser.id) {
                knownIds.add(payload.new.id); return;
            }
            renderMessage(payload.new);
        })
        .subscribe(s => {
            if (s==='SUBSCRIBED') setStatus('online','LIVE');
            if (s==='CHANNEL_ERROR') setStatus('','RT ERR');
        });
};

// ── POLLING ────────────────────────────────────────────────────────────────
const startPolling = () => {
    clearInterval(pollTimer); clearInterval(cTimer);
    pollTimer = setInterval(() => { if (currentChat) loadChatMessages(true); }, POLL_MS);
    cTimer    = setInterval(() => { countdownEl.textContent = '0.5s'; }, 500);
};

// ── SEND ───────────────────────────────────────────────────────────────────
sendBtn.onclick = async () => {
    const content = messageInput.value.trim();
    if (!content || !currentUser || !currentChat) return;
    messageInput.value = '';
    sendBtn.disabled = true;

    const { data, error } = await supabase.from('messages').insert([{
        content,
        chat_id:         currentChat.id,
        sender_id:       currentUser.id,
        sender_name:     currentUser.display_name || currentUser.username,
        sender_username: currentUser.username
    }]).select().single();

    sendBtn.disabled = false;
    if (error) { console.error(error); messageInput.value = content; }
    else if (data) renderMessage(data);
};

messageInput.addEventListener('keydown', e => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});

// ── NEW DM ─────────────────────────────────────────────────────────────────
let selectedDmUser = null;

newDmBtn.onclick = () => { selectedDmUser=null; dmSearchInput.value=''; dmSearchResults.innerHTML=''; newDmModal.classList.add('open'); dmSearchInput.focus(); };
dmCancelBtn.onclick = () => newDmModal.classList.remove('open');

let dmSearchTimer;
dmSearchInput.addEventListener('input', () => {
    clearTimeout(dmSearchTimer);
    dmSearchTimer = setTimeout(() => searchUsersModal(dmSearchInput.value, dmSearchResults, user => {
        selectedDmUser = user;
        dmSearchInput.value = '@' + user.username;
        dmSearchResults.innerHTML = '';
    }), 250);
});

dmCreateBtn.onclick = async () => {
    if (!selectedDmUser) { return; }

    // Check if DM already exists
    const { data: myMemberships } = await supabase.from('chat_members').select('chat_id').eq('user_id', currentUser.id);
    const { data: theirMemberships } = await supabase.from('chat_members').select('chat_id').eq('user_id', selectedDmUser.id);
    if (myMemberships && theirMemberships) {
        const myIds = new Set(myMemberships.map(m=>m.chat_id));
        const existing = theirMemberships.find(m => myIds.has(m.chat_id));
        if (existing) {
            const { data: existingChat } = await supabase.from('chats').select('*').eq('id', existing.chat_id).eq('type','direct').single();
            if (existingChat) {
                newDmModal.classList.remove('open');
                await loadChats();
                openChat(existingChat, '@' + selectedDmUser.username);
                return;
            }
        }
    }

    // Create new DM chat
    const { data: chat, error } = await supabase.from('chats').insert([{ type:'direct', created_by:currentUser.id }]).select().single();
    if (error || !chat) return;
    await supabase.from('chat_members').insert([{ chat_id:chat.id, user_id:currentUser.id }, { chat_id:chat.id, user_id:selectedDmUser.id }]);

    newDmModal.classList.remove('open');
    await loadChats();
    openChat(chat, '@' + selectedDmUser.username);
};

// ── NEW GROUP ──────────────────────────────────────────────────────────────
let selectedGroupMembers = [];

newGroupBtn.onclick = () => {
    selectedGroupMembers = []; groupNameInput.value=''; groupMemberSearch.value='';
    groupMemberResults.innerHTML=''; selectedMembersEl.innerHTML='';
    newGroupModal.classList.add('open'); groupNameInput.focus();
};
groupCancelBtn.onclick = () => newGroupModal.classList.remove('open');

let groupSearchTimer;
groupMemberSearch.addEventListener('input', () => {
    clearTimeout(groupSearchTimer);
    groupSearchTimer = setTimeout(() => searchUsersModal(groupMemberSearch.value, groupMemberResults, user => {
        if (!selectedGroupMembers.find(u=>u.id===user.id)) {
            selectedGroupMembers.push(user);
            renderSelectedMembers();
        }
        groupMemberSearch.value = '';
        groupMemberResults.innerHTML = '';
    }), 250);
});

const renderSelectedMembers = () => {
    selectedMembersEl.innerHTML = selectedGroupMembers.map(u => `
        <div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid var(--border2);font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--accent2);">
            @${esc(u.username)}
            <span style="cursor:pointer;color:var(--danger);margin-left:4px;" data-uid="${u.id}">✕</span>
        </div>
    `).join('');
    selectedMembersEl.querySelectorAll('[data-uid]').forEach(el => {
        el.onclick = () => { selectedGroupMembers = selectedGroupMembers.filter(u=>u.id!==el.dataset.uid); renderSelectedMembers(); };
    });
};

groupCreateBtn.onclick = async () => {
    const name = groupNameInput.value.trim();
    if (!name) return;

    const { data: chat, error } = await supabase.from('chats').insert([{ type:'group', name, created_by:currentUser.id }]).select().single();
    if (error || !chat) return;

    const members = [{ chat_id:chat.id, user_id:currentUser.id }, ...selectedGroupMembers.map(u=>({ chat_id:chat.id, user_id:u.id }))];
    await supabase.from('chat_members').insert(members);

    newGroupModal.classList.remove('open');
    await loadChats();
    openChat(chat, name);
};

// ── USER SEARCH (modal) ────────────────────────────────────────────────────
const searchUsersModal = async (query, resultsEl, onSelect) => {
    const clean = query.replace(/^@/,'').toLowerCase().trim();
    if (!clean) { resultsEl.innerHTML=''; return; }
    const { data } = await supabase.from('profiles').select('*')
        .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`).neq('id', currentUser.id).limit(6);
    if (!data || data.length === 0) { resultsEl.innerHTML='<div style="padding:8px 10px;font-family:Share Tech Mono,monospace;font-size:9px;color:var(--muted)">НЕ ЗНАЙДЕНО</div>'; return; }
    resultsEl.innerHTML = data.map(u=>`
        <div class="user-search-item" data-uid="${u.id}">
            <div class="usi-avatar">${esc(initials(u.display_name||u.username))}</div>
            <div>
                <div class="usi-name">@${esc(u.username)}</div>
                <div class="usi-display">${esc(u.display_name||'')}</div>
            </div>
        </div>
    `).join('');
    resultsEl.querySelectorAll('.user-search-item').forEach(el => {
        el.onclick = () => onSelect(data.find(u=>u.id===el.dataset.uid));
    });
};

// ── SIDEBAR USER SEARCH ────────────────────────────────────────────────────
let sideSearchTimer;
userSearchInput.addEventListener('input', () => {
    clearTimeout(sideSearchTimer);
    const q = userSearchInput.value.trim();
    if (!q) { searchResults.innerHTML=''; return; }
    sideSearchTimer = setTimeout(() => searchUsersSidebar(q), 300);
});

const searchUsersSidebar = async (query) => {
    const clean = query.replace(/^@/,'').toLowerCase();
    const { data } = await supabase.from('profiles').select('*')
        .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`).neq('id',currentUser.id).limit(8);
    if (!data||data.length===0) { searchResults.innerHTML='<div style="padding:6px 4px;font-family:Share Tech Mono,monospace;font-size:9px;color:var(--muted)">НЕ ЗНАЙДЕНО</div>'; return; }
    searchResults.innerHTML = data.map(u=>`
        <div class="user-result-item" data-uid="${u.id}" style="display:flex;align-items:center;gap:8px;padding:7px 4px;cursor:pointer;border:1px solid transparent;transition:all .15s;">
            <div style="width:26px;height:26px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-family:Share Tech Mono,monospace;font-size:11px;color:var(--bg);font-weight:bold;flex-shrink:0;">${esc(initials(u.display_name||u.username))}</div>
            <div>
                <div style="font-family:Share Tech Mono,monospace;font-size:10px;color:var(--accent2)">@${esc(u.username)}</div>
                <div style="font-size:11px;color:var(--text-dim)">${esc(u.display_name||'')}</div>
            </div>
        </div>
    `).join('');
    searchResults.querySelectorAll('[data-uid]').forEach(el=>{
        el.onmouseenter = () => el.style.background='rgba(0,212,255,.04)';
        el.onmouseleave = () => el.style.background='';
        el.onclick = () => { openProfile(el.dataset.uid); userSearchInput.value=''; searchResults.innerHTML=''; };
    });
};

// ── PROFILE PANEL ──────────────────────────────────────────────────────────
let profileUserId = null;
const openProfile = async (userId) => {
    if (!userId) return;
    profileUserId = userId;
    const { data } = await supabase.from('profiles').select('*').eq('id',userId).single();
    if (!data) return;
    profileAvatar.textContent      = initials(data.display_name||data.username);
    profileUsername.textContent    = '@' + data.username;
    profileDisplayName.textContent = data.display_name || '—';
    profilePhone.textContent       = data.phone ? data.phone.replace(/(\d{3})(\d+)(\d{2})$/,(_,a,b,c)=>a+'*'.repeat(b.length)+c) : '—';
    profileDate.textContent        = data.created_at ? new Date(data.created_at).toLocaleDateString('uk-UA') : '—';
    profilePanel.classList.add('open');
};

profileDmBtn.onclick = async () => {
    if (!profileUserId) return;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id',profileUserId).single();
    if (!profile) return;
    profilePanel.classList.remove('open');
    // Simulate DM creation
    selectedDmUser = profile;
    await dmCreateBtn.onclick();
};

closeProfileBtn.onclick = () => profilePanel.classList.remove('open');

document.addEventListener('click', e => {
    const el = e.target.closest('[data-uid]');
    if (el && el.dataset.uid && !el.closest('.modal')) openProfile(el.dataset.uid);
});

chatInfoBtn.onclick = () => {
    if (currentChat && currentChat.created_by) openProfile(currentChat.created_by);
};

// ── LOGOUT ─────────────────────────────────────────────────────────────────
logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('massenger_user');
    currentUser = null; currentChat = null; knownIds.clear(); chats = [];
    clearInterval(pollTimer); clearInterval(cTimer);
    chatDiv.innerHTML = ''; chatListEl.innerHTML = '';
    showPage(authPage); showStep(step1, 0); phoneInput.value = '';
};

// ── BOOT ───────────────────────────────────────────────────────────────────
const boot = async () => {
    // Check active Supabase Auth session first
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // Session exists — load profile by auth_id
        const { data: profile } = await supabase.from('profiles')
            .select('*')
            .eq('auth_id', session.user.id)
            .single();

        if (profile) {
            currentUser = profile;
            localStorage.setItem('massenger_user', JSON.stringify(currentUser));
            headerAvatar.textContent   = initials(currentUser.display_name||currentUser.username);
            headerUsername.textContent = '@' + currentUser.username;
            showPage(appPage);
            hideLoading();
            loadChats();
            startPolling();
            return;
        }
    }

    // Fallback: try localStorage
    const saved = localStorage.getItem('massenger_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            headerAvatar.textContent   = initials(currentUser.display_name||currentUser.username);
            headerUsername.textContent = '@' + currentUser.username;
            showPage(appPage);
            hideLoading();
            loadChats();
            startPolling();
            return;
        } catch { localStorage.removeItem('massenger_user'); }
    }

    hideLoading();
    showPage(authPage);
};

boot();
