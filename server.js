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
app.use(cors({
  origin: 'todo-front-three-umber.vercel.app', // Yahan apna Vercel URL dalein
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/goals', goalRoutes);

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