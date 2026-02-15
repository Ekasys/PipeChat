import { useState, useEffect } from 'react'
import {
  Typography,
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  Grid,
  Card,
  CardContent,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Add, Search, Star, Edit, Delete, Calculate } from '@mui/icons-material'
import api from '../services/api'
import PartnerForm from '../components/PartnerForm'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { opportunityService, Opportunity } from '../services/opportunityService'

interface Partner {
  id: string
  name: string
  company_name?: string
  capabilities?: string[]
  contract_vehicles?: string[]
  win_rate?: number
  fit_score?: number
  status: string
}

export default function TeamingPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [openDialog, setOpenDialog] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [openFitDialog, setOpenFitDialog] = useState(false)
  const [fitScorePartner, setFitScorePartner] = useState<Partner | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('')
  const [fitScore, setFitScore] = useState<number | null>(null)
  const [fitScoreLoading, setFitScoreLoading] = useState(false)
  const [fitScoreError, setFitScoreError] = useState<string | null>(null)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadPartners()
  }, [])

  useEffect(() => {
    if (openFitDialog) {
      loadOpportunities()
    }
  }, [openFitDialog])

  const loadPartners = async () => {
    try {
      setLoading(true)
      const response = await api.get<{ partners: Partner[] }>('/teaming/partners')
      setPartners(response.data.partners)
    } catch (error) {
      console.error('Failed to load partners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePartner = async (data: any) => {
    try {
      await api.post('/teaming/partners', data)
      showToast('Partner created successfully', 'success')
      loadPartners()
    } catch (error) {
      console.error('Failed to create partner:', error)
      showToast('Failed to create partner', 'error')
    }
  }

  const handleUpdatePartner = async (data: any) => {
    if (!selectedPartner) return
    try {
      await api.put(`/teaming/partners/${selectedPartner.id}`, data)
      showToast('Partner updated successfully', 'success')
      loadPartners()
    } catch (error) {
      console.error('Failed to update partner:', error)
      showToast('Failed to update partner', 'error')
    }
  }

  const handleDeletePartner = async (partnerId: string) => {
    if (!window.confirm('Are you sure you want to delete this partner?')) return
    try {
      await api.delete(`/teaming/partners/${partnerId}`)
      showToast('Partner deleted successfully', 'success')
      loadPartners()
    } catch (error) {
      console.error('Failed to delete partner:', error)
      showToast('Failed to delete partner', 'error')
    }
  }

  const loadOpportunities = async () => {
    try {
      const data = await opportunityService.list({ limit: 1000 })
      setOpportunities(data.opportunities)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
      showToast('Failed to load opportunities', 'error')
    }
  }

  const handleOpenFitDialog = (partner: Partner) => {
    setFitScorePartner(partner)
    setSelectedOpportunityId('')
    setFitScore(null)
    setFitScoreError(null)
    setOpenFitDialog(true)
  }

  const handleCalculateFit = async () => {
    if (!fitScorePartner || !selectedOpportunityId) {
      setFitScoreError('Please select an opportunity')
      return
    }

    try {
      setFitScoreLoading(true)
      setFitScoreError(null)
      
      const opportunity = opportunities.find(opp => opp.id === selectedOpportunityId)
      if (!opportunity) {
        setFitScoreError('Opportunity not found')
        return
      }

      // Build opportunity requirements from the selected opportunity
      const opportunityRequirements = {
        naics_codes: opportunity.naics_code ? [opportunity.naics_code] : [],
        contract_vehicle: opportunity.contract_vehicle || '',
        required_capabilities: [], // Could be extracted from opportunity description/requirements
      }

      const response = await api.post<{ fit_score: number }>(
        `/teaming/partners/${fitScorePartner.id}/calculate-fit`,
        opportunityRequirements
      )
      
      setFitScore(response.data.fit_score)
    } catch (error: any) {
      console.error('Failed to calculate fit score:', error)
      setFitScoreError(error.response?.data?.detail || 'Failed to calculate fit score')
    } finally {
      setFitScoreLoading(false)
    }
  }

  const handleCloseFitDialog = () => {
    setOpenFitDialog(false)
    setFitScorePartner(null)
    setSelectedOpportunityId('')
    setFitScore(null)
    setFitScoreError(null)
  }

  const filteredPartners = partners.filter((partner) =>
    partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Teaming & Partners</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setSelectedPartner(null)
            setOpenDialog(true)
          }}
        >
          Add Partner
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search partners by name or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
      </Paper>

      <Grid container spacing={3}>
        {filteredPartners.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No partners found. Add partners to build your teaming network.
              </Typography>
            </Paper>
          </Grid>
        ) : (
          filteredPartners.map((partner) => (
            <Grid item xs={12} md={6} lg={4} key={partner.id}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, var(--pp-slate-80) 0%, var(--pp-dark-90) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 40px rgba(99, 102, 241, 0.3)',
                  },
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Box>
                      <Typography variant="h6">{partner.name}</Typography>
                      {partner.company_name && (
                        <Typography variant="body2" color="text.secondary">
                          {partner.company_name}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={partner.status}
                      color={partner.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  {partner.fit_score !== undefined && partner.fit_score !== null && (
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Fit Score
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Rating value={(partner.fit_score || 0) / 20} readOnly precision={0.1} />
                        <Typography variant="body2">
                          {(partner.fit_score || 0).toFixed(1)}%
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {partner.win_rate !== undefined && partner.win_rate !== null && (
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        Win Rate: <strong>{(partner.win_rate || 0).toFixed(1)}%</strong>
                      </Typography>
                    </Box>
                  )}

                  {partner.capabilities && partner.capabilities.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Capabilities
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {partner.capabilities.slice(0, 3).map((cap, idx) => (
                          <Chip key={idx} label={cap} size="small" />
                        ))}
                        {partner.capabilities.length > 3 && (
                          <Chip label={`+${partner.capabilities.length - 3}`} size="small" />
                        )}
                      </Box>
                    </Box>
                  )}

                  {partner.contract_vehicles && partner.contract_vehicles.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Contract Vehicles
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {partner.contract_vehicles.slice(0, 2).map((vehicle, idx) => (
                          <Chip key={idx} label={vehicle} size="small" color="primary" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  <Box display="flex" gap={1} mt={2}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => {
                        setSelectedPartner(partner)
                        setOpenDialog(true)
                      }}
                    >
                      <Edit sx={{ mr: 0.5 }} />
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      fullWidth
                      startIcon={<Calculate />}
                      onClick={() => handleOpenFitDialog(partner)}
                    >
                      Calculate Fit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDeletePartner(partner.id)}
                    >
                      <Delete />
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <PartnerForm
        open={openDialog}
        onClose={() => {
          setOpenDialog(false)
          setSelectedPartner(null)
        }}
        onSubmit={selectedPartner ? handleUpdatePartner : handleCreatePartner}
        initialData={selectedPartner || undefined}
      />

      {/* Fit Score Calculation Dialog */}
      <Dialog open={openFitDialog} onClose={handleCloseFitDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Calculate Fit Score
          {fitScorePartner && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Partner: {fitScorePartner.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Select Opportunity</InputLabel>
              <Select
                value={selectedOpportunityId}
                label="Select Opportunity"
                onChange={(e) => setSelectedOpportunityId(e.target.value)}
                disabled={fitScoreLoading}
              >
                {opportunities.map((opp) => (
                  <MenuItem key={opp.id} value={opp.id}>
                    {opp.name} {opp.agency && `- ${opp.agency}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {fitScoreLoading && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                  Calculating fit score...
                </Typography>
              </Box>
            )}

            {fitScoreError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {fitScoreError}
              </Alert>
            )}

            {fitScore !== null && !fitScoreLoading && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Fit Score
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 3,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                  }}
                >
                  <Box
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `conic-gradient(from 0deg, #667eea 0%, #667eea ${fitScore}%, rgba(99, 102, 241, 0.1) ${fitScore}%)`,
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: 'var(--pp-dark-90)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                      }}
                    >
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#667eea' }}>
                        {(fitScore || 0).toFixed(0)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        / 100
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Fit Score Breakdown
                    </Typography>
                    <Typography variant="body2">
                      • NAICS Match: {(fitScorePartner as any)?.naics_codes?.length ? 'Yes' : 'No'}
                    </Typography>
                    <Typography variant="body2">
                      • Contract Vehicles: {fitScorePartner?.contract_vehicles?.length || 0}
                    </Typography>
                    <Typography variant="body2">
                      • Capabilities: {fitScorePartner?.capabilities?.length || 0}
                    </Typography>
                    <Typography variant="body2">
                      • Win Rate: {fitScorePartner?.win_rate || 0}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFitDialog}>Close</Button>
          <Button
            variant="contained"
            onClick={handleCalculateFit}
            disabled={!selectedOpportunityId || fitScoreLoading}
            startIcon={fitScoreLoading ? <CircularProgress size={20} /> : <Calculate />}
          >
            Calculate
          </Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </Box>
  )
}

