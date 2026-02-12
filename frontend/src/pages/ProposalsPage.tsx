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
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import { Add, Edit, Visibility } from '@mui/icons-material'
import api from '../services/api'
import { proposalService, Proposal } from '../services/proposalService'
import { opportunityService, Opportunity } from '../services/opportunityService'
import ProposalForm from '../components/ProposalForm'
import ProposalDetail from '../components/ProposalDetail'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from '../components/LoadingSpinner'

const phases = ['pink_team', 'red_team', 'gold_team', 'submitted']

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [openDetailDialog, setOpenDetailDialog] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadProposals()
    loadOpportunities()
  }, [])

  const loadProposals = async () => {
    try {
      setLoading(true)
      const data = await proposalService.list()
      setProposals(data.proposals)
    } catch (error) {
      console.error('Failed to load proposals:', error)
      showToast('Failed to load proposals', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadOpportunities = async () => {
    try {
      const data = await opportunityService.list({ limit: 100 })
      setOpportunities(data.opportunities)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
    }
  }

  const handleCreateProposal = async (data: any) => {
    try {
      if (!data.name || !data.opportunity_id) {
        showToast('Name and Opportunity are required', 'error')
        return
      }
      
      console.log('ProposalsPage: Creating proposal with data:', data)
      const createdProposal = await proposalService.create(data)
      console.log('ProposalsPage: Proposal created successfully:', createdProposal.id)
      showToast('Proposal created successfully', 'success')
      setOpenDialog(false)
      setSelectedProposal(null)
      loadProposals()
    } catch (error: any) {
      console.error('Failed to create proposal:', error)
      console.error('Create proposal error details:', {
        status: error?.response?.status,
        data: error?.response?.data,
      })
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create proposal'
      showToast(errorMessage, 'error')
    }
  }

  const handleUpdateProposal = async (data: any) => {
    if (!selectedProposal) return
    try {
      await proposalService.update(selectedProposal.id, data)
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
      // Fetch full proposal details if needed
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
      console.log('ProposalsPage: Viewing proposal:', {
        id: proposal.id,
        name: proposal.name,
        fullProposal: proposal,
      })
      // Fetch full proposal details
      const fullProposal = await proposalService.get(proposal.id)
      console.log('ProposalsPage: Loaded proposal:', {
        id: fullProposal.id,
        name: fullProposal.name,
        fullProposal: fullProposal,
      })
      setSelectedProposal(fullProposal)
      setOpenDetailDialog(true)
    } catch (error: any) {
      console.error('ProposalsPage: Failed to load proposal:', error)
      console.error('Load proposal error details:', {
        status: error?.response?.status,
        data: error?.response?.data,
        proposalId: proposal.id,
        proposal: proposal,
      })

      if (error?.response?.status === 404) {
        // If the proposal is not accessible (likely different tenant), remove it from the list
        setProposals(prev => prev.filter(p => p.id !== proposal.id))
        showToast('This proposal is not accessible (likely belongs to another tenant). It has been removed from the list.', 'warning')
        return
      }

      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to load proposal details'
      showToast(errorMessage, 'error')
    }
  }

  const handleProposalUpdated = (updated: Proposal) => {
    // Update local list so page reflects phase/status changes without manual refresh
    setProposals(prev => prev.map(p => (p.id === updated.id ? updated : p)))
    setSelectedProposal(updated)
  }

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success'> = {
      pink_team: 'default',
      red_team: 'primary',
      gold_team: 'secondary',
      submitted: 'success',
    }
    return colors[phase] || 'default'
  }

  if (loading) {
    return <LoadingSpinner message="Loading proposals..." />
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Proposals</Typography>
        <Button 
          variant="contained" 
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
        >
          New Proposal
        </Button>
      </Box>

      <Paper 
        sx={{ 
          p: 3, 
          mb: 3,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        }}
      >
        <Typography variant="h6" gutterBottom fontWeight={700}>
          Shipley Workflow
        </Typography>
        <Stepper activeStep={0} alternativeLabel>
          {phases.map((phase) => (
            <Step key={phase}>
              <StepLabel>{phase.replace('_', ' ').toUpperCase()}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Phase</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {proposals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No proposals found
                </TableCell>
              </TableRow>
            ) : (
              proposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell>{proposal.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={proposal.current_phase.replace('_', ' ')}
                      color={getPhaseColor(proposal.current_phase)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{proposal.status}</TableCell>
                  <TableCell>{new Date(proposal.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
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
                      onClick={() => handleViewClick(proposal)}
                      sx={{
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.2)',
                        },
                      }}
                    >
                      <Visibility />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ProposalForm
        open={openDialog}
        onClose={() => {
          setOpenDialog(false)
          setSelectedProposal(null)
        }}
        onSubmit={selectedProposal ? handleUpdateProposal : handleCreateProposal}
        initialData={selectedProposal || undefined}
        opportunities={opportunities}
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
        onProposalUpdated={handleProposalUpdated}
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

