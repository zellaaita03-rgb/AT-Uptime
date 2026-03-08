import { useState, useEffect } from 'react'
import axios from 'axios'
import { format, formatDistanceToNow } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const API_URL = 'http://localhost:3001/api'

export default function Dashboard() {
  const [endpoints, setEndpoints] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedEndpoint, setSelectedEndpoint] = useState(null)
  const [logs, setLogs] = useState([])

  const fetchData = async () => {
    try {
      const [endpointsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/endpoints`),
        axios.get(`${API_URL}/stats`)
      ])
      setEndpoints(endpointsRes.data)
      
      const statsMap = {}
      statsRes.data.forEach(s => {
        statsMap[s.endpoint_id] = s
      })
      setStats(statsMap)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchLogs = async (endpointId) => {
    try {
      const res = await axios.get(`${API_URL}/endpoints/${endpointId}/logs?limit=50`)
      setLogs(res.data)
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  useEffect(() => {
    if (selectedEndpoint) {
      fetchLogs(selectedEndpoint.id)
      const interval = setInterval(() => fetchLogs(selectedEndpoint.id), 10000)
      return () => clearInterval(interval)
    }
  }, [selectedEndpoint])

  const getUptimeColor = (percent) => {
    if (percent >= 99) return 'var(--success)'
    if (percent >= 95) return 'var(--warning)'
    return 'var(--error)'
  }

  const chartData = logs.slice().reverse().map(log => ({
    time: format(new Date(log.checked_at), 'HH:mm'),
    responseTime: log.response_time,
    status: log.status
  }))

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="page">
      <nav className="nav">
        <a href="/" className="nav-brand">
          <div className="nav-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          AT-Uptime
        </a>
        <div className="nav-links">
          <a href="/login" className="nav-link">Admin</a>
        </div>
      </nav>

      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {endpoints.filter(e => e.last_status === 1).length}/{endpoints.length} services online
        </p>
      </div>

      {endpoints.length === 0 ? (
        <div className="empty-state glass-card">
          <div className="empty-icon">📊</div>
          <h3 className="empty-title">No endpoints configured</h3>
          <p>Add endpoints in the admin panel to start monitoring.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: '32px' }}>
            {endpoints.map((endpoint, index) => (
              <div 
                key={endpoint.id} 
                className={`endpoint-card glass-card fade-in stagger-${index + 1}`}
                onClick={() => setSelectedEndpoint(endpoint)}
                style={{ cursor: 'pointer' }}
              >
                <div className="endpoint-header">
                  <div className="endpoint-info">
                    <h3 className="endpoint-name">{endpoint.name}</h3>
                    <span className="endpoint-url">{endpoint.url}</span>
                  </div>
                  <span className={`status-badge ${endpoint.last_status === 1 ? 'status-up' : 'status-down'}`}>
                    <span className="status-dot"></span>
                    {endpoint.last_status === 1 ? 'UP' : 'DOWN'}
                  </span>
                </div>

                <div className="endpoint-stats">
                  <div className="endpoint-stat">
                    <span className="endpoint-stat-value">
                      {endpoint.last_response_time ? `${endpoint.last_response_time}ms` : '-'}
                    </span>
                    <span className="endpoint-stat-label">Response</span>
                  </div>
                  <div className="endpoint-stat">
                    <span className="endpoint-stat-value" style={{ color: getUptimeColor(stats[endpoint.id]?.uptime_percent || 0) }}>
                      {stats[endpoint.id]?.uptime_percent || 0}%
                    </span>
                    <span className="endpoint-stat-label">Uptime</span>
                  </div>
                  <div className="endpoint-stat">
                    <span className="endpoint-stat-value">
                      {stats[endpoint.id]?.total_checks || 0}
                    </span>
                    <span className="endpoint-stat-label">Checks</span>
                  </div>
                </div>

                <div className="endpoint-footer">
                  <span className="endpoint-last-check">
                    Last check: {endpoint.last_checked 
                      ? formatDistanceToNow(new Date(endpoint.last_checked), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {selectedEndpoint && (
            <div className="detail-panel glass-card">
              <div className="detail-header">
                <div>
                  <h2>{selectedEndpoint.name}</h2>
                  <span className="endpoint-url">{selectedEndpoint.url}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEndpoint(null)}>
                  Close
                </button>
              </div>

              <div className="tabs">
                <button className="tab active">Response Time</button>
              </div>

              <div className="chart-container">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <XAxis 
                        dataKey="time" 
                        stroke="#606070" 
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#606070" 
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(value) => `${value}ms`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                        labelStyle={{ color: 'var(--text-secondary)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="responseTime" 
                        stroke="var(--accent-primary)" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: 'var(--accent-primary)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <p>No data available yet</p>
                  </div>
                )}
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Response Time</th>
                      <th>Status Code</th>
                      <th>Error</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 20).map(log => (
                      <tr key={log.id}>
                        <td>
                          <span className={`status-badge ${log.status === 1 ? 'status-up' : 'status-down'}`}>
                            <span className="status-dot"></span>
                            {log.status === 1 ? 'UP' : 'DOWN'}
                          </span>
                        </td>
                        <td>{log.response_time ? `${log.response_time}ms` : '-'}</td>
                        <td>{log.status_code || '-'}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.error_message || '-'}
                        </td>
                        <td>{format(new Date(log.checked_at), 'MMM d, HH:mm:ss')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .endpoint-card {
          padding: 24px;
        }

        .endpoint-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .endpoint-info {
          flex: 1;
          min-width: 0;
        }

        .endpoint-name {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .endpoint-url {
          font-size: 12px;
          color: var(--text-muted);
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .endpoint-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
        }

        .endpoint-stat {
          display: flex;
          flex-direction: column;
        }

        .endpoint-stat-value {
          font-size: 18px;
          font-weight: 600;
        }

        .endpoint-stat-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .endpoint-footer {
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .endpoint-last-check {
          font-size: 12px;
          color: var(--text-muted);
        }

        .detail-panel {
          padding: 24px;
          margin-top: 24px;
        }

        .detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .detail-header h2 {
          font-size: 20px;
          margin-bottom: 4px;
        }

        .chart-container {
          height: 200px;
          margin-bottom: 24px;
        }
      `}</style>
    </div>
  )
}
