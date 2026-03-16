import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PRIORITY_COLORS = {
  high:   { bg: '#ff3b3b22', border: '#ff3b3b', text: '#ff3b3b' },
  medium: { bg: '#f5a62322', border: '#f5a623', text: '#f5a623' },
  low:    { bg: '#00d4aa22', border: '#00d4aa', text: '#00d4aa' },
};

const STATUS_COLORS = {
  pending:     '#888',
  'in-progress': '#f5a623',
  completed:   '#00d4aa',
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks`);
      setTasks(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const createTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', description: '', priority: 'medium' });
    fetchTasks();
  };

  const updateStatus = async (id, status) => {
    const task = tasks.find(t => t.id === id);
    await fetch(`${API_URL}/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status }),
    });
    fetchTasks();
  };

  const deleteTask = async (id) => {
    await fetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  const filtered = tasks.filter(t => filter === 'all' || t.status === filter);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoMark}>◈</span>
          <span style={styles.logoText}>TASKFLOW</span>
        </div>
        <div style={styles.stats}>
          <span style={styles.statBadge}>{tasks.length} total</span>
          <span style={{ ...styles.statBadge, color: '#00d4aa' }}>
            {tasks.filter(t => t.status === 'completed').length} done
          </span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Create Task Form */}
        <section style={styles.createCard}>
          <h2 style={styles.sectionTitle}>NEW TASK</h2>
          <form onSubmit={createTask} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Task title..."
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              style={{ ...styles.input, height: 72, resize: 'vertical' }}
              placeholder="Description (optional)..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
            <div style={styles.formRow}>
              <select
                style={styles.select}
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">↓ Low Priority</option>
                <option value="medium">→ Medium Priority</option>
                <option value="high">↑ High Priority</option>
              </select>
              <button type="submit" style={styles.btn}>＋ ADD TASK</button>
            </div>
          </form>
        </section>

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          {['all','pending','in-progress','completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Task List */}
        {loading ? (
          <div style={styles.loading}>Loading tasks...</div>
        ) : (
          <div style={styles.taskGrid}>
            {filtered.length === 0 && (
              <div style={styles.empty}>No tasks yet. Create one above ↑</div>
            )}
            {filtered.map(task => (
              <div key={task.id} style={styles.taskCard}>
                <div style={styles.taskHeader}>
                  <span style={{
                    ...styles.priorityTag,
                    background: PRIORITY_COLORS[task.priority]?.bg,
                    border: `1px solid ${PRIORITY_COLORS[task.priority]?.border}`,
                    color: PRIORITY_COLORS[task.priority]?.text,
                  }}>
                    {task.priority?.toUpperCase()}
                  </span>
                  <span style={{ ...styles.statusDot, background: STATUS_COLORS[task.status] }} />
                </div>
                <h3 style={styles.taskTitle}>{task.title}</h3>
                {task.description && <p style={styles.taskDesc}>{task.description}</p>}
                <div style={styles.taskFooter}>
                  <select
                    style={styles.statusSelect}
                    value={task.status}
                    onChange={e => updateStatus(task.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button onClick={() => deleteTask(task.id)} style={styles.deleteBtn}>✕</button>
                </div>
                <div style={styles.taskDate}>
                  {new Date(task.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  app: { minHeight: '100vh', background: '#0a0a0f', color: '#e8e8f0', fontFamily: "'Syne', sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '24px 40px', borderBottom: '1px solid #1e1e2e', position: 'sticky', top: 0,
    background: '#0a0a0f', zIndex: 10 },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  logoMark: { fontSize: 28, color: '#7c3aed' },
  logoText: { fontSize: 22, fontWeight: 800, letterSpacing: 4, color: '#e8e8f0' },
  stats: { display: 'flex', gap: 12 },
  statBadge: { padding: '4px 12px', background: '#1e1e2e', borderRadius: 20,
    fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#888' },
  main: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
  createCard: { background: '#12121c', border: '1px solid #1e1e2e', borderRadius: 16,
    padding: 32, marginBottom: 32 },
  sectionTitle: { fontSize: 11, fontWeight: 600, letterSpacing: 4, color: '#7c3aed',
    marginBottom: 20, fontFamily: "'DM Mono', monospace" },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8,
    padding: '12px 16px', color: '#e8e8f0', fontSize: 15, fontFamily: "'Syne', sans-serif",
    outline: 'none', transition: 'border-color 0.2s' },
  formRow: { display: 'flex', gap: 12 },
  select: { flex: 1, background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8,
    padding: '12px 16px', color: '#e8e8f0', fontSize: 14, fontFamily: "'Syne', sans-serif" },
  btn: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px 24px', fontSize: 13, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' },
  filterBar: { display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' },
  filterBtn: { padding: '6px 16px', background: 'transparent', border: '1px solid #1e1e2e',
    borderRadius: 20, color: '#555', fontSize: 11, letterSpacing: 2, cursor: 'pointer',
    fontFamily: "'DM Mono', monospace" },
  filterBtnActive: { borderColor: '#7c3aed', color: '#7c3aed', background: '#7c3aed15' },
  taskGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  taskCard: { background: '#12121c', border: '1px solid #1e1e2e', borderRadius: 12,
    padding: 20, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' },
  taskHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  priorityTag: { fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
    letterSpacing: 1, fontFamily: "'DM Mono', monospace" },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  taskTitle: { fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.4 },
  taskDesc: { fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 },
  taskFooter: { display: 'flex', gap: 8, marginTop: 4 },
  statusSelect: { flex: 1, background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 6,
    padding: '6px 10px', color: '#aaa', fontSize: 12, fontFamily: "'DM Mono', monospace" },
  deleteBtn: { background: '#ff3b3b15', border: '1px solid #ff3b3b30', color: '#ff3b3b',
    borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 },
  taskDate: { fontSize: 10, color: '#444', fontFamily: "'DM Mono', monospace" },
  loading: { textAlign: 'center', color: '#444', padding: 60, fontFamily: "'DM Mono', monospace" },
  empty: { gridColumn: '1/-1', textAlign: 'center', color: '#333', padding: 60,
    fontFamily: "'DM Mono', monospace", fontSize: 14 },
};
