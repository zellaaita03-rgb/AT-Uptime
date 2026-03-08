# AT-Uptime

A modern server and application uptime monitoring dashboard built with Node.js, Express, SQLite, and React + Vite.

![AT-Uptime Dashboard](https://via.placeholder.com/800x400/1a1a24/6366f1?text=AT-Uptime)

## Features

- 🌐 **Monitor HTTP/HTTPS endpoints** and **ping** servers
- 📊 **Real-time dashboard** with response time charts
- 🔐 **Admin panel** secured with username/password (default: admin/admin)
- ➕ **Add, edit, and delete** monitored endpoints
- 📈 **Uptime statistics** and check history
- 📥 **Export reports** to CSV or PDF
- 🎨 **Modern dark theme** with glassmorphism design (2025-2026 trends)
- 🗄️ **SQLite database** for persistent storage

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Frontend**: React 18, Vite
- **Charts**: Recharts
- **PDF Generation**: PDFKit
- **HTTP Client**: Axios

## Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
cd AT-Uptime
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Start the Application

```bash
# Start the backend server (runs on port 3001)
npm start

# In another terminal, start the frontend (runs on port 5173)
cd client && npm run dev
```

### 3. Access the Dashboard

- **Dashboard**: http://localhost:5173
- **Admin Panel**: http://localhost:5173/admin
- **Login**: Username: `admin`, Password: `admin`

## Configuration

### Default Admin Credentials
- Username: `admin`
- Password: `admin`

Change these in the Admin Panel under Settings.

### Check Interval
Default check interval is 60 seconds. You can modify this per endpoint or globally in Settings.

### Supported Endpoint Types

1. **HTTP/HTTPS**: Monitors web servers, APIs, websites
2. **Ping**: Monitors server availability via ICMP ping

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/login` | Authenticate | No |
| GET | `/api/endpoints` | List all endpoints | No |
| POST | `/api/endpoints` | Add endpoint | Yes |
| PUT | `/api/endpoints/:id` | Update endpoint | Yes |
| DELETE | `/api/endpoints/:id` | Delete endpoint | Yes |
| GET | `/api/endpoints/:id/logs` | Get check logs | No |
| GET | `/api/stats` | Get uptime statistics | No |
| GET | `/api/export/csv` | Export to CSV | Yes |
| GET | `/api/export/pdf` | Export to PDF | Yes |

## Project Structure

```
AT-Uptime/
├── server.js          # Express backend
├── package.json       # Backend dependencies
├── uptime.db          # SQLite database (created automatically)
├── client/
│   ├── src/
│   │   ├── App.jsx       # Main React app
│   │   ├── main.jsx      # Entry point
│   │   ├── index.css     # Global styles
│   │   └── pages/
│   │       ├── Dashboard.jsx  # Main dashboard
│   │       ├── Admin.jsx       # Admin panel
│   │       └── Login.jsx       # Login page
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Screenshots

### Dashboard
- Grid of endpoint cards showing status (UP/DOWN)
- Response time and uptime percentage
- Click to view detailed history and charts

### Admin Panel
- Add/edit/delete endpoints
- Configure check intervals
- Export reports to CSV/PDF
- Change admin credentials

## License

MIT
