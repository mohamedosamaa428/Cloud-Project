require('dotenv').config();

const express = require('express');
const cors = require('cors');
const adminRoutes = require('./src/routes/admin');
const taskRoutes = require('./src/routes/tasks.routes');
const projectRoutes = require('./src/routes/projects.routes');
const commentRoutes = require('./src/routes/comments.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'mini-jira-auth API',
    status: 'ok',
    endpoints: {
      health: 'GET /health',
      admin: '/admin',
      tasks: '/api/tasks',
      projects: '/api/projects',
      comments: '/api/tasks/:taskId/comments',
    },
    note: 'Protected routes require Authorization: Bearer <Cognito access token>',
  });
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks/:taskId/comments', commentRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});