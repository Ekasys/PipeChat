import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
  Typography,
} from '@mui/material'
import { ProposalVolume, RFPReference, StructureSource, proposalService } from '../services/proposalService'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'

interface VolumeFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (volume: ProposalVolume) => void
  proposalId: string
  initialData?: ProposalVolume
}

const volumeTypes = [
  { value: 'technical', label: 'Technical' },
  { value: 'management', label: 'Management' },
  { value: 'past_performance', label: 'Past Performance' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'executive_summary', label: 'Executive Summary' },
  { value: 'other', label: 'Other' },
]

const structureSources = [
  { value: 'rfp', label: 'RFP' },
  { value: 'user', label: 'User' },
  { value: 'template', label: 'Template' },
]

const volumeStatuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'final', label: 'Final' },
  { value: 'locked', label: 'Locked' },
]

export default function VolumeForm({
  open,
  onClose,
  onSubmit,
  proposalId,
  initialData,
}: VolumeFormProps) {
  const [formData, setFormData] = useState<Partial<ProposalVolume>>({
    name: '',
    volume_type: undefined,
    status: 'draft',
    source: 'user',
    order_index: 0,
    rfp_reference: undefined,
    description: '',
    content: '',
    compliance_notes: '',
    page_count: '',
    word_count: undefined,
    page_limit: '',
    rfp_sections: [],
    executive_summary: '',
    technical_approach: '',
  })
  
  const [rfpRef, setRfpRef] = useState<RFPReference>({
    section_number: '',
    page_range: '',
    clause_text_snippet: '',
  })
  const [loading, setLoading] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    console.log('VolumeForm: Mounted/Updated', {
      open,
      proposalId,
      hasInitialData: !!initialData,
      initialDataId: initialData?.id,
    })
  }, [open, proposalId, initialData])

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        volume_type: initialData.volume_type,
        status: initialData.status || 'draft',
        source: initialData.source || 'user',
        order_index: initialData.order_index || 0,
        rfp_reference: initialData.rfp_reference,
        description: initialData.description || '',
        content: initialData.content || '',
        compliance_notes: initialData.compliance_notes || '',
        page_count: initialData.page_count || '',
        word_count: initialData.word_count,
        page_limit: initialData.page_limit || '',
        rfp_sections: initialData.rfp_sections || [],
        executive_summary: initialData.executive_summary || '',
        technical_approach: initialData.technical_approach || '',
      })
      setRfpRef(initialData.rfp_reference || {
        section_number: '',
        page_range: '',
        clause_text_snippet: '',
      })
    } else {
      setFormData({
        name: '',
        volume_type: undefined,
        status: 'draft',
        source: 'user',
        order_index: 0,
        rfp_reference: undefined,
        description: '',
        content: '',
        compliance_notes: '',
        page_count: '',
        word_count: undefined,
        page_limit: '',
        rfp_sections: [],
        executive_summary: '',
        technical_approach: '',
      })
      setRfpRef({
        section_number: '',
        page_range: '',
        clause_text_snippet: '',
      })
    }
  }, [initialData, open])

  const handleSubmit = async () => {
    if (!formData.name) {
      showToast('Volume name is required', 'error')
      return
    }

    if (!proposalId || !proposalId.trim()) {
      console.error('VolumeForm: proposalId is missing or empty:', proposalId)
      showToast('Proposal ID is missing. Please try refreshing the page.', 'error')
      return
    }

    // Verify proposal exists before attempting to create volume
    try {
      console.log('VolumeForm: Verifying proposal exists:', proposalId)
      const proposal = await proposalService.get(proposalId)
      console.log('VolumeForm: Proposal verified:', {
        id: proposal.id,
        name: proposal.name,
        tenant_id: (proposal as any).tenant_id,
      })
      console.log('VolumeForm: Proposal verified, proceeding with volume creation')
    } catch (error: any) {
      console.error('VolumeForm: Proposal verification failed:', error)
      console.error('Verification error details:', {
        status: error?.response?.status,
        data: error?.response?.data,
        proposalId,
      })
      if (error?.response?.status === 404) {
        const detail = error?.response?.data?.detail || 'Proposal not found'
        showToast(`${detail} (ID: ${proposalId}). Please ensure the proposal exists and try again.`, 'error')
      } else {
        showToast('Failed to verify proposal. Please try again.', 'error')
      }
      return
    }

    const fullUrl = `/api/v1/proposals/${proposalId}/volumes`
    console.log('VolumeForm: Creating volume with:', {
      proposalId,
      formData,
      url: fullUrl,
      baseURL: '/api/v1',
      fullPath: fullUrl,
    })

    try {
      setLoading(true)
      
      // Prepare payload with rfp_reference if source is 'rfp'
      const payload = { ...formData }
      if (formData.source === 'rfp' && (rfpRef.section_number || rfpRef.page_range || rfpRef.clause_text_snippet)) {
        payload.rfp_reference = rfpRef
      } else if (formData.source !== 'rfp') {
        payload.rfp_reference = undefined
      }
      
      let volume: ProposalVolume

      if (initialData) {
        console.log('VolumeForm: Updating existing volume:', initialData.id)
        volume = await proposalService.updateVolume(proposalId, initialData.id, payload)
      } else {
        console.log('VolumeForm: Creating new volume for proposal:', proposalId)
        volume = await proposalService.createVolume(proposalId, payload)
        console.log('VolumeForm: Volume created successfully:', volume.id)
      }

      showToast(
        initialData ? 'Volume updated successfully' : 'Volume created successfully',
        'success'
      )
      onSubmit(volume)
      onClose()
    } catch (error: any) {
      console.error('Failed to save volume:', error)
      
      // Log full error details for debugging
      const errorDetails = {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        config: {
          url: error?.config?.url,
          method: error?.config?.method,
          baseURL: error?.config?.baseURL,
          fullURL: error?.config?.baseURL + error?.config?.url,
        },
        proposalId,
        formData,
      }
      console.error('Error details:', errorDetails)
      
      let errorMessage = 'Failed to save volume'
      
      // Try multiple ways to extract the error message
      const responseData = error?.response?.data
      if (responseData) {
        if (typeof responseData === 'string') {
          errorMessage = responseData
        } else if (responseData.detail) {
          errorMessage = responseData.detail
        } else if (responseData.message) {
          errorMessage = responseData.message
        } else if (responseData.error) {
          errorMessage = responseData.error
        }
      }
      
      if (error?.response?.status === 404) {
        if (!errorMessage || errorMessage === 'Failed to save volume') {
          errorMessage = `Proposal not found (ID: ${proposalId}). The proposal may not exist in the database or may belong to a different tenant. Please verify the proposal exists and try again.`
        }
      } else if (error?.message && errorMessage === 'Failed to save volume') {
        errorMessage = error.message
      }
      
      console.error('Final error message:', errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {initialData ? 'Edit Volume' : 'Create Volume'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Volume Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />

            <TextField
              select
              label="Volume Type (Optional)"
              value={formData.volume_type || ''}
              onChange={(e) =>
                setFormData({ ...formData, volume_type: (e.target.value || undefined) as ProposalVolume['volume_type'] })
              }
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {volumeTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Source"
              value={formData.source || 'user'}
              onChange={(e) =>
                setFormData({ ...formData, source: e.target.value as StructureSource })
              }
              fullWidth
              required
            >
              {structureSources.map((source) => (
                <MenuItem key={source.value} value={source.value}>
                  {source.label}
                </MenuItem>
              ))}
            </TextField>

            {formData.source === 'rfp' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  RFP Reference
                </Typography>
                <TextField
                  label="Section Number"
                  value={rfpRef.section_number || ''}
                  onChange={(e) => setRfpRef({ ...rfpRef, section_number: e.target.value })}
                  fullWidth
                  size="small"
                  placeholder="e.g., L.3.1"
                />
                <TextField
                  label="Page Range"
                  value={rfpRef.page_range || ''}
                  onChange={(e) => setRfpRef({ ...rfpRef, page_range: e.target.value })}
                  fullWidth
                  size="small"
                  placeholder="e.g., pp. 12–18"
                />
                <TextField
                  label="Clause Text Snippet"
                  value={rfpRef.clause_text_snippet || ''}
                  onChange={(e) => setRfpRef({ ...rfpRef, clause_text_snippet: e.target.value })}
                  multiline
                  rows={2}
                  fullWidth
                  size="small"
                  placeholder="Brief excerpt from RFP"
                />
              </Box>
            )}

            <TextField
              select
              label="Status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as ProposalVolume['status'] })
              }
              fullWidth
            >
              {volumeStatuses.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              multiline
              rows={4}
              fullWidth
            />

            <TextField
              label="Executive Summary"
              value={formData.executive_summary || ''}
              onChange={(e) => setFormData({ ...formData, executive_summary: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Technical Approach"
              value={formData.technical_approach || ''}
              onChange={(e) => setFormData({ ...formData, technical_approach: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Compliance Notes"
              value={formData.compliance_notes}
              onChange={(e) => setFormData({ ...formData, compliance_notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Page Count"
                value={formData.page_count}
                onChange={(e) => setFormData({ ...formData, page_count: e.target.value })}
                fullWidth
              />

              <TextField
                label="Word Count"
                type="number"
                value={formData.word_count || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    word_count: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                fullWidth
              />
            </Box>

            <TextField
              label="Page Limit"
              value={formData.page_limit || ''}
              onChange={(e) => setFormData({ ...formData, page_limit: e.target.value })}
              fullWidth
            />

            <TextField
              label="RFP Sections (comma-separated)"
              value={(formData.rfp_sections || []).join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  rfp_sections: e.target.value
                    ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    : [],
                })
              }
              fullWidth
              helperText="Example: L, M, C.1.2"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {initialData ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </>
  )
}



