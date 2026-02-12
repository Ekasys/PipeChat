import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Box,
  Paper,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Grid,
  Card,
  CardContent,
  Pagination,
} from '@mui/material'
import { Add, Edit, Visibility, AccountTree, Delete, Download } from '@mui/icons-material'
import api from '../services/api'
import AccountForm from '../components/AccountForm'
import ContactForm from '../components/ContactForm'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from '../components/LoadingSpinner'
import OrgChart from '../components/OrgChart'
import SearchFilterBar from '../components/SearchFilterBar'

interface Account {
  id: string
  name: string
  agency?: string
  organization_type?: string
  account_type?: string
  relationship_health_score?: string
  opportunities_count?: number
  total_opportunity_value?: number
  contacts_count?: number
  created_at: string
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email?: string
  title?: string
  influence_level?: string
  account_id?: string
}

interface FilterOptions {
  search?: string
  organization_type?: string
  account_type?: string
  relationship_health?: string
  influence_level?: string
  relationship_strength?: string
  sort_by?: string
  sort_order?: string
}

export default function CRMPage() {
  const navigate = useNavigate()
  const [tabValue, setTabValue] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [openContactDialog, setOpenContactDialog] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [selectedAccountForChart, setSelectedAccountForChart] = useState<Account | null>(null)
  const [orgChartData, setOrgChartData] = useState<any[]>([])
  const [orgChartLoading, setOrgChartLoading] = useState(false)
  const { toast, showToast, hideToast } = useToast()
  
  // Filter and pagination state
  const [accountFilters, setAccountFilters] = useState<FilterOptions>({
    sort_by: 'created_at',
    sort_order: 'desc',
  })
  const [contactFilters, setContactFilters] = useState<FilterOptions>({
    sort_by: 'created_at',
    sort_order: 'desc',
  })
  const [accountPage, setAccountPage] = useState(1)
  const [contactPage, setContactPage] = useState(1)
  const [accountPagination, setAccountPagination] = useState({ total: 0, pages: 0, limit: 50 })
  const [contactPagination, setContactPagination] = useState({ total: 0, pages: 0, limit: 50 })

  useEffect(() => {
    loadData()
  }, [tabValue, accountFilters, accountPage, contactFilters, contactPage])

  const loadData = async () => {
    try {
      setLoading(true)
      if (tabValue === 0) {
        const params = new URLSearchParams()
        if (accountFilters.search) params.append('search', accountFilters.search)
        if (accountFilters.organization_type) params.append('organization_type', accountFilters.organization_type)
        if (accountFilters.account_type) params.append('account_type', accountFilters.account_type)
        if (accountFilters.relationship_health) params.append('relationship_health', accountFilters.relationship_health)
        if (accountFilters.sort_by) params.append('sort_by', accountFilters.sort_by)
        if (accountFilters.sort_order) params.append('sort_order', accountFilters.sort_order)
        params.append('page', accountPage.toString())
        params.append('limit', accountPagination.limit.toString())
        
        const response = await api.get<{ accounts: Account[]; total: number; pages: number }>(`/crm/accounts?${params}`)
        setAccounts(response.data.accounts)
        setAccountPagination({
          total: response.data.total,
          pages: response.data.pages,
          limit: accountPagination.limit,
        })
      } else if (tabValue === 1) {
        const params = new URLSearchParams()
        if (contactFilters.search) params.append('search', contactFilters.search)
        if (contactFilters.influence_level) params.append('influence_level', contactFilters.influence_level)
        if (contactFilters.relationship_strength) params.append('relationship_strength', contactFilters.relationship_strength)
        if (contactFilters.sort_by) params.append('sort_by', contactFilters.sort_by)
        if (contactFilters.sort_order) params.append('sort_order', contactFilters.sort_order)
        params.append('page', contactPage.toString())
        params.append('limit', contactPagination.limit.toString())
        
        const response = await api.get<{ contacts: Contact[]; total: number; pages: number }>(`/crm/contacts?${params}`)
        setContacts(response.data.contacts || [])
        setContactPagination({
          total: response.data.total,
          pages: response.data.pages,
          limit: contactPagination.limit,
        })
      }
    } catch (error) {
      console.error('Failed to load CRM data:', error)
      showToast('Failed to load CRM data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAccount = async (data: any) => {
    try {
      await api.post('/crm/accounts', data)
      showToast('Account created successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Failed to create account:', error)
      showToast('Failed to create account', 'error')
    }
  }

  const handleUpdateAccount = async (data: any) => {
    if (!selectedAccount) return
    try {
      await api.put(`/crm/accounts/${selectedAccount.id}`, data)
      showToast('Account updated successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Failed to update account:', error)
      showToast('Failed to update account', 'error')
    }
  }

  const handleCreateContact = async (data: any) => {
    try {
      await api.post('/crm/contacts', data)
      showToast('Contact created successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Failed to create contact:', error)
      showToast('Failed to create contact', 'error')
    }
  }

  const handleUpdateContact = async (data: any) => {
    if (!selectedContact) return
    try {
      await api.put(`/crm/contacts/${selectedContact.id}`, data)
      showToast('Contact updated successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Failed to update contact:', error)
      showToast('Failed to update contact', 'error')
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return
    try {
      await api.delete(`/crm/contacts/${contactId}`)
      showToast('Contact deleted successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Failed to delete contact:', error)
      showToast('Failed to delete contact', 'error')
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to delete this account? This will also delete all related contacts, opportunities, and activities.')) return
    try {
      await api.delete(`/crm/accounts/${accountId}`)
      showToast('Account deleted successfully', 'success')
      loadData()
    } catch (error) {
      console.error('Failed to delete account:', error)
      showToast('Failed to delete account', 'error')
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

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>CRM</Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={async () => {
              try {
                const params = new URLSearchParams()
                if (tabValue === 0) {
                  if (accountFilters.search) params.append('search', accountFilters.search)
                  if (accountFilters.organization_type) params.append('organization_type', accountFilters.organization_type)
                  if (accountFilters.relationship_health) params.append('relationship_health', accountFilters.relationship_health)
                  const response = await api.get(`/crm/accounts/export?${params}`, {
                    responseType: 'blob',
                  })
                  const url = window.URL.createObjectURL(new Blob([response.data]))
                  const link = document.createElement('a')
                  link.href = url
                  link.setAttribute('download', 'accounts.csv')
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  showToast('Accounts exported successfully', 'success')
                } else {
                  if (contactFilters.search) params.append('search', contactFilters.search)
                  if (contactFilters.influence_level) params.append('influence_level', contactFilters.influence_level)
                  if (contactFilters.relationship_strength) params.append('relationship_strength', contactFilters.relationship_strength)
                  const response = await api.get(`/crm/contacts/export?${params}`, {
                    responseType: 'blob',
                  })
                  const url = window.URL.createObjectURL(new Blob([response.data]))
                  const link = document.createElement('a')
                  link.href = url
                  link.setAttribute('download', 'contacts.csv')
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  showToast('Contacts exported successfully', 'success')
                }
              } catch (error) {
                console.error('Failed to export:', error)
                showToast('Failed to export data', 'error')
              }
            }}
          >
            Export {tabValue === 0 ? 'Accounts' : 'Contacts'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              if (tabValue === 0) {
                setSelectedAccount(null)
                setOpenDialog(true)
              } else {
                setSelectedContact(null)
                setOpenContactDialog(true)
              }
            }}
          >
            {tabValue === 0 ? 'New Account' : 'New Contact'}
          </Button>
        </Box>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Accounts" />
          <Tab label="Contacts" />
          <Tab label="Org Charts" />
        </Tabs>
      </Paper>

      {tabValue === 0 && (
        <SearchFilterBar
          filters={accountFilters}
          onFiltersChange={(filters) => {
            setAccountFilters(filters)
            setAccountPage(1)
          }}
          onClear={() => {
            setAccountFilters({ sort_by: 'created_at', sort_order: 'desc' })
            setAccountPage(1)
          }}
          type="account"
        />
      )}

      {tabValue === 1 && (
        <SearchFilterBar
          filters={contactFilters}
          onFiltersChange={(filters) => {
            setContactFilters(filters)
            setContactPage(1)
          }}
          onClear={() => {
            setContactFilters({ sort_by: 'created_at', sort_order: 'desc' })
            setContactPage(1)
          }}
          type="contact"
        />
      )}

      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Influence</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No contacts found
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Button
                        variant="text"
                        onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        {contact.first_name} {contact.last_name}
                      </Button>
                    </TableCell>
                    <TableCell>{contact.email || 'N/A'}</TableCell>
                    <TableCell>{contact.title || 'N/A'}</TableCell>
                    <TableCell>
                      {contact.influence_level && (
                        <Chip label={contact.influence_level} size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedContact(contact)
                          setOpenContactDialog(true)
                        }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteContact(contact.id)}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 1 && contactPagination.pages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={contactPagination.pages}
            page={contactPage}
            onChange={(_, page) => setContactPage(page)}
            color="primary"
          />
        </Box>
      )}

      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Organization Charts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select an account to view its organization chart
          </Typography>
          {!selectedAccountForChart ? (
            <Grid container spacing={2} sx={{ mt: 2 }}>
              {accounts.map((account) => (
                <Grid item xs={12} sm={6} md={4} key={account.id}>
                  <Card
                    sx={{
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
                      },
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {account.name}
                      </Typography>
                      {account.agency && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {account.agency}
                        </Typography>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<AccountTree />}
                        onClick={async () => {
                          setSelectedAccountForChart(account)
                          setOrgChartLoading(true)
                          try {
                            const response = await api.get<{ org_chart: any[] }>(
                              `/crm/accounts/${account.id}/org-chart`
                            )
                            setOrgChartData(response.data.org_chart)
                          } catch (error) {
                            console.error('Failed to load org chart:', error)
                            showToast('Failed to load organization chart', 'error')
                          } finally {
                            setOrgChartLoading(false)
                          }
                        }}
                        sx={{ mt: 1 }}
                      >
                        View Org Chart
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box>
              <Button
                startIcon={<AccountTree />}
                onClick={() => {
                  setSelectedAccountForChart(null)
                  setOrgChartData([])
                }}
                sx={{ mb: 2 }}
              >
                Back to Accounts
              </Button>
              {orgChartLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                  <LoadingSpinner />
                </Box>
              ) : (
                <OrgChart data={orgChartData} accountName={selectedAccountForChart.name} />
              )}
            </Box>
          )}
        </Paper>
      )}

      {loading && tabValue === 0 ? (
        <LoadingSpinner message="Loading accounts..." />
      ) : (
        <>
          {tabValue === 0 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Agency</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Account Type</TableCell>
                    <TableCell>Opportunities</TableCell>
                    <TableCell>Pipeline Value</TableCell>
                    <TableCell>Relationship Health</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        No accounts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Button
                            variant="text"
                            onClick={() => navigate(`/crm/accounts/${account.id}`)}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                          >
                            {account.name}
                          </Button>
                        </TableCell>
                        <TableCell>{account.agency || 'N/A'}</TableCell>
                        <TableCell>{account.organization_type || 'N/A'}</TableCell>
                        <TableCell>
                          {account.account_type ? (
                            <Chip
                              label={account.account_type === 'customer' ? 'Customer' : 'Teaming Partner'}
                              size="small"
                              color={account.account_type === 'customer' ? 'primary' : 'secondary'}
                              variant="outlined"
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={account.opportunities_count || 0}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {account.total_opportunity_value
                            ? new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(account.total_opportunity_value)
                            : '$0'}
                        </TableCell>
                        <TableCell>
                          {account.relationship_health_score && (
                            <Chip
                              label={account.relationship_health_score}
                              color={getHealthColor(account.relationship_health_score)}
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>{new Date(account.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setSelectedAccount(account)
                              setOpenDialog(true)
                            }}
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
                            onClick={() => navigate(`/crm/accounts/${account.id}`)}
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
                            color="error"
                            onClick={() => handleDeleteAccount(account.id)}
                            sx={{
                              '&:hover': {
                                background: 'rgba(239, 68, 68, 0.2)',
                              },
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {tabValue === 0 && accountPagination.pages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={accountPagination.pages}
                page={accountPage}
                onChange={(_, page) => setAccountPage(page)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      <AccountForm
        open={openDialog && tabValue === 0}
        onClose={() => {
          setOpenDialog(false)
          setSelectedAccount(null)
        }}
        onSubmit={selectedAccount ? handleUpdateAccount : handleCreateAccount}
        initialData={selectedAccount || undefined}
      />
      <ContactForm
        open={openContactDialog && tabValue === 1}
        onClose={() => {
          setOpenContactDialog(false)
          setSelectedContact(null)
        }}
        onSubmit={selectedContact ? handleUpdateContact : handleCreateContact}
        initialData={selectedContact || undefined}
        accounts={accounts.map((acc) => ({ id: acc.id, name: acc.name }))}
        contacts={contacts.map((c) => ({ 
          id: c.id, 
          first_name: c.first_name, 
          last_name: c.last_name,
          account_id: c.account_id 
        }))}
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

