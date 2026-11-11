// client.js - Lógica del cliente de chat con Socket.IO
const socket = io(); // se conecta al servidor que sirvió la página

const $ = (id) => document.getElementById(id);
const loginBox = $('login'), loginForm = $('login-form'), usernameInput = $('username');
const loginError = $('login-error'), app = $('app');
const messages = $('messages'), chatForm = $('chat-form'), input = $('input');
const usersList = $('users'), count = $('count'), typingBox = $('typing');
const statusDot = $('status'), me = $('me');

let myName = '';
let typingTimeout = null;
const typingUsers = new Set();

const formatTime = (t) =>
  new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

function addMessage({ user, text, time }, system = false) {
  const li = document.createElement('li');
  if (system) {
    li.className = 'system';
    li.textContent = text;
  } else {
    li.className = user === myName ? 'msg mine' : 'msg';
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${user} · ${formatTime(time)}`;
    const body = document.createElement('span');
    body.className = 'text';
    body.textContent = text; // textContent evita inyección de HTML (XSS)
    li.append(meta, body);
  }
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

function renderTyping() {
  const names = Array.from(typingUsers);
  typingBox.textContent = names.length === 0 ? '' :
    names.length === 1 ? `${names[0]} está escribiendo...` : `${names.join(', ')} están escribiendo...`;
}

// --- Ingreso ---
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  socket.emit('user:join', usernameInput.value, (res) => {
    if (!res.ok) { loginError.textContent = res.error; return; }
    myName = res.username;
    me.textContent = `Tú: ${myName}`;
    loginBox.classList.add('hidden');
    app.classList.remove('hidden');
    input.focus();
  });
});

// --- Envío de mensajes ---
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat:message', text);
  socket.emit('chat:typing', false);
  input.value = '';
});

input.addEventListener('input', () => {
  socket.emit('chat:typing', true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('chat:typing', false), 1500);
});

// --- Eventos recibidos del servidor ---
socket.on('chat:message', (msg) => addMessage(msg));
socket.on('system:message', (msg) => addMessage(msg, true));
socket.on('users:update', (list) => {
  count.textContent = list.length;
  usersList.innerHTML = '';
  list.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name + (name === myName ? ' (tú)' : '');
    usersList.appendChild(li);
  });
});
socket.on('chat:typing', ({ user, isTyping }) => {
  isTyping ? typingUsers.add(user) : typingUsers.delete(user);
  renderTyping();
});

// --- Estado de la conexión ---
socket.on('connect', () => statusDot.classList.add('online'));
socket.on('disconnect', () => {
  statusDot.classList.remove('online');
  addMessage({ text: 'Conexión perdida. Reintentando...' }, true);
});
socket.io.on('reconnect', () => {
  // Al reconectar el servidor nos olvidó: volvemos a registrar el nombre
  if (myName) socket.emit('user:join', myName, () => {});
});
