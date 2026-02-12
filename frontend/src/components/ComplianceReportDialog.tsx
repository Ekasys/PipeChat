import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Chip,
  Divider,
  Paper,
  LinearProgress,
  Card,
  CardContent,
} from '@mui/material'
import { CheckCircle, Cancel, Download, PictureAsPdf, TableChart } from '@mui/icons-material'

interface ComplianceReportDialogProps {
  open: boolean
  onClose: () => void
  reportType: 'fedramp' | 'nist' | 'cmmc' | null
  reportData: any
}

export default function ComplianceReportDialog({
  open,
  onClose,
  reportType,
  reportData,
}: ComplianceReportDialogProps) {
  const getReportTitle = () => {
    switch (reportType) {
      case 'fedramp':
        return 'FedRAMP Moderate Compliance Report'
      case 'nist':
        return 'NIST 800-53 Security Controls Assessment'
      case 'cmmc':
        return 'CMMC Level 2 Cybersecurity Maturity Report'
      default:
        return 'Compliance Report'
    }
  }

  const renderControlStatus = (status: boolean) => {
    return (
      <Chip
        icon={status ? <CheckCircle /> : <Cancel />}
        label={status ? 'Compliant' : 'Non-Compliant'}
        color={status ? 'success' : 'error'}
        size="small"
      />
    )
  }

  const calculateComplianceScore = (data: Record<string, any>): number => {
    const values = Object.values(data).flatMap(v => 
      typeof v === 'object' ? Object.values(v) : [v]
    )
    const compliant = values.filter(v => v === true).length
    return values.length > 0 ? Math.round((compliant / values.length) * 100) : 0
  }

  const getComplianceScore = () => {
    if (!reportData) return 0
    switch (reportType) {
      case 'fedramp':
        return calculateComplianceScore(reportData.fedramp_moderate || {})
      case 'nist':
        return calculateComplianceScore(reportData.nist_800_53 || {})
      case 'cmmc':
        return calculateComplianceScore(reportData.cmmc_level2 || {})
      default:
        return 0
    }
  }

  const renderFedRAMPReport = () => {
    if (!reportData?.fedramp_moderate) return null
    const data = reportData.fedramp_moderate
    const score = calculateComplianceScore(data)

    return (
      <Box>
        <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="h4" gutterBottom>
              {score}%
            </Typography>
            <Typography variant="body1">Compliance Score</Typography>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{ mt: 2, height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>
        <Typography variant="h6" gutterBottom>
          Control Families
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(data).map(([key, value]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Typography>
                {renderControlStatus(value as boolean)}
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  const renderNISTReport = () => {
    if (!reportData?.nist_800_53) return null
    const data = reportData.nist_800_53
    const score = calculateComplianceScore(data)

    return (
      <Box>
        <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="h4" gutterBottom>
              {score}%
            </Typography>
            <Typography variant="body1">Compliance Score</Typography>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{ mt: 2, height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>
        <Typography variant="h6" gutterBottom>
          Security Control Families
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(data).map(([key, value]) => {
            // NIST data structure is nested: { "AC": {"access_control": true} }
            const controlFamily = value as Record<string, boolean>
            return Object.entries(controlFamily).map(([controlKey, controlValue]) => (
              <Grid item xs={12} sm={6} md={4} key={`${key}-${controlKey}`}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {key} - {controlKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Typography>
                  {renderControlStatus(controlValue)}
                </Paper>
              </Grid>
            ))
          })}
        </Grid>
      </Box>
    )
  }

  const renderCMMCReport = () => {
    if (!reportData?.cmmc_level2) return null
    const data = reportData.cmmc_level2
    const score = calculateComplianceScore(data)

    return (
      <Box>
        <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="h4" gutterBottom>
              {score}%
            </Typography>
            <Typography variant="body1">Compliance Score</Typography>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{ mt: 2, height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>
        <Typography variant="h6" gutterBottom>
          CMMC Level 2 Practices
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(data).map(([key, value]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Typography>
                {renderControlStatus(value as boolean)}
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  const renderReportContent = () => {
    switch (reportType) {
      case 'fedramp':
        return renderFedRAMPReport()
      case 'nist':
        return renderNISTReport()
      case 'cmmc':
        return renderCMMCReport()
      default:
        return <Typography>No report data available</Typography>
    }
  }

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(reportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${reportType}_compliance_report_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadExcel = () => {
    if (!reportData) return
    
    let rows: string[][] = []
    let data: Record<string, any> = {}
    
    switch (reportType) {
      case 'fedramp':
        data = reportData.fedramp_moderate || {}
        rows = [['Control Family', 'Status']]
        Object.entries(data).forEach(([key, value]) => {
          rows.push([
            key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            value ? 'Compliant' : 'Non-Compliant'
          ])
        })
        break
      case 'nist':
        data = reportData.nist_800_53 || {}
        rows = [['Control Family', 'Control', 'Status']]
        Object.entries(data).forEach(([key, value]) => {
          const controlFamily = value as Record<string, boolean>
          Object.entries(controlFamily).forEach(([controlKey, controlValue]) => {
            rows.push([
              key,
              controlKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
              controlValue ? 'Compliant' : 'Non-Compliant'
            ])
          })
        })
        break
      case 'cmmc':
        data = reportData.cmmc_level2 || {}
        rows = [['Practice', 'Status']]
        Object.entries(data).forEach(([key, value]) => {
          rows.push([
            key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            value ? 'Compliant' : 'Non-Compliant'
          ])
        })
        break
    }
    
    const csv = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${reportType}_compliance_report_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = () => {
    // For PDF, we'll create a simple HTML representation and use browser print
    // In a production environment, you'd want to use a library like jsPDF or generate on the server
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    const score = getComplianceScore()
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${getReportTitle()}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            .score { font-size: 48px; color: #1976d2; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>${getReportTitle()}</h1>
          <div class="score">Compliance Score: ${score}%</div>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <p>Note: This is a simplified PDF export. For detailed reports, please use the Excel export.</p>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Typography variant="h5">{getReportTitle()}</Typography>
          <Box display="flex" gap={1}>
            <Button
              startIcon={<TableChart />}
              variant="outlined"
              size="small"
              onClick={handleDownloadExcel}
            >
              Excel
            </Button>
            <Button
              startIcon={<PictureAsPdf />}
              variant="outlined"
              size="small"
              onClick={handleDownloadPDF}
            >
              PDF
            </Button>
            <Button
              startIcon={<Download />}
              variant="outlined"
              size="small"
              onClick={handleDownloadJSON}
            >
              JSON
            </Button>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {reportData?.generated_at && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Generated: {new Date(reportData.generated_at).toLocaleString()}
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        {renderReportContent()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

