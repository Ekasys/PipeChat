import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Chip,
  Divider,
  Tabs,
  Tab,
} from '@mui/material'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Opportunity, opportunityService } from '../services/opportunityService'
import FileUpload from './FileUpload'
import { Document } from '../services/documentService'
import { useState, useEffect, useMemo } from 'react'
import { documentService } from '../services/documentService'
import FlowStepper, { FinalState, FlowStep } from './FlowStepper'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'
import {
  Search,
  DirectionsRun,
  Description,
  Handshake,
  MilitaryTech,
  EmojiEvents,
  MoodBad,
  Backspace,
} from '@mui/icons-material'

interface OpportunityDetailProps {
  open: boolean
  onClose: () => void
  opportunity: Opportunity | null
  onEdit?: () => void
  onStageUpdated?: (opportunity: Opportunity) => void
}

export default function OpportunityDetail({
  open,
  onClose,
  opportunity,
  onEdit,
  onStageUpdated,
}: OpportunityDetailProps) {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [tabValue, setTabValue] = useState(0)
  const [currentOpportunity, setCurrentOpportunity] = useState<Opportunity | null>(opportunity)
  const [stageUpdating, setStageUpdating] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    setCurrentOpportunity(opportunity)
  }, [opportunity])

  useEffect(() => {
    if (open && currentOpportunity?.id) {
      loadDocuments()
      setTabValue(0)
    }
  }, [open, currentOpportunity?.id])

  const loadDocuments = async () => {
    if (!currentOpportunity?.id) return
    try {
      const data = await documentService.list({ opportunity_id: currentOpportunity.id })
      setDocuments(data.documents)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const handleDocumentUpload = (document: Document) => {
    setDocuments(prev => [...prev, document])
  }

  const handleDocumentDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId))
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

  const formatDateValue = (value?: string) =>
    value ? format(new Date(value), 'MM/dd/yyyy') : 'N/A'

  const getStageColor = (stage: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
      qualification: 'secondary',
      pursuit: 'primary',
      proposal: 'warning',
      negotiation: 'success',
      award: 'info',
      won: 'success',
      lost: 'error',
    }
    return colors[stage] || 'default'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      active: 'primary',
      won: 'success',
      lost: 'error',
      withdrawn: 'default',
    }
    return colors[status] || 'default'
  }

  const stageSteps: FlowStep[] = useMemo(
    () => [
      {
        value: 'qualification',
        label: 'Qualification',
        description: 'Gate reviews, intel, and teaming analysis',
        icon: <Search fontSize="small" />,
        accentColor: '#38bdf8',
      },
      {
        value: 'pursuit',
        label: 'Pursuit',
        description: 'Customer shaping and solution alignment',
        icon: <DirectionsRun fontSize="small" />,
        accentColor: '#6366f1',
      },
      {
        value: 'proposal',
        label: 'Proposal',
        description: 'Capture planning and proposal development',
        icon: <Description fontSize="small" />,
        accentColor: '#a855f7',
      },
      {
        value: 'negotiation',
        label: 'Negotiation',
        description: 'Discussions, clarifications, and BAFO',
        icon: <Handshake fontSize="small" />,
        accentColor: '#f97316',
      },
      {
        value: 'award',
        label: 'Award Decision',
        description: 'Competitive range and decision milestone',
        icon: <MilitaryTech fontSize="small" />,
        accentColor: '#22d3ee',
      },
    ],
    []
  )

  const stageFinalStates: Record<string, FinalState> = useMemo(
    () => ({
      won: {
        label: 'Awarded',
        color: '#22c55e',
        icon: <EmojiEvents fontSize="small" />,
      },
      lost: {
        label: 'Not Selected',
        color: '#f97316',
        icon: <MoodBad fontSize="small" />,
      },
      withdrawn: {
        label: 'Withdrawn',
        color: '#94a3b8',
        icon: <Backspace fontSize="small" />,
      },
    }),
    []
  )

  const handleStageChange = async (newStage: string) => {
    if (!currentOpportunity || stageUpdating || newStage === currentOpportunity.stage) return

    const payload: Partial<Opportunity> = { stage: newStage }
    if (newStage === 'won') {
      payload.status = 'won'
    } else if (newStage === 'lost') {
      payload.status = 'lost'
    } else if (newStage === 'withdrawn') {
      payload.status = 'withdrawn'
    }

    try {
      setStageUpdating(true)
      const updated = await opportunityService.update(currentOpportunity.id, payload)
      setCurrentOpportunity(updated)
      onStageUpdated?.(updated)
      showToast(`Stage moved to ${newStage.replace('_', ' ').toUpperCase()}`, 'success')
    } catch (error: any) {
      console.error('Failed to update opportunity stage:', error)
      const errorMessage =
        error?.response?.data?.detail || error?.message || 'Failed to update opportunity stage'
      showToast(errorMessage, 'error')
    } finally {
      setStageUpdating(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {currentOpportunity?.name || 'Opportunity Details'}
        {currentOpportunity && (
          <Box display="flex" gap={1} mt={1}>
            <Chip label={currentOpportunity.stage} color={getStageColor(currentOpportunity.stage)} size="small" />
            <Chip label={currentOpportunity.status} color={getStatusColor(currentOpportunity.status)} size="small" />
          </Box>
        )}
      </DialogTitle>
      <DialogContent>
        {!currentOpportunity ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No opportunity selected.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                <Tab label="Details" />
                <Tab label="Documents" />
              </Tabs>
            </Box>

            {tabValue === 0 && (
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <FlowStepper
                    steps={stageSteps}
                    current={currentOpportunity.stage}
                    onStepChange={handleStageChange}
                    loading={stageUpdating}
                    finalStates={stageFinalStates}
                  />
                  {!['won', 'lost', 'withdrawn'].includes(currentOpportunity.stage) && (
                    <Box
                      sx={{
                        mt: 2,
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => handleStageChange('won')}
                        disabled={stageUpdating}
                      >
                        Mark as Won
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => handleStageChange('lost')}
                        disabled={stageUpdating}
                      >
                        Mark as Lost
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => handleStageChange('withdrawn')}
                        disabled={stageUpdating}
                      >
                        Withdraw Opportunity
                      </Button>
                    </Box>
                  )}
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                {currentOpportunity.summary && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Opportunity Summary
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ mt: 1, whiteSpace: 'pre-wrap' }}
                    >
                      {currentOpportunity.summary}
                    </Typography>
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Agency
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.agency || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Sub Agency
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.sub_agency || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Opportunity Status
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.status}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    BD Status
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.bd_status || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Stage
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.stage}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Value
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatCurrency(currentOpportunity.value)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    PWin
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.pwin ? `${currentOpportunity.pwin}%` : 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Price-to-Win
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatCurrency(currentOpportunity.ptw)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    RFP/RFI Submission Date
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatDateValue(currentOpportunity.rfp_submission_date)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    BD Due Date
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatDateValue(currentOpportunity.due_date)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Award Date
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatDateValue(currentOpportunity.award_date)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Next Task Due
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatDateValue(currentOpportunity.next_task_due)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Capture Manager Assigned
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.capture_manager || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Role (Prime/Sub)
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.role ? currentOpportunity.role.toUpperCase() : 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Contract Vehicle
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.contract_vehicle || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Number of Years
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {currentOpportunity.number_of_years !== undefined && currentOpportunity.number_of_years !== null
                      ? currentOpportunity.number_of_years
                      : 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatDateValue(currentOpportunity.created_at)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {formatDateValue(currentOpportunity.updated_at)}
                  </Typography>
                </Grid>

                {currentOpportunity.next_task_comments && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Next Task Comments
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                      {currentOpportunity.next_task_comments}
                    </Typography>
                  </Grid>
                )}

                {currentOpportunity.history_notes && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      History & Notes
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                      {currentOpportunity.history_notes}
                    </Typography>
                  </Grid>
                )}

                {currentOpportunity.agency_pocs && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Agency Points of Contact
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                      {currentOpportunity.agency_pocs}
                    </Typography>
                  </Grid>
                )}

                {currentOpportunity.business_sectors && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Business Sectors
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {currentOpportunity.business_sectors
                        .split(/[,\n]+/)
                        .map((sector) => sector.trim())
                        .filter(Boolean)
                        .map((sector, idx) => (
                          <Chip key={`${sector}-${idx}`} label={sector} size="small" />
                        ))}
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      onClose()
                      navigate(`/opportunities/${currentOpportunity.id}/proposals`)
                    }}
                    sx={{ mt: 2 }}
                  >
                    Open Proposal Workspace
                  </Button>
                </Grid>
              </Grid>
            )}

            {tabValue === 1 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Documents
                </Typography>
                <FileUpload
                  opportunityId={currentOpportunity.id}
                  existingDocuments={documents}
                  onUploadComplete={handleDocumentUpload}
                  onDelete={handleDocumentDelete}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        {onEdit && currentOpportunity && (
          <Button onClick={onEdit} variant="contained">
            Edit
          </Button>
        )}
      </DialogActions>
      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </Dialog>
  )
}

