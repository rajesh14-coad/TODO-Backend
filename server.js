require('dotenv').config(); // Sabse pehle env variables load honge
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const PersonalMessage = require('./models/PersonalMessage');
const User = require('./models/userModel'); // Import User model for Presence
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const goalRoutes = require('./routes/goalRoutes');
const teamRoutes = require('./routes/teamRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Database se connect karne ka function call
connectDB();

const app = express();

// Middlewares
const allowedOrigins = [
  'https://todo-front-three-umber.vercel.app',  // Production Vercel URL
  'http://localhost:5173',  // Local development (Vite default)
  'http://localhost:3000'   // Alternative local port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/teams', teamRoutes);

// Fallback/Alias Routes (Handles requests without /api prefix)
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/goals', goalRoutes);
app.use('/teams', teamRoutes);

// Root Route (Testing ke liye)
app.get('/', (req, res) => {
  res.send('API is running successfully...');
});

// Error Handlers
app.use(notFound);
app.use(errorHandler);

// Port setup
const PORT = process.env.PORT || 5001;

const httpServer = http.createServer(app);

// Socket.io Setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// Map to store userId -> socketId relation for presence
const onlineUsers = new Map();

// 🔒 Socket Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    if (!token) return next(new Error('Authentication error: No token provided'));

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;

    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) return next(new Error('Authentication error: User not found'));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User Presence: Join Logic
  socket.on('user_connected', async (userId) => {
    if (!userId) return;

    onlineUsers.set(socket.id, userId);

    // Update DB status
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('user_status_change', { userId, isOnline: true });
    } catch (e) {
      console.error('Error updating status:', e);
    }
  });

  socket.on('join_team', (teamId) => {
    socket.join(teamId);
    console.log(`Socket ${socket.id} joined team ${teamId}`);
  });

  socket.on('send_message', async (data) => {
    const { teamId, sender, text, clientUUID } = data;
    try {
      const newMessage = await Message.create({ teamId, sender, text });
      // Fetch sender details (username & profilePicture)
      const fullMessage = await newMessage.populate('sender', 'username profilePicture');

      const response = fullMessage.toObject();
      if (clientUUID) response.clientUUID = clientUUID; // Echo back UUID

      io.to(teamId).emit('receive_message', response);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Team Typing Events
  socket.on('typing_start', ({ teamId, username }) => {
    socket.to(teamId).emit('typing_start', { username });
  });

  socket.on('typing_stop', ({ teamId, username }) => {
    socket.to(teamId).emit('typing_stop', { username });
  });

  // Message Read Receipt
  socket.on('message_read', ({ teamId, messageId, readerId }) => {
    socket.to(teamId).emit('message_read', { messageId, readerId });
  });

  // Personal Chat Logic
  socket.on('join_personal_chat', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined personal room ${roomId}`);
  });

  socket.on('send_personal_message', async (data) => {
    const { roomId, receiver, text, clientUUID } = data;
    const sender = socket.user.id;
    const ChatConnection = require('./models/ChatConnection');

    try {
      // Chat Lock Logic: Verify connection is accepted
      const connection = await ChatConnection.findOne({ roomId });
      if (!connection || connection.status !== 'accepted') {
        socket.emit('error', { message: 'Chat request not accepted yet.' });
        return;
      }

      const newMessage = await PersonalMessage.create({
        roomId,
        sender,
        receiver,
        text,
        read: false
      });
      // Populate sender details for frontend display
      const fullMessage = await newMessage.populate('sender', 'username profilePicture');

      const response = fullMessage.toObject();
      if (clientUUID) response.clientUUID = clientUUID;

      io.to(roomId).emit('receive_personal_message', response);

    } catch (error) {
      console.error('Error sending personal message:', error);
    }
  });

  // Personal Chat Typing (Room based)
  // Assuming frontend emits 'typing_start_personal' with roomId
  socket.on('typing_start_personal', ({ roomId, username }) => {
    socket.to(roomId).emit('typing_start_personal', { username });
  });

  socket.on('typing_stop_personal', ({ roomId, username }) => {
    socket.to(roomId).emit('typing_stop_personal', { username });
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    const userId = onlineUsers.get(socket.id);

    if (userId) {
      onlineUsers.delete(socket.id);
      // Update DB
      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date()
        });
        io.emit('user_status_change', { userId, isOnline: false, lastSeen: new Date() });
      } catch (e) {
        console.error('Error updating disconnect status:', e);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});