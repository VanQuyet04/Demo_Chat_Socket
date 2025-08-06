const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('chat.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER,
    room_id TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    status TEXT DEFAULT 'sent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users (id)
  )`);

  // Rooms table
  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // Room members table
  db.run(`CREATE TABLE IF NOT EXISTS room_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Message read receipts table
  db.run(`CREATE TABLE IF NOT EXISTS message_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

// JWT Secret
const JWT_SECRET = 'your-secret-key';

// Store online users
const onlineUsers = new Map();
const userSockets = new Map();

// Authentication middleware
const authenticateToken = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.userId = user.id;
    socket.username = user.username;
    next();
  });
};

// API Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
      [username, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }
      
      const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
      res.json({ token, user: { id: this.lastID, username } });
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Login failed' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  });
});

app.get('/api/users', (req, res) => {
  db.all('SELECT id, username FROM users ORDER BY username', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(users);
  });
});

app.get('/api/rooms', (req, res) => {
  db.all(`
    SELECT r.*, u.username as created_by_name 
    FROM rooms r 
    JOIN users u ON r.created_by = u.id 
    ORDER BY r.created_at DESC
  `, (err, rooms) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch rooms' });
    }
    res.json(rooms);
  });
});

app.post('/api/rooms', (req, res) => {
  const { name } = req.body;
  const userId = req.body.userId; // In real app, get from JWT token
  
  db.run('INSERT INTO rooms (name, created_by) VALUES (?, ?)', 
    [name, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create room' });
    }
    
    // Add creator as member
    db.run('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', 
      [this.lastID, userId]);
    
    res.json({ id: this.lastID, name, created_by: userId });
  });
});

app.get('/api/messages/:type/:id', (req, res) => {
  const { type, id } = req.params;
  
  let query;
  if (type === 'private') {
    // Fix: Get current user ID from query parameter
    const currentUserId = req.query.currentUserId;
    if (!currentUserId) {
      return res.status(400).json({ error: 'Current user ID required' });
    }
    
    query = `
      SELECT m.*, u.username as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE (m.sender_id = ? AND m.receiver_id = ?) 
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `;
    db.all(query, [currentUserId, id, id, currentUserId], (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
      res.json(messages);
    });
  } else if (type === 'room') {
    query = `
      SELECT m.*, u.username as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
    `;
    db.all(query, [id], (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
      res.json(messages);
    });
  }
});

// Socket.io connection
io.use(authenticateToken);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.username} (${socket.userId})`);
  
  // Add to online users
  onlineUsers.set(socket.userId, {
    id: socket.userId,
    username: socket.username,
    socketId: socket.id
  });
  userSockets.set(socket.userId, socket.id);
  
  // Broadcast online status
  io.emit('user_online', { userId: socket.userId, username: socket.username });
  
  // Send current online users to the new user
  onlineUsers.forEach((userData, userId) => {
    if (userId !== socket.userId) {
      socket.emit('user_online', { userId: userId, username: userData.username });
    }
  });
  
  // Join user's personal room for private messages
  socket.join(`user_${socket.userId}`);
  
  // Handle private message
  socket.on('private_message', (data) => {
    const { receiverId, content } = data;
    
    // Save to database
    db.run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [socket.userId, receiverId, content], function(err) {
      if (err) {
        console.error('Error saving message:', err);
        return;
      }
      
      const message = {
        id: this.lastID,
        sender_id: socket.userId,
        receiver_id: receiverId,
        content,
        sender_name: socket.username,
        status: 'sent',
        created_at: new Date().toISOString()
      };
      
      // Send to receiver if online (use room for reliability)
      io.to(`user_${receiverId}`).emit('private_message', message);
      
      // Send back to sender
      socket.emit('private_message', message);
    });
  });
  
  // Handle room message
  socket.on('room_message', (data) => {
    const { roomId, content } = data;
    
    // Save to database
    db.run('INSERT INTO messages (sender_id, room_id, content) VALUES (?, ?, ?)',
      [socket.userId, roomId, content], function(err) {
      if (err) {
        console.error('Error saving room message:', err);
        return;
      }
      
      const message = {
        id: this.lastID,
        sender_id: socket.userId,
        room_id: roomId,
        content,
        sender_name: socket.username,
        status: 'sent',
        created_at: new Date().toISOString()
      };
      
      // Broadcast to room
      io.to(`room_${roomId}`).emit('room_message', message);
    });
  });
  
  // Join room
  socket.on('join_room', (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`${socket.username} joined room ${roomId}`);
    
    // Add to room members if not already
    db.run('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)',
      [roomId, socket.userId]);
  });
  
  // Leave room
  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
    console.log(`${socket.username} left room ${roomId}`);
  });
  
  // Typing indicators
  socket.on('typing_start', (data) => {
    if (data.type === 'private') {
      io.to(`user_${data.receiverId}`).emit('typing_start', {
        userId: socket.userId,
        username: socket.username
      });
    } else if (data.type === 'room') {
      socket.to(`room_${data.roomId}`).emit('typing_start', {
        userId: socket.userId,
        username: socket.username
      });
    }
  });
  
  socket.on('typing_stop', (data) => {
    if (data.type === 'private') {
      io.to(`user_${data.receiverId}`).emit('typing_stop', {
        userId: socket.userId
      });
    } else if (data.type === 'room') {
      socket.to(`room_${data.roomId}`).emit('typing_stop', {
        userId: socket.userId
      });
    }
  });
  
  // Read receipts
  socket.on('message_seen', (data) => {
    console.log('Message seen event:', data);
    if (data.type === 'private') {
      // Use room instead of socket ID for more reliable delivery
      io.to(`user_${data.senderId}`).emit('message_seen', {
        messageId: data.messageId,
        seenBy: socket.userId,
        seenByUsername: socket.username
      });
      console.log(`Message ${data.messageId} marked as seen by ${socket.username}`);
    } else if (data.type === 'room') {
      socket.to(`room_${data.roomId}`).emit('message_seen', {
        messageId: data.messageId,
        seenBy: socket.userId,
        seenByUsername: socket.username
      });
      console.log(`Message ${data.messageId} marked as seen by ${socket.username} in room ${data.roomId}`);
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username}`);
    
    onlineUsers.delete(socket.userId);
    userSockets.delete(socket.userId);
    
    // Broadcast offline status
    io.emit('user_offline', { userId: socket.userId });
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the chat app`);
}); 