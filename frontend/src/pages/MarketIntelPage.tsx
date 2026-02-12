import { useState, useEffect } from 'react'
import {
  Typography,
  Box,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  useMediaQuery,
  useTheme,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  LinearProgress,
} from '@mui/material'
import {
  Add,
  Search,
  Visibility,
  Delete,
  ExpandMore,
  FilterList,
  Close,
  CloudDownload,
  Business,
  Description,
  DateRange,
} from '@mui/icons-material'
import { marketIntelService, MarketIntel, SAMGovOpportunity } from '../services/marketIntelService'
import CaptureQualification from '../components/CaptureQualification'

const STAGES = ['rumor', 'confirmed', 'rfi', 'qualified']

export default function MarketIntelPage() {
  const [intel, setIntel] = useState<MarketIntel[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [openSearchDialog, setOpenSearchDialog] = useState(false)
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false)
  const [selectedIntel, setSelectedIntel] = useState<MarketIntel | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SAMGovOpportunity[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [searchTab, setSearchTab] = useState(0)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: MarketIntel | null }>({ open: false, item: null })

  // Form state
  const [formData, setFormData] = useState<Partial<MarketIntel>>({
    title: '',
    description: '',
    stage: 'rumor',
    source: '',
    agency: '',
    estimated_value: undefined,
    expected_rfp_date: '',
    naics_codes: [],
    contract_vehicle: '',
    market_notes: '',
  })

  // Advanced search filters
  const [searchFilters, setSearchFilters] = useState({
    notice_type: '',
    posted_from: '',
    posted_to: '',
    set_aside: '',
    naics_code: '',
  })

  useEffect(() => {
    loadIntel()
  }, [])

  // Auto-refresh when items are processing
  useEffect(() => {
    const processingStatuses = ['processing', 'fetching_documents', 'extracting_requirements']
    const hasProcessing = intel.some(item => processingStatuses.includes(item.processing_status))
    if (hasProcessing) {
      const interval = setInterval(() => {
        loadIntel(true) // Silent refresh
      }, 3000) // Poll every 3 seconds
      return () => clearInterval(interval)
    }
  }, [intel])

  const loadIntel = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await marketIntelService.list()
      setIntel(data.intel)
    } catch (error) {
      console.error('Failed to load market intelligence:', error)
      if (!silent) showSnackbar('Failed to load market intelligence', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleSearchSAMGov = async () => {
    // Allow search without keywords if filters are provided
    const hasFilters = Object.values(searchFilters).some(v => v && v !== '')
    
    if (!searchQuery.trim() && !hasFilters) {
      showSnackbar('Please enter a search query or select filters', 'error')
      return
    }

    try {
      setSearchLoading(true)
      // Filter out empty strings from search filters
      const cleanFilters = Object.fromEntries(
        Object.entries(searchFilters).filter(([_, v]) => v !== '' && v != null)
      )
      
      // Log filters being sent for debugging
      console.log('Search filters:', cleanFilters)
      console.log('Search query:', searchQuery)
      
      const results = await marketIntelService.searchSAMGov({
        keywords: searchQuery.trim() || undefined, // Only send if not empty
        ...cleanFilters,
        limit: 50,
      })
      console.log('SAM.gov search results:', results)
      console.log('Results array:', results.results)
      console.log('Results count:', results.results?.length || 0)
      console.log('Total:', results.total)
      
      setSearchResults(results.results || [])
      if (results.results && results.results.length > 0) {
        setOpenSearchDialog(true)
      } else {
        showSnackbar(`No results found. Total available: ${results.total || 0}`, 'error')
      }
    } catch (error: any) {
      console.error('SAM.gov search failed:', error)
      console.error('Error response:', error.response?.data)
      showSnackbar(
        error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to search SAM.gov',
        'error'
      )
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  // Helper to extract SAM.gov field values (API uses different field names)
  const getSamField = (opp: SAMGovOpportunity, ...fields: string[]) => {
    for (const field of fields) {
      const val = (opp as any)[field]
      if (val !== undefined && val !== null && val !== '') return val
    }
    return null
  }

  const handleImportFromSAMGov = (opportunity: SAMGovOpportunity) => {
    // Close dialog immediately
    setOpenSearchDialog(false)
    
    // Build data - prefer 'department' (parsed by backend) over full path
    const agency = getSamField(opportunity, 'department', 'fullParentPathName', 'agency', 'organizationName') || ''
    const deadline = getSamField(opportunity, 'responseDeadLine', 'responseDeadline', 'archiveDate') || ''
    const naicsCode = getSamField(opportunity, 'naicsCode', 'naics')
    const setAside = getSamField(opportunity, 'typeOfSetAsideDescription', 'typeOfSetAside', 'setAside') || ''
    const noticeId = getSamField(opportunity, 'solicitationNumber', 'noticeId', 'id') || ''
    
    // Optimistic card - add immediately with temp ID
    const tempId = `temp-${Date.now()}`
    const optimisticIntel: MarketIntel = {
      id: tempId,
      title: opportunity.title || 'Untitled Opportunity',
      description: getSamField(opportunity, 'description', 'additionalInfoLink') || '',
      stage: 'rumor',
      source: 'SAM.gov',
      agency: agency,
      expected_rfp_date: deadline,
      naics_codes: naicsCode ? (Array.isArray(naicsCode) ? naicsCode : [naicsCode]) : [],
      contract_vehicle: setAside,
      sam_gov_id: noticeId,
      processing_status: 'processing',
      created_at: new Date().toISOString(),
    }
    
    // Add to state NOW
    setIntel(prev => [...prev, optimisticIntel])
    showSnackbar('Importing...', 'success')
    
    // Then persist to backend
    const intelData: Partial<MarketIntel> = {
      title: optimisticIntel.title,
      description: optimisticIntel.description,
      stage: 'rumor',
      source: 'SAM.gov',
      agency: agency,
      expected_rfp_date: deadline,
      naics_codes: optimisticIntel.naics_codes,
      contract_vehicle: setAside,
      sam_gov_id: noticeId,
      sam_gov_data: opportunity,
    }

    marketIntelService.create(intelData)
      .then(() => {
        // Refresh to get real ID
        marketIntelService.list().then(data => setIntel(data.intel))
      })
      .catch((error: any) => {
        // Remove optimistic card on failure
        setIntel(prev => prev.filter(i => i.id !== tempId))
        showSnackbar(error.response?.data?.detail || 'Failed to import', 'error')
      })
  }

  const handleCreateIntel = async () => {
    try {
      await marketIntelService.create(formData)
      showSnackbar('Market intelligence created successfully', 'success')
      setOpenDialog(false)
      resetForm()
      loadIntel()
    } catch (error: any) {
      console.error('Create failed:', error)
      showSnackbar(error.response?.data?.detail || 'Failed to create market intelligence', 'error')
    }
  }

  const handleUpdateStage = async (intelId: string, newStage: string) => {
    try {
      await marketIntelService.updateStage(intelId, newStage)
      loadIntel()
    } catch (error) {
      console.error('Failed to update stage:', error)
      showSnackbar('Failed to update stage', 'error')
    }
  }

  const handleDeleteIntel = (item: MarketIntel) => {
    setDeleteDialog({ open: true, item })
  }

  const confirmDelete = async () => {
    if (!deleteDialog.item) return
    try {
      await marketIntelService.delete(deleteDialog.item.id)
      showSnackbar('Market Intelligence deleted successfully', 'success')
      setDeleteDialog({ open: false, item: null })
      loadIntel()
    } catch (error) {
      console.error('Failed to delete:', error)
      showSnackbar('Failed to delete', 'error')
      setDeleteDialog({ open: false, item: null })
    }
  }

  const handleDragStart = (e: React.DragEvent, intelId: string) => {
    setDraggedItem(intelId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    // Clear drag state so clicks work again
    setDraggedItem(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault()
    if (draggedItem) {
      const item = intel.find((i) => i.id === draggedItem)
      if (item && item.stage !== targetStage) {
        handleUpdateStage(draggedItem, targetStage)
      }
      setDraggedItem(null)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      stage: 'rumor',
      source: '',
      agency: '',
      estimated_value: undefined,
      expected_rfp_date: '',
      naics_codes: [],
      contract_vehicle: '',
      market_notes: '',
    })
  }

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity })
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success'> = {
      rumor: 'default',
      confirmed: 'primary',
      rfi: 'secondary',
      qualified: 'success',
    }
    return colors[stage] || 'default'
  }

  const intelByStage = STAGES.map((stage) => ({
    stage,
    items: intel.filter((item) => item.stage === stage),
  }))

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Market Intelligence
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
          Add Intel
        </Button>
      </Box>

      {/* Search Bar */}
      <Box mb={3}>
        <Paper
          sx={{
            p: 2,
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          }}
        >
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              fullWidth
              placeholder="Search SAM.gov for opportunities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSAMGov()
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  background: 'rgba(15, 23, 42, 0.5)',
                  '&:hover': {
                    background: 'rgba(15, 23, 42, 0.7)',
                  },
                },
              }}
            />
            <Button
              variant="contained"
              startIcon={searchLoading ? <CircularProgress size={20} /> : <Search />}
              onClick={handleSearchSAMGov}
              disabled={searchLoading}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              Search SAM.gov
            </Button>
          </Box>

          {/* Advanced Filters */}
          <Accordion sx={{ mt: 2, background: 'rgba(15, 23, 42, 0.3)' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center" gap={1}>
                <FilterList />
                <Typography>Advanced Filters</Typography>
                {Object.values(searchFilters).some(v => v && v !== '') && (
                  <Chip 
                    label="Active" 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Notice Type</InputLabel>
                    <Select
                      value={searchFilters.notice_type}
                      onChange={(e) =>
                        setSearchFilters({ ...searchFilters, notice_type: e.target.value })
                      }
                      label="Notice Type"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="PRESOL">Presolicitation</MenuItem>
                      <MenuItem value="COMBINE">Combined Synopsis</MenuItem>
                      <MenuItem value="SRCSGT">Sources Sought</MenuItem>
                      <MenuItem value="SNOTE">Special Notice</MenuItem>
                      <MenuItem value="SSALE">Sale of Surplus</MenuItem>
                      <MenuItem value="AWARD">Award</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Posted From"
                    type="date"
                    value={searchFilters.posted_from}
                    onChange={(e) =>
                      setSearchFilters({ ...searchFilters, posted_from: e.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Posted To"
                    type="date"
                    value={searchFilters.posted_to}
                    onChange={(e) =>
                      setSearchFilters({ ...searchFilters, posted_to: e.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Set-Aside</InputLabel>
                    <Select
                      value={searchFilters.set_aside}
                      onChange={(e) =>
                        setSearchFilters({ ...searchFilters, set_aside: e.target.value })
                      }
                      label="Set-Aside"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="SBA">SBA</MenuItem>
                      <MenuItem value="8A">8(a)</MenuItem>
                      <MenuItem value="HUBZone">HUBZone</MenuItem>
                      <MenuItem value="WOSB">WOSB</MenuItem>
                      <MenuItem value="EDWOSB">EDWOSB</MenuItem>
                      <MenuItem value="VOSB">VOSB</MenuItem>
                      <MenuItem value="SDVOSB">SDVOSB</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="NAICS Code"
                    value={searchFilters.naics_code}
                    onChange={(e) =>
                      setSearchFilters({ ...searchFilters, naics_code: e.target.value })
                    }
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Box>

      {/* Kanban Board */}
      <Grid container spacing={3}>
        {intelByStage.map(({ stage, items }) => (
          <Grid item xs={12} sm={6} md={3} key={stage}>
            <Paper
              sx={{
                p: 3,
                minHeight: 500,
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  fontWeight: 700,
                  mb: 2,
                }}
              >
                {stage.charAt(0).toUpperCase() + stage.slice(1)} ({items.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No items
                  </Typography>
                ) : (
                  items.map((item) => (
                    <Card
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        // Don't open if we were dragging
                        if (draggedItem) return
                        e.stopPropagation()
                        console.log('Card clicked - opening detail dialog for:', item.title)
                        setSelectedIntel(item)
                        setOpenDetailsDialog(true)
                      }}
                      sx={{
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
                        },
                        '&:active': {
                          cursor: 'grabbing',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                          <Typography variant="subtitle2" sx={{ flex: 1 }}>
                            {item.title}
                          </Typography>
                          <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                console.log('Eye icon clicked - opening detail dialog for:', item.title)
                                setSelectedIntel(item)
                                setOpenDetailsDialog(true)
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                console.log('Delete clicked for:', item.title)
                                handleDeleteIntel(item)
                              }}
                              sx={{ 
                                color: 'error.main',
                                '&:hover': { background: 'rgba(244, 67, 54, 0.2)' }
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        {item.agency && (
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {item.agency}
                          </Typography>
                        )}
                        {item.estimated_value && (
                          <Typography variant="body2" fontWeight="bold" gutterBottom>
                            ${item.estimated_value.toLocaleString()}
                          </Typography>
                        )}
                        {item.source && (
                          <Chip
                            label={item.source}
                            size="small"
                            sx={{ mt: 0.5, mr: 0.5 }}
                          />
                        )}
                        <Chip
                          label={item.stage}
                          color={getStageColor(item.stage)}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                        {/* Processing status indicator */}
                        {item.processing_status === 'fetching_documents' && (
                          <Box sx={{ mt: 1 }}>
                            <Chip
                              label="Fetching documents..."
                              size="small"
                              color="info"
                              sx={{ mb: 0.5 }}
                            />
                            <LinearProgress sx={{ borderRadius: 1 }} />
                          </Box>
                        )}
                        {item.processing_status === 'extracting_requirements' && (
                          <Box sx={{ mt: 1 }}>
                            <Chip
                              label="Extracting requirements..."
                              size="small"
                              color="warning"
                              sx={{ mb: 0.5 }}
                            />
                            <LinearProgress color="warning" sx={{ borderRadius: 1 }} />
                          </Box>
                        )}
                        {item.processing_status === 'processing' && (
                          <Box sx={{ mt: 1 }}>
                            <Chip
                              label="Processing..."
                              size="small"
                              color="info"
                              sx={{ mb: 0.5 }}
                            />
                            <LinearProgress sx={{ borderRadius: 1 }} />
                          </Box>
                        )}
                        {item.processing_status === 'error' && (
                          <Chip
                            label="Processing failed"
                            size="small"
                            color="error"
                            sx={{ mt: 0.5, ml: 0.5 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Add Intel Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Market Intelligence</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  label="Stage"
                >
                  {STAGES.map((stage) => (
                    <MenuItem key={stage} value={stage}>
                      {stage.charAt(0).toUpperCase() + stage.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Agency"
                value={formData.agency}
                onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Estimated Value"
                type="number"
                value={formData.estimated_value || ''}
                onChange={(e) =>
                  setFormData({ ...formData, estimated_value: e.target.value ? parseFloat(e.target.value) : undefined })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Expected RFP Date"
                type="date"
                value={formData.expected_rfp_date || ''}
                onChange={(e) => setFormData({ ...formData, expected_rfp_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contract Vehicle"
                value={formData.contract_vehicle}
                onChange={(e) => setFormData({ ...formData, contract_vehicle: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Market Notes"
                multiline
                rows={3}
                value={formData.market_notes}
                onChange={(e) => setFormData({ ...formData, market_notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenDialog(false)
            resetForm()
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateIntel} disabled={!formData.title}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* SAM.gov Search Results Dialog */}
      <Dialog open={openSearchDialog} onClose={() => setOpenSearchDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">SAM.gov Search Results</Typography>
            <IconButton onClick={() => setOpenSearchDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {searchResults.length === 0 ? (
            <Alert severity="info">No results found. Try different search terms or filters.</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Agency</TableCell>
                    <TableCell>Posted Date</TableCell>
                    <TableCell>Deadline</TableCell>
                    <TableCell>Notice Type</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.map((opp, idx) => {
                    // Map SAM.gov API fields to display values
                    // Prefer 'department' (parsed from backend) over full path
                    const agency = getSamField(opp, 'department', 'fullParentPathName', 'agency', 'organizationName')
                    const postedDate = getSamField(opp, 'postedDate', 'publishDate')
                    const deadline = getSamField(opp, 'responseDeadLine', 'responseDeadline', 'archiveDate')
                    const noticeType = getSamField(opp, 'type', 'baseType', 'noticeType')
                    
                    // Format dates if present
                    const formatDate = (d: string | null) => {
                      if (!d) return 'N/A'
                      return d.substring(0, 10) // Take YYYY-MM-DD part
                    }
                    
                    return (
                      <TableRow key={idx}>
                        <TableCell>{opp.title || 'N/A'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {agency || 'N/A'}
                        </TableCell>
                        <TableCell>{formatDate(postedDate)}</TableCell>
                        <TableCell>{formatDate(deadline)}</TableCell>
                        <TableCell>{noticeType || 'N/A'}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            startIcon={<CloudDownload />}
                            onClick={() => handleImportFromSAMGov(opp)}
                          >
                            Import
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSearchDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Intel Details Dialog - Full Capture Qualification */}
      <Dialog 
        open={openDetailsDialog} 
        onClose={() => setOpenDetailsDialog(false)} 
        maxWidth="xl" 
        fullWidth
        PaperProps={{ sx: { minHeight: '80vh' } }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">{selectedIntel?.title || 'Market Intelligence'}</Typography>
              <Box display="flex" gap={1} mt={0.5}>
                {selectedIntel?.agency && (
                  <Chip label={selectedIntel.agency} size="small" variant="outlined" />
                )}
                {selectedIntel?.stage && (
                  <Chip label={selectedIntel.stage} size="small" color={getStageColor(selectedIntel.stage)} />
                )}
                {selectedIntel?.source && (
                  <Chip label={selectedIntel.source} size="small" variant="outlined" />
                )}
              </Box>
            </Box>
            <IconButton onClick={() => setOpenDetailsDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedIntel && (
            <CaptureQualification
              intel={selectedIntel}
              onUpdate={() => {
                loadIntel()
              }}
              onClose={() => setOpenDetailsDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, item: null })}>
        <DialogTitle>Delete Market Intelligence?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "<strong>{deleteDialog.item?.title}</strong>"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will also delete all associated documents and compliance data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, item: null })}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
