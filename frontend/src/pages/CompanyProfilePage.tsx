import { useState, useEffect } from 'react'
import {
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Grid,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import { Save, Edit, Add, Delete, Business, AutoAwesome } from '@mui/icons-material'
import { companyProfileService, CompanyProfile } from '../services/companyProfileService'
import { aiService } from '../services/aiService'
import { aiProviderService } from '../services/aiProviderService'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tabValue, setTabValue] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<CompanyProfile>>({})
  const [arrayFields, setArrayFields] = useState<Record<string, string[]>>({})
  const [newArrayItem, setNewArrayItem] = useState<Record<string, string>>({})
  const [pastPerformance, setPastPerformance] = useState<Array<{
    contract_name?: string
    agency?: string
    value?: number
    description?: string
    period?: string
  }>>([])
  const [keyContracts, setKeyContracts] = useState<Array<{
    contract_name?: string
    agency?: string
    value?: number
    description?: string
  }>>([])
  const [awards, setAwards] = useState<Array<{
    award_name?: string
    organization?: string
    year?: string
    description?: string
  }>>([])
  const [openPastPerfDialog, setOpenPastPerfDialog] = useState(false)
  const [openContractDialog, setOpenContractDialog] = useState(false)
  const [openAwardDialog, setOpenAwardDialog] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingType, setEditingType] = useState<'performance' | 'contract' | 'award' | null>(null)
  const [generatingFields, setGeneratingFields] = useState<Record<string, boolean>>({})
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5-mini')
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadProfile()
    loadDefaultModel()
  }, [])

  const loadDefaultModel = async () => {
    try {
      const saved = localStorage.getItem('ai-assistant-model')
      if (saved) {
        setSelectedModel(saved)
      } else {
        const provider = await aiProviderService.getDefault()
        if (provider) {
          const defaultModel = aiProviderService.getDefaultModel(provider)
          setSelectedModel(defaultModel)
        }
      }
    } catch (error) {
      console.error('Failed to load default model:', error)
    }
  }

  const handleGenerateField = async (fieldName: string) => {
    if (!formData.website) {
      showToast('Please enter a website URL first', 'error')
      return
    }

    try {
      setGeneratingFields(prev => ({ ...prev, [fieldName]: true }))
      const result = await aiService.generateCompanyField(formData.website, fieldName, selectedModel)
      
      if (result.content.startsWith('[Error')) {
        showToast(result.content, 'error')
        return
      }

      // Handle array fields differently
      if (['core_values', 'differentiators', 'core_capabilities', 'technical_expertise', 'service_offerings'].includes(fieldName)) {
        const items = result.content.split(',').map(item => item.trim()).filter(Boolean)
        setArrayFields(prev => ({
          ...prev,
          [fieldName]: [...(prev[fieldName] || []), ...items],
        }))
        showToast(`Generated ${items.length} items for ${fieldName}`, 'success')
      } else {
        setFormData(prev => ({
          ...prev,
          [fieldName]: result.content,
        }))
        showToast(`Generated ${fieldName} successfully`, 'success')
      }
    } catch (error: any) {
      console.error('Failed to generate field:', error)
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to generate field'
      showToast(errorMsg, 'error')
    } finally {
      setGeneratingFields(prev => ({ ...prev, [fieldName]: false }))
    }
  }

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await companyProfileService.get()
      setProfile(data)
      setFormData(data)
      // Initialize array fields
      setArrayFields({
        core_values: data.core_values || [],
        differentiators: data.differentiators || [],
        naics_codes: data.naics_codes || [],
        contract_vehicles: data.contract_vehicles || [],
        certifications: data.certifications || [],
        core_capabilities: data.core_capabilities || [],
        technical_expertise: data.technical_expertise || [],
        win_themes: data.win_themes || [],
      })
      // Initialize past performance data
      setPastPerformance(data.past_performance_highlights || [])
      setKeyContracts(data.key_contracts || [])
      setAwards(data.awards_recognition || [])
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Profile doesn't exist yet - show empty form
        setProfile(null)
        setFormData({ company_name: '', country: 'United States' })
      } else {
        console.error('Failed to load company profile:', error)
        showToast('Failed to load company profile', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const dataToSave = {
        ...formData,
        ...arrayFields,
        past_performance_highlights: pastPerformance,
        key_contracts: keyContracts,
        awards_recognition: awards,
      }

      if (profile) {
        await companyProfileService.update(dataToSave)
        showToast('Company profile updated successfully', 'success')
      } else {
        await companyProfileService.create(dataToSave)
        showToast('Company profile created successfully', 'success')
      }
      setEditMode(false)
      loadProfile()
    } catch (error: any) {
      console.error('Failed to save company profile:', error)
      showToast(error.response?.data?.detail || 'Failed to save company profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddArrayItem = (field: string) => {
    const value = newArrayItem[field]?.trim()
    if (!value) return

    setArrayFields((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), value],
    }))
    setNewArrayItem((prev) => ({ ...prev, [field]: '' }))
  }

  const handleRemoveArrayItem = (field: string, index: number) => {
    setArrayFields((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index) || [],
    }))
  }

  if (loading) {
    return <LoadingSpinner message="Loading company profile..." />
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <Business sx={{ fontSize: 40, color: '#667eea' }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Company Profile
          </Typography>
        </Box>
        {!editMode ? (
          <Button variant="contained" startIcon={<Edit />} onClick={() => setEditMode(true)}>
            Edit Profile
          </Button>
        ) : (
          <Box display="flex" gap={2}>
            <Button variant="outlined" onClick={() => {
              setEditMode(false)
              loadProfile()
            }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <Save />}
              onClick={handleSave}
              disabled={saving}
            >
              Save
            </Button>
          </Box>
        )}
      </Box>

      {!profile && !editMode && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No company profile found. Click "Edit Profile" to create one.
        </Alert>
      )}

      <Paper
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        }}
      >
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Basic Information" />
          <Tab label="Company Description" />
          <Tab label="Business & Compliance" />
          <Tab label="Capabilities & Expertise" />
          <Tab label="Past Performance" />
          <Tab label="Proposal Content" />
        </Tabs>

        {/* Basic Information Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.company_name || ''}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                disabled={!editMode}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Legal Name"
                value={formData.legal_name || ''}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="DUNS Number"
                value={formData.duns_number || ''}
                onChange={(e) => setFormData({ ...formData, duns_number: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="CAGE Code"
                value={formData.cage_code || ''}
                onChange={(e) => setFormData({ ...formData, cage_code: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="UEI"
                value={formData.uei || ''}
                onChange={(e) => setFormData({ ...formData, uei: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!editMode}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="City"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="State"
                value={formData.state || ''}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="ZIP Code"
                value={formData.zip_code || ''}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Country"
                value={formData.country || 'United States'}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Number of Employees"
                value={formData.number_of_employees || ''}
                onChange={(e) => setFormData({ ...formData, number_of_employees: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Annual Revenue"
                value={formData.annual_revenue || ''}
                onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                disabled={!editMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Years in Business"
                type="number"
                value={formData.years_in_business || ''}
                onChange={(e) => setFormData({ ...formData, years_in_business: parseInt(e.target.value) || undefined })}
                disabled={!editMode}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Company Description Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Company Overview"
                  value={formData.company_overview || ''}
                  onChange={(e) => setFormData({ ...formData, company_overview: e.target.value })}
                  disabled={!editMode}
                  multiline
                  rows={6}
                  placeholder="Provide a comprehensive overview of your company..."
                />
                {editMode && (
                  <IconButton
                    onClick={() => handleGenerateField('company_overview')}
                    disabled={generatingFields.company_overview || !formData.website}
                    color="primary"
                    title="Auto-generate with AI"
                    sx={{ mt: 1 }}
                  >
                    {generatingFields.company_overview ? (
                      <CircularProgress size={20} />
                    ) : (
                      <AutoAwesome />
                    )}
                  </IconButton>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Mission Statement"
                  value={formData.mission_statement || ''}
                  onChange={(e) => setFormData({ ...formData, mission_statement: e.target.value })}
                  disabled={!editMode}
                  multiline
                  rows={3}
                />
                {editMode && (
                  <IconButton
                    onClick={() => handleGenerateField('mission_statement')}
                    disabled={generatingFields.mission_statement || !formData.website}
                    color="primary"
                    title="Auto-generate with AI"
                    sx={{ mt: 1 }}
                  >
                    {generatingFields.mission_statement ? (
                      <CircularProgress size={20} />
                    ) : (
                      <AutoAwesome />
                    )}
                  </IconButton>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Vision Statement"
                  value={formData.vision_statement || ''}
                  onChange={(e) => setFormData({ ...formData, vision_statement: e.target.value })}
                  disabled={!editMode}
                  multiline
                  rows={3}
                />
                {editMode && (
                  <IconButton
                    onClick={() => handleGenerateField('vision_statement')}
                    disabled={generatingFields.vision_statement || !formData.website}
                    color="primary"
                    title="Auto-generate with AI"
                    sx={{ mt: 1 }}
                  >
                    {generatingFields.vision_statement ? (
                      <CircularProgress size={20} />
                    ) : (
                      <AutoAwesome />
                    )}
                  </IconButton>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1">
                  Core Values
                </Typography>
                {editMode && (
                  <IconButton
                    onClick={() => handleGenerateField('core_values')}
                    disabled={generatingFields.core_values || !formData.website}
                    color="primary"
                    size="small"
                    title="Auto-generate with AI"
                  >
                    {generatingFields.core_values ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AutoAwesome fontSize="small" />
                    )}
                  </IconButton>
                )}
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.core_values?.map((value, index) => (
                  <Chip
                    key={index}
                    label={value}
                    onDelete={editMode ? () => handleRemoveArrayItem('core_values', index) : undefined}
                    color="primary"
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add core value"
                    value={newArrayItem.core_values || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, core_values: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('core_values')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('core_values')}>Add</Button>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1">
                  Key Differentiators
                </Typography>
                {editMode && (
                  <IconButton
                    onClick={() => handleGenerateField('differentiators')}
                    disabled={generatingFields.differentiators || !formData.website}
                    color="primary"
                    size="small"
                    title="Auto-generate with AI"
                  >
                    {generatingFields.differentiators ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AutoAwesome fontSize="small" />
                    )}
                  </IconButton>
                )}
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.differentiators?.map((value, index) => (
                  <Chip
                    key={index}
                    label={value}
                    onDelete={editMode ? () => handleRemoveArrayItem('differentiators', index) : undefined}
                    color="secondary"
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add differentiator"
                    value={newArrayItem.differentiators || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, differentiators: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('differentiators')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('differentiators')}>Add</Button>
                </Box>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Business & Compliance Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Business Type"
                value={formData.business_type || ''}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                disabled={!editMode}
                placeholder="e.g., Small Business, 8(a), WOSB"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Size Standard"
                value={formData.size_standard || ''}
                onChange={(e) => setFormData({ ...formData, size_standard: e.target.value })}
                disabled={!editMode}
                placeholder="Small or Large"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                NAICS Codes
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.naics_codes?.map((code, index) => (
                  <Chip
                    key={index}
                    label={code}
                    onDelete={editMode ? () => handleRemoveArrayItem('naics_codes', index) : undefined}
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add NAICS code"
                    value={newArrayItem.naics_codes || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, naics_codes: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('naics_codes')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('naics_codes')}>Add</Button>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Contract Vehicles
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.contract_vehicles?.map((vehicle, index) => (
                  <Chip
                    key={index}
                    label={vehicle}
                    onDelete={editMode ? () => handleRemoveArrayItem('contract_vehicles', index) : undefined}
                    color="success"
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add contract vehicle (e.g., GSA, OASIS)"
                    value={newArrayItem.contract_vehicles || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, contract_vehicles: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('contract_vehicles')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('contract_vehicles')}>Add</Button>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Certifications
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.certifications?.map((cert, index) => (
                  <Chip
                    key={index}
                    label={cert}
                    onDelete={editMode ? () => handleRemoveArrayItem('certifications', index) : undefined}
                    color="info"
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add certification (e.g., ISO 9001, CMMC Level 2)"
                    value={newArrayItem.certifications || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, certifications: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('certifications')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('certifications')}>Add</Button>
                </Box>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Capabilities & Expertise Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1">
                  Core Capabilities
                </Typography>
                {editMode && (
                  <IconButton
                    onClick={() => handleGenerateField('core_capabilities')}
                    disabled={generatingFields.core_capabilities || !formData.website}
                    color="primary"
                    size="small"
                    title="Auto-generate with AI"
                  >
                    {generatingFields.core_capabilities ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AutoAwesome fontSize="small" />
                    )}
                  </IconButton>
                )}
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.core_capabilities?.map((cap, index) => (
                  <Chip
                    key={index}
                    label={cap}
                    onDelete={editMode ? () => handleRemoveArrayItem('core_capabilities', index) : undefined}
                    color="primary"
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1} mb={3}>
                  <TextField
                    size="small"
                    placeholder="Add capability"
                    value={newArrayItem.core_capabilities || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, core_capabilities: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('core_capabilities')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('core_capabilities')}>Add</Button>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1">
                  Technical Expertise
                </Typography>
                {editMode && (
                  <IconButton
                    onClick={() => handleGenerateField('technical_expertise')}
                    disabled={generatingFields.technical_expertise || !formData.website}
                    color="primary"
                    size="small"
                    title="Auto-generate with AI"
                  >
                    {generatingFields.technical_expertise ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AutoAwesome fontSize="small" />
                    )}
                  </IconButton>
                )}
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.technical_expertise?.map((exp, index) => (
                  <Chip
                    key={index}
                    label={exp}
                    onDelete={editMode ? () => handleRemoveArrayItem('technical_expertise', index) : undefined}
                    color="secondary"
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add technical expertise"
                    value={newArrayItem.technical_expertise || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, technical_expertise: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('technical_expertise')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('technical_expertise')}>Add</Button>
                </Box>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Past Performance Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            {/* Past Performance Highlights */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Past Performance Highlights</Typography>
                {editMode && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setEditingIndex(null)
                      setEditingType('performance')
                      setOpenPastPerfDialog(true)
                    }}
                  >
                    Add Performance
                  </Button>
                )}
              </Box>
              {pastPerformance.length === 0 ? (
                <Alert severity="info">No past performance highlights added yet.</Alert>
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  {pastPerformance.map((item, index) => (
                    <Paper key={index} sx={{ p: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start">
                        <Box flex={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {item.contract_name || 'Untitled Contract'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.agency && `Agency: ${item.agency}`}
                            {item.value && ` • Value: $${item.value.toLocaleString()}`}
                            {item.period && ` • Period: ${item.period}`}
                          </Typography>
                          {item.description && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {item.description}
                            </Typography>
                          )}
                        </Box>
                        {editMode && (
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingIndex(index)
                                setEditingType('performance')
                                setOpenPastPerfDialog(true)
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setPastPerformance(pastPerformance.filter((_, i) => i !== index))
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Key Contracts */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Key Contracts</Typography>
                {editMode && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setEditingIndex(null)
                      setEditingType('contract')
                      setOpenContractDialog(true)
                    }}
                  >
                    Add Contract
                  </Button>
                )}
              </Box>
              {keyContracts.length === 0 ? (
                <Alert severity="info">No key contracts added yet.</Alert>
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  {keyContracts.map((item, index) => (
                    <Paper key={index} sx={{ p: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start">
                        <Box flex={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {item.contract_name || 'Untitled Contract'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.agency && `Agency: ${item.agency}`}
                            {item.value && ` • Value: $${item.value.toLocaleString()}`}
                          </Typography>
                          {item.description && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {item.description}
                            </Typography>
                          )}
                        </Box>
                        {editMode && (
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingIndex(index)
                                setEditingType('contract')
                                setOpenContractDialog(true)
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setKeyContracts(keyContracts.filter((_, i) => i !== index))
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Awards & Recognition */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Awards & Recognition</Typography>
                {editMode && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setEditingIndex(null)
                      setEditingType('award')
                      setOpenAwardDialog(true)
                    }}
                  >
                    Add Award
                  </Button>
                )}
              </Box>
              {awards.length === 0 ? (
                <Alert severity="info">No awards or recognition added yet.</Alert>
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  {awards.map((item, index) => (
                    <Paper key={index} sx={{ p: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start">
                        <Box flex={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {item.award_name || 'Untitled Award'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.organization && `Organization: ${item.organization}`}
                            {item.year && ` • Year: ${item.year}`}
                          </Typography>
                          {item.description && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {item.description}
                            </Typography>
                          )}
                        </Box>
                        {editMode && (
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingIndex(index)
                                setEditingType('award')
                                setOpenAwardDialog(true)
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setAwards(awards.filter((_, i) => i !== index))
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>

          {/* Past Performance Dialog */}
          <Dialog open={openPastPerfDialog} onClose={() => setOpenPastPerfDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {editingIndex !== null ? 'Edit Past Performance' : 'Add Past Performance'}
            </DialogTitle>
            <DialogContent>
              <PastPerformanceForm
                initialData={editingIndex !== null ? pastPerformance[editingIndex] : undefined}
                onSave={(data) => {
                  if (editingIndex !== null) {
                    const updated = [...pastPerformance]
                    updated[editingIndex] = data
                    setPastPerformance(updated)
                  } else {
                    setPastPerformance([...pastPerformance, data])
                  }
                  setOpenPastPerfDialog(false)
                  setEditingIndex(null)
                }}
                onCancel={() => {
                  setOpenPastPerfDialog(false)
                  setEditingIndex(null)
                }}
              />
            </DialogContent>
          </Dialog>

          {/* Key Contract Dialog */}
          <Dialog open={openContractDialog} onClose={() => setOpenContractDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {editingIndex !== null ? 'Edit Key Contract' : 'Add Key Contract'}
            </DialogTitle>
            <DialogContent>
              <KeyContractForm
                initialData={editingIndex !== null ? keyContracts[editingIndex] : undefined}
                onSave={(data) => {
                  if (editingIndex !== null) {
                    const updated = [...keyContracts]
                    updated[editingIndex] = data
                    setKeyContracts(updated)
                  } else {
                    setKeyContracts([...keyContracts, data])
                  }
                  setOpenContractDialog(false)
                  setEditingIndex(null)
                }}
                onCancel={() => {
                  setOpenContractDialog(false)
                  setEditingIndex(null)
                }}
              />
            </DialogContent>
          </Dialog>

          {/* Award Dialog */}
          <Dialog open={openAwardDialog} onClose={() => setOpenAwardDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {editingIndex !== null ? 'Edit Award' : 'Add Award'}
            </DialogTitle>
            <DialogContent>
              <AwardForm
                initialData={editingIndex !== null ? awards[editingIndex] : undefined}
                onSave={(data) => {
                  if (editingIndex !== null) {
                    const updated = [...awards]
                    updated[editingIndex] = data
                    setAwards(updated)
                  } else {
                    setAwards([...awards, data])
                  }
                  setOpenAwardDialog(false)
                  setEditingIndex(null)
                }}
                onCancel={() => {
                  setOpenAwardDialog(false)
                  setEditingIndex(null)
                }}
              />
            </DialogContent>
          </Dialog>
        </TabPanel>

        {/* Proposal Content Tab */}
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Win Themes
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Common win themes that will be incorporated into proposal generation
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {arrayFields.win_themes?.map((theme, index) => (
                  <Chip
                    key={index}
                    label={theme}
                    onDelete={editMode ? () => handleRemoveArrayItem('win_themes', index) : undefined}
                    color="success"
                  />
                ))}
              </Box>
              {editMode && (
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add win theme"
                    value={newArrayItem.win_themes || ''}
                    onChange={(e) => setNewArrayItem({ ...newArrayItem, win_themes: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddArrayItem('win_themes')
                      }
                    }}
                  />
                  <Button onClick={() => handleAddArrayItem('win_themes')}>Add</Button>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                Standard boilerplate and proposal templates will be available in a future update.
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={hideToast}
      />
    </Box>
  )
}

// Past Performance Form Component
function PastPerformanceForm({
  initialData,
  onSave,
  onCancel,
}: {
  initialData?: {
    contract_name?: string
    agency?: string
    value?: number
    description?: string
    period?: string
  }
  onSave: (data: {
    contract_name?: string
    agency?: string
    value?: number
    description?: string
    period?: string
  }) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    contract_name: initialData?.contract_name || '',
    agency: initialData?.agency || '',
    value: initialData?.value?.toString() || '',
    description: initialData?.description || '',
    period: initialData?.period || '',
  })

  const handleSubmit = () => {
    onSave({
      contract_name: formData.contract_name || undefined,
      agency: formData.agency || undefined,
      value: formData.value ? parseFloat(formData.value) : undefined,
      description: formData.description || undefined,
      period: formData.period || undefined,
    })
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Contract Name"
            value={formData.contract_name}
            onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Agency"
            value={formData.agency}
            onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Contract Value"
            type="number"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Period"
            value={formData.period}
            onChange={(e) => setFormData({ ...formData, period: e.target.value })}
            placeholder="e.g., 2020-2023"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={4}
          />
        </Grid>
        <Grid item xs={12}>
          <DialogActions>
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={!formData.contract_name}>
              Save
            </Button>
          </DialogActions>
        </Grid>
      </Grid>
    </Box>
  )
}

// Key Contract Form Component
function KeyContractForm({
  initialData,
  onSave,
  onCancel,
}: {
  initialData?: {
    contract_name?: string
    agency?: string
    value?: number
    description?: string
  }
  onSave: (data: {
    contract_name?: string
    agency?: string
    value?: number
    description?: string
  }) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    contract_name: initialData?.contract_name || '',
    agency: initialData?.agency || '',
    value: initialData?.value?.toString() || '',
    description: initialData?.description || '',
  })

  const handleSubmit = () => {
    onSave({
      contract_name: formData.contract_name || undefined,
      agency: formData.agency || undefined,
      value: formData.value ? parseFloat(formData.value) : undefined,
      description: formData.description || undefined,
    })
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Contract Name"
            value={formData.contract_name}
            onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Agency"
            value={formData.agency}
            onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Contract Value"
            type="number"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={4}
          />
        </Grid>
        <Grid item xs={12}>
          <DialogActions>
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={!formData.contract_name}>
              Save
            </Button>
          </DialogActions>
        </Grid>
      </Grid>
    </Box>
  )
}

// Award Form Component
function AwardForm({
  initialData,
  onSave,
  onCancel,
}: {
  initialData?: {
    award_name?: string
    organization?: string
    year?: string
    description?: string
  }
  onSave: (data: {
    award_name?: string
    organization?: string
    year?: string
    description?: string
  }) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    award_name: initialData?.award_name || '',
    organization: initialData?.organization || '',
    year: initialData?.year || '',
    description: initialData?.description || '',
  })

  const handleSubmit = () => {
    onSave({
      award_name: formData.award_name || undefined,
      organization: formData.organization || undefined,
      year: formData.year || undefined,
      description: formData.description || undefined,
    })
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Award Name"
            value={formData.award_name}
            onChange={(e) => setFormData({ ...formData, award_name: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Organization"
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Year"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            placeholder="e.g., 2023"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={4}
          />
        </Grid>
        <Grid item xs={12}>
          <DialogActions>
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={!formData.award_name}>
              Save
            </Button>
          </DialogActions>
        </Grid>
      </Grid>
    </Box>
  )
}

