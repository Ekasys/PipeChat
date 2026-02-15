import React, { useState, useCallback } from 'react'
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  CloudUpload,
  Delete,
  Download,
  Description,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { documentService, Document } from '../services/documentService'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'

interface FileUploadProps {
  opportunityId?: string
  proposalId?: string
  onUploadComplete?: (document: Document) => void
  onDelete?: (documentId: string) => void
  existingDocuments?: Document[]
  documentType?: string
}

export default function FileUpload({
  opportunityId,
  proposalId,
  onUploadComplete,
  onDelete,
  existingDocuments = [],
  documentType,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [openDialog, setOpenDialog] = useState(false)
  const [uploadMetadata, setUploadMetadata] = useState({
    title: '',
    description: '',
    document_type: documentType || '',
  })
  const { toast, showToast, hideToast } = useToast()
  const [documents, setDocuments] = useState<Document[]>(existingDocuments)

  React.useEffect(() => {
    setDocuments(existingDocuments)
  }, [existingDocuments])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (50MB limit)
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        showToast(`File size exceeds 50MB limit. Selected file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`, 'error')
        return
      }
      setSelectedFile(file)
      setUploadMetadata(prev => ({
        ...prev,
        title: prev.title || file.name,
      }))
      setOpenDialog(true)
    }
  }, [showToast])

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setUploading(true)
      setUploadProgress(0)

      // Simulate progress (actual upload progress would need XMLHttpRequest)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const document = await documentService.upload(selectedFile, {
        ...uploadMetadata,
        opportunity_id: opportunityId,
        proposal_id: proposalId,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      setDocuments(prev => [...prev, document])
      showToast('File uploaded successfully', 'success')
      setOpenDialog(false)
      setSelectedFile(null)
      setUploadMetadata({
        title: '',
        description: '',
        document_type: documentType || '',
      })

      if (onUploadComplete) {
        onUploadComplete(document)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      showToast(
        error.response?.data?.detail || error.message || 'Failed to upload file',
        'error'
      )
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      await documentService.delete(documentId)
      setDocuments(prev => prev.filter(doc => doc.id !== documentId))
      showToast('Document deleted successfully', 'success')
      
      if (onDelete) {
        onDelete(documentId)
      }
    } catch (error: any) {
      console.error('Delete error:', error)
      showToast(
        error.response?.data?.detail || error.message || 'Failed to delete document',
        'error'
      )
    }
  }

  const handleDownload = async (document: Document) => {
    try {
      await documentService.download(document.id, document.filename)
    } catch (error: any) {
      console.error('Download error:', error)
      showToast(
        error.response?.data?.detail || error.message || 'Failed to download document',
        'error'
      )
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <CloudUpload color="primary" />
          <Typography variant="h6">Upload Documents</Typography>
        </Box>

        <input
          accept="*/*"
          style={{ display: 'none' }}
          id="file-upload"
          type="file"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        <label htmlFor="file-upload">
          <Button
            variant="contained"
            component="span"
            startIcon={<CloudUpload />}
            disabled={uploading}
            sx={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 1) 0%, rgba(236, 72, 153, 1) 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(236, 72, 153, 0.9) 100%)',
              },
            }}
          >
            Select File
          </Button>
        </label>

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Uploading... {uploadProgress}%
            </Typography>
          </Box>
        )}
      </Paper>

      {documents.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Uploaded Documents ({documents.length})
          </Typography>
          <List>
            {documents.map((doc) => (
              <ListItem
                key={doc.id}
                sx={{
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 2,
                  mb: 1,
                  background: 'var(--pp-dark-50)',
                  '&:hover': {
                    background: 'var(--pp-dark-70)',
                  },
                }}
              >
                <Description sx={{ mr: 2, color: 'primary.main' }} />
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1" fontWeight={600}>
                        {doc.title || doc.filename}
                      </Typography>
                      {doc.document_type && (
                        <Chip
                          label={doc.document_type}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(doc.file_size)}
                        {doc.uploaded_at && ` • Uploaded ${new Date(doc.uploaded_at).toLocaleDateString()}`}
                      </Typography>
                      {doc.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {doc.description}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleDownload(doc)}
                    sx={{
                      '&:hover': {
                        background: 'rgba(99, 102, 241, 0.2)',
                      },
                    }}
                  >
                    <Download />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => handleDelete(doc.id)}
                    sx={{
                      ml: 1,
                      '&:hover': {
                        background: 'rgba(244, 67, 54, 0.2)',
                      },
                    }}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Dialog open={openDialog} onClose={() => !uploading && setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedFile && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>File:</strong> {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </Typography>
              </Alert>
            )}
            <TextField
              fullWidth
              label="Title"
              value={uploadMetadata.title}
              onChange={(e) => setUploadMetadata(prev => ({ ...prev, title: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Document Type</InputLabel>
              <Select
                value={uploadMetadata.document_type}
                label="Document Type"
                onChange={(e) => setUploadMetadata(prev => ({ ...prev, document_type: e.target.value }))}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="rfp">RFP</MenuItem>
                <MenuItem value="amendment">Amendment</MenuItem>
                <MenuItem value="proposal">Proposal</MenuItem>
                <MenuItem value="resume">Resume</MenuItem>
                <MenuItem value="sow">Statement of Work</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={uploadMetadata.description}
              onChange={(e) => setUploadMetadata(prev => ({ ...prev, description: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={uploading || !selectedFile}
            startIcon={uploading ? <LinearProgress /> : <CloudUpload />}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={hideToast}
      />
    </Box>
  )
}

