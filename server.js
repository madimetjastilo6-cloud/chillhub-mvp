require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();

function publicUsers(){
  return [...users.values()].map(u => ({ id:u.id, name:u.name, role:u.role, country:u.country, avatar:u.avatar, online:true, coins:u.coins, tickets:u.tickets }));
}
function hosts(){ return publicUsers().filter(u => u.role === 'host'); }

io.on('connection', socket => {
  socket.on('register', profile => {
    const clean = {
      id: socket.id,
      name: String(profile.name || 'Guest').slice(0,24),
      role: profile.role === 'host' ? 'host' : 'user',
      country: profile.country || 'South Africa',
      avatar: profile.avatar || (profile.role === 'host' ? '💃' : '🙂'),
      coins: Number(profile.coins || 20),
      tickets: Number(profile.tickets || 3)
    };
    users.set(socket.id, clean);
    socket.emit('me', clean);
    io.emit('hosts', hosts());
    io.emit('users', publicUsers());
  });

  socket.on('change-role', role => {
    const u = users.get(socket.id); if(!u) return;
    u.role = role === 'host' ? 'host' : 'user';
    u.avatar = u.role === 'host' ? '💃' : '🙂';
    users.set(socket.id, u);
    socket.emit('me', u);
    io.emit('hosts', hosts());
  });

  socket.on('get-hosts', () => socket.emit('hosts', hosts()));

  socket.on('call-host', ({hostId}) => {
    const caller = users.get(socket.id); const host = users.get(hostId);
    if(!caller || !host) return socket.emit('call-error', 'Host is offline.');
    io.to(hostId).emit('incoming-call', { from: socket.id, caller });
  });
  socket.on('accept-call', ({to}) => io.to(to).emit('call-accepted', { from: socket.id, host: users.get(socket.id) }));
  socket.on('reject-call', ({to}) => io.to(to).emit('call-rejected'));
  socket.on('webrtc-offer', ({to, offer}) => io.to(to).emit('webrtc-offer', { from: socket.id, offer }));
  socket.on('webrtc-answer', ({to, answer}) => io.to(to).emit('webrtc-answer', { from: socket.id, answer }));
  socket.on('webrtc-ice', ({to, candidate}) => io.to(to).emit('webrtc-ice', { from: socket.id, candidate }));
  socket.on('end-call', ({to}) => io.to(to).emit('call-ended'));

  socket.on('gift', ({to, gift}) => io.to(to).emit('gift', { from: users.get(socket.id)?.name || 'User', gift }));

  socket.on('disconnect', () => { users.delete(socket.id); io.emit('hosts', hosts()); });
});


// Friendly routes for deployment
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/user', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`ChillHub upgraded MVP running on http://localhost:${PORT}`));
