import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Paper,
  Button,
  Chip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Menu,
  Toolbar,
} from '@mui/material'
import { Add, Edit, Visibility, Search, Clear, Download, MoreVert, Delete } from '@mui/icons-material'
import { opportunityService, Opportunity } from '../services/opportunityService'
import { format } from 'date-fns'
import OpportunityForm from '../components/OpportunityForm'
import OpportunityDetail from '../components/OpportunityDetail'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function OpportunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [openDetailDialog, setOpenDetailDialog] = useState(false)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionMenuAnchor, setBulkActionMenuAnchor] = useState<null | HTMLElement>(null)
  const [filters, setFilters] = useState({
    stage: '',
    status: searchParams.get('status') || '',
    agency: '',
    search: '',
    minValue: '',
    maxValue: '',
  })
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([])
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadOpportunities()
  }, [])

  // Apply URL parameters on mount
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setFilters(prev => ({ ...prev, status: statusParam }))
    }
  }, [searchParams])

  const loadOpportunities = async () => {
    try {
      setLoading(true)
      // Load all opportunities first, then filter client-side for better UX
      const data = await opportunityService.list({
        limit: 1000, // Get all opportunities
      })
      setAllOpportunities(data.opportunities)
      applyFilters(data.opportunities)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
      showToast('Failed to load opportunities', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = (opps: Opportunity[]) => {
    let filtered = [...opps]

    // Search filter (name, agency)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(
        (opp) =>
          opp.name?.toLowerCase().includes(searchLower) ||
          opp.agency?.toLowerCase().includes(searchLower)
      )
    }

    // Stage filter
    if (filters.stage) {
      filtered = filtered.filter((opp) => opp.stage === filters.stage)
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter((opp) => opp.status === filters.status)
    }

    // Agency filter
    if (filters.agency) {
      filtered = filtered.filter((opp) =>
        opp.agency?.toLowerCase().includes(filters.agency.toLowerCase())
      )
    }

    // Value range filters
    if (filters.minValue) {
      const minVal = parseFloat(filters.minValue)
      if (!isNaN(minVal)) {
        filtered = filtered.filter((opp) => opp.value && opp.value >= minVal)
      }
    }
    if (filters.maxValue) {
      const maxVal = parseFloat(filters.maxValue)
      if (!isNaN(maxVal)) {
        filtered = filtered.filter((opp) => opp.value && opp.value <= maxVal)
      }
    }

    setOpportunities(filtered)
  }

  // Debounce search filter
  useEffect(() => {
    if (allOpportunities.length > 0) {
      const timeoutId = setTimeout(() => {
        applyFilters(allOpportunities)
      }, filters.search ? 300 : 0) // 300ms debounce for search
      
      return () => clearTimeout(timeoutId)
    }
  }, [filters, allOpportunities])

  const handleCreateOpportunity = async (data: any) => {
    try {
      // Check authentication first
      const token = localStorage.getItem('accessToken')
      if (!token) {
        showToast('Please log in to create opportunities', 'error')
        return
      }
      
      // Ensure required fields are present
      if (!data.name || data.name.trim() === '') {
        showToast('Opportunity name is required', 'error')
        return
      }
      
      console.log('Form data received:', data)
      console.log('Auth token present:', !!token)
      
      const result = await opportunityService.create({
        name: data.name.trim(),
        agency: data.agency || undefined,
        stage: data.stage || 'qualification',
        value: data.value ? Number(data.value) : undefined,
        pwin: data.pwin ? Number(data.pwin) : undefined,
        ptw: data.ptw ? Number(data.ptw) : undefined,
        due_date: data.due_date || undefined,
      })
      
      console.log('Opportunity created:', result)
      showToast('Opportunity created successfully', 'success')
      loadOpportunities()
    } catch (error: any) {
      console.error('Failed to create opportunity:', error)
      console.error('Error response:', error.response)
      console.error('Error status:', error.response?.status)
      console.error('Error data:', error.response?.data)
      
      let errorMessage = 'Failed to create opportunity'
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.'
          // Optionally redirect to login
          setTimeout(() => {
            window.location.href = '/login'
          }, 2000)
        } else if (error.response.status === 403) {
          errorMessage = 'You do not have permission to create opportunities'
        } else if (error.response.status === 422) {
          // Validation error
          if (error.response.data?.detail) {
            if (Array.isArray(error.response.data.detail)) {
              errorMessage = error.response.data.detail.map((e: any) => {
                const field = e.loc ? e.loc.join('.') : 'field'
                return `${field}: ${e.msg || e}`
              }).join(', ')
            } else {
              errorMessage = error.response.data.detail
            }
          } else {
            errorMessage = 'Invalid data provided. Please check your input.'
          }
        } else if (error.response.data) {
          if (typeof error.response.data.detail === 'string') {
            errorMessage = error.response.data.detail
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message
          } else if (Array.isArray(error.response.data.detail)) {
            errorMessage = error.response.data.detail.map((e: any) => e.msg || e).join(', ')
          }
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Is the backend running?'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      showToast(errorMessage, 'error')
    }
  }

  const handleUpdateOpportunity = async (data: any) => {
    if (!selectedOpp) return
    try {
      await opportunityService.update(selectedOpp.id, data)
      showToast('Opportunity updated successfully', 'success')
      loadOpportunities()
    } catch (error: any) {
      console.error('Failed to update opportunity:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update opportunity'
      showToast(errorMessage, 'error')
    }
  }

  const handleDeleteOpportunity = async (opp: Opportunity) => {
    if (!window.confirm(`Are you sure you want to delete "${opp.name}"? This will also delete all associated documents, proposals, and activities.`)) {
      return
    }
    try {
      await opportunityService.delete(opp.id)
      showToast('Opportunity deleted successfully', 'success')
      loadOpportunities()
    } catch (error: any) {
      console.error('Failed to delete opportunity:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete opportunity'
      showToast(errorMessage, 'error')
    }
  }

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(opportunities.map(opp => opp.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) {
      showToast('Please select opportunities to export', 'warning')
      return
    }

    try {
      const selectedOpps = opportunities.filter(opp => selectedIds.has(opp.id))
      
      // Convert to CSV format
      const headers = ['Name', 'Agency', 'Stage', 'Status', 'Value', 'PWin', 'PTW', 'Due Date', 'NAICS Code', 'Contract Vehicle']
      const rows = selectedOpps.map(opp => [
        opp.name || '',
        opp.agency || '',
        opp.stage || '',
        opp.status || '',
        opp.value?.toString() || '',
        opp.pwin?.toString() || '',
        opp.ptw?.toString() || '',
        opp.due_date ? format(new Date(opp.due_date), 'MM/dd/yyyy') : '',
        opp.naics_code || '',
        opp.contract_vehicle || '',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `opportunities_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      showToast(`Exported ${selectedIds.size} opportunities successfully`, 'success')
      setSelectedIds(new Set())
      setBulkActionMenuAnchor(null)
    } catch (error) {
      console.error('Export failed:', error)
      showToast('Failed to export opportunities', 'error')
    }
  }

  const handleBulkUpdateStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) {
      showToast('Please select opportunities to update', 'warning')
      return
    }

    try {
      const updatePromises = Array.from(selectedIds).map(id =>
        opportunityService.update(id, { status: newStatus })
      )
      await Promise.all(updatePromises)
      showToast(`Updated ${selectedIds.size} opportunities to ${newStatus}`, 'success')
      setSelectedIds(new Set())
      setBulkActionMenuAnchor(null)
      loadOpportunities()
    } catch (error) {
      console.error('Bulk update failed:', error)
      showToast('Failed to update opportunities', 'error')
    }
  }

  const handleBulkUpdateStage = async (newStage: string) => {
    if (selectedIds.size === 0) {
      showToast('Please select opportunities to update', 'warning')
      return
    }

    try {
      const updatePromises = Array.from(selectedIds).map(id =>
        opportunityService.update(id, { stage: newStage })
      )
      await Promise.all(updatePromises)
      showToast(`Updated ${selectedIds.size} opportunities to ${newStage}`, 'success')
      setSelectedIds(new Set())
      setBulkActionMenuAnchor(null)
      loadOpportunities()
    } catch (error) {
      console.error('Bulk update failed:', error)
      showToast('Failed to update opportunities', 'error')
    }
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      qualification: 'default',
      pursuit: 'primary',
      proposal: 'secondary',
      negotiation: 'warning',
      won: 'success',
      lost: 'error',
    }
    return colors[stage] || 'default'
  }

  const handleViewClick = (opp: Opportunity) => {
    setSelectedOpp(opp)
    setOpenDetailDialog(true)
  }

  const handleOpportunityStageUpdated = (updated: Opportunity) => {
    setSelectedOpp(updated)
    setAllOpportunities(prev => {
      const next = prev.map(opp => (opp.id === updated.id ? updated : opp))
      applyFilters(next)
      return next
    })
  }

  if (loading) {
    return <LoadingSpinner message="Loading opportunities..." />
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Opportunities</Typography>
        <Box display="flex" gap={2}>
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleBulkExport}
              >
                Export ({selectedIds.size})
              </Button>
              <Button
                variant="outlined"
                startIcon={<MoreVert />}
                onClick={(e) => setBulkActionMenuAnchor(e.currentTarget)}
              >
                Bulk Actions ({selectedIds.size})
              </Button>
            </>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
            New Opportunity
          </Button>
        </Box>
      </Box>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkActionMenuAnchor}
        open={Boolean(bulkActionMenuAnchor)}
        onClose={() => setBulkActionMenuAnchor(null)}
      >
        <MenuItem onClick={handleBulkExport}>
          <Download sx={{ mr: 1 }} /> Export to CSV
        </MenuItem>
        <MenuItem onClick={() => {
          setBulkActionMenuAnchor(null)
          const newStatus = window.prompt('Enter new status (active, won, lost, withdrawn):', 'active')
          if (newStatus) handleBulkUpdateStatus(newStatus)
        }}>
          Update Status
        </MenuItem>
        <MenuItem onClick={() => {
          setBulkActionMenuAnchor(null)
          const newStage = window.prompt('Enter new stage (qualification, pursuit, proposal, negotiation):', 'qualification')
          if (newStage) handleBulkUpdateStage(newStage)
        }}>
          Update Stage
        </MenuItem>
      </Menu>

      {/* Advanced Filters */}
      <Paper 
        sx={{ 
          p: 3, 
          mb: 3,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        }}
      >
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Search sx={{ color: 'text.secondary' }} />
          <Typography variant="h6">Advanced Filters</Typography>
          {(filters.search || filters.stage || filters.status || filters.agency || filters.minValue || filters.maxValue) && (
            <Button
              size="small"
              startIcon={<Clear />}
              onClick={() => setFilters({ stage: '', status: '', agency: '', search: '', minValue: '', maxValue: '' })}
              sx={{ ml: 'auto' }}
            >
              Clear All
            </Button>
          )}
        </Box>
        
        <Box display="flex" flexWrap="wrap" gap={2}>
          <TextField
            size="small"
            label="Search"
            placeholder="Search by name or agency..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Stage</InputLabel>
            <Select
              value={filters.stage}
              label="Stage"
              onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
            >
              <MenuItem value="">All Stages</MenuItem>
              <MenuItem value="qualification">Qualification</MenuItem>
              <MenuItem value="pursuit">Pursuit</MenuItem>
              <MenuItem value="proposal">Proposal</MenuItem>
              <MenuItem value="negotiation">Negotiation</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="won">Won</MenuItem>
              <MenuItem value="lost">Lost</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Agency"
            placeholder="Filter by agency..."
            value={filters.agency}
            onChange={(e) => setFilters({ ...filters, agency: e.target.value })}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            label="Min Value"
            type="number"
            placeholder="Min"
            value={filters.minValue}
            onChange={(e) => setFilters({ ...filters, minValue: e.target.value })}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
            sx={{ minWidth: 120 }}
          />
          <TextField
            size="small"
            label="Max Value"
            type="number"
            placeholder="Max"
            value={filters.maxValue}
            onChange={(e) => setFilters({ ...filters, maxValue: e.target.value })}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
            sx={{ minWidth: 120 }}
          />
        </Box>
        {opportunities.length !== allOpportunities.length && allOpportunities.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Showing {opportunities.length} of {allOpportunities.length} opportunities
          </Typography>
        )}
      </Paper>

      {/* Opportunities Table */}
      <TableContainer 
        component={Paper}
        sx={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.size > 0 && selectedIds.size < opportunities.length}
                  checked={opportunities.length > 0 && selectedIds.size === opportunities.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Agency</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>PWin</TableCell>
              <TableCell>Submission Date</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Capture Manager</TableCell>
              <TableCell>Actions</TableCell>
              <TableCell>Export</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {opportunities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} align="center">
                  No opportunities found
                </TableCell>
              </TableRow>
            ) : (
              opportunities.map((opp) => (
                <TableRow 
                  key={opp.id}
                  selected={selectedIds.has(opp.id)}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.05)',
                    },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(opp.id)}
                      onChange={() => handleSelectOne(opp.id)}
                    />
                  </TableCell>
                  <TableCell>{opp.name}</TableCell>
                  <TableCell>{opp.agency || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label={opp.stage} color={getStageColor(opp.stage)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={opp.status} color={opp.status === 'won' ? 'success' : opp.status === 'lost' ? 'error' : 'default'} size="small" />
                  </TableCell>
                  <TableCell>{formatCurrency(opp.value)}</TableCell>
                  <TableCell>{opp.pwin ? `${opp.pwin}%` : 'N/A'}</TableCell>
                  <TableCell>
                    {opp.rfp_submission_date ? format(new Date(opp.rfp_submission_date), 'MM/dd/yyyy') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {opp.due_date ? format(new Date(opp.due_date), 'MM/dd/yyyy') : 'N/A'}
                  </TableCell>
                  <TableCell>{opp.capture_manager || 'N/A'}</TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        setSelectedOpp(opp)
                        setOpenDialog(true)
                      }}
                      sx={{
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.2)',
                        },
                      }}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton 
                      size="small"
                      onClick={() => {
                        setSelectedOpp(opp)
                        setOpenDetailDialog(true)
                      }}
                      sx={{
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.2)',
                        },
                      }}
                    >
                      <Visibility />
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      size="small"
                      onClick={() => {
                        // Export single opportunity to CSV
                        const csvContent = [
                          ['Name', 'Agency', 'Stage', 'Status', 'Value', 'PWin', 'PTW', 'Due Date'].join(','),
                          [
                            opp.name || '',
                            opp.agency || '',
                            opp.stage || '',
                            opp.status || '',
                            opp.value?.toString() || '',
                            opp.pwin?.toString() || '',
                            opp.ptw?.toString() || '',
                            opp.due_date ? format(new Date(opp.due_date), 'MM/dd/yyyy') : '',
                          ].map(cell => `"${cell}"`).join(',')
                        ].join('\n')
                        
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                        const link = document.createElement('a')
                        const url = URL.createObjectURL(blob)
                        link.setAttribute('href', url)
                        link.setAttribute('download', `opportunity_${opp.name?.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`)
                        link.style.visibility = 'hidden'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        showToast('Opportunity exported successfully', 'success')
                      }}
                      sx={{
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.2)',
                        },
                      }}
                      title="Export to CSV"
                    >
                      <Download />
                    </IconButton>
                    <IconButton 
                      size="small"
                      onClick={() => handleDeleteOpportunity(opp)}
                      sx={{
                        color: 'error.main',
                        '&:hover': {
                          background: 'rgba(244, 67, 54, 0.2)',
                        },
                      }}
                      title="Delete Opportunity"
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

      <OpportunityForm
        open={openDialog}
        onClose={() => {
          setOpenDialog(false)
          setSelectedOpp(null)
        }}
        onSubmit={selectedOpp ? handleUpdateOpportunity : handleCreateOpportunity}
        initialData={selectedOpp || undefined}
      />
      <OpportunityDetail
        open={openDetailDialog}
        onClose={() => {
          setOpenDetailDialog(false)
          setSelectedOpp(null)
        }}
        opportunity={selectedOpp}
        onEdit={() => {
          setOpenDetailDialog(false)
          setOpenDialog(true)
        }}
        onStageUpdated={handleOpportunityStageUpdated}
      />
      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={hideToast}
      />
    </Box>
  )
}

