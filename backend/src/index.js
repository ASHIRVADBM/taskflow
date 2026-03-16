const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'taskflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Initialize DB table
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      priority VARCHAR(20) DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Database initialized');
};

// GET all tasks
app.get('/api/tasks', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  res.json(rows);
});

// GET single task
app.get('/api/tasks/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

// POST create task
app.post('/api/tasks', async (req, res) => {
  const { title, description, priority } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO tasks (title, description, priority) VALUES ($1, $2, $3) RETURNING *',
    [title, description, priority || 'medium']
  );
  res.status(201).json(rows[0]);
});

// PUT update task
app.put('/api/tasks/:id', async (req, res) => {
  const { title, description, status, priority } = req.body;
  const { rows } = await pool.query(
    `UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [title, description, status, priority, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

// DELETE task
app.delete('/api/tasks/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Task not found' });
  res.json({ message: 'Task deleted' });
});

// Start server
app.listen(PORT, async () => {
  await initDB();
  console.log(`TaskFlow API running on port ${PORT}`);
});

module.exports = app;
