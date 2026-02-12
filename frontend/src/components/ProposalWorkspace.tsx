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
} from '@mui/material'
import { Add, Edit, Visibility, AutoAwesome, Download } from '@mui/icons-material'
import { proposalService, Proposal } from '../services/proposalService'
import ProposalForm from './ProposalForm'
import ProposalDetail from './ProposalDetail'
import ProposalAIAssistant from './ProposalAIAssistant'
import Toast from './Toast'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from './LoadingSpinner'
import { format } from 'date-fns'

interface ProposalWorkspaceProps {
  opportunityId: string
  opportunityName?: string
}

export default function ProposalWorkspace({ opportunityId, opportunityName }: ProposalWorkspaceProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [openDetailDialog, setOpenDetailDialog] = useState(false)
  const [openAIDialog, setOpenAIDialog] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (opportunityId) {
      loadProposals()
    }
  }, [opportunityId])

  const loadProposals = async () => {
    try {
      setLoading(true)
      console.log('ProposalWorkspace: Loading proposals for opportunityId:', opportunityId)
      // Filter by opportunity_id on the backend for better performance
      const data = await proposalService.list(opportunityId)
      console.log('ProposalWorkspace: Received proposals:', data.proposals.length)
      // Additional client-side filter as safety measure
      const filtered = data.proposals.filter(p => p.opportunity_id === opportunityId)
      console.log('ProposalWorkspace: Filtered proposals:', filtered.length)
      setProposals(filtered)
    } catch (error) {
      console.error('Failed to load proposals:', error)
      showToast('Failed to load proposals', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProposal = async (data: any) => {
    try {
      if (!data.name) {
        showToast('Proposal name is required', 'error')
        return
      }
      
      await proposalService.create({
        ...data,
        opportunity_id: opportunityId,
      })
      showToast('Proposal created successfully', 'success')
      setOpenDialog(false)
      setSelectedProposal(null)
      loadProposals()
    } catch (error: any) {
      console.error('Failed to create proposal:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create proposal'
      showToast(errorMessage, 'error')
    }
  }

  const handleUpdateProposal = async (data: any) => {
    if (!selectedProposal) return
    try {
      // Ensure opportunity_id cannot be changed - always use the original
      const updateData = {
        ...data,
        opportunity_id: selectedProposal.opportunity_id || opportunityId, // Preserve original opportunity
      }
      await proposalService.update(selectedProposal.id, updateData)
      showToast('Proposal updated successfully', 'success')
      setOpenDialog(false)
      setSelectedProposal(null)
      loadProposals()
    } catch (error: any) {
      console.error('Failed to update proposal:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update proposal'
      showToast(errorMessage, 'error')
    }
  }

  const handleEditClick = async (proposal: Proposal) => {
    try {
      const fullProposal = await proposalService.get(proposal.id)
      setSelectedProposal(fullProposal)
      setOpenDialog(true)
    } catch (error: any) {
      console.error('Failed to load proposal:', error)
      showToast('Failed to load proposal details', 'error')
    }
  }

  const handleViewClick = async (proposal: Proposal) => {
    try {
      const fullProposal = await proposalService.get(proposal.id)
      setSelectedProposal(fullProposal)
      setOpenDetailDialog(true)
    } catch (error: any) {
      console.error('Failed to load proposal:', error)
      showToast('Failed to load proposal details', 'error')
    }
  }

  const handleProposalPhaseUpdated = (updated: Proposal) => {
    setSelectedProposal(updated)
    loadProposals()
  }

  const getPhaseColor = (phase: string) => {
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

  const getPhaseLabel = (phase: string) => {
    return phase.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const handleExportProposal = async (proposal: Proposal) => {
    try {
      const blob = await proposalService.export(proposal.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${proposal.name.replace(/\s+/g, '_')}_v${proposal.version || '1.0'}.docx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      showToast('Proposal exported successfully', 'success')
    } catch (error: any) {
      console.error('Failed to export proposal:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to export proposal'
      showToast(errorMessage, 'error')
    }
  }

  const handleExportAll = async () => {
    // Export the first proposal for now (can be enhanced to export all)
    if (proposals.length > 0) {
      await handleExportProposal(proposals[0])
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading proposals..." />
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Proposal Workspace
          {opportunityName && (
            <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
              - {opportunityName}
            </Typography>
          )}
        </Typography>
        <Box display="flex" gap={1}>
          {proposals.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportAll}
            >
              Export All
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setSelectedProposal(null)
              setOpenDialog(true)
            }}
          >
            New Proposal
          </Button>
        </Box>
      </Box>

      {proposals.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No proposals found for this opportunity.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setSelectedProposal(null)
              setOpenDialog(true)
            }}
            sx={{ mt: 2 }}
          >
            Create First Proposal
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Phase</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
                <TableCell>Export</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell>{proposal.name}</TableCell>
                  <TableCell>{proposal.version || '1.0'}</TableCell>
                  <TableCell>
                    <Chip
                      label={getPhaseLabel(proposal.current_phase || 'pink_team')}
                      color={getPhaseColor(proposal.current_phase || 'pink_team')}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={proposal.status || 'draft'}
                      color={proposal.status === 'submitted' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {proposal.created_at
                      ? format(new Date(proposal.created_at), 'MM/dd/yyyy')
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewClick(proposal)}
                      sx={{
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.2)',
                        },
                      }}
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(proposal)}
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
                        setSelectedProposal(proposal)
                        setOpenAIDialog(true)
                      }}
                      sx={{
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.2)',
                        },
                      }}
                      title="AI Assistant"
                    >
                      <AutoAwesome />
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleExportProposal(proposal)}
                      sx={{
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.2)',
                        },
                      }}
                      title="Export to Word"
                    >
                      <Download />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ProposalForm
        open={openDialog}
        onClose={() => {
          setOpenDialog(false)
          setSelectedProposal(null)
        }}
        onSubmit={selectedProposal ? handleUpdateProposal : handleCreateProposal}
        initialData={selectedProposal || undefined}
        lockedOpportunityId={opportunityId}
        lockedOpportunityName={opportunityName}
      />
      <ProposalDetail
        open={openDetailDialog}
        onClose={() => {
          setOpenDetailDialog(false)
          setSelectedProposal(null)
        }}
        proposal={selectedProposal}
        onEdit={() => {
          setOpenDetailDialog(false)
          setOpenDialog(true)
        }}
        onProposalUpdated={handleProposalPhaseUpdated}
      />
      <ProposalAIAssistant
        open={openAIDialog}
        onClose={() => {
          setOpenAIDialog(false)
          setSelectedProposal(null)
        }}
        proposalId={selectedProposal?.id || ''}
        proposalName={selectedProposal?.name}
        opportunityId={opportunityId}
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

