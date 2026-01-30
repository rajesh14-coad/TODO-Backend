require('dotenv').config(); // Sabse pehle env variables load honge
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const goalRoutes = require('./routes/goalRoutes');
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

// Fallback/Alias Routes (Handles requests without /api prefix)
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/goals', goalRoutes);

// Root Route (Testing ke liye)
app.get('/', (req, res) => {
  res.send('API is running successfully...');
});

// Error Handlers
app.use(notFound);
app.use(errorHandler);

// Port setup
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});