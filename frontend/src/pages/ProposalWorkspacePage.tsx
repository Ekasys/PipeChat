import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, Typography, Breadcrumbs, Link } from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import ProposalWorkspace from '../components/ProposalWorkspace'
import { opportunityService } from '../services/opportunityService'
import { useState, useEffect } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ProposalWorkspacePage() {
  const { opportunityId } = useParams<{ opportunityId: string }>()
  const navigate = useNavigate()
  const [opportunityName, setOpportunityName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (opportunityId) {
      loadOpportunity()
    }
  }, [opportunityId])

  const loadOpportunity = async () => {
    if (!opportunityId) return
    try {
      setLoading(true)
      const opportunity = await opportunityService.get(opportunityId)
      setOpportunityName(opportunity.name)
    } catch (error) {
      console.error('Failed to load opportunity:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading opportunity..." />
  }

  if (!opportunityId) {
    return (
      <Box>
        <Typography variant="h6" color="error">
          Invalid opportunity ID
        </Typography>
      </Box>
    )
  }

  return (
    <Box className="fade-in">
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate('/opportunities')}
              sx={{ color: 'text.secondary', textDecoration: 'none', cursor: 'pointer' }}
            >
              Opportunities
            </Link>
            <Typography color="text.primary">{opportunityName || 'Proposal Workspace'}</Typography>
          </Breadcrumbs>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Proposal Workspace
          </Typography>
          {opportunityName && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              {opportunityName}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/opportunities')}
        >
          Back to Opportunities
        </Button>
      </Box>

      <ProposalWorkspace opportunityId={opportunityId} opportunityName={opportunityName} />
    </Box>
  )
}

