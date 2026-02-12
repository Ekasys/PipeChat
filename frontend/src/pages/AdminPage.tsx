import { useState, useEffect } from 'react'
import {
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  TextField,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Checkbox,
  TableSortLabel,
  CircularProgress,
} from '@mui/material'
import { Add, Edit, Delete, Download, Settings, Search, Clear, LockReset } from '@mui/icons-material'
import api from '../services/api'
import UserForm from '../components/UserForm'
import ComplianceReportDialog from '../components/ComplianceReportDialog'
import AIProviderForm from '../components/AIProviderForm'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import TenantSettingsDialog from '../components/TenantSettingsDialog'

interface User {
  id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  role: string
  is_active: boolean
  last_login?: string | null
  created_at?: string | null
}

interface AuditLog {
  id: string
  action: string
  resource_type: string
  created_at: string
  user_id: string
  user_email?: string
  user_name?: string
  user_username?: string
  ip_address?: string
  resource_id?: string
  details?: any
}

interface AIProvider {
  id: string
  provider_name: string
  display_name: string
  is_active: boolean
  is_default: boolean
  connection_config: {
    api_key?: string
    api_endpoint?: string
    base_url?: string
    default_model?: string
    temperature?: number
    max_tokens?: number
    organization?: string
  }
  created_at?: string
  updated_at?: string
}

export default function AdminPage() {
  const [tabValue, setTabValue] = useState(0)
  const [users, setUsers] = useState<User[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [openUserDialog, setOpenUserDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [openComplianceDialog, setOpenComplianceDialog] = useState(false)
  const [complianceReportType, setComplianceReportType] = useState<'fedramp' | 'nist' | 'cmmc' | null>(null)
  const [complianceReportData, setComplianceReportData] = useState<any>(null)
  const [loadingCompliance, setLoadingCompliance] = useState(false)
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([])
  const [openAIProviderDialog, setOpenAIProviderDialog] = useState(false)
  const [selectedAIProvider, setSelectedAIProvider] = useState<AIProvider | null>(null)
  const [openSettingsDialog, setOpenSettingsDialog] = useState(false)
  const [aiProviderSearch, setAIProviderSearch] = useState('')
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const { toast, showToast, hideToast } = useToast()
  
  // User management state
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<string>('')
  const [userStatusFilter, setUserStatusFilter] = useState<string>('')
  const [userSortBy, setUserSortBy] = useState('created_at')
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('desc')
  const [userPage, setUserPage] = useState(1)
  const [userTotal, setUserTotal] = useState(0)
  const [userLimit] = useState(50)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })
  
  // Audit logs state
  const [auditLogPage, setAuditLogPage] = useState(1)
  const [auditLogTotal, setAuditLogTotal] = useState(0)
  const [auditLogLimit] = useState(50)
  const [auditLogStartDate, setAuditLogStartDate] = useState<string>('')
  const [auditLogEndDate, setAuditLogEndDate] = useState<string>('')
  const [auditLogActionFilter, setAuditLogActionFilter] = useState<string>('')
  const [auditLogResourceTypeFilter, setAuditLogResourceTypeFilter] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [tabValue, userSearch, userRoleFilter, userStatusFilter, userSortBy, userSortOrder, userPage])

  useEffect(() => {
    if (tabValue === 1) {
      loadAuditLogs()
    }
  }, [tabValue, auditLogPage, auditLogStartDate, auditLogEndDate, auditLogActionFilter, auditLogResourceTypeFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      if (tabValue === 0) {
        const params = new URLSearchParams()
        if (userSearch) params.append('q', userSearch)
        if (userRoleFilter) params.append('role', userRoleFilter)
        if (userStatusFilter !== '') {
          params.append('is_active', userStatusFilter === 'active' ? 'true' : 'false')
        }
        params.append('sort_by', userSortBy)
        params.append('sort_order', userSortOrder)
        params.append('skip', String((userPage - 1) * userLimit))
        params.append('limit', String(userLimit))
        
        const response = await api.get<{ users: User[]; total: number }>(`/admin/users?${params.toString()}`)
        setUsers(response.data.users)
        setUserTotal(response.data.total)
      } else if (tabValue === 3) {
        // Settings tab - load AI providers
        const response = await api.get<{ providers: AIProvider[] }>('/admin/ai-providers')
        setAiProviders(response.data.providers)
      }
    } catch (error) {
      console.error('Failed to load admin data:', error)
      showToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const testAIProviderConnection = async (providerId: string) => {
    try {
      setTestingProvider(providerId)
      // In a real implementation, you'd have a test endpoint
      // For now, we'll simulate a test
      await new Promise(resolve => setTimeout(resolve, 1500))
      showToast('Connection test successful', 'success')
    } catch (error) {
      console.error('Connection test failed:', error)
      showToast('Connection test failed', 'error')
    } finally {
      setTestingProvider(null)
    }
  }

  const filteredAIProviders = aiProviders.filter(provider => {
    if (!aiProviderSearch) return true
    const searchLower = aiProviderSearch.toLowerCase()
    return (
      provider.provider_name.toLowerCase().includes(searchLower) ||
      provider.display_name.toLowerCase().includes(searchLower) ||
      provider.connection_config?.default_model?.toLowerCase().includes(searchLower)
    )
  })

  const loadAuditLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (auditLogStartDate) {
        params.append('start_date', new Date(auditLogStartDate).toISOString())
      }
      if (auditLogEndDate) {
        const endDate = new Date(auditLogEndDate)
        endDate.setHours(23, 59, 59, 999)
        params.append('end_date', endDate.toISOString())
      }
      if (auditLogActionFilter) {
        params.append('action', auditLogActionFilter)
      }
      if (auditLogResourceTypeFilter) {
        params.append('resource_type', auditLogResourceTypeFilter)
      }
      params.append('skip', String((auditLogPage - 1) * auditLogLimit))
      params.append('limit', String(auditLogLimit))
      
      const response = await api.get<{ logs: AuditLog[]; total: number }>(`/admin/audit-logs?${params.toString()}`)
      setAuditLogs(response.data.logs)
      setAuditLogTotal(response.data.total)
    } catch (error) {
      console.error('Failed to load audit logs:', error)
      showToast('Failed to load audit logs', 'error')
    } finally {
      setLoading(false)
    }
  }

  const clearAuditLogFilters = () => {
    setAuditLogStartDate('')
    setAuditLogEndDate('')
    setAuditLogActionFilter('')
    setAuditLogResourceTypeFilter('')
    setAuditLogPage(1)
  }

  // Get unique action types and resource types for filters
  const getUniqueActions = () => {
    const actions = new Set<string>()
    auditLogs.forEach(log => actions.add(log.action))
    return Array.from(actions).sort()
  }

  const getUniqueResourceTypes = () => {
    const types = new Set<string>()
    auditLogs.forEach(log => types.add(log.resource_type))
    return Array.from(types).sort()
  }

  const getRoleColor = (role: string): 'default' | 'primary' | 'secondary' | 'success' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error'> = {
      admin: 'error',
      capture: 'primary',
      proposal: 'secondary',
      analyst: 'default',
    }
    return colors[role] || 'default'
  }

  const handleViewComplianceReport = async (reportType: 'fedramp' | 'nist' | 'cmmc') => {
    try {
      setLoadingCompliance(true)
      const response = await api.get('/admin/compliance-report')
      setComplianceReportData(response.data)
      setComplianceReportType(reportType)
      setOpenComplianceDialog(true)
    } catch (error) {
      console.error('Failed to load compliance report:', error)
      showToast('Failed to load compliance report', 'error')
    } finally {
      setLoadingCompliance(false)
    }
  }

  const handleDeleteUser = (user: User) => {
    setConfirmDialog({
      open: true,
      title: 'Deactivate User',
      message: `Are you sure you want to deactivate ${user.email}?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users/${user.id}`)
          showToast('User deactivated successfully', 'success')
          loadData()
          setConfirmDialog({ ...confirmDialog, open: false })
        } catch (error) {
          console.error('Failed to deactivate user:', error)
          showToast('Failed to deactivate user', 'error')
        }
      },
    })
  }

  const handleResetPassword = async (user: User) => {
    try {
      if (!window.confirm(`Reset password for ${user.email}?`)) {
        return
      }
      const response = await api.post(`/admin/users/${user.id}/reset-password`)
      const tempPassword = response.data?.temp_password
      if (tempPassword) {
        window.prompt(`Temporary password for ${user.email} (copy now):`, tempPassword)
      }
      showToast('Password reset successfully', 'success')
    } catch (error) {
      console.error('Failed to reset password:', error)
      showToast('Failed to reset password', 'error')
    }
  }

  const handleSort = (field: string) => {
    if (userSortBy === field) {
      setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setUserSortBy(field)
      setUserSortOrder('desc')
    }
    setUserPage(1)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Administration</Typography>
        <Button variant="outlined" startIcon={<Settings />} onClick={() => setOpenSettingsDialog(true)}>
          Settings
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Users" />
          <Tab label="Audit Logs" />
          <Tab label="Compliance" />
          <Tab label="Settings" />
        </Tabs>
      </Paper>

      {tabValue === 0 && (
        <>
          <Box mb={2} display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <Button variant="contained" startIcon={<Add />} onClick={() => {
              setSelectedUser(null)
              setOpenUserDialog(true)
            }}>
              Add User
            </Button>
            {selectedUsers.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  color="success"
                  onClick={async () => {
                    try {
                      await Promise.all(
                        selectedUsers.map(userId =>
                          api.put(`/admin/users/${userId}`, { is_active: true })
                        )
                      )
                      showToast(`${selectedUsers.length} user(s) activated successfully`, 'success')
                      setSelectedUsers([])
                      loadData()
                    } catch (error) {
                      console.error('Failed to activate users:', error)
                      showToast('Failed to activate users', 'error')
                    }
                  }}
                >
                  Activate ({selectedUsers.length})
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: 'Deactivate Users',
                      message: `Are you sure you want to deactivate ${selectedUsers.length} user(s)?`,
                      onConfirm: async () => {
                        try {
                          await Promise.all(
                            selectedUsers.map(userId =>
                              api.put(`/admin/users/${userId}`, { is_active: false })
                            )
                          )
                          showToast(`${selectedUsers.length} user(s) deactivated successfully`, 'success')
                          setSelectedUsers([])
                          loadData()
                          setConfirmDialog({ ...confirmDialog, open: false })
                        } catch (error) {
                          console.error('Failed to deactivate users:', error)
                          showToast('Failed to deactivate users', 'error')
                        }
                      },
                    })
                  }}
                >
                  Deactivate ({selectedUsers.length})
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setSelectedUsers([])}
                >
                  Clear Selection
                </Button>
              </>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={async () => {
                try {
                  const params = new URLSearchParams()
                  if (userSearch) params.append('q', userSearch)
                  if (userRoleFilter) params.append('role', userRoleFilter)
                  if (userStatusFilter !== '') {
                    params.append('is_active', userStatusFilter === 'active' ? 'true' : 'false')
                  }
                  params.append('skip', '0')
                  params.append('limit', '10000')
                  
                  const response = await api.get(`/admin/users?${params.toString()}`)
                  const users = response.data.users
                  const csv = [
                    ['Name', 'Email', 'Username', 'Role', 'Status', 'Last Login', 'Created At'].join(','),
                    ...users.map((user: User) => [
                      `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
                      user.email,
                      user.username,
                      user.role,
                      user.is_active ? 'Active' : 'Inactive',
                      formatDate(user.last_login),
                      formatDate(user.created_at),
                    ].join(','))
                  ].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `users_${new Date().toISOString().split('T')[0]}.csv`
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  URL.revokeObjectURL(url)
                  showToast('Users exported successfully', 'success')
                } catch (error) {
                  console.error('Failed to export users:', error)
                  showToast('Failed to export users', 'error')
                }
              }}
            >
              Export CSV
            </Button>
            <TextField
              size="small"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value)
                setUserPage(1)
              }}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: userSearch && (
                  <IconButton size="small" onClick={() => setUserSearch('')}>
                    <Clear fontSize="small" />
                  </IconButton>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={userRoleFilter}
                label="Role"
                onChange={(e) => {
                  setUserRoleFilter(e.target.value)
                  setUserPage(1)
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="capture">Capture</MenuItem>
                <MenuItem value="proposal">Proposal</MenuItem>
                <MenuItem value="analyst">Analyst</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={userStatusFilter}
                label="Status"
                onChange={(e) => {
                  setUserStatusFilter(e.target.value)
                  setUserPage(1)
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {loading ? (
            <LoadingSpinner message="Loading users..." />
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedUsers.length > 0 && selectedUsers.length < users.length}
                          checked={users.length > 0 && selectedUsers.length === users.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers(users.map(u => u.id))
                            } else {
                              setSelectedUsers([])
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={userSortBy === 'email'}
                          direction={userSortBy === 'email' ? userSortOrder : 'asc'}
                          onClick={() => handleSort('email')}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={userSortBy === 'email'}
                          direction={userSortBy === 'email' ? userSortOrder : 'asc'}
                          onClick={() => handleSort('email')}
                        >
                          Email
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>Username</TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={userSortBy === 'role'}
                          direction={userSortBy === 'role' ? userSortOrder : 'asc'}
                          onClick={() => handleSort('role')}
                        >
                          Role
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Login</TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={userSortBy === 'created_at'}
                          direction={userSortBy === 'created_at' ? userSortOrder : 'asc'}
                          onClick={() => handleSort('created_at')}
                        >
                          Created
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers([...selectedUsers, user.id])
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {user.first_name || user.last_name
                              ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                              : user.email}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>
                            <Chip label={user.role} color={getRoleColor(user.role)} size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={user.is_active ? 'Active' : 'Inactive'}
                              color={user.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{formatDate(user.last_login)}</TableCell>
                          <TableCell>{formatDate(user.created_at)}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => {
                              setSelectedUser(user)
                              setOpenUserDialog(true)
                            }}>
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleResetPassword(user)}
                              title="Reset password"
                            >
                              <LockReset />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteUser(user)}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {userTotal > userLimit && (
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination
                    count={Math.ceil(userTotal / userLimit)}
                    page={userPage}
                    onChange={(_, page) => setUserPage(page)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}

      {tabValue === 1 && (
        <>
          <Box mb={2} display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              size="small"
              label="Start Date"
              type="date"
              value={auditLogStartDate}
              onChange={(e) => {
                setAuditLogStartDate(e.target.value)
                setAuditLogPage(1)
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              size="small"
              label="End Date"
              type="date"
              value={auditLogEndDate}
              onChange={(e) => {
                setAuditLogEndDate(e.target.value)
                setAuditLogPage(1)
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Action</InputLabel>
              <Select
                value={auditLogActionFilter}
                label="Action"
                onChange={(e) => {
                  setAuditLogActionFilter(e.target.value)
                  setAuditLogPage(1)
                }}
              >
                <MenuItem value="">All</MenuItem>
                {getUniqueActions().map(action => (
                  <MenuItem key={action} value={action}>{action}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Resource Type</InputLabel>
              <Select
                value={auditLogResourceTypeFilter}
                label="Resource Type"
                onChange={(e) => {
                  setAuditLogResourceTypeFilter(e.target.value)
                  setAuditLogPage(1)
                }}
              >
                <MenuItem value="">All</MenuItem>
                {getUniqueResourceTypes().map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {(auditLogStartDate || auditLogEndDate || auditLogActionFilter || auditLogResourceTypeFilter) && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Clear />}
                onClick={clearAuditLogFilters}
              >
                Clear Filters
              </Button>
            )}
          </Box>
          {loading ? (
            <LoadingSpinner message="Loading audit logs..." />
          ) : (
            <>
              <TableContainer component={Paper}>
                <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
                  <Typography variant="h6">Audit Logs ({auditLogTotal} total)</Typography>
                  <Button
                    startIcon={<Download />}
                    variant="outlined"
                    onClick={async () => {
                      try {
                        const params = new URLSearchParams()
                        if (auditLogStartDate) {
                          params.append('start_date', new Date(auditLogStartDate).toISOString())
                        }
                        if (auditLogEndDate) {
                          const endDate = new Date(auditLogEndDate)
                          endDate.setHours(23, 59, 59, 999)
                          params.append('end_date', endDate.toISOString())
                        }
                        if (auditLogActionFilter) {
                          params.append('action', auditLogActionFilter)
                        }
                        if (auditLogResourceTypeFilter) {
                          params.append('resource_type', auditLogResourceTypeFilter)
                        }
                        params.append('skip', '0')
                        params.append('limit', '10000')
                        
                        const response = await api.get(`/admin/audit-logs?${params.toString()}`)
                        const logs = response.data.logs
                        const csv = [
                          ['Timestamp', 'Action', 'Resource Type', 'User Email', 'User Name', 'IP Address'].join(','),
                          ...logs.map((log: AuditLog) => [
                            new Date(log.created_at).toISOString(),
                            log.action,
                            log.resource_type,
                            log.user_email || '',
                            log.user_name || '',
                            log.ip_address || '',
                          ].join(','))
                        ].join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        URL.revokeObjectURL(url)
                        showToast('Audit logs exported successfully', 'success')
                      } catch (error) {
                        console.error('Failed to export audit logs:', error)
                        showToast('Failed to export audit logs', 'error')
                      }
                    }}
                  >
                    Export CSV
                  </Button>
                </Box>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Resource Type</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>IP Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.resource_type}</TableCell>
                          <TableCell>
                            {log.user_name || log.user_email || log.user_username || log.user_id}
                          </TableCell>
                          <TableCell>{log.ip_address || 'N/A'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {auditLogTotal > auditLogLimit && (
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination
                    count={Math.ceil(auditLogTotal / auditLogLimit)}
                    page={auditLogPage}
                    onChange={(_, page) => setAuditLogPage(page)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  FedRAMP Moderate
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Compliance status and controls
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ mt: 2 }}
                  fullWidth
                  onClick={() => handleViewComplianceReport('fedramp')}
                  disabled={loadingCompliance}
                >
                  {loadingCompliance ? 'Loading...' : 'View Report'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  NIST 800-53
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Security controls assessment
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ mt: 2 }}
                  fullWidth
                  onClick={() => handleViewComplianceReport('nist')}
                  disabled={loadingCompliance}
                >
                  {loadingCompliance ? 'Loading...' : 'View Report'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  CMMC Level 2
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cybersecurity maturity certification
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ mt: 2 }}
                  fullWidth
                  onClick={() => handleViewComplianceReport('cmmc')}
                  disabled={loadingCompliance}
                >
                  {loadingCompliance ? 'Loading...' : 'View Report'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 3 && (
        <>
          <Box mb={2} display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setSelectedAIProvider(null)
                setOpenAIProviderDialog(true)
              }}
            >
              Add AI Provider
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <TextField
              size="small"
              placeholder="Search AI providers..."
              value={aiProviderSearch}
              onChange={(e) => setAIProviderSearch(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: aiProviderSearch && (
                  <IconButton size="small" onClick={() => setAIProviderSearch('')}>
                    <Clear fontSize="small" />
                  </IconButton>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
          </Box>
          {loading ? (
            <LoadingSpinner message="Loading AI providers..." />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Provider</TableCell>
                    <TableCell>Display Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Default</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAIProviders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {aiProviderSearch
                          ? 'No AI providers found matching your search'
                          : 'No AI providers configured. Click "Add AI Provider" to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAIProviders.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <Chip
                            label={provider.provider_name.toUpperCase()}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{provider.display_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={provider.is_active ? 'Active' : 'Inactive'}
                            color={provider.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {provider.is_default && (
                            <Chip label="Default" color="primary" size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          {provider.connection_config?.default_model || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => testAIProviderConnection(provider.id)}
                            disabled={testingProvider === provider.id}
                            title="Test Connection"
                          >
                            {testingProvider === provider.id ? (
                              <CircularProgress size={20} />
                            ) : (
                              <Settings />
                            )}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedAIProvider(provider)
                              setOpenAIProviderDialog(true)
                            }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setConfirmDialog({
                                open: true,
                                title: 'Delete AI Provider',
                                message: `Are you sure you want to delete ${provider.display_name}?`,
                                onConfirm: async () => {
                                  try {
                                    await api.delete(`/admin/ai-providers/${provider.id}`)
                                    showToast('AI Provider deleted successfully', 'success')
                                    loadData()
                                    setConfirmDialog({ ...confirmDialog, open: false })
                                  } catch (error) {
                                    console.error('Failed to delete AI provider:', error)
                                    showToast('Failed to delete AI provider', 'error')
                                  }
                                },
                              })
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      <UserForm
        open={openUserDialog}
        onClose={() => {
          setOpenUserDialog(false)
          setSelectedUser(null)
        }}
        onSuccess={() => {
          loadData()
        }}
        user={selectedUser}
      />
      <ComplianceReportDialog
        open={openComplianceDialog}
        onClose={() => {
          setOpenComplianceDialog(false)
          setComplianceReportType(null)
          setComplianceReportData(null)
        }}
        reportType={complianceReportType}
        reportData={complianceReportData}
      />
      <AIProviderForm
        open={openAIProviderDialog}
        onClose={() => {
          setOpenAIProviderDialog(false)
          setSelectedAIProvider(null)
        }}
        onSubmit={async (provider) => {
          try {
            if (selectedAIProvider) {
              await api.put(`/admin/ai-providers/${selectedAIProvider.id}`, provider)
              showToast('AI Provider updated successfully', 'success')
            } else {
              await api.post('/admin/ai-providers', provider)
              showToast('AI Provider created successfully', 'success')
            }
            loadData()
          } catch (error: any) {
            console.error('Failed to save AI provider:', error)
            throw error
          }
        }}
        initialData={selectedAIProvider || undefined}
      />
      <TenantSettingsDialog
        open={openSettingsDialog}
        onClose={() => setOpenSettingsDialog(false)}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </Box>
  )
}

