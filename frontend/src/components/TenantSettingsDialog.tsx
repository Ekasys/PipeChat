import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { CheckCircleRounded, Settings } from '@mui/icons-material'
import api from '../services/api'
import { useToast } from '../hooks/useToast'

interface TenantSettingsDialogProps {
  open: boolean
  onClose: () => void
}

interface TenantSettings {
  tenant_id?: string
  name?: string
  subdomain?: string
  data_residency?: string
  compliance_level?: string
  settings?: {
    [key: string]: any
  }
}

interface TenantSettingsFormData {
  name: string
  subdomain: string
  data_residency: string
  compliance_level: string
  ekchat_chat_enabled: boolean
  ekchat_rag_enabled: boolean
  ekchat_rfp_enabled: boolean
}

type TenantSettingsField = keyof TenantSettingsFormData

export default function TenantSettingsDialog({ open, onClose }: TenantSettingsDialogProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<TenantSettings>({})
  const [formData, setFormData] = useState<TenantSettingsFormData>({
    name: '',
    subdomain: '',
    data_residency: '',
    compliance_level: '',
    ekchat_chat_enabled: false,
    ekchat_rag_enabled: false,
    ekchat_rfp_enabled: false,
  })
  const [dirtyFields, setDirtyFields] = useState<Set<TenantSettingsField>>(new Set())
  const [savedFields, setSavedFields] = useState<Set<TenantSettingsField>>(new Set())
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await api.get<TenantSettings>('/admin/settings')
      const tenantSettings = response.data.settings || {}

      setSettings(response.data)
      setFormData({
        name: response.data.name || '',
        subdomain: response.data.subdomain || '',
        data_residency: response.data.data_residency || '',
        compliance_level: response.data.compliance_level || '',
        ekchat_chat_enabled: !!tenantSettings.ekchat_chat_enabled,
        ekchat_rag_enabled: !!tenantSettings.ekchat_rag_enabled,
        ekchat_rfp_enabled: !!tenantSettings.ekchat_rfp_enabled,
      })
      setDirtyFields(new Set())
      setSavedFields(new Set())
      setSavedAt(null)
    } catch (error) {
      console.error('Failed to load settings:', error)
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateField = <K extends TenantSettingsField>(field: K, value: TenantSettingsFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setDirtyFields((prev) => {
      if (prev.has(field)) {
        return prev
      }
      const next = new Set(prev)
      next.add(field)
      return next
    })
    setSavedFields((prev) => {
      if (!prev.has(field)) {
        return prev
      }
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  const isSavedField = (field: TenantSettingsField) => savedFields.has(field) && !dirtyFields.has(field)

  const handleSave = async () => {
    if (dirtyFields.size === 0) {
      showToast('No changes to save', 'info')
      return
    }

    const savedSnapshot = new Set(dirtyFields)

    try {
      setLoading(true)
      await api.put('/admin/settings', {
        ...settings.settings,
        name: formData.name,
        subdomain: formData.subdomain,
        data_residency: formData.data_residency,
        compliance_level: formData.compliance_level,
        ekchat_chat_enabled: formData.ekchat_chat_enabled,
        ekchat_rag_enabled: formData.ekchat_rag_enabled,
        ekchat_rfp_enabled: formData.ekchat_rfp_enabled,
      })
      showToast('Settings saved successfully', 'success')
      setSavedFields(savedSnapshot)
      setDirtyFields(new Set())
      setSavedAt(Date.now())
    } catch (error) {
      console.error('Failed to save settings:', error)
      showToast('Failed to save settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings />
        Tenant Settings
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography>Loading settings...</Typography>
          </Box>
        ) : (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tenant Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Subdomain"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Data Residency"
                value={formData.data_residency}
                onChange={(e) => updateField('data_residency', e.target.value)}
                select
                SelectProps={{ native: true }}
                helperText={isSavedField('data_residency') ? 'Saved' : ' '}
                FormHelperTextProps={{
                  sx: { color: isSavedField('data_residency') ? 'success.main' : 'text.disabled' },
                }}
              >
                <option value="us">United States</option>
                <option value="eu">European Union</option>
                <option value="uk">United Kingdom</option>
                <option value="ca">Canada</option>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Compliance Level"
                value={formData.compliance_level}
                onChange={(e) => updateField('compliance_level', e.target.value)}
                select
                SelectProps={{ native: true }}
                helperText={isSavedField('compliance_level') ? 'Saved' : ' '}
                FormHelperTextProps={{
                  sx: { color: isSavedField('compliance_level') ? 'success.main' : 'text.disabled' },
                }}
              >
                <option value="">None</option>
                <option value="fedramp_moderate">FedRAMP Moderate</option>
                <option value="fedramp_high">FedRAMP High</option>
                <option value="nist_800_53">NIST 800-53</option>
                <option value="cmmc_level2">CMMC Level 2</option>
                <option value="cmmc_level3">CMMC Level 3</option>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Ekchat Feature Flags
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.ekchat_chat_enabled}
                      onChange={(e) => updateField('ekchat_chat_enabled', e.target.checked)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Enable Ekchat Chat Core
                      {isSavedField('ekchat_chat_enabled') && (
                        <CheckCircleRounded sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.ekchat_rag_enabled}
                      onChange={(e) => updateField('ekchat_rag_enabled', e.target.checked)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Enable Ekchat RAG + Tables/Plots + Web Search
                      {isSavedField('ekchat_rag_enabled') && (
                        <CheckCircleRounded sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.ekchat_rfp_enabled}
                      onChange={(e) => updateField('ekchat_rfp_enabled', e.target.checked)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Enable Ekchat Advanced RFP Workflows
                      {isSavedField('ekchat_rfp_enabled') && (
                        <CheckCircleRounded sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                    </Box>
                  }
                />
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Box sx={{ flex: 1, pl: 1 }}>
          {dirtyFields.size > 0 ? (
            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
              {dirtyFields.size} unsaved change{dirtyFields.size === 1 ? '' : 's'}
            </Typography>
          ) : savedAt ? (
            <Chip
              size="small"
              color="success"
              icon={<CheckCircleRounded />}
              label="All changes saved"
              sx={{ height: 24 }}
            />
          ) : null}
        </Box>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || dirtyFields.size === 0}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
