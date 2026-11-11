// server.js - Servidor de chat en tiempo real con Node.js (módulo http) y Socket.IO
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
};

// 1) Servidor HTTP básico que entrega los archivos estáticos del cliente
const httpServer = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const file = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, file));

  // Evita salir de la carpeta pública (path traversal)
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Acceso denegado');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 - Archivo no encontrado');
    }
    const type = MIME[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

// 2) Socket.IO se acopla al servidor HTTP (comunicación bidireccional)
const io = new Server(httpServer);

const users = new Map(); // socket.id -> nombre de usuario

const userList = () => Array.from(users.values());
const clean = (text, max) => String(text || '').trim().slice(0, max);

io.on('connection', (socket) => {
  console.log(`[+] Cliente conectado: ${socket.id}`);

  // Un usuario se une al chat
  socket.on('user:join', (name, ack) => {
    const username = clean(name, 20);
    if (!username) return ack && ack({ ok: false, error: 'Nombre inválido' });
    if (userList().some((u) => u.toLowerCase() === username.toLowerCase())) {
      return ack && ack({ ok: false, error: 'Ese nombre ya está en uso' });
    }
    users.set(socket.id, username);
    ack && ack({ ok: true, username });

    socket.broadcast.emit('system:message', {
      text: `${username} se unió al chat`,
      time: Date.now(),
    });
    io.emit('users:update', userList());
  });

  // Mensaje de chat: se reenvía a TODOS los clientes (incluido el emisor)
  socket.on('chat:message', (text) => {
    const username = users.get(socket.id);
    const message = clean(text, 500);
    if (!username || !message) return;
    io.emit('chat:message', { user: username, text: message, time: Date.now() });
  });

  // Indicador "está escribiendo..."
  socket.on('chat:typing', (isTyping) => {
    const username = users.get(socket.id);
    if (!username) return;
    socket.broadcast.emit('chat:typing', { user: username, isTyping: !!isTyping });
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    users.delete(socket.id);
    console.log(`[-] Cliente desconectado: ${socket.id}`);
    if (username) {
      io.emit('system:message', { text: `${username} salió del chat`, time: Date.now() });
      io.emit('chat:typing', { user: username, isTyping: false });
      io.emit('users:update', userList());
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de chat escuchando en http://localhost:${PORT}`);
});
