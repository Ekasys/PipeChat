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
  IconButton,
} from '@mui/material'
import { ArrowBack, Edit, AccountTree, Add, Link as LinkIcon, LinkOff } from '@mui/icons-material'
import api from '../services/api'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import ActivityTimeline from '../components/ActivityTimeline'
import AccountForm from '../components/AccountForm'
import ContactForm from '../components/ContactForm'
import OpportunityForm from '../components/OpportunityForm'
import LinkOpportunityDialog from '../components/LinkOpportunityDialog'
import OpportunityDetail from '../components/OpportunityDetail'
import { opportunityService, Opportunity } from '../services/opportunityService'

interface Account {
  id: string
  name: string
  agency?: string
  organization_type?: string
  website?: string
  address?: string
  phone?: string
  naics_codes?: string[]
  contract_vehicles?: string[]
  relationship_health_score?: string
  notes?: string
  contacts_count?: number
  opportunities_count?: number
  total_opportunity_value?: number
  active_opportunities?: any[]
  recent_contacts?: any[]
  created_at: string
  updated_at: string
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [openContactDialog, setOpenContactDialog] = useState(false)
  const [openOpportunityDialog, setOpenOpportunityDialog] = useState(false)
  const [openLinkDialog, setOpenLinkDialog] = useState(false)
  const [openOpportunityDetail, setOpenOpportunityDetail] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const [allAccounts, setAllAccounts] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (id) {
      loadAccount()
      loadAccounts()
      loadContacts()
    }
  }, [id])

  const loadAccount = async () => {
    try {
      setLoading(true)
      const response = await api.get<Account>(`/crm/accounts/${id}`)
      setAccount(response.data)
    } catch (error) {
      console.error('Failed to load account:', error)
      showToast('Failed to load account', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    try {
      const response = await api.get<{ accounts: any[] }>('/crm/accounts')
      setAllAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    }
  }

  const loadContacts = async () => {
    try {
      const response = await api.get<{ contacts: any[] }>('/crm/contacts')
      setAllContacts(response.data.contacts || [])
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  const handleUpdateAccount = async (data: any) => {
    if (!account) return
    try {
      const updated = await api.put(`/crm/accounts/${account.id}`, data)
      setAccount(updated.data)
      showToast('Account updated successfully', 'success')
      setOpenEditDialog(false)
      loadAccount()
    } catch (error) {
      console.error('Failed to update account:', error)
      showToast('Failed to update account', 'error')
    }
  }

  const handleCreateContact = async (data: any) => {
    if (!account) return
    try {
      // Pre-fill account_id
      const contactData = {
        ...data,
        account_id: account.id,
      }
      await api.post('/crm/contacts', contactData)
      showToast('Contact created successfully', 'success')
      setOpenContactDialog(false)
      loadAccount() // Reload to refresh contact list
      loadContacts() // Reload contacts list for manager selection
    } catch (error) {
      console.error('Failed to create contact:', error)
      showToast('Failed to create contact', 'error')
    }
  }

  const handleCreateOpportunity = async (data: any) => {
    if (!account) return
    try {
      // Pre-fill account_id and agency
      const opportunityData = {
        ...data,
        account_id: account.id,
        agency: data.agency || account.agency,
      }
      await opportunityService.create(opportunityData)
      showToast('Opportunity created successfully', 'success')
      setOpenOpportunityDialog(false)
      loadAccount() // Reload to refresh opportunities list
    } catch (error) {
      console.error('Failed to create opportunity:', error)
      showToast('Failed to create opportunity', 'error')
    }
  }

  const handleUnlinkOpportunity = async (opportunityId: string) => {
    if (!window.confirm('Are you sure you want to unlink this opportunity from this account?')) return
    try {
      await opportunityService.update(opportunityId, { account_id: null })
      showToast('Opportunity unlinked successfully', 'success')
      loadAccount()
    } catch (error) {
      console.error('Failed to unlink opportunity:', error)
      showToast('Failed to unlink opportunity', 'error')
    }
  }

  const getHealthColor = (score?: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
      Excellent: 'success',
      Good: 'success',
      Fair: 'warning',
      Poor: 'error',
    }
    return colors[score || ''] || 'default'
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
    return <LoadingSpinner message="Loading account..." />
  }

  if (!account) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Account not found
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
            {account.name}
          </Typography>
          {account.relationship_health_score && (
            <Chip
              label={account.relationship_health_score}
              color={getHealthColor(account.relationship_health_score)}
            />
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => setOpenEditDialog(true)}
        >
          Edit Account
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Contacts
              </Typography>
              <Typography variant="h4">{account.contacts_count || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Opportunities
              </Typography>
              <Typography variant="h4">{account.opportunities_count || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Pipeline Value
              </Typography>
              <Typography variant="h4">{formatCurrency(account.total_opportunity_value)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Relationship Health
              </Typography>
              <Typography variant="h4">
                {account.relationship_health_score || 'Unknown'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Account Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Agency
                </Typography>
                <Typography variant="body1">{account.agency || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Organization Type
                </Typography>
                <Typography variant="body1">{account.organization_type || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Account Type
                </Typography>
                <Box>
                  {(account as any).account_type ? (
                    <Chip
                      label={(account as any).account_type === 'customer' ? 'Customer' : 'Teaming Partner'}
                      size="small"
                      color={(account as any).account_type === 'customer' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  ) : (
                    <Typography variant="body1">N/A</Typography>
                  )}
                </Box>
              </Grid>
              {account.website && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Website
                  </Typography>
                  <Typography variant="body1">
                    <a href={account.website} target="_blank" rel="noopener noreferrer">
                      {account.website}
                    </a>
                  </Typography>
                </Grid>
              )}
              {account.phone && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography variant="body1">{account.phone}</Typography>
                </Grid>
              )}
              {account.address && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Address
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {account.address}
                  </Typography>
                </Grid>
              )}
              {account.naics_codes && account.naics_codes.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    NAICS Codes
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {account.naics_codes.map((code) => (
                      <Chip key={code} label={code} size="small" />
                    ))}
                  </Box>
                </Grid>
              )}
              {account.contract_vehicles && account.contract_vehicles.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Contract Vehicles
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {account.contract_vehicles.map((vehicle) => (
                      <Chip key={vehicle} label={vehicle} size="small" />
                    ))}
                  </Box>
                </Grid>
              )}
              {account.notes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                    {account.notes}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Active Opportunities */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Active Opportunities
              </Typography>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => setOpenLinkDialog(true)}
                >
                  Link
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setOpenOpportunityDialog(true)}
                >
                  Create
                </Button>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {account.active_opportunities && account.active_opportunities.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Stage</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {account.active_opportunities.map((opp: any) => (
                      <TableRow key={opp.id}>
                        <TableCell>
                          <Button
                            variant="text"
                            onClick={async () => {
                              try {
                                const oppData = await opportunityService.get(opp.id)
                                setSelectedOpportunity(oppData)
                                setOpenOpportunityDetail(true)
                              } catch (error) {
                                console.error('Failed to load opportunity:', error)
                                showToast('Failed to load opportunity details', 'error')
                              }
                            }}
                            sx={{ textTransform: 'none', fontWeight: 600, p: 0 }}
                          >
                            {opp.name}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Chip label={opp.stage} size="small" />
                        </TableCell>
                        <TableCell>{formatCurrency(opp.value)}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleUnlinkOpportunity(opp.id)}
                            title="Unlink opportunity"
                          >
                            <LinkOff fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No active opportunities
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Recent Contacts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Recent Contacts
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => setOpenContactDialog(true)}
              >
                Add Contact
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {account.recent_contacts && account.recent_contacts.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Email</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {account.recent_contacts.map((contact: any) => (
                      <TableRow 
                        key={contact.id}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                      >
                        <TableCell>
                          <Button
                            variant="text"
                            sx={{ textTransform: 'none', fontWeight: 600, p: 0 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/crm/contacts/${contact.id}`)
                            }}
                          >
                            {contact.first_name} {contact.last_name}
                          </Button>
                        </TableCell>
                        <TableCell>{contact.title || 'N/A'}</TableCell>
                        <TableCell>{contact.email || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No contacts
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Activity Timeline */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <ActivityTimeline accountId={account.id} onActivityAdded={loadAccount} />
          </Paper>
        </Grid>
      </Grid>

      <AccountForm
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        onSubmit={handleUpdateAccount}
        initialData={account}
      />

      <ContactForm
        open={openContactDialog}
        onClose={() => setOpenContactDialog(false)}
        onSubmit={handleCreateContact}
        initialData={account ? { account_id: account.id } : undefined}
        accounts={allAccounts.map((acc) => ({ id: acc.id, name: acc.name }))}
        contacts={allContacts.map((c) => ({ 
          id: c.id, 
          first_name: c.first_name, 
          last_name: c.last_name,
          account_id: c.account_id 
        }))}
      />

      <OpportunityForm
        open={openOpportunityDialog}
        onClose={() => setOpenOpportunityDialog(false)}
        onSubmit={handleCreateOpportunity}
        initialData={account ? { 
          account_id: account.id,
          agency: account.agency 
        } : undefined}
      />

      <LinkOpportunityDialog
        open={openLinkDialog}
        onClose={() => setOpenLinkDialog(false)}
        accountId={account?.id || ''}
        onLinked={loadAccount}
      />

      {selectedOpportunity && (
        <OpportunityDetail
          open={openOpportunityDetail}
          onClose={() => {
            setOpenOpportunityDetail(false)
            setSelectedOpportunity(null)
          }}
          opportunity={selectedOpportunity}
          onStageUpdated={async (updated) => {
            setSelectedOpportunity(updated)
            loadAccount()
          }}
        />
      )}

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </Box>
  )
}
