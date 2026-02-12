import { useState, useEffect } from 'react'
import {
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Card,
  CardContent,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  AutoAwesome,
  Description,
  Person,
  Edit,
  Lightbulb,
  Warning,
  ExpandMore,
  ContentCopy,
  CheckCircle,
} from '@mui/icons-material'
import { aiService, RFPSummary, Risk } from '../services/aiService'
import { documentService, Document } from '../services/documentService'
import { opportunityService, Opportunity } from '../services/opportunityService'
import { aiProviderService, ModelOption } from '../services/aiProviderService'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from '../components/LoadingSpinner'

const AVAILABLE_MODELS = [
  { value: 'gpt-5', label: 'GPT-5 (Complex reasoning, broad world knowledge, code-heavy tasks)' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (Cost-optimized, balances speed/cost/capability)' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano (High-throughput, simple instruction-following)' },
  { value: 'gpt-5-codex', label: 'GPT-5-Codex (Optimized for agentic coding in Codex)' },
  { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat Latest (Chat-optimized version)' },
]

export default function AIAssistantPage() {
  const [tabValue, setTabValue] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const { toast, showToast, hideToast } = useToast()

  // Model selection - persist in localStorage
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([
    { value: 'gpt-5', label: 'GPT-5 (Complex reasoning, broad world knowledge, code-heavy tasks)' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini (Cost-optimized, balances speed/cost/capability)' },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano (High-throughput, simple instruction-following)' },
    { value: 'gpt-5-codex', label: 'GPT-5-Codex (Optimized for agentic coding in Codex)' },
    { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat Latest (Chat-optimized version)' },
  ])
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem('ai-assistant-model')
    return saved || 'gpt-5-mini' // Default to GPT-5-mini (cost-optimized)
  })

  // RFP Parser state
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<string>('')
  const [rfpSummary, setRfpSummary] = useState<RFPSummary | null>(null)
  const [parsingRFP, setParsingRFP] = useState(false)

  // Resume Tailor state
  const [resumeText, setResumeText] = useState('')
  const [sowText, setSowText] = useState('')
  const [tailoredResume, setTailoredResume] = useState('')
  const [tailoringResume, setTailoringResume] = useState(false)

  // Proposal Draft state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOpportunity, setSelectedOpportunity] = useState<string>('')
  const [sectionType, setSectionType] = useState('executive_summary')
  const [draftedContent, setDraftedContent] = useState('')
  const [draftingProposal, setDraftingProposal] = useState(false)

  // Win Themes state
  const [winThemes, setWinThemes] = useState<string[]>([])
  const [loadingThemes, setLoadingThemes] = useState(false)

  // Risk Analysis state
  const [proposalText, setProposalText] = useState('')
  const [risks, setRisks] = useState<Risk[]>([])
  const [analyzingRisks, setAnalyzingRisks] = useState(false)

  const [copiedText, setCopiedText] = useState<string | null>(null)

  useEffect(() => {
    setInitialLoad(false)
    loadActiveProvider()
    if (tabValue === 0) {
      loadDocuments()
    } else if (tabValue === 2 || tabValue === 3) {
      loadOpportunities()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue])

  const loadActiveProvider = async () => {
    try {
      const provider = await aiProviderService.getDefault()
      if (provider) {
        const models = aiProviderService.getModelsForProvider(provider.provider_name)
        setAvailableModels(models)
        
        // Set default model from provider config or use first model
        const defaultModel = aiProviderService.getDefaultModel(provider)
        const savedModel = localStorage.getItem('ai-assistant-model')
        
        // Only update if saved model is not in the new list, or use provider default
        if (!savedModel || !models.find(m => m.value === savedModel)) {
          setSelectedModel(defaultModel)
          localStorage.setItem('ai-assistant-model', defaultModel)
        }
      }
    } catch (error) {
      console.error('Failed to load active provider:', error)
      // Keep default models on error
    }
  }

  // Save model selection to localStorage
  useEffect(() => {
    localStorage.setItem('ai-assistant-model', selectedModel)
  }, [selectedModel])

  const loadDocuments = async () => {
    try {
      // Load all documents, not just RFP type, so users can parse any document
      const data = await documentService.list()
      console.log('Loaded documents:', data.documents?.length || 0, data.documents)
      setDocuments(data.documents || [])
      if (data.documents && data.documents.length === 0 && !initialLoad) {
        showToast('No documents found. Upload a document from an Opportunity or Proposal page.', 'info')
      }
    } catch (error: any) {
      console.error('Failed to load documents:', error)
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to load documents'
      // Don't show toast on initial load to avoid spam
      if (!initialLoad) {
        showToast(errorMsg, 'error')
      }
      // Set empty array to prevent crashes
      setDocuments([])
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

  const handleParseRFP = async () => {
    if (!selectedDocument) {
      showToast('Please select a document', 'error')
      return
    }

    try {
      setParsingRFP(true)
      setRfpSummary(null) // Clear previous summary
      
      console.log('Parsing document:', selectedDocument)
      const summary = await aiService.parseRFP(selectedDocument, selectedModel)
      console.log('Parse result:', summary)
      
      // Check if there's an error in the response
      if (summary && typeof summary === 'object' && 'error' in summary) {
        const errorMsg = (summary as any).error || 'Failed to parse RFP'
        console.error('Parse error:', errorMsg)
        showToast(errorMsg, 'error')
        setRfpSummary(null)
        return
      }
      
      // Validate summary structure
      if (!summary || typeof summary !== 'object' || !('summary' in summary)) {
        console.error('Invalid summary structure:', summary)
        showToast('Invalid response from server', 'error')
        setRfpSummary(null)
        return
      }
      
      setRfpSummary(summary as RFPSummary)
      showToast('RFP parsed successfully', 'success')
    } catch (error: any) {
      console.error('Failed to parse RFP:', error)
      console.error('Error details:', error.response?.data)
      // Extract error message from response
      let errorMessage = 'Failed to parse RFP'
      if (error.response?.data) {
        const data = error.response.data
        if (typeof data.detail === 'string') {
          errorMessage = data.detail
        } else if (Array.isArray(data.detail)) {
          // Pydantic validation errors
          errorMessage = data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ')
        } else if (data.detail && typeof data.detail === 'object') {
          errorMessage = data.detail.msg || JSON.stringify(data.detail)
        } else if (typeof data === 'string') {
          errorMessage = data
        } else if (data.error) {
          errorMessage = data.error
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      showToast(errorMessage, 'error')
      setRfpSummary(null)
    } finally {
      setParsingRFP(false)
    }
  }

  const handleTailorResume = async () => {
    if (!resumeText || !sowText) {
      showToast('Please provide both resume and SOW text', 'error')
      return
    }

    try {
      setTailoringResume(true)
      const result = await aiService.tailorResume(resumeText, sowText, selectedModel)
      setTailoredResume(result.tailored_resume)
      showToast('Resume tailored successfully', 'success')
    } catch (error: any) {
      console.error('Failed to tailor resume:', error)
      showToast(
        error.response?.data?.detail || error.message || 'Failed to tailor resume',
        'error'
      )
    } finally {
      setTailoringResume(false)
    }
  }

  const handleDraftProposal = async () => {
    if (!selectedOpportunity) {
      showToast('Please select an opportunity', 'error')
      return
    }

    try {
      setDraftingProposal(true)
      const result = await aiService.draftProposal(selectedOpportunity, sectionType, selectedModel)
      setDraftedContent(result.content)
      showToast('Proposal section drafted successfully', 'success')
    } catch (error: any) {
      console.error('Failed to draft proposal:', error)
      showToast(
        error.response?.data?.detail || error.message || 'Failed to draft proposal',
        'error'
      )
    } finally {
      setDraftingProposal(false)
    }
  }

  const handleGetWinThemes = async (regenerate: boolean = false) => {
    if (!selectedOpportunity) {
      showToast('Please select an opportunity', 'error')
      return
    }

    try {
      setLoadingThemes(true)
      const result = await aiService.getWinThemes(selectedOpportunity, selectedModel, regenerate)
      setWinThemes(result.win_themes || [])
      if (regenerate) {
        showToast('Win themes regenerated successfully', 'success')
      } else if (result.win_themes && result.win_themes.length > 0) {
        showToast('Loaded existing win themes', 'success')
      } else {
        showToast('Win themes generated successfully', 'success')
      }
    } catch (error: any) {
      console.error('Failed to get win themes:', error)
      showToast(
        error.response?.data?.detail || error.message || 'Failed to get win themes',
        'error'
      )
    } finally {
      setLoadingThemes(false)
    }
  }

  const handleAnalyzeRisks = async () => {
    if (!proposalText) {
      showToast('Please provide proposal text', 'error')
      return
    }

    try {
      setAnalyzingRisks(true)
      const result = await aiService.analyzeRisks(proposalText, selectedModel)
      setRisks(result.risks)
      showToast('Risk analysis completed', 'success')
    } catch (error: any) {
      console.error('Failed to analyze risks:', error)
      showToast(
        error.response?.data?.detail || error.message || 'Failed to analyze risks',
        'error'
      )
    } finally {
      setAnalyzingRisks(false)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(id)
      showToast('Copied to clipboard', 'success')
      setTimeout(() => setCopiedText(null), 2000)
    } catch (error) {
      showToast('Failed to copy', 'error')
    }
  }

  const getRiskColor = (severity: string) => {
    const colors: Record<string, 'error' | 'warning' | 'info'> = {
      high: 'error',
      medium: 'warning',
      low: 'info',
    }
    return colors[severity.toLowerCase()] || 'info'
  }

  if (initialLoad) {
    return (
      <Box className="fade-in" display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box className="fade-in">
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <AutoAwesome sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            AI Assistant
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="model-select-label">AI Model</InputLabel>
          <Select
            labelId="model-select-label"
            id="model-select"
            value={selectedModel}
            label="AI Model"
            onChange={(e) => setSelectedModel(e.target.value)}
            sx={{
              background: 'rgba(15, 23, 42, 0.5)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(99, 102, 241, 0.3)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(99, 102, 241, 0.5)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(99, 102, 241, 0.7)',
              },
            }}
          >
            {availableModels.map((model) => (
              <MenuItem key={model.value} value={model.value}>
                {model.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab icon={<Description />} label="RFP Parser" />
          <Tab icon={<Person />} label="Resume Tailor" />
          <Tab icon={<Edit />} label="Proposal Draft" />
          <Tab icon={<Lightbulb />} label="Win Themes" />
          <Tab icon={<Warning />} label="Risk Analysis" />
        </Tabs>
      </Paper>

      {/* RFP Parser Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700}>
                    Select RFP Document
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={loadDocuments}
                    sx={{ minWidth: 'auto' }}
                  >
                    Refresh
                  </Button>
                </Box>
                <Box sx={{ mb: 2 }}>
                  {documents.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      No documents found. Upload a document first from an Opportunity or Proposal page.
                    </Alert>
                  ) : (
                    <>
                      <select
                        value={selectedDocument}
                        onChange={(e) => setSelectedDocument(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          background: 'rgba(15, 23, 42, 0.5)',
                          color: 'white',
                          fontSize: '14px',
                        }}
                      >
                        <option value="">Select a document...</option>
                        {documents.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.title || doc.filename || 'Untitled Document'} {doc.document_type ? `(${doc.document_type})` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedDocument && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Selected: {documents.find(d => d.id === selectedDocument)?.title || documents.find(d => d.id === selectedDocument)?.filename || 'Unknown'}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleParseRFP}
                  disabled={!selectedDocument || parsingRFP || documents.length === 0}
                  startIcon={parsingRFP ? <CircularProgress size={20} /> : <AutoAwesome />}
                  sx={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 1) 0%, rgba(236, 72, 153, 1) 100%)',
                  }}
                >
                  {parsingRFP ? 'Parsing...' : 'Parse RFP'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            {parsingRFP && (
              <Card
                sx={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <CardContent>
                  <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="body1">Parsing RFP document...</Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
            {!parsingRFP && rfpSummary && (
              <Card
                sx={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      RFP Summary
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(rfpSummary.summary, 'rfp-summary')}
                    >
                      {copiedText === 'rfp-summary' ? <CheckCircle /> : <ContentCopy />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                    {rfpSummary.summary}
                  </Typography>
                  {rfpSummary.sections && Object.keys(rfpSummary.sections).length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Sections Found:
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {Object.keys(rfpSummary.sections).map((section) => (
                          <Chip key={section} label={section} size="small" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
            {!parsingRFP && !rfpSummary && (
              <Card
                sx={{
                  background: 'rgba(15, 23, 42, 0.3)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <CardContent>
                  <Box textAlign="center" py={4}>
                    <Description sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      Select a document and click "Parse RFP" to see the summary here
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* Resume Tailor Tab */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, mb: 2 }}>
              <Typography variant="h6" gutterBottom fontWeight={700}>
                Resume Text
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste resume text here..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Paper>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={700}>
                Statement of Work
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={sowText}
                onChange={(e) => setSowText(e.target.value)}
                placeholder="Paste SOW text here..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Paper>
            <Button
              variant="contained"
              fullWidth
              onClick={handleTailorResume}
              disabled={!resumeText || !sowText || tailoringResume}
              startIcon={tailoringResume ? <CircularProgress size={20} /> : <AutoAwesome />}
              sx={{ mt: 2 }}
            >
              {tailoringResume ? 'Tailoring...' : 'Tailor Resume'}
            </Button>
          </Grid>

          <Grid item xs={12} md={6}>
            {tailoredResume && (
              <Card
                sx={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Tailored Resume
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(tailoredResume, 'tailored-resume')}
                    >
                      {copiedText === 'tailored-resume' ? <CheckCircle /> : <ContentCopy />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {tailoredResume}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* Proposal Draft Tab */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  Select Opportunity
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <select
                    value={selectedOpportunity}
                    onChange={(e) => setSelectedOpportunity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      background: 'rgba(15, 23, 42, 0.5)',
                      color: 'white',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Select an opportunity...</option>
                    {opportunities.map((opp) => (
                      <option key={opp.id} value={opp.id}>
                        {opp.name}
                      </option>
                    ))}
                  </select>
                </Box>
                <Typography variant="h6" gutterBottom fontWeight={700} sx={{ mt: 2 }}>
                  Section Type
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <select
                    value={sectionType}
                    onChange={(e) => setSectionType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      background: 'rgba(15, 23, 42, 0.5)',
                      color: 'white',
                      fontSize: '14px',
                    }}
                  >
                    <option value="executive_summary">Executive Summary</option>
                    <option value="technical_approach">Technical Approach</option>
                    <option value="management_approach">Management Approach</option>
                    <option value="past_performance">Past Performance</option>
                  </select>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleDraftProposal}
                  disabled={!selectedOpportunity || draftingProposal}
                  startIcon={draftingProposal ? <CircularProgress size={20} /> : <AutoAwesome />}
                >
                  {draftingProposal ? 'Drafting...' : 'Draft Section'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            {draftedContent && (
              <Card
                sx={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Drafted Content
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(draftedContent, 'drafted-content')}
                    >
                      {copiedText === 'drafted-content' ? <CheckCircle /> : <ContentCopy />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {draftedContent}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* Win Themes Tab */}
      {tabValue === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  Select Opportunity
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <select
                    value={selectedOpportunity}
                    onChange={(e) => setSelectedOpportunity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      background: 'rgba(15, 23, 42, 0.5)',
                      color: 'white',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Select an opportunity...</option>
                    {opportunities.map((opp) => (
                      <option key={opp.id} value={opp.id}>
                        {opp.name}
                      </option>
                    ))}
                  </select>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => handleGetWinThemes(false)}
                    disabled={!selectedOpportunity || loadingThemes}
                    startIcon={loadingThemes ? <CircularProgress size={20} /> : <Lightbulb />}
                  >
                    {loadingThemes ? 'Loading...' : winThemes.length > 0 ? 'Refresh Win Themes' : 'Generate Win Themes'}
                  </Button>
                  {winThemes.length > 0 && (
                    <Button
                      variant="outlined"
                      onClick={() => handleGetWinThemes(true)}
                      disabled={!selectedOpportunity || loadingThemes}
                      startIcon={loadingThemes ? <CircularProgress size={20} /> : <Lightbulb />}
                    >
                      Regenerate
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            {winThemes.length > 0 && (
              <Card
                sx={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={700}>
                    Suggested Win Themes
                  </Typography>
                  <List>
                    {winThemes.map((theme, index) => (
                      <ListItem
                        key={index}
                        sx={{
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          borderRadius: 2,
                          mb: 1,
                          background: 'rgba(99, 102, 241, 0.1)',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight={600}>
                              {theme}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* Risk Analysis Tab */}
      {tabValue === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={700}>
                Proposal Text
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={15}
                value={proposalText}
                onChange={(e) => setProposalText(e.target.value)}
                placeholder="Paste proposal text to analyze for risks..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
              <Button
                variant="contained"
                fullWidth
                onClick={handleAnalyzeRisks}
                disabled={!proposalText || analyzingRisks}
                startIcon={analyzingRisks ? <CircularProgress size={20} /> : <Warning />}
                sx={{ mt: 2 }}
              >
                {analyzingRisks ? 'Analyzing...' : 'Analyze Risks'}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            {risks.length > 0 && (
              <Card
                sx={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight={700}>
                    Identified Risks
                  </Typography>
                  {risks.map((risk, index) => (
                    <Accordion
                      key={index}
                      sx={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        mb: 1,
                        '&:before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box display="flex" alignItems="center" gap={2} width="100%">
                          <Chip
                            label={risk.severity}
                            color={getRiskColor(risk.severity)}
                            size="small"
                          />
                          <Typography variant="body2" sx={{ flexGrow: 1 }}>
                            {risk.risk}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Recommendation:</strong> {risk.recommendation}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={hideToast}
      />
    </Box>
  )
}

