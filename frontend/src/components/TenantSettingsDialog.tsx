import { useEffect, useState } from 'react'
import {
  Box,
  Button,
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
import { Settings } from '@mui/icons-material'
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

export default function TenantSettingsDialog({ open, onClose }: TenantSettingsDialogProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<TenantSettings>({})
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    data_residency: '',
    compliance_level: '',
    ekchat_chat_enabled: false,
    ekchat_rag_enabled: false,
    ekchat_rfp_enabled: false,
  })

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
    } catch (error) {
      console.error('Failed to load settings:', error)
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
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
      onClose()
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
                onChange={(e) => setFormData({ ...formData, data_residency: e.target.value })}
                select
                SelectProps={{ native: true }}
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
                onChange={(e) => setFormData({ ...formData, compliance_level: e.target.value })}
                select
                SelectProps={{ native: true }}
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
                      onChange={(e) => setFormData({ ...formData, ekchat_chat_enabled: e.target.checked })}
                    />
                  }
                  label="Enable Ekchat Chat Core"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.ekchat_rag_enabled}
                      onChange={(e) => setFormData({ ...formData, ekchat_rag_enabled: e.target.checked })}
                    />
                  }
                  label="Enable Ekchat RAG + Tables/Plots + Web Search"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.ekchat_rfp_enabled}
                      onChange={(e) => setFormData({ ...formData, ekchat_rfp_enabled: e.target.checked })}
                    />
                  }
                  label="Enable Ekchat Advanced RFP Workflows"
                />
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
