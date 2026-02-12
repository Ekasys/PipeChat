import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material'
import { ArrowBack, Edit } from '@mui/icons-material'
import api from '../services/api'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import ActivityTimeline from '../components/ActivityTimeline'
import ContactForm from '../components/ContactForm'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  title?: string
  department?: string
  influence_level?: string
  relationship_strength?: string
  account_id?: string
  manager_id?: string
  notes?: string
  account?: any
  manager?: any
  related_opportunities?: any[]
  created_at: string
  updated_at: string
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contact, setContact] = useState<Contact | null>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (id) {
      loadContact()
      loadAccounts()
      loadContacts()
    }
  }, [id])

  const loadContact = async () => {
    try {
      setLoading(true)
      const response = await api.get<Contact>(`/crm/contacts/${id}`)
      setContact(response.data)
    } catch (error) {
      console.error('Failed to load contact:', error)
      showToast('Failed to load contact', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    try {
      const response = await api.get<{ accounts: any[] }>('/crm/accounts')
      setAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    }
  }

  const loadContacts = async () => {
    try {
      const response = await api.get<{ contacts: any[] }>('/crm/contacts')
      setContacts(response.data.contacts || [])
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  const handleUpdateContact = async (data: any) => {
    if (!contact) return
    try {
      const updated = await api.put(`/crm/contacts/${contact.id}`, data)
      setContact(updated.data)
      showToast('Contact updated successfully', 'success')
      setOpenEditDialog(false)
      loadContact()
    } catch (error) {
      console.error('Failed to update contact:', error)
      showToast('Failed to update contact', 'error')
    }
  }

  const getInfluenceColor = (level?: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      Champion: 'success',
      Influencer: 'info',
      Neutral: 'default',
      Blocker: 'error',
    }
    return colors[level || ''] || 'default'
  }

  const getRelationshipColor = (strength?: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
      Strong: 'success',
      Moderate: 'warning',
      Weak: 'error',
    }
    return colors[strength || ''] || 'default'
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

  if (loading) {
    return <LoadingSpinner message="Loading contact..." />
  }

  if (!contact) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Contact not found
        </Typography>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/crm')} sx={{ mt: 2 }}>
          Back to CRM
        </Button>
      </Box>
    )
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/crm')}>
            Back
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {contact.first_name} {contact.last_name}
          </Typography>
          {contact.influence_level && (
            <Chip
              label={contact.influence_level}
              color={getInfluenceColor(contact.influence_level)}
            />
          )}
          {contact.relationship_strength && (
            <Chip
              label={contact.relationship_strength}
              color={getRelationshipColor(contact.relationship_strength)}
            />
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => setOpenEditDialog(true)}
        >
          Edit Contact
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Contact Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Contact Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1">{contact.email || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Phone
                </Typography>
                <Typography variant="body1">{contact.phone || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Title
                </Typography>
                <Typography variant="body1">{contact.title || 'N/A'}</Typography>
              </Grid>
              {contact.department && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Department
                  </Typography>
                  <Typography variant="body1">{contact.department}</Typography>
                </Grid>
              )}
              {contact.account && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Account
                  </Typography>
                  <Typography variant="body1">{contact.account.name}</Typography>
                </Grid>
              )}
              {contact.manager && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Manager
                  </Typography>
                  <Typography variant="body1">
                    {contact.manager.first_name} {contact.manager.last_name}
                  </Typography>
                </Grid>
              )}
              {contact.notes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                    {contact.notes}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Related Opportunities */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Related Opportunities
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {contact.related_opportunities && contact.related_opportunities.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Stage</TableCell>
                      <TableCell>Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contact.related_opportunities.map((opp: any) => (
                      <TableRow key={opp.id}>
                        <TableCell>{opp.name}</TableCell>
                        <TableCell>
                          <Chip label={opp.stage} size="small" />
                        </TableCell>
                        <TableCell>{formatCurrency(opp.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No related opportunities
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Activity Timeline */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <ActivityTimeline contactId={contact.id} onActivityAdded={loadContact} />
          </Paper>
        </Grid>
      </Grid>

      <ContactForm
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        onSubmit={handleUpdateContact}
        initialData={contact}
        accounts={accounts.map((acc) => ({ id: acc.id, name: acc.name }))}
        contacts={contacts.map((c) => ({ 
          id: c.id, 
          first_name: c.first_name, 
          last_name: c.last_name,
          account_id: c.account_id 
        }))}
      />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </Box>
  )
}
