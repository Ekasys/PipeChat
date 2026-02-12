import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  LinearProgress,
  Card,
  CardContent,
  Slider,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  CloudDownload,
  Psychology,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  HelpOutline,
  ThumbUp,
  ThumbDown,
  ArrowForward,
  Refresh,
  Description,
  Assessment,
  Gavel,
} from '@mui/icons-material'
import { marketIntelService, MarketIntel, ComplianceRequirement, ComplianceSummary } from '../services/marketIntelService'

interface CaptureQualificationProps {
  intel: MarketIntel
  onUpdate: () => void
  onClose: () => void
}

// Default bid/no-bid criteria with descriptions
const DEFAULT_CRITERIA = [
  { 
    name: 'Strategic Alignment', 
    weight: 1.5, 
    max_score: 10,
    description: 'How well does this opportunity align with company strategy and growth goals? Consider target markets, market position strengthening, and long-term growth objectives.',
  },
  { 
    name: 'Technical Capability', 
    weight: 2.0, 
    max_score: 10,
    description: 'Do we have the technical skills and experience to perform? Consider relevant past performance, required certifications, and available technical staff.',
  },
  { 
    name: 'Compliance Readiness', 
    weight: 2.0, 
    max_score: 10,
    description: 'Can we meet all mandatory requirements? Look for showstopper gaps and whether any gaps can be addressed before submission.',
  },
  { 
    name: 'Price Competitiveness', 
    weight: 1.5, 
    max_score: 10,
    description: 'Can we be competitive on price while maintaining margins? Consider labor rates, price expectations, and whether the budget is realistic for the scope.',
  },
  { 
    name: 'Competitive Position', 
    weight: 1.0, 
    max_score: 10,
    description: 'How do we stack up against likely competitors? Consider the incumbent, competitor strengths/weaknesses, and any discriminators we have.',
  },
  { 
    name: 'Resource Availability', 
    weight: 1.0, 
    max_score: 10,
    description: 'Do we have the resources to pursue and perform? Consider BD/capture bandwidth, proposal team availability, and ability to staff the contract if we win.',
  },
  { 
    name: 'Risk Assessment', 
    weight: 1.0, 
    max_score: 10,
    description: 'What is the overall risk profile? Evaluate performance risks, financial risks, and reputational risks. Higher score = lower risk.',
  },
]

export default function CaptureQualification({ intel, onUpdate, onClose }: CaptureQualificationProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Compliance Matrix state
  const [complianceMatrix, setComplianceMatrix] = useState<{
    requirements: ComplianceRequirement[]
    summary: ComplianceSummary
  } | null>(null)
  
  // Bid Score state
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({})
  const [bidResult, setBidResult] = useState<any>(null)
  
  // Decision dialog
  const [decisionDialog, setDecisionDialog] = useState(false)
  const [decision, setDecision] = useState<'bid' | 'no-bid'>('bid')
  const [rationale, setRationale] = useState('')

  useEffect(() => {
    loadComplianceMatrix()
    // Initialize criteria scores
    const initialScores: Record<string, number> = {}
    DEFAULT_CRITERIA.forEach(c => {
      initialScores[c.name] = 5
    })
    setCriteriaScores(initialScores)
  }, [intel.id])

  const loadComplianceMatrix = async () => {
    try {
      const result = await marketIntelService.getComplianceMatrix(intel.id)
      setComplianceMatrix(result)
    } catch (err) {
      console.error('Failed to load compliance matrix:', err)
    }
  }

  const handleFetchDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await marketIntelService.fetchDocuments(intel.id)
      setSuccess(`Found ${result.attachments_found} documents, downloaded ${result.attachments_downloaded}`)
      onUpdate()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadAttachment = async (idx: number, filename: string) => {
    try {
      const blob = await marketIntelService.downloadAttachment(intel.id, idx)
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to download attachment')
    }
  }

  const handleExtractRequirements = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await marketIntelService.extractRequirements(intel.id)
      setSuccess(`Extracted ${result.requirements_extracted} requirements`)
      loadComplianceMatrix()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to extract requirements')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRequirement = async (reqId: string, status: string) => {
    try {
      await marketIntelService.updateComplianceRequirement(reqId, { compliance_status: status })
      loadComplianceMatrix()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update requirement')
    }
  }

  const handleCalculateBidScore = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await marketIntelService.calculateBidScore(intel.id, criteriaScores)
      setBidResult(result)
      setSuccess(`Score calculated: ${result.bid_score}% - Recommendation: ${result.recommendation.toUpperCase()}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to calculate score')
    } finally {
      setLoading(false)
    }
  }

  const handleBidDecision = async () => {
    setLoading(true)
    try {
      await marketIntelService.setBidDecision(intel.id, decision, rationale)
      setDecisionDialog(false)
      setSuccess(`Decision recorded: ${decision.toUpperCase()}`)
      onUpdate()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to set decision')
    } finally {
      setLoading(false)
    }
  }

  const handleConvertToOpportunity = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await marketIntelService.convertToOpportunity(intel.id)
      const docsMsg = result.documents_transferred 
        ? ` (${result.documents_transferred} documents transferred)` 
        : ''
      setSuccess(`✓ Converted to Opportunity: ${result.opportunity_name}${docsMsg}. Redirecting...`)
      // Close immediately and refresh - intel is deleted
      setTimeout(() => {
        onClose()
        onUpdate()
        // Navigate to opportunities page
        window.location.href = '/opportunities'
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to convert')
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'success'
      case 'partial': return 'warning'
      case 'non_compliant': return 'error'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle color="success" />
      case 'partial': return <Warning color="warning" />
      case 'non_compliant': return <ErrorIcon color="error" />
      default: return <HelpOutline color="disabled" />
    }
  }

  const attachments = (intel as any).attachments || []

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Action Bar */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <CloudDownload />}
          onClick={handleFetchDocuments}
          disabled={loading}
        >
          Fetch SAM.gov Documents
        </Button>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <Psychology />}
          onClick={handleExtractRequirements}
          disabled={loading || attachments.length === 0}
        >
          AI Extract Requirements
        </Button>
        <Box sx={{ flex: 1 }} />
        {intel.bid_decision && (
          <Chip
            label={`Decision: ${intel.bid_decision.toUpperCase()}`}
            color={intel.bid_decision === 'bid' ? 'success' : 'error'}
            sx={{ fontWeight: 'bold' }}
          />
        )}
        <Button
          variant="contained"
          color="primary"
          startIcon={<ArrowForward />}
          onClick={handleConvertToOpportunity}
          disabled={loading || !intel.bid_decision || intel.bid_decision !== 'bid'}
        >
          Convert to Opportunity
        </Button>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Description />} label="Documents" />
        <Tab icon={<Assessment />} label="Compliance Matrix" />
        <Tab icon={<Gavel />} label="Bid/No-Bid" />
      </Tabs>

      {/* Documents Tab */}
      {activeTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Attached Documents</Typography>
          {attachments.length === 0 ? (
            <Alert severity="info">
              No documents fetched yet. Click "Fetch SAM.gov Documents" to download attachments.
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attachments.map((att: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{att.name}</TableCell>
                      <TableCell>{att.type}</TableCell>
                      <TableCell>{att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'N/A'}</TableCell>
                      <TableCell>
                        {att.local_path ? (
                          <Chip label="Downloaded" color="success" size="small" />
                        ) : (
                          <Chip label={att.error || 'Failed'} color="error" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {att.local_path && (
                          <Button
                            size="small"
                            startIcon={<CloudDownload />}
                            onClick={() => handleDownloadAttachment(idx, att.name)}
                          >
                            Open
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Compliance Matrix Tab */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Compliance Matrix</Typography>
            {complianceMatrix?.summary && (
              <Box display="flex" gap={2} alignItems="center">
                <Chip label={`Score: ${complianceMatrix.summary.score}%`} color="primary" />
                <Typography variant="body2">
                  ✓ {complianceMatrix.summary.compliant} |
                  ~ {complianceMatrix.summary.partial} |
                  ✗ {complianceMatrix.summary.non_compliant} |
                  ? {complianceMatrix.summary.pending}
                </Typography>
              </Box>
            )}
          </Box>

          {complianceMatrix?.summary && (
            <LinearProgress
              variant="determinate"
              value={complianceMatrix.summary.score}
              sx={{ mb: 3, height: 10, borderRadius: 5 }}
              color={complianceMatrix.summary.score >= 70 ? 'success' : complianceMatrix.summary.score >= 50 ? 'warning' : 'error'}
            />
          )}

          {!complianceMatrix?.requirements?.length ? (
            <Alert severity="info">
              No requirements extracted yet. Fetch documents first, then click "AI Extract Requirements".
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>#</TableCell>
                    <TableCell width={120}>Section</TableCell>
                    <TableCell>Requirement</TableCell>
                    <TableCell width={150}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {complianceMatrix.requirements.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>{req.requirement_number}</TableCell>
                      <TableCell>{req.section}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 400 }}>
                          {req.requirement_text}
                        </Typography>
                        {req.extracted_by_ai && (
                          <Chip label="AI" size="small" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={req.compliance_status}
                            onChange={(e) => handleUpdateRequirement(req.id, e.target.value)}
                          >
                            <MenuItem value="pending">⏳ Pending</MenuItem>
                            <MenuItem value="compliant">✓ Compliant</MenuItem>
                            <MenuItem value="partial">~ Partial</MenuItem>
                            <MenuItem value="non_compliant">✗ Non-Compliant</MenuItem>
                            <MenuItem value="not_applicable">N/A</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Bid/No-Bid Tab */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Bid/No-Bid Scorecard</Typography>
          
          <Grid container spacing={3}>
            {/* Criteria Scoring */}
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle1" gutterBottom>Score Each Criterion (1-10)</Typography>
              {DEFAULT_CRITERIA.map((criterion) => (
                <Box key={criterion.name} sx={{ mb: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center">
                      <Typography variant="body2">
                        {criterion.name}
                      </Typography>
                      <Tooltip title={criterion.description} arrow placement="top">
                        <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }}>
                          <HelpOutline fontSize="small" sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </IconButton>
                      </Tooltip>
                      <Chip label={`Weight: ${criterion.weight}x`} size="small" sx={{ ml: 1 }} />
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {criteriaScores[criterion.name] || 5} / 10
                    </Typography>
                  </Box>
                  <Slider
                    value={criteriaScores[criterion.name] || 5}
                    onChange={(_, v) => setCriteriaScores({ ...criteriaScores, [criterion.name]: v as number })}
                    min={1}
                    max={10}
                    marks
                    valueLabelDisplay="auto"
                    sx={{
                      color: (criteriaScores[criterion.name] || 5) >= 7 ? 'success.main' :
                             (criteriaScores[criterion.name] || 5) >= 4 ? 'warning.main' : 'error.main'
                    }}
                  />
                </Box>
              ))}
              
              <Button
                variant="contained"
                onClick={handleCalculateBidScore}
                disabled={loading}
                fullWidth
                sx={{ mt: 2 }}
              >
                Calculate Score
              </Button>
            </Grid>

            {/* Results */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Result</Typography>
                  
                  {bidResult ? (
                    <>
                      <Box textAlign="center" my={3}>
                        <Typography variant="h2" fontWeight="bold" color={
                          bidResult.recommendation === 'bid' ? 'success.main' :
                          bidResult.recommendation === 'review' ? 'warning.main' : 'error.main'
                        }>
                          {bidResult.bid_score}
                        </Typography>
                        <Typography variant="h6">
                          {bidResult.recommendation === 'bid' && '✓ RECOMMEND BID'}
                          {bidResult.recommendation === 'review' && '⚠ NEEDS REVIEW'}
                          {bidResult.recommendation === 'no-bid' && '✗ NO-BID'}
                        </Typography>
                      </Box>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Thresholds: Bid ≥70 | Review 50-69 | No-Bid &lt;50
                      </Typography>
                      
                      <Box mt={2} display="flex" gap={1}>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<ThumbUp />}
                          onClick={() => { setDecision('bid'); setDecisionDialog(true) }}
                          fullWidth
                        >
                          Bid
                        </Button>
                        <Button
                          variant="contained"
                          color="error"
                          startIcon={<ThumbDown />}
                          onClick={() => { setDecision('no-bid'); setDecisionDialog(true) }}
                          fullWidth
                        >
                          No-Bid
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <Box textAlign="center" py={4}>
                      <Typography color="text.secondary">
                        Score the criteria and click Calculate to see the recommendation
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Decision Dialog */}
      <Dialog open={decisionDialog} onClose={() => setDecisionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Confirm {decision === 'bid' ? 'BID' : 'NO-BID'} Decision
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rationale (optional)"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Document the reasoning for this decision..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecisionDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={decision === 'bid' ? 'success' : 'error'}
            onClick={handleBidDecision}
            disabled={loading}
          >
            Confirm {decision === 'bid' ? 'BID' : 'NO-BID'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
