import { useEffect, useMemo, useState } from 'react'
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
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import { format } from 'date-fns'
import { Proposal, ProposalVolume, proposalService } from '../services/proposalService'
import FileUpload from './FileUpload'
import { Document } from '../services/documentService'
import { documentService } from '../services/documentService'
import FlowStepper, { FinalState, FlowStep } from './FlowStepper'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'
import VolumeForm from './VolumeForm'
import {
  Brush,
  Bolt,
  WorkspacePremium,
  Send,
  EmojiEvents,
  MoodBad,
  Add,
  Edit,
  Delete,
  Folder,
  Visibility,
} from '@mui/icons-material'

interface ProposalDetailProps {
  open: boolean
  onClose: () => void
  proposal: Proposal | null
  onEdit?: () => void
  onProposalUpdated?: (proposal: Proposal) => void
}

export default function ProposalDetail({
  open,
  onClose,
  proposal,
  onEdit,
  onProposalUpdated,
}: ProposalDetailProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [volumes, setVolumes] = useState<ProposalVolume[]>([])
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(proposal)
  const [phaseUpdating, setPhaseUpdating] = useState(false)
  const [openVolumeForm, setOpenVolumeForm] = useState(false)
  const [openVolumeView, setOpenVolumeView] = useState(false)
  const [selectedVolume, setSelectedVolume] = useState<ProposalVolume | null>(null)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    console.log('ProposalDetail: Proposal prop changed:', {
      proposal,
      proposalId: proposal?.id,
      hasProposal: !!proposal,
    })
    setCurrentProposal(proposal)
  }, [proposal])

  useEffect(() => {
    if (open && currentProposal?.id) {
      console.log('ProposalDetail: Loading data for proposal:', currentProposal.id)
      loadDocuments()
      loadVolumes()
    } else if (open && !currentProposal?.id) {
      console.error('ProposalDetail: Dialog opened but proposal ID is missing:', {
        proposal,
        currentProposal,
      })
    }
  }, [open, currentProposal?.id])

  const loadDocuments = async () => {
    if (!currentProposal?.id) return
    try {
      const data = await documentService.list({ proposal_id: currentProposal.id })
      setDocuments(data.documents)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const loadVolumes = async () => {
    if (!currentProposal?.id) {
      console.error('ProposalDetail: Cannot load volumes - proposal ID is missing')
      return
    }
    
    // First verify the proposal exists
    try {
      console.log('ProposalDetail: Verifying proposal exists before loading volumes:', currentProposal.id)
      const verifiedProposal = await proposalService.get(currentProposal.id)
      console.log('ProposalDetail: Proposal verified:', verifiedProposal.id)
    } catch (error: any) {
      console.error('ProposalDetail: Proposal verification failed:', error)
      if (error?.response?.status === 404) {
        const detail = error?.response?.data?.detail || 'Proposal not found'
        showToast(`${detail} (ID: ${currentProposal.id}). The proposal may belong to another tenant and will be hidden.`, 'warning')
        // Close dialog and surface removal to parent by clearing currentProposal
        setCurrentProposal(null)
        onClose()
        return
      }
    }
    
    try {
      console.log('ProposalDetail: Loading volumes for proposal:', currentProposal.id)
      const data = await proposalService.listVolumes(currentProposal.id)
      console.log('ProposalDetail: Loaded volumes:', data.volumes.length)
      setVolumes(data.volumes)
    } catch (error: any) {
      console.error('ProposalDetail: Failed to load volumes:', error)
      console.error('Error details:', {
        status: error?.response?.status,
        data: error?.response?.data,
        proposalId: currentProposal?.id,
      })
      if (error?.response?.status === 404) {
        // Treat missing proposal as no volumes to avoid breaking the UI
        setVolumes([])
        return
      }
    }
  }

  const handleDocumentUpload = (document: Document) => {
    setDocuments(prev => [...prev, document])
  }

  const handleDocumentDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId))
  }

  const handleVolumeSubmit = (volume: ProposalVolume) => {
    if (selectedVolume) {
      setVolumes(prev => prev.map(v => (v.id === volume.id ? volume : v)))
    } else {
      setVolumes(prev => [...prev, volume])
    }
    setSelectedVolume(null)
  }

  const handleViewVolume = (volume: ProposalVolume) => {
    setSelectedVolume(volume)
    setOpenVolumeView(true)
  }

  const handleEditVolume = (volume: ProposalVolume) => {
    console.log('ProposalDetail: Opening edit volume form:', {
      volumeId: volume.id,
      proposalId: currentProposal?.id,
    })
    setSelectedVolume(volume)
    setOpenVolumeForm(true)
  }

  const handleDeleteVolume = async (volumeId: string) => {
    if (!currentProposal?.id) return
    if (!window.confirm('Are you sure you want to delete this volume?')) return

    try {
      await proposalService.deleteVolume(currentProposal.id, volumeId)
      setVolumes(prev => prev.filter(v => v.id !== volumeId))
      showToast('Volume deleted successfully', 'success')
    } catch (error: any) {
      console.error('Failed to delete volume:', error)
      const errorMessage =
        error?.response?.data?.detail || error?.message || 'Failed to delete volume'
      showToast(errorMessage, 'error')
    }
  }

  const getVolumeStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      in_review: 'warning',
      approved: 'primary',
      final: 'success',
      locked: 'error',
    }
    return colors[status] || 'default'
  }

  const getVolumeTypeLabel = (type?: string) => {
    if (!type) return '—'
    const labels: Record<string, string> = {
      technical: 'Technical',
      management: 'Management',
      past_performance: 'Past Performance',
      pricing: 'Pricing',
      executive_summary: 'Executive Summary',
      other: 'Other',
    }
    return labels[type] || type
  }
  
  const getSourceLabel = (source?: string) => {
    const labels: Record<string, string> = {
      rfp: 'RFP',
      user: 'User',
      template: 'Template',
    }
    return labels[source || 'user'] || 'User'
  }
  
  const getSourceColor = (source?: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      rfp: 'primary',
      user: 'default',
      template: 'secondary',
    }
    return colors[source || 'user'] || 'default'
  }

  const getPhaseChipColor = (phase: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      pink_team: 'secondary',
      red_team: 'error',
      gold_team: 'warning',
      submitted: 'success',
      won: 'success',
      lost: 'error',
    }
    return colors[phase] || 'default'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      in_review: 'warning',
      approved: 'primary',
      submitted: 'success',
    }
    return colors[status] || 'default'
  }

  const proposalSteps: FlowStep[] = useMemo(
    () => [
      {
        value: 'pink_team',
        label: 'Pink Team',
        description: 'Storyboards & compliance alignment',
        icon: <Brush fontSize="small" />,
        accentColor: '#ec4899',
      },
      {
        value: 'red_team',
        label: 'Red Team',
        description: 'Competitive critique & gap closure',
        icon: <Bolt fontSize="small" />,
        accentColor: '#f87171',
      },
      {
        value: 'gold_team',
        label: 'Gold Team',
        description: 'Final polish & leadership sign-off',
        icon: <WorkspacePremium fontSize="small" />,
        accentColor: '#fbbf24',
      },
      {
        value: 'submitted',
        label: 'Submitted',
        description: 'Package delivered to the customer',
        icon: <Send fontSize="small" />,
        accentColor: '#22d3ee',
      },
    ],
    []
  )

  const proposalFinalStates: Record<string, FinalState> = useMemo(
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
    }),
    []
  )

  const handlePhaseChange = async (newPhase: string) => {
    if (!currentProposal || phaseUpdating || newPhase === currentProposal.current_phase) return

    try {
      setPhaseUpdating(true)
      const updated = await proposalService.transitionPhase(currentProposal.id, newPhase)
      setCurrentProposal(updated)
      onProposalUpdated?.(updated)
      showToast(`Moved to ${newPhase.replace('_', ' ').toUpperCase()} phase`, 'success')
    } catch (error: any) {
      console.error('Failed to update proposal phase:', error)
      const errorMessage =
        error?.response?.data?.detail || error?.message || 'Failed to update proposal phase'
      showToast(errorMessage, 'error')
    } finally {
      setPhaseUpdating(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Proposal Details
      </DialogTitle>
      <DialogContent>
        {!currentProposal ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No proposal selected.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 3 }}>
              <FlowStepper
                steps={proposalSteps}
                current={currentProposal.current_phase}
                onStepChange={handlePhaseChange}
                loading={phaseUpdating}
                finalStates={proposalFinalStates}
              />
              {!['won', 'lost'].includes(currentProposal.current_phase) && (
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
                    onClick={() => handlePhaseChange('won')}
                    disabled={phaseUpdating}
                  >
                    Mark as Won
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handlePhaseChange('lost')}
                    disabled={phaseUpdating}
                  >
                    Mark as Lost
                  </Button>
                </Box>
              )}
            </Box>

            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  {currentProposal.name}
                </Typography>
                <Box display="flex" gap={1} mb={2}>
                  <Chip
                    label={currentProposal.current_phase.replace('_', ' ').toUpperCase()}
                    color={getPhaseChipColor(currentProposal.current_phase)}
                    size="small"
                  />
                  <Chip
                    label={currentProposal.status}
                    color={getStatusColor(currentProposal.status)}
                    size="small"
                  />
                  {currentProposal.version && (
                    <Chip label={`v${currentProposal.version}`} size="small" />
                  )}
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Proposal ID
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {currentProposal.id}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Opportunity ID
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {currentProposal.opportunity_id || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Current Phase
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {currentProposal.current_phase.replace('_', ' ').toUpperCase()}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {currentProposal.status}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Version
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {currentProposal.version || '1.0'}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {format(new Date(currentProposal.created_at), 'MM/dd/yyyy HH:mm')}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {format(new Date(currentProposal.updated_at), 'MM/dd/yyyy HH:mm')}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 3, backgroundColor: 'background.paper' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Folder color="primary" />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Proposal Volumes
                      </Typography>
                      {volumes.length > 0 && (
                        <Chip
                          label={`${volumes.length} ${volumes.length === 1 ? 'Volume' : 'Volumes'}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<Add />}
                      onClick={() => {
                        console.log('ProposalDetail: Opening add volume form:', {
                          proposalId: currentProposal?.id,
                          proposal: currentProposal,
                        })
                        if (!currentProposal?.id) {
                          showToast('Proposal ID is missing. Please try refreshing the page.', 'error')
                          return
                        }
                        setSelectedVolume(null)
                        setOpenVolumeForm(true)
                      }}
                      sx={{ fontWeight: 600 }}
                      disabled={!currentProposal?.id}
                    >
                      Add Volume
                    </Button>
                  </Box>
                  {volumes.length === 0 ? (
                    <Box
                      sx={{
                        py: 4,
                        textAlign: 'center',
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                      }}
                    >
                      <Folder sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                        No volumes yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Create your first volume to organize your proposal content
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Add />}
                        onClick={() => {
                          if (!currentProposal?.id) {
                            showToast('Proposal ID is missing. Please try refreshing the page.', 'error')
                            return
                          }
                          setSelectedVolume(null)
                          setOpenVolumeForm(true)
                        }}
                        disabled={!currentProposal?.id}
                      >
                        Create Volume
                      </Button>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Volume Name</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Sections</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Pages</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Words</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              Actions
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {volumes.map((volume) => (
                            <TableRow
                              key={volume.id}
                              hover
                              sx={{
                                '&:hover': {
                                  backgroundColor: 'action.hover',
                                },
                              }}
                            >
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Folder fontSize="small" color="action" />
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {volume.name}
                                  </Typography>
                                </Box>
                                {volume.description && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', mt: 0.5 }}
                                  >
                                    {volume.description.length > 50
                                      ? `${volume.description.substring(0, 50)}...`
                                      : volume.description}
                                  </Typography>
                                )}
                              </TableCell>
                            <TableCell>
                              {volume.volume_type ? (
                                <Chip
                                  label={getVolumeTypeLabel(volume.volume_type)}
                                  size="small"
                                  variant="outlined"
                                />
                              ) : (
                                <Typography variant="body2" color="text.secondary">—</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5} flexDirection="column">
                                <Chip
                                  label={volume.status.replace('_', ' ')}
                                  color={getVolumeStatusColor(volume.status)}
                                  size="small"
                                />
                                <Chip
                                  label={getSourceLabel(volume.source)}
                                  color={getSourceColor(volume.source)}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </TableCell>
                            <TableCell>
                              {volume.rfp_reference ? (
                                <Box>
                                  {volume.rfp_reference.section_number && (
                                    <Typography variant="caption" display="block">
                                      § {volume.rfp_reference.section_number}
                                    </Typography>
                                  )}
                                  {volume.rfp_reference.page_range && (
                                    <Typography variant="caption" display="block" color="text.secondary">
                                      {volume.rfp_reference.page_range}
                                    </Typography>
                                  )}
                                </Box>
                              ) : volume.rfp_sections && volume.rfp_sections.length > 0 ? (
                                <Typography variant="body2">
                                  {volume.rfp_sections.join(', ')}
                                </Typography>
                              ) : (
                                <Typography variant="body2">—</Typography>
                              )}
                            </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {volume.page_count || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {volume.word_count ? volume.word_count.toLocaleString() : '—'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Box display="flex" gap={0.5} justifyContent="flex-end">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleViewVolume(volume)}
                                    title="View volume"
                                  >
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditVolume(volume)}
                                    disabled={volume.status === 'locked'}
                                    title="Edit volume"
                                    color="primary"
                                  >
                                    <Edit fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteVolume(volume.id)}
                                    disabled={volume.status === 'locked'}
                                    color="error"
                                    title="Delete volume"
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Documents
                </Typography>
                <FileUpload
                  proposalId={currentProposal.id}
                  existingDocuments={documents}
                  onUploadComplete={handleDocumentUpload}
                  onDelete={handleDocumentDelete}
                />
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        {onEdit && currentProposal && (
          <Button onClick={onEdit} variant="contained">
            Edit
          </Button>
        )}
      </DialogActions>
      {currentProposal?.id ? (
        <VolumeForm
          open={openVolumeForm}
          onClose={() => {
            setOpenVolumeForm(false)
            setSelectedVolume(null)
          }}
          onSubmit={handleVolumeSubmit}
          proposalId={currentProposal.id}
          initialData={selectedVolume || undefined}
        />
      ) : openVolumeForm ? (
        <Dialog open={openVolumeForm} onClose={() => setOpenVolumeForm(false)}>
          <DialogTitle>Error</DialogTitle>
          <DialogContent>
            <Typography color="error">
              Proposal ID is missing. Cannot create volume. Please close this dialog and try again.
            </Typography>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Proposal: {currentProposal ? JSON.stringify(currentProposal, null, 2) : 'null'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenVolumeForm(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      ) : null}
      <Dialog open={openVolumeView} onClose={() => setOpenVolumeView(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Volume Details</DialogTitle>
        <DialogContent dividers>
          {selectedVolume ? (
            <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {selectedVolume.name}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {selectedVolume.volume_type && (
                  <Chip label={getVolumeTypeLabel(selectedVolume.volume_type)} size="small" variant="outlined" />
                )}
                <Chip
                  label={selectedVolume.status.replace('_', ' ')}
                  color={getVolumeStatusColor(selectedVolume.status)}
                  size="small"
                />
                <Chip
                  label={getSourceLabel(selectedVolume.source)}
                  color={getSourceColor(selectedVolume.source)}
                  size="small"
                  variant="outlined"
                />
              </Box>
              {selectedVolume.rfp_reference && (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    RFP Reference
                  </Typography>
                  {selectedVolume.rfp_reference.section_number && (
                    <Typography variant="body2">
                      Section: {selectedVolume.rfp_reference.section_number}
                    </Typography>
                  )}
                  {selectedVolume.rfp_reference.page_range && (
                    <Typography variant="body2">
                      Pages: {selectedVolume.rfp_reference.page_range}
                    </Typography>
                  )}
                  {selectedVolume.rfp_reference.clause_text_snippet && (
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                      "{selectedVolume.rfp_reference.clause_text_snippet}"
                    </Typography>
                  )}
                </Box>
              )}
              {selectedVolume.sections && selectedVolume.sections.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Sections ({selectedVolume.sections.length})
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    {selectedVolume.sections.map((section) => (
                      <Typography key={section.id} variant="body2" sx={{ pl: 2 }}>
                        • {section.heading}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
              {selectedVolume.description && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedVolume.description}
                  </Typography>
                </Box>
              )}
              {selectedVolume.executive_summary && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Executive Summary
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedVolume.executive_summary}
                  </Typography>
                </Box>
              )}
              {selectedVolume.technical_approach && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Technical Approach
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedVolume.technical_approach}
                  </Typography>
                </Box>
              )}
              {selectedVolume.content && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Content
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedVolume.content}
                  </Typography>
                </Box>
              )}
              {selectedVolume.compliance_notes && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Compliance Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedVolume.compliance_notes}
                  </Typography>
                </Box>
              )}
              <Box display="flex" gap={2}>
                <Typography variant="body2">Pages: {selectedVolume.page_count || '—'}</Typography>
                <Typography variant="body2">
                  Words: {selectedVolume.word_count ? selectedVolume.word_count.toLocaleString() : '—'}
                </Typography>
              </Box>
              <Box display="flex" gap={2}>
                <Typography variant="body2">Page Limit: {selectedVolume.page_limit || '—'}</Typography>
                <Typography variant="body2">
                  RFP Sections:{' '}
                  {selectedVolume.rfp_sections && selectedVolume.rfp_sections.length > 0
                    ? selectedVolume.rfp_sections.join(', ')
                    : '—'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No volume selected.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVolumeView(false)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </Dialog>
  )
}

