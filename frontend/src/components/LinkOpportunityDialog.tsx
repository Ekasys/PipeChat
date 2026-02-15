import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Typography,
  IconButton,
} from '@mui/material'
import { Search, Link as LinkIcon } from '@mui/icons-material'
import { opportunityService, Opportunity } from '../services/opportunityService'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'
import LoadingSpinner from './LoadingSpinner'

interface LinkOpportunityDialogProps {
  open: boolean
  onClose: () => void
  accountId: string
  onLinked: () => void
}

export default function LinkOpportunityDialog({
  open,
  onClose,
  accountId,
  onLinked,
}: LinkOpportunityDialogProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [filteredOpportunities, setFilteredOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (open) {
      loadOpportunities()
    }
  }, [open])

  useEffect(() => {
    if (searchTerm) {
      const filtered = opportunities.filter(
        (opp) =>
          opp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opp.agency?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredOpportunities(filtered)
    } else {
      setFilteredOpportunities(opportunities)
    }
  }, [searchTerm, opportunities])

  const loadOpportunities = async () => {
    try {
      setLoading(true)
      const response = await opportunityService.list({ limit: 1000 })
      // Filter to show opportunities that are not linked to this account
      // (either no account_id or different account_id)
      const unlinked = response.opportunities.filter(
        (opp) => !opp.account_id || opp.account_id !== accountId
      )
      setOpportunities(unlinked)
      setFilteredOpportunities(unlinked)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
      showToast('Failed to load opportunities', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLinkOpportunity = async (opportunityId: string) => {
    try {
      await opportunityService.update(opportunityId, { account_id: accountId })
      showToast('Opportunity linked successfully', 'success')
      onLinked()
      onClose()
    } catch (error) {
      console.error('Failed to link opportunity:', error)
      showToast('Failed to link opportunity', 'error')
    }
  }

  const formatCurrency = (value?: number) => {
    if (!value) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Link Opportunity to Account</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search opportunities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  background: 'var(--pp-dark-50)',
                },
              }}
            />
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LoadingSpinner message="Loading opportunities..." />
            </Box>
          ) : filteredOpportunities.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {searchTerm
                  ? 'No opportunities found matching your search'
                  : 'No unlinked opportunities available'}
              </Typography>
            </Paper>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Agency</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOpportunities.map((opp) => (
                    <TableRow key={opp.id} hover>
                      <TableCell>{opp.name}</TableCell>
                      <TableCell>{opp.agency || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip label={opp.stage} size="small" />
                      </TableCell>
                      <TableCell>{formatCurrency(opp.value)}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleLinkOpportunity(opp.id)}
                          title="Link this opportunity"
                        >
                          <LinkIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </>
  )
}
