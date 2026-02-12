import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  TextField,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  IconButton,
} from '@mui/material'
import {
  AutoAwesome,
  Description,
  Edit,
  Lightbulb,
  Warning,
  Preview,
  Save,
  Visibility,
  CheckCircle,
  HourglassEmpty,
} from '@mui/icons-material'
import { aiService, RFPSummary, Risk } from '../services/aiService'
import { documentService, Document } from '../services/documentService'
import { proposalService, Proposal } from '../services/proposalService'
import { aiProviderService, ModelOption } from '../services/aiProviderService'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'

type SectionOption = {
  value: 'executive_summary' | 'technical_approach' | 'management_approach' | 'past_performance'
  label: string
  description: string
}

const SECTION_OPTIONS: SectionOption[] = [
  {
    value: 'executive_summary',
    label: 'Executive Summary',
    description: 'Provide a high-level overview that captures the customer problem, your differentiated solution, and the measurable benefits you will deliver.',
  },
  {
    value: 'technical_approach',
    label: 'Technical Approach',
    description: 'Outline your methodology, technologies, and processes that demonstrate how you will meet or exceed the statement of work requirements.',
  },
  {
    value: 'management_approach',
    label: 'Management Approach',
    description: 'Describe the team structure, staffing plan, quality controls, and communication cadence that ensure smooth project execution.',
  },
  {
    value: 'past_performance',
    label: 'Past Performance',
    description: 'Highlight the most relevant contracts, successful outcomes, and customer testimonials that prove your ability to deliver.',
  },
]

const getSectionLabel = (value: SectionOption['value']) =>
  SECTION_OPTIONS.find((section) => section.value === value)?.label || 'Section'

interface ProposalAIAssistantProps {
  open: boolean
  onClose: () => void
  proposalId: string
  proposalName?: string
  opportunityId?: string
}

export default function ProposalAIAssistant({
  open,
  onClose,
  proposalId,
  proposalName,
  opportunityId,
}: ProposalAIAssistantProps) {
  const [tabValue, setTabValue] = useState(0)
  const { toast, showToast, hideToast } = useToast()

  // Model selection
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([
    { value: 'gpt-5', label: 'GPT-5 (Complex reasoning, broad world knowledge, code-heavy tasks)' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini (Cost-optimized, balances speed/cost/capability)' },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano (High-throughput, simple instruction-following)' },
    { value: 'gpt-5-codex', label: 'GPT-5-Codex (Optimized for agentic coding in Codex)' },
    { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat Latest (Chat-optimized version)' },
  ])
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem('ai-assistant-model')
    return saved || 'gpt-5-mini'
  })

  // RFP Parser state
  const [opportunityDocuments, setOpportunityDocuments] = useState<Document[]>([])
  const [proposalDocuments, setProposalDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<string>('')
  const [rfpSummary, setRfpSummary] = useState<RFPSummary | null>(null)
  const [parsingRFP, setParsingRFP] = useState(false)
  const [loadingDocuments, setLoadingDocuments] = useState(false)

  // Proposal Draft state
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [sectionType, setSectionType] = useState<SectionOption['value']>('executive_summary')
  const [draftedContent, setDraftedContent] = useState('')
  const [draftingProposal, setDraftingProposal] = useState(false)
  const [lastSyncedSection, setLastSyncedSection] = useState<SectionOption['value']>('executive_summary')

  // Win Themes state
  const [winThemes, setWinThemes] = useState<string[]>([])
  const [loadingThemes, setLoadingThemes] = useState(false)

  // Risk Analysis state
  const [proposalText, setProposalText] = useState('')
  const [risks, setRisks] = useState<Risk[]>([])
  const [analyzingRisks, setAnalyzingRisks] = useState(false)

  const currentSection = SECTION_OPTIONS.find((section) => section.value === sectionType)

  const getProposalSectionContent = (section: SectionOption['value']) => {
    if (!proposal) return ''
    switch (section) {
      case 'executive_summary':
        return proposal.executive_summary || ''
      case 'technical_approach':
        return proposal.technical_approach || ''
      case 'management_approach':
        return proposal.management_approach || ''
      case 'past_performance':
        return proposal.past_performance || ''
      default:
        return ''
    }
  }

  const truncateContent = (text: string, max = 220) => {
    const clean = text?.trim()
    if (!clean) return ''
    if (clean.length <= max) return clean
    return `${clean.slice(0, max)}...`
  }

  useEffect(() => {
    if (open) {
      loadActiveProvider()
      if (tabValue === 0) {
        loadDocuments()
      } else if (tabValue === 1) {
        loadProposal()
      } else if (tabValue === 2 && opportunityId) {
        loadWinThemes()
      } else if (tabValue === 4) {
        // Preview tab - load full proposal
        loadProposal()
      }
    }
    // Reset selected document when dialog closes
    if (!open) {
      setSelectedDocument('')
      setRfpSummary(null)
    }
  }, [open, tabValue, opportunityId, proposalId])

  useEffect(() => {
    if (!proposal) return
    const syncedContent = getProposalSectionContent(sectionType)
    if (lastSyncedSection === sectionType) {
      setDraftedContent(syncedContent || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal])

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

  useEffect(() => {
    localStorage.setItem('ai-assistant-model', selectedModel)
  }, [selectedModel])

  const loadDocuments = async () => {
    if (!proposalId) {
      console.warn('No proposalId provided, cannot load documents')
      return
    }
    
    try {
      setLoadingDocuments(true)
      console.log('Loading documents for proposal:', proposalId, 'opportunity:', opportunityId)
      
      // Load documents from both opportunity and proposal
      const [opportunityData, proposalData] = await Promise.all([
        opportunityId ? documentService.list({ opportunity_id: opportunityId }) : Promise.resolve({ documents: [] }),
        documentService.list({ proposal_id: proposalId }),
      ])
      
      console.log('Opportunity documents:', opportunityData.documents?.length || 0, opportunityData.documents)
      console.log('Proposal documents:', proposalData.documents?.length || 0, proposalData.documents)
      
      // Filter out duplicates (in case a document is linked to both)
      const opportunityDocs = (opportunityData.documents || []).filter(
        doc => !doc.proposal_id || doc.proposal_id !== proposalId
      )
      const proposalDocs = proposalData.documents || []
      
      console.log('Filtered opportunity docs:', opportunityDocs.length)
      console.log('Filtered proposal docs:', proposalDocs.length)
      
      setOpportunityDocuments(opportunityDocs)
      setProposalDocuments(proposalDocs)
      
      if (opportunityDocs.length === 0 && proposalDocs.length === 0) {
        console.warn('No documents found for this proposal/opportunity')
      }
    } catch (error: any) {
      console.error('Failed to load documents:', error)
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to load documents'
      showToast(errorMsg, 'error')
      setOpportunityDocuments([])
      setProposalDocuments([])
    } finally {
      setLoadingDocuments(false)
    }
  }

  const loadProposal = async () => {
    try {
      const proposalData = await proposalService.get(proposalId)
      setProposal(proposalData)
      // Pre-fill proposal text for risk analysis
      const text = [
        proposalData.executive_summary,
        proposalData.technical_approach,
      ].filter(Boolean).join('\n\n')
      setProposalText(text)
      const currentContent = getProposalSectionContent(sectionType)
      setDraftedContent(currentContent || '')
      setLastSyncedSection(sectionType)
    } catch (error) {
      console.error('Failed to load proposal:', error)
    }
  }

  const loadWinThemes = async (regenerate: boolean = false) => {
    if (!opportunityId) return
    try {
      setLoadingThemes(true)
      const result = await aiService.getWinThemes(opportunityId, selectedModel, regenerate)
      setWinThemes(result.win_themes || [])
      if (regenerate) {
        showToast('Win themes regenerated successfully', 'success')
      } else if (result.win_themes && result.win_themes.length > 0) {
        showToast('Loaded existing win themes', 'success')
      } else {
        showToast('Win themes generated successfully', 'success')
      }
    } catch (error: any) {
      console.error('Failed to load win themes:', error)
      showToast('Failed to load win themes', 'error')
    } finally {
      setLoadingThemes(false)
    }
  }

  const handleParseRFP = async () => {
    if (!selectedDocument) {
      showToast('Please select a document', 'error')
      return
    }

    try {
      setParsingRFP(true)
      setRfpSummary(null)
      const summary = await aiService.parseRFP(selectedDocument, selectedModel)
      setRfpSummary(summary)
      showToast('RFP parsed successfully', 'success')
    } catch (error: any) {
      console.error('Failed to parse RFP:', error)
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to parse RFP'
      showToast(errorMsg, 'error')
    } finally {
      setParsingRFP(false)
    }
  }

  const handleDraftProposal = async () => {
    if (!opportunityId) {
      showToast('Opportunity ID is required', 'error')
      return
    }

    try {
      setDraftingProposal(true)
      const result = await aiService.draftProposal(opportunityId, sectionType, selectedModel)
      setDraftedContent(result.content)
      setLastSyncedSection(sectionType)
      
      // Auto-save the generated content to the proposal
      await handleSaveDraftAuto(result.content)
      
      showToast('Proposal section drafted and saved successfully', 'success')
    } catch (error: any) {
      console.error('Failed to draft proposal:', error)
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to draft proposal'
      showToast(errorMsg, 'error')
    } finally {
      setDraftingProposal(false)
    }
  }

  const handleSaveDraftAuto = async (content: string) => {
    if (!content) return

    try {
      const updateData: any = {}
      if (sectionType === 'executive_summary') {
        updateData.executive_summary = content
      } else if (sectionType === 'technical_approach') {
        updateData.technical_approach = content
      } else if (sectionType === 'management_approach') {
        updateData.management_approach = content
      } else if (sectionType === 'past_performance') {
        updateData.past_performance = content
      }

      await proposalService.update(proposalId, updateData)
      // Reload proposal to get updated data (this will also update the preview)
      await loadProposal()
    } catch (error: any) {
      console.error('Failed to auto-save proposal:', error)
      // Don't show error toast for auto-save, just log it
    }
  }

  const handleAnalyzeRisks = async () => {
    if (!proposalText.trim()) {
      showToast('Please enter proposal text to analyze', 'error')
      return
    }

    try {
      setAnalyzingRisks(true)
      setRisks([])
      const result = await aiService.analyzeRisks(proposalText, selectedModel)
      setRisks(result.risks || [])
      showToast('Risk analysis completed', 'success')
    } catch (error: any) {
      console.error('Failed to analyze risks:', error)
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to analyze risks'
      showToast(errorMsg, 'error')
    } finally {
      setAnalyzingRisks(false)
    }
  }

  const handleSectionChange = (value: SectionOption['value']) => {
    setSectionType(value)
    const existingContent = getProposalSectionContent(value)
    setDraftedContent(existingContent || '')
    setLastSyncedSection(value)
  }

  const handleSaveDraft = async () => {
    if (!proposal || !draftedContent) return

    try {
      const updateData: any = {}
      if (sectionType === 'executive_summary') {
        updateData.executive_summary = draftedContent
      } else if (sectionType === 'technical_approach') {
        updateData.technical_approach = draftedContent
      } else if (sectionType === 'management_approach') {
        updateData.management_approach = draftedContent
      } else if (sectionType === 'past_performance') {
        updateData.past_performance = draftedContent
      }

      await proposalService.update(proposalId, updateData)
      showToast('Proposal updated successfully', 'success')
      await loadProposal()
    } catch (error: any) {
      console.error('Failed to save proposal:', error)
      showToast('Failed to save proposal', 'error')
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
          <AutoAwesome sx={{ color: 'primary.main' }} />
          AI Assistant - {proposalName || 'Proposal'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>AI Model</InputLabel>
              <Select
                value={selectedModel}
                label="AI Model"
                onChange={(e) => setSelectedModel(e.target.value)}
                sx={{
                  background: 'rgba(15, 23, 42, 0.5)',
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

          <Paper sx={{ mb: 2 }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab icon={<Description />} label="RFP Parser" />
              <Tab icon={<Edit />} label="Proposal Draft" />
              <Tab icon={<Lightbulb />} label="Win Themes" />
              <Tab icon={<Warning />} label="Risk Analysis" />
              <Tab icon={<Preview />} label="Document Preview" />
            </Tabs>
          </Paper>

          {/* RFP Parser Tab */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    Select Document
                  </Typography>
                  <Button
                    size="small"
                    onClick={loadDocuments}
                    disabled={loadingDocuments}
                    sx={{ minWidth: 'auto' }}
                  >
                    {loadingDocuments ? <CircularProgress size={16} /> : 'Refresh'}
                  </Button>
                </Box>
                
                {loadingDocuments ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (opportunityDocuments.length === 0 && proposalDocuments.length === 0) ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No documents found. Upload documents from the Opportunity or Proposal page.
                  </Alert>
                ) : (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="document-select-label" sx={{ color: 'text.primary' }}>Document</InputLabel>
                    <Select
                      labelId="document-select-label"
                      value={selectedDocument}
                      label="Document"
                      onChange={(e) => {
                        const newValue = e.target.value as string
                        console.log('Select onChange fired:', newValue)
                        setSelectedDocument(newValue)
                      }}
                      displayEmpty
                      renderValue={(value) => {
                        if (!value) {
                          return <em style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Select a document...</em>
                        }
                        const allDocs = [...opportunityDocuments, ...proposalDocuments]
                        const selectedDoc = allDocs.find(doc => doc.id === value)
                        return selectedDoc ? (selectedDoc.title || selectedDoc.filename) : ''
                      }}
                      sx={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        color: 'text.primary',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(99, 102, 241, 0.3)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(99, 102, 241, 0.5)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(99, 102, 241, 0.7)',
                        },
                        '& .MuiSelect-icon': {
                          color: 'text.primary',
                        },
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            maxHeight: 400,
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            '& .MuiMenuItem-root': {
                              color: 'text.primary',
                              '&:hover': {
                                background: 'rgba(99, 102, 241, 0.2)',
                              },
                              '&.Mui-selected': {
                                background: 'rgba(99, 102, 241, 0.3)',
                                '&:hover': {
                                  background: 'rgba(99, 102, 241, 0.4)',
                                },
                              },
                            },
                          },
                        },
                        anchorOrigin: {
                          vertical: 'bottom',
                          horizontal: 'left',
                        },
                        transformOrigin: {
                          vertical: 'top',
                          horizontal: 'left',
                        },
                        disablePortal: false,
                      }}
                    >
                      <MenuItem value="" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        Select a document...
                      </MenuItem>
                      {opportunityDocuments.length > 0 && opportunityDocuments.map((doc) => (
                        <MenuItem 
                          key={doc.id} 
                          value={doc.id} 
                          sx={{ color: 'text.primary' }}
                        >
                          📄 {doc.title || doc.filename}
                        </MenuItem>
                      ))}
                      {proposalDocuments.length > 0 && proposalDocuments.map((doc) => (
                        <MenuItem 
                          key={doc.id} 
                          value={doc.id} 
                          sx={{ color: 'text.primary' }}
                        >
                          📋 {doc.title || doc.filename}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Button
                  variant="contained"
                  onClick={handleParseRFP}
                  disabled={!selectedDocument || parsingRFP}
                  fullWidth
                >
                  Parse RFP
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                {parsingRFP ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                    <CircularProgress size={48} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Parsing RFP document...
                    </Typography>
                  </Box>
                ) : rfpSummary ? (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      RFP Summary
                    </Typography>
                    <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {rfpSummary.summary}
                      </Typography>
                    </Paper>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                    <Typography variant="body2" color="text.secondary">
                      Select a document and click "Parse RFP" to see the summary here.
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          )}

          {/* Proposal Draft Tab */}
          {tabValue === 1 && (
            <Paper
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.92) 0%, rgba(15, 23, 42, 0.98) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.22)',
                boxShadow: '0 20px 45px rgba(15, 23, 42, 0.45)',
              }}
            >
              <Grid container spacing={4}>
                <Grid item xs={12} md={4}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: 'primary.light', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}
                  >
                    Section Setup
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {currentSection?.description || 'Select a section to draft and tailor it with opportunity context.'}
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Section Type</InputLabel>
                    <Select
                      value={sectionType}
                      label="Section Type"
                      onChange={(e) => handleSectionChange(e.target.value as SectionOption['value'])}
                      sx={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        color: 'text.primary',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(99, 102, 241, 0.3)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(99, 102, 241, 0.5)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(99, 102, 241, 0.7)',
                        },
                        '& .MuiSelect-icon': {
                          color: 'text.primary',
                        },
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            maxHeight: 360,
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            '& .MuiMenuItem-root': {
                              color: 'text.primary',
                              '&:hover': {
                                background: 'rgba(99, 102, 241, 0.2)',
                              },
                              '&.Mui-selected': {
                                background: 'rgba(99, 102, 241, 0.3)',
                                '&:hover': {
                                  background: 'rgba(99, 102, 241, 0.4)',
                                },
                              },
                            },
                          },
                        },
                      }}
                    >
                      {SECTION_OPTIONS.map((section) => (
                        <MenuItem key={section.value} value={section.value}>
                          {section.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {!opportunityId && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                      Link this proposal to an opportunity to enable AI drafting.
                    </Alert>
                  )}

                  <Divider sx={{ my: 3, borderColor: 'rgba(99, 102, 241, 0.25)' }} />

                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    How the assistant helps
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    We blend your company profile strengths, win themes, and RFP content to produce a section that feels on-brand and compliant.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: 'primary.light', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}
                  >
                    Section Content
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Edit the AI draft before saving it back to the proposal record.
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{ flex: 1, position: 'relative' }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={12}
                        value={draftedContent}
                        onChange={(e) => setDraftedContent(e.target.value)}
                        placeholder={`AI-generated ${currentSection?.label?.toLowerCase() || 'section'} will appear here...`}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'rgba(15, 23, 42, 0.5)',
                          },
                        }}
                      />
                      {draftingProposal && (
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(15, 23, 42, 0.65)',
                            borderRadius: 1,
                          }}
                        >
                          <Box sx={{ textAlign: 'center' }}>
                            <CircularProgress size={36} sx={{ mb: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              Generating {currentSection?.label || 'section'}...
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                    <IconButton
                      onClick={handleDraftProposal}
                      disabled={!opportunityId || draftingProposal}
                      color="primary"
                      title={opportunityId ? 'Generate section with AI' : 'Link an opportunity to enable AI generation'}
                      sx={{
                        mt: 0.5,
                        p: 1.2,
                        background: 'rgba(99, 102, 241, 0.18)',
                        border: '1px solid rgba(99, 102, 241, 0.45)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          background: 'rgba(99, 102, 241, 0.28)',
                          transform: 'translateY(-1px)',
                        },
                        '&.Mui-disabled': {
                          opacity: 0.4,
                          background: 'rgba(148, 163, 184, 0.1)',
                          borderColor: 'rgba(148, 163, 184, 0.2)',
                        },
                      }}
                    >
                      {draftingProposal ? <CircularProgress size={22} /> : <AutoAwesome />}
                    </IconButton>
                  </Box>

                  {draftedContent ? (
                    <Box
                      sx={{
                        mt: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: 1.5,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                        Generated content is editable. Tweak the language, then save back to the proposal when you are ready.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSaveDraft}
                        disabled={!proposal || draftingProposal || !draftedContent.trim()}
                        sx={{
                          alignSelf: { xs: 'stretch', sm: 'flex-start' },
                          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        }}
                      >
                        Save to Proposal
                      </Button>
                    </Box>
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Click the sparkle icon to generate this section from your opportunity and company profile context.
                    </Alert>
                  )}

                  <Divider sx={{ my: 3, borderColor: 'rgba(99, 102, 241, 0.2)' }} />

                  <Typography
                    variant="subtitle2"
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: 'primary.light', mb: 1 }}
                  >
                    Generated Sections
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Review every drafted section and jump directly into edit mode.
                  </Typography>

                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {SECTION_OPTIONS.map((section) => {
                      const content = getProposalSectionContent(section.value)
                      const hasContent = Boolean(content && content.trim())
                      const isActive = sectionType === section.value

                      return (
                        <Grid item xs={12} key={section.value}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2,
                              background: isActive
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(79, 70, 229, 0.22) 100%)'
                                : 'rgba(15, 23, 42, 0.35)',
                              borderColor: isActive ? 'rgba(99, 102, 241, 0.7)' : 'rgba(99, 102, 241, 0.2)',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  {hasContent ? (
                                    <CheckCircle fontSize="small" color="success" />
                                  ) : (
                                    <HourglassEmpty fontSize="small" color="warning" />
                                  )}
                                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {section.label}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                  {hasContent ? truncateContent(content) : 'No content generated yet for this section.'}
                                </Typography>
                              </Box>
                              <Button
                                variant={isActive ? 'contained' : 'outlined'}
                                size="small"
                                startIcon={<Visibility />}
                                onClick={() => handleSectionChange(section.value)}
                                sx={{
                                  alignSelf: 'flex-start',
                                  background: isActive ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : undefined,
                                }}
                              >
                                {isActive ? 'Editing' : hasContent ? 'Edit Section' : 'Draft Section'}
                              </Button>
                            </Box>
                          </Paper>
                        </Grid>
                      )
                    })}
                  </Grid>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Win Themes Tab */}
          {tabValue === 2 && (
            <Box>
              {loadingThemes ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                  <CircularProgress size={48} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Generating win themes...
                  </Typography>
                </Box>
              ) : winThemes.length > 0 ? (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Win Themes
                  </Typography>
                  <Grid container spacing={2}>
                    {winThemes.map((theme, index) => (
                      <Grid item xs={12} sm={6} md={4} key={index}>
                        <Chip
                          label={theme}
                          color="primary"
                          sx={{ width: '100%', height: 'auto', py: 1 }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ) : (
                <Alert severity="info">
                  Click the button below to generate win themes for this opportunity.
                </Alert>
              )}
              {opportunityId && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => loadWinThemes(false)}
                    disabled={loadingThemes}
                  >
                    {winThemes.length > 0 ? 'Refresh Win Themes' : 'Generate Win Themes'}
                  </Button>
                  {winThemes.length > 0 && (
                    <Button
                      variant="outlined"
                      onClick={() => loadWinThemes(true)}
                      disabled={loadingThemes}
                    >
                      Regenerate
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Risk Analysis Tab */}
          {tabValue === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Proposal Text
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={10}
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  placeholder="Enter proposal text to analyze for risks..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(15, 23, 42, 0.5)',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleAnalyzeRisks}
                  disabled={!proposalText.trim() || analyzingRisks}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  Analyze Risks
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Risk Analysis Results
                </Typography>
                {analyzingRisks ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                    <CircularProgress size={48} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing risks...
                    </Typography>
                  </Box>
                ) : risks.length > 0 ? (
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {risks.map((risk, index) => (
                      <Paper key={index} sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle2" color="error" gutterBottom>
                          {risk.risk}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Severity: {risk.severity}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {risk.recommendation}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info">
                    Enter proposal text and click "Analyze Risks" to see results.
                  </Alert>
                )}
              </Grid>
            </Grid>
          )}

          {/* Document Preview Tab */}
          {tabValue === 4 && (
            <Box>
              {!proposal ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Paper
                  sx={{
                    p: 4,
                    maxHeight: '70vh',
                    overflow: 'auto',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                  }}
                >
                  {/* Document Header */}
                  <Box sx={{ textAlign: 'center', mb: 4, pb: 3, borderBottom: '2px solid rgba(99, 102, 241, 0.3)' }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                      {proposal.name}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Version: {proposal.version || '1.0'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Phase: {proposal.current_phase.replace('_', ' ').toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Status: {proposal.status.toUpperCase()}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Executive Summary */}
                  {proposal.executive_summary && (
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
                        Executive Summary
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          lineHeight: 1.8,
                          whiteSpace: 'pre-wrap',
                          textAlign: 'justify',
                        }}
                      >
                        {proposal.executive_summary}
                      </Typography>
                    </Box>
                  )}

                  {/* Technical Approach */}
                  {proposal.technical_approach && (
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
                        Technical Approach
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          lineHeight: 1.8,
                          whiteSpace: 'pre-wrap',
                          textAlign: 'justify',
                        }}
                      >
                        {proposal.technical_approach}
                      </Typography>
                    </Box>
                  )}

                  {/* Management Approach */}
                  {proposal.management_approach && (
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
                        Management Approach
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          lineHeight: 1.8,
                          whiteSpace: 'pre-wrap',
                          textAlign: 'justify',
                        }}
                      >
                        {proposal.management_approach}
                      </Typography>
                    </Box>
                  )}

                  {/* Past Performance */}
                  {proposal.past_performance && (
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
                        Past Performance
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          lineHeight: 1.8,
                          whiteSpace: 'pre-wrap',
                          textAlign: 'justify',
                        }}
                      >
                        {proposal.past_performance}
                      </Typography>
                    </Box>
                  )}

                  {/* Win Themes */}
                  {proposal.win_themes && proposal.win_themes.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
                        Win Themes
                      </Typography>
                      <Box component="ul" sx={{ pl: 3, m: 0 }}>
                        {proposal.win_themes.map((theme, index) => (
                          <Box component="li" key={index} sx={{ mb: 1.5 }}>
                            <Typography
                              variant="body1"
                              sx={{
                                lineHeight: 1.8,
                              }}
                            >
                              {theme}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Empty State */}
                  {!proposal.executive_summary &&
                    !proposal.technical_approach &&
                    !proposal.management_approach &&
                    !proposal.past_performance &&
                    (!proposal.win_themes || proposal.win_themes.length === 0) && (
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No sections have been generated yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Use the "Proposal Draft" tab to generate sections for this proposal.
                        </Typography>
                      </Box>
                    )}

                  {/* Document Footer */}
                  {(proposal.executive_summary ||
                    proposal.technical_approach ||
                    proposal.management_approach ||
                    proposal.past_performance ||
                    (proposal.win_themes && proposal.win_themes.length > 0)) && (
                    <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(99, 102, 241, 0.2)', textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Document generated on {new Date(proposal.updated_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={hideToast}
      />
    </>
  )
}

