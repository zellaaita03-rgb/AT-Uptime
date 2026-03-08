import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import axios from 'axios';
import ping from 'ping';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new Database('uptime.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'http',
    interval INTEGER DEFAULT 60,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id INTEGER NOT NULL,
    status INTEGER,
    response_time INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Initialize default settings
const initSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
initSetting.run('check_interval', '60');
initSetting.run('admin_username', 'admin');
initSetting.run('admin_password', 'admin');

// Auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = credentials.split(':');
  
  const user = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_username');
  const pass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
  
  if (username === user.value && password === pass.value) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
};

// Check endpoint status
async function checkEndpoint(endpoint) {
  const startTime = Date.now();
  
  try {
    if (endpoint.type === 'ping') {
      const result = await ping.promise.probe(endpoint.url, {
        timeout: 10,
      });
      
      return {
        status: result.alive ? 1 : 0,
        response_time: result.alive ? Math.round(result.time) : null,
        status_code: result.alive ? 200 : 0,
        error_message: result.alive ? null : 'Host unreachable'
      };
    } else {
      const response = await axios.get(endpoint.url, {
        timeout: 10000,
        validateStatus: () => true,
        httpAgent: new (require('http').Agent)({ keepAlive: true }),
        httpsAgent: new (require('https').Agent)({ keepAlive: true }),
      });
      
      return {
        status: response.status >= 200 && response.status < 400 ? 1 : 0,
        response_time: Date.now() - startTime,
        status_code: response.status,
        error_message: null
      };
    }
  } catch (error) {
    return {
      status: 0,
      response_time: null,
      status_code: null,
      error_message: error.message
    };
  }
}

// API Routes

// Login check (public)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_username');
  const pass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
  
  if (username === user.value && password === pass.value) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Get all endpoints
app.get('/api/endpoints', (req, res) => {
  const endpoints = db.prepare(`
    SELECT e.*, 
      (SELECT status FROM logs WHERE endpoint_id = e.id ORDER BY checked_at DESC LIMIT 1) as last_status,
      (SELECT response_time FROM logs WHERE endpoint_id = e.id ORDER BY checked_at DESC LIMIT 1) as last_response_time,
      (SELECT checked_at FROM logs WHERE endpoint_id = e.id ORDER BY checked_at DESC LIMIT 1) as last_checked
    FROM endpoints e 
    WHERE e.is_active = 1
    ORDER BY e.position ASC, e.id ASC
  `).all();
  res.json(endpoints);
});

// Get single endpoint
app.get('/api/endpoints/:id', (req, res) => {
  const endpoint = db.prepare('SELECT * FROM endpoints WHERE id = ?').get(req.params.id);
  if (endpoint) {
    res.json(endpoint);
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Add endpoint (protected)
app.post('/api/endpoints', authenticate, (req, res) => {
  const { name, url, type, interval } = req.body;
  
  const maxPos = db.prepare('SELECT MAX(position) as max FROM endpoints').get();
  const position = (maxPos.max || 0) + 1;
  
  const stmt = db.prepare(`
    INSERT INTO endpoints (name, url, type, interval, position) 
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(name, url, type || 'http', interval || 60, position);
  
  // Immediately check the new endpoint
  const endpoint = db.prepare('SELECT * FROM endpoints WHERE id = ?').get(result.lastInsertRowid);
  checkEndpoint(endpoint).then(result => {
    db.prepare(`
      INSERT INTO logs (endpoint_id, status, response_time, status_code, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(endpoint.id, result.status, result.response_time, result.status_code, result.error_message);
  });
  
  res.json({ id: result.lastInsertRowid, success: true });
});

// Update endpoint (protected)
app.put('/api/endpoints/:id', authenticate, (req, res) => {
  const { name, url, type, interval, position, is_active } = req.body;
  
  const stmt = db.prepare(`
    UPDATE endpoints 
    SET name = ?, url = ?, type = ?, interval = ?, position = ?, is_active = ?
    WHERE id = ?
  `);
  
  stmt.run(name, url, type, interval, position, is_active !== undefined ? is_active : 1, req.params.id);
  res.json({ success: true });
});

// Delete endpoint (protected)
app.delete('/api/endpoints/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM logs WHERE endpoint_id = ?').run(req.params.id);
  db.prepare('DELETE FROM endpoints WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get logs for an endpoint
app.get('/api/endpoints/:id/logs', (req, res) => {
  const { limit = 100, start, end } = req.query;
  
  let query = 'SELECT * FROM logs WHERE endpoint_id = ?';
  const params = [req.params.id];
  
  if (start) {
    query += ' AND checked_at >= ?';
    params.push(start);
  }
  if (end) {
    query += ' AND checked_at <= ?';
    params.push(end);
  }
  
  query += ' ORDER BY checked_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// Get all logs (for reporting)
app.get('/api/logs', authenticate, (req, res) => {
  const { limit = 1000, start, end } = req.query;
  
  let query = 'SELECT l.*, e.name as endpoint_name, e.url as endpoint_url FROM logs l JOIN endpoints e ON l.endpoint_id = e.id';
  const params = [];
  
  if (start) {
    query += ' WHERE l.checked_at >= ?';
    params.push(start);
  }
  if (end) {
    query += query.includes('WHERE') ? ' AND l.checked_at <= ?' : ' WHERE l.checked_at <= ?';
    params.push(end);
  }
  
  query += ' ORDER BY l.checked_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// Get statistics
app.get('/api/stats', (req, res) => {
  const endpoints = db.prepare('SELECT id FROM endpoints WHERE is_active = 1').all();
  
  const stats = endpoints.map(ep => {
    const total = db.prepare('SELECT COUNT(*) as count FROM logs WHERE endpoint_id = ?').get(ep.id);
    const up = db.prepare('SELECT COUNT(*) as count FROM logs WHERE endpoint_id = ? AND status = 1').get(ep.id);
    const avgResponse = db.prepare('SELECT AVG(response_time) as avg FROM logs WHERE endpoint_id = ? AND response_time IS NOT NULL').get(ep.id);
    
    return {
      endpoint_id: ep.id,
      total_checks: total.count,
      uptime_count: up.count,
      uptime_percent: total.count > 0 ? ((up.count / total.count) * 100).toFixed(2) : 0,
      avg_response_time: avgResponse.avg ? Math.round(avgResponse.avg) : null
    };
  });
  
  res.json(stats);
});

// Export to CSV
app.get('/api/export/csv', authenticate, (req, res) => {
  const { start, end } = req.query;
  
  let query = 'SELECT l.*, e.name as endpoint_name, e.url as endpoint_url FROM logs l JOIN endpoints e ON l.endpoint_id = e.id';
  const params = [];
  
  if (start) {
    query += ' WHERE l.checked_at >= ?';
    params.push(start);
  }
  if (end) {
    query += query.includes('WHERE') ? ' AND l.checked_at <= ?' : ' WHERE l.checked_at <= ?';
    params.push(end);
  }
  
  query += ' ORDER BY l.checked_at DESC';
  
  const logs = db.prepare(query).all(...params);
  
  const headers = 'Endpoint,URL,Status,Response Time (ms),Status Code,Error,Checked At\n';
  const rows = logs.map(l => 
    `"${l.endpoint_name}","${l.endpoint_url}","${l.status === 1 ? 'UP' : 'DOWN'}","${l.response_time || ''}","${l.status_code || ''}","${l.error_message || ''}","${l.checked_at}"`
  ).join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=uptime-report.csv');
  res.send(headers + rows);
});

// Export to PDF
app.get('/api/export/pdf', authenticate, (req, res) => {
  const { start, end } = req.query;
  
  let query = 'SELECT l.*, e.name as endpoint_name, e.url as endpoint_url FROM logs l JOIN endpoints e ON l.endpoint_id = e.id';
  const params = [];
  
  if (start) {
    query += ' WHERE l.checked_at >= ?';
    params.push(start);
  }
  if (end) {
    query += query.includes('WHERE') ? ' AND l.checked_at <= ?' : ' WHERE l.checked_at <= ?';
    params.push(end);
  }
  
  query += ' ORDER BY l.checked_at DESC LIMIT 500';
  
  const logs = db.prepare(query).all(...params);
  
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=uptime-report.pdf');
  
  doc.pipe(res);
  
  // Title
  doc.fontSize(24).fillColor('#2563eb').text('AT-Uptime Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  
  if (start || end) {
    let dateRange = 'Date Range: ';
    if (start) dateRange += `From ${start}`;
    if (end) dateRange += ` To ${end}`;
    doc.text(dateRange, { align: 'center' });
  }
  
  doc.moveDown();
  
  // Summary
  const endpoints = db.prepare('SELECT id, name, url FROM endpoints').all();
  doc.fontSize(14).fillColor('#1e293b').text('Uptime Summary');
  doc.moveDown(0.5);
  
  endpoints.forEach(ep => {
    const total = db.prepare('SELECT COUNT(*) as count FROM logs WHERE endpoint_id = ?').get(ep.id);
    const up = db.prepare('SELECT COUNT(*) as count FROM logs WHERE endpoint_id = ? AND status = 1').get(ep.id);
    const uptime = total.count > 0 ? ((up.count / total.count) * 100).toFixed(2) : 0;
    
    doc.fontSize(10).fillColor('#334155')
       .text(`${ep.name} (${ep.url})`)
       .fillColor(uptime >= 99 ? '#16a34a' : uptime >= 95 ? '#eab308' : '#dc2626')
       .text(`   Uptime: ${uptime}% (${up.count}/${total.count} checks)`);
    doc.moveDown(0.3);
  });
  
  doc.moveDown();
  
  // Detailed logs
  doc.fontSize(14).fillColor('#1e293b').text('Recent Checks');
  doc.moveDown(0.5);
  
  doc.fontSize(8).fillColor('#64748b');
  logs.slice(0, 50).forEach(l => {
    const statusColor = l.status === 1 ? '#16a34a' : '#dc2626';
    const status = l.status === 1 ? 'UP' : 'DOWN';
    doc.fillColor('#475569')
       .text(`${l.checked_at} | `, { continued: true })
       .fillColor(statusColor)
       .text(status, { continued: true })
       .fillColor('#475569')
       .text(` | ${l.response_time || '-'}ms | ${l.endpoint_name}`);
  });
  
  doc.end();
});

// Manual check trigger
app.post('/api/check/:id', async (req, res) => {
  const endpoint = db.prepare('SELECT * FROM endpoints WHERE id = ?').get(req.params.id);
  
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  const result = await checkEndpoint(endpoint);
  
  db.prepare(`
    INSERT INTO logs (endpoint_id, status, response_time, status_code, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(endpoint.id, result.status, result.response_time, result.status_code, result.error_message);
  
  res.json(result);
});

// Update settings
app.put('/api/settings', authenticate, (req, res) => {
  const { admin_username, admin_password, check_interval } = req.body;
  
  if (admin_username) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(admin_username, 'admin_username');
  }
  if (admin_password) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(admin_password, 'admin_password');
  }
  if (check_interval) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(check_interval.toString(), 'check_interval');
  }
  
  res.json({ success: true });
});

// Get settings (public - just check_interval)
app.get('/api/settings', (req, res) => {
  const interval = db.prepare('SELECT value FROM settings WHERE key = ?').get('check_interval');
  res.json({ check_interval: interval ? parseInt(interval.value) : 60 });
});

// Background checker
async function runChecks() {
  const endpoints = db.prepare('SELECT * FROM endpoints WHERE is_active = 1').all();
  
  for (const endpoint of endpoints) {
    const result = await checkEndpoint(endpoint);
    
    db.prepare(`
      INSERT INTO logs (endpoint_id, status, response_time, status_code, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(endpoint.id, result.status, result.response_time, result.status_code, result.error_message);
    
    // Keep only last 1000 logs per endpoint
    db.prepare(`
      DELETE FROM logs WHERE endpoint_id = ? AND id NOT IN (
        SELECT id FROM logs WHERE endpoint_id = ? ORDER BY checked_at DESC LIMIT 1000
      )
    `).run(endpoint.id, endpoint.id);
  }
}

// Start monitoring
const intervalSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('check_interval');
const checkInterval = (intervalSetting ? parseInt(intervalSetting.value) : 60) * 1000;

setInterval(runChecks, checkInterval);

// Initial check after 5 seconds
setTimeout(runChecks, 5000);

app.listen(PORT, () => {
  console.log(`AT-Uptime server running on http://localhost:${PORT}`);
});
