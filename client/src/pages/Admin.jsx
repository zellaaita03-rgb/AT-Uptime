import { useState, useEffect } from 'react'
import axios from 'axios'
import { format } from 'date-fns'

const API_URL = 'http://192.168.1.171:3001/api'

function getAuthHeader() {
  const creds = localStorage.getItem('at-uptime-credentials')
  return creds ? { headers: { Authorization: `Basic ${creds}` } } : {}
}

export default function Admin({ onLogout }) {
  const [endpoints, setEndpoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState(null)
  const [formData, setFormData] = useState({ name: '', url: '', type: 'http', interval: 60 })
  const [logs, setLogs] = useState([])
  const [showExportModal, setShowExportModal] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [activeTab, setActiveTab] = useState('endpoints')

  const fetchEndpoints = async () => {
    try {
      const res = await axios.get(`${API_URL}/endpoints`)
      setEndpoints(res.data)
    } catch (err) {
      console.error('Error fetching endpoints:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEndpoints()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingEndpoint) {
        await axios.put(`${API_URL}/endpoints/${editingEndpoint.id}`, formData, getAuthHeader())
      } else {
        await axios.post(`${API_URL}/endpoints`, formData, getAuthHeader())
      }
      setShowModal(false)
      setEditingEndpoint(null)
      setFormData({ name: '', url: '', type: 'http', interval: 60 })
      fetchEndpoints()
    } catch (err) {
      alert('Error saving endpoint: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleEdit = (endpoint) => {
    setEditingEndpoint(endpoint)
    setFormData({
      name: endpoint.name,
      url: endpoint.url,
      type: endpoint.type,
      interval: endpoint.interval
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this endpoint?')) return
    try {
      await axios.delete(`${API_URL}/endpoints/${id}`, getAuthHeader())
      fetchEndpoints()
    } catch (err) {
      alert('Error deleting endpoint')
    }
  }

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams()
      if (dateRange.start) params.append('start', dateRange.start)
      if (dateRange.end) params.append('end', dateRange.end)
      
      const response = await axios.get(`${API_URL}/export/csv?${params}`, {
        ...getAuthHeader(),
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `uptime-report-${format(new Date(), 'yyyy-MM-dd')}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setShowExportModal(false)
    } catch (err) {
      alert('Error exporting CSV')
    }
  }

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams()
      if (dateRange.start) params.append('start', dateRange.start)
      if (dateRange.end) params.append('end', dateRange.end)
      
      const response = await axios.get(`${API_URL}/export/pdf?${params}`, {
        ...getAuthHeader(),
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `uptime-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setShowExportModal(false)
    } catch (err) {
      alert('Error exporting PDF')
    }
  }

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
          <a href="/" className="nav-link">Dashboard</a>
          <button onClick={onLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowExportModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Report
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => {
            setEditingEndpoint(null)
            setFormData({ name: '', url: '', type: 'http', interval: 60 })
            setShowModal(true)
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Endpoint
          </button>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'endpoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('endpoints')}
        >
          Endpoints
        </button>
        <button 
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'endpoints' && (
        <div className="glass-card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Type</th>
                  <th>Interval</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(endpoint => (
                  <tr key={endpoint.id}>
                    <td style={{ fontWeight: 500 }}>{endpoint.name}</td>
                    <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {endpoint.url}
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        background: endpoint.type === 'ping' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textTransform: 'uppercase'
                      }}>
                        {endpoint.type}
                      </span>
                    </td>
                    <td>{endpoint.interval}s</td>
                    <td>
                      <span className={`status-badge ${endpoint.last_status === 1 ? 'status-up' : 'status-down'}`}>
                        <span className="status-dot"></span>
                        {endpoint.last_status === 1 ? 'UP' : endpoint.last_status === 0 ? 'DOWN' : 'UNKNOWN'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleEdit(endpoint)}
                          style={{ padding: '6px 12px' }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-danger btn-sm" 
                          onClick={() => handleDelete(endpoint.id)}
                          style={{ padding: '6px 12px' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {endpoints.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No endpoints configured. Add one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <SettingsPanel />
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingEndpoint ? 'Edit Endpoint' : 'Add Endpoint'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Server"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">URL</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com or 192.168.1.1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="http">HTTP/HTTPS</option>
                    <option value="ping">Ping</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Check Interval (seconds)</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) })}
                    min="10"
                    max="3600"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEndpoint ? 'Save Changes' : 'Add Endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Export Report</h3>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Start Date (optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date (optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
                Leave dates empty to export all data.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleExportCSV}>
                Export CSV
              </button>
              <button className="btn btn-primary" onClick={handleExportPDF}>
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn svg {
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}

function SettingsPanel() {
  const [settings, setSettings] = useState({
    admin_username: 'admin',
    admin_password: '',
    check_interval: 60
  })
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    try {
      const data = {}
      if (settings.admin_username) data.admin_username = settings.admin_username
      if (settings.admin_password) data.admin_password = settings.admin_password
      data.check_interval = settings.check_interval
      
      await axios.put(`${API_URL}/settings`, data, getAuthHeader())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Error saving settings')
    }
  }

  return (
    <div className="glass-card" style={{ maxWidth: '600px' }}>
      <div style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '24px' }}>Admin Settings</h3>
        
        {saved && (
          <div className="alert alert-success" style={{ marginBottom: '20px' }}>
            Settings saved successfully!
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="input"
            value={settings.admin_username}
            onChange={(e) => setSettings({ ...settings, admin_username: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">New Password (leave empty to keep current)</label>
          <input
            type="password"
            className="input"
            value={settings.admin_password}
            onChange={(e) => setSettings({ ...settings, admin_password: e.target.value })}
            placeholder="Enter new password"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Default Check Interval (seconds)</label>
          <input
            type="number"
            className="input"
            value={settings.check_interval}
            onChange={(e) => setSettings({ ...settings, check_interval: parseInt(e.target.value) })}
            min="10"
            max="3600"
          />
        </div>

        <button className="btn btn-primary" onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  )
}
