import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { Settings } from '@mui/icons-material'

interface AIProvider {
  id?: string
  provider_name: string
  display_name: string
  is_active: boolean
  is_default: boolean
  connection_config: {
    api_key?: string
    api_endpoint?: string
    base_url?: string
    default_model?: string
    temperature?: number
    max_tokens?: number
    organization?: string
    azure_endpoint?: string
    api_version?: string
    chat_deployment?: string
    embedding_deployment?: string
    auth_mode?: 'api-key' | 'managed-identity'
  }
}

interface AIProviderFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (provider: AIProvider) => Promise<void>
  initialData?: AIProvider
}

const PROVIDER_OPTIONS = [
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'chatgpt', label: 'OpenAI ChatGPT' },
  { value: 'grok', label: 'xAI Grok' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'ollama-cloud', label: 'Ollama Cloud' },
]

export default function AIProviderForm({
  open,
  onClose,
  onSubmit,
  initialData,
}: AIProviderFormProps) {
  const [formData, setFormData] = useState<AIProvider>({
    provider_name: '',
    display_name: '',
    is_active: true,
    is_default: false,
    connection_config: {},
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({
        provider_name: '',
        display_name: '',
        is_active: true,
        is_default: false,
        connection_config: {},
      })
    }
    setErrors({})
  }, [initialData, open])

  const handleChange = (field: string, value: any) => {
    if (field.startsWith('connection_config.')) {
      const configField = field.replace('connection_config.', '')
      setFormData((prev) => ({
        ...prev,
        connection_config: {
          ...prev.connection_config,
          [configField]: value,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
    }

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleProviderChange = (providerName: string) => {
    const provider = PROVIDER_OPTIONS.find((p) => p.value === providerName)
    setFormData((prev) => ({
      ...prev,
      provider_name: providerName,
      display_name: provider?.label || providerName,
      connection_config: {
        ...prev.connection_config,
        api_endpoint:
          providerName === 'chatgpt'
            ? 'https://api.openai.com/v1'
            : providerName === 'gemini'
              ? 'https://generativelanguage.googleapis.com/v1'
              : providerName === 'grok'
                ? 'https://api.x.ai/v1'
                : prev.connection_config?.api_endpoint,
        base_url:
          providerName === 'ollama'
            ? 'http://host.docker.internal:11434'
            : providerName === 'ollama-cloud'
              ? 'https://api.ollama.ai'
              : prev.connection_config?.base_url,
        azure_endpoint:
          providerName === 'azure-openai'
            ? prev.connection_config?.azure_endpoint || ''
            : prev.connection_config?.azure_endpoint,
        api_version:
          providerName === 'azure-openai'
            ? prev.connection_config?.api_version || '2024-06-01'
            : prev.connection_config?.api_version,
        auth_mode:
          providerName === 'azure-openai'
            ? (prev.connection_config?.auth_mode || 'api-key')
            : prev.connection_config?.auth_mode,
      },
    }))
  }

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!formData.provider_name) nextErrors.provider_name = 'Provider is required'
    if (!formData.display_name) nextErrors.display_name = 'Display name is required'

    const provider = formData.provider_name

    if (provider === 'azure-openai') {
      if (!formData.connection_config?.azure_endpoint) {
        nextErrors['connection_config.azure_endpoint'] = 'Azure endpoint is required'
      }
      if (!formData.connection_config?.chat_deployment) {
        nextErrors['connection_config.chat_deployment'] = 'Chat deployment is required'
      }
      if (!formData.connection_config?.embedding_deployment) {
        nextErrors['connection_config.embedding_deployment'] = 'Embedding deployment is required'
      }
      const authMode = formData.connection_config?.auth_mode || 'api-key'
      if (authMode === 'api-key' && !formData.connection_config?.api_key) {
        nextErrors['connection_config.api_key'] = 'API key is required for auth_mode=api-key'
      }
    } else if (provider === 'ollama') {
      if (!formData.connection_config?.base_url) {
        nextErrors['connection_config.base_url'] = 'Base URL is required for Ollama'
      }
    } else if (provider === 'ollama-cloud') {
      if (!formData.connection_config?.base_url) {
        nextErrors['connection_config.base_url'] = 'Base URL is required for Ollama Cloud'
      }
      if (!formData.connection_config?.api_key) {
        nextErrors['connection_config.api_key'] = 'API key is required for Ollama Cloud'
      }
    } else {
      if (!formData.connection_config?.api_key) {
        nextErrors['connection_config.api_key'] = 'API key is required'
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      await onSubmit(formData)
      onClose()
    } catch (error: any) {
      setErrors({
        submit: error.response?.data?.detail || error.message || 'Failed to save AI provider',
      })
    } finally {
      setLoading(false)
    }
  }

  const renderAzureFields = () => (
    <>
      <Grid item xs={12}>
        <FormControl fullWidth>
          <InputLabel>Auth Mode</InputLabel>
          <Select
            value={formData.connection_config?.auth_mode || 'api-key'}
            label="Auth Mode"
            onChange={(e) => handleChange('connection_config.auth_mode', e.target.value)}
          >
            <MenuItem value="api-key">API Key</MenuItem>
            <MenuItem value="managed-identity">Managed Identity</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Azure Endpoint"
          value={formData.connection_config?.azure_endpoint || ''}
          onChange={(e) => handleChange('connection_config.azure_endpoint', e.target.value)}
          error={!!errors['connection_config.azure_endpoint']}
          helperText={errors['connection_config.azure_endpoint'] || 'https://<resource>.openai.azure.com'}
        />
      </Grid>
      {(formData.connection_config?.auth_mode || 'api-key') === 'api-key' && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={formData.connection_config?.api_key || ''}
            onChange={(e) => handleChange('connection_config.api_key', e.target.value)}
            error={!!errors['connection_config.api_key']}
            helperText={errors['connection_config.api_key']}
          />
        </Grid>
      )}
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="API Version"
          value={formData.connection_config?.api_version || '2024-06-01'}
          onChange={(e) => handleChange('connection_config.api_version', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Chat Deployment"
          value={formData.connection_config?.chat_deployment || ''}
          onChange={(e) => handleChange('connection_config.chat_deployment', e.target.value)}
          error={!!errors['connection_config.chat_deployment']}
          helperText={errors['connection_config.chat_deployment']}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Embedding Deployment"
          value={formData.connection_config?.embedding_deployment || ''}
          onChange={(e) => handleChange('connection_config.embedding_deployment', e.target.value)}
          error={!!errors['connection_config.embedding_deployment']}
          helperText={errors['connection_config.embedding_deployment']}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Default Model"
          value={formData.connection_config?.default_model || ''}
          onChange={(e) => handleChange('connection_config.default_model', e.target.value)}
          placeholder="Use same as chat deployment"
        />
      </Grid>
    </>
  )

  const renderOllamaFields = (cloud: boolean) => (
    <>
      {cloud && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={formData.connection_config?.api_key || ''}
            onChange={(e) => handleChange('connection_config.api_key', e.target.value)}
            error={!!errors['connection_config.api_key']}
            helperText={errors['connection_config.api_key']}
          />
        </Grid>
      )}
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Base URL"
          value={formData.connection_config?.base_url || ''}
          onChange={(e) => handleChange('connection_config.base_url', e.target.value)}
          error={!!errors['connection_config.base_url']}
          helperText={errors['connection_config.base_url'] || (cloud ? 'https://api.ollama.ai' : 'http://host.docker.internal:11434')}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Default Model"
          value={formData.connection_config?.default_model || ''}
          onChange={(e) => handleChange('connection_config.default_model', e.target.value)}
        />
      </Grid>
    </>
  )

  const renderGenericFields = () => (
    <>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="API Key"
          type="password"
          value={formData.connection_config?.api_key || ''}
          onChange={(e) => handleChange('connection_config.api_key', e.target.value)}
          error={!!errors['connection_config.api_key']}
          helperText={errors['connection_config.api_key']}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="API Endpoint"
          value={formData.connection_config?.api_endpoint || ''}
          onChange={(e) => handleChange('connection_config.api_endpoint', e.target.value)}
        />
      </Grid>
      {formData.provider_name === 'chatgpt' && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Organization ID (Optional)"
            value={formData.connection_config?.organization || ''}
            onChange={(e) => handleChange('connection_config.organization', e.target.value)}
          />
        </Grid>
      )}
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Default Model"
          value={formData.connection_config?.default_model || ''}
          onChange={(e) => handleChange('connection_config.default_model', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          type="number"
          label="Temperature"
          value={formData.connection_config?.temperature || 0.7}
          onChange={(e) => handleChange('connection_config.temperature', parseFloat(e.target.value) || 0.7)}
          inputProps={{ min: 0, max: 2, step: 0.1 }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          type="number"
          label="Max Tokens"
          value={formData.connection_config?.max_tokens || 2000}
          onChange={(e) => handleChange('connection_config.max_tokens', parseInt(e.target.value, 10) || 2000)}
          inputProps={{ min: 1, max: 32000 }}
        />
      </Grid>
    </>
  )

  const getProviderSpecificFields = () => {
    if (formData.provider_name === 'azure-openai') return renderAzureFields()
    if (formData.provider_name === 'ollama') return renderOllamaFields(false)
    if (formData.provider_name === 'ollama-cloud') return renderOllamaFields(true)
    return renderGenericFields()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings />
        {initialData ? 'Edit AI Provider' : 'Add AI Provider'}
      </DialogTitle>
      <DialogContent>
        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.submit}
          </Alert>
        )}

        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.provider_name}>
              <InputLabel>AI Provider</InputLabel>
              <Select
                value={formData.provider_name}
                label="AI Provider"
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={!!initialData}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Display Name"
              value={formData.display_name}
              onChange={(e) => handleChange('display_name', e.target.value)}
              error={!!errors.display_name}
              helperText={errors.display_name}
            />
          </Grid>

          {formData.provider_name && (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Connection Configuration
                </Typography>
              </Grid>
              {getProviderSpecificFields()}
            </>
          )}

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                  />
                }
                label="Active"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_default}
                    onChange={(e) => handleChange('is_default', e.target.checked)}
                  />
                }
                label="Set as Default Provider"
              />
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
