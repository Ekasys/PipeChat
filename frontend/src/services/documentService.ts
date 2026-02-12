import api from './api'

export interface Document {
  id: string
  filename: string
  file_size?: number
  mime_type?: string
  document_type?: string
  title?: string
  description?: string
  opportunity_id?: string
  proposal_id?: string
  uploaded_at?: string
}

export interface DocumentListResponse {
  documents: Document[]
}

export const documentService = {
  upload: async (
    file: File,
    options?: {
      document_type?: string
      title?: string
      description?: string
      opportunity_id?: string
      proposal_id?: string
    }
  ): Promise<Document> => {
    const formData = new FormData()
    formData.append('file', file)
    
    if (options?.document_type) {
      formData.append('document_type', options.document_type)
    }
    if (options?.title) {
      formData.append('title', options.title)
    }
    if (options?.description) {
      formData.append('description', options.description)
    }
    if (options?.opportunity_id) {
      formData.append('opportunity_id', options.opportunity_id)
    }
    if (options?.proposal_id) {
      formData.append('proposal_id', options.proposal_id)
    }
    
    const response = await api.post<Document>('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  list: async (filters?: {
    opportunity_id?: string
    proposal_id?: string
    document_type?: string
  }): Promise<DocumentListResponse> => {
    const params = new URLSearchParams()
    if (filters?.opportunity_id) {
      params.append('opportunity_id', filters.opportunity_id)
    }
    if (filters?.proposal_id) {
      params.append('proposal_id', filters.proposal_id)
    }
    if (filters?.document_type) {
      params.append('document_type', filters.document_type)
    }
    
    const url = `/documents${params.toString() ? `?${params.toString()}` : ''}`
    const response = await api.get<DocumentListResponse>(url)
    return response.data
  },

  get: async (id: string): Promise<Document> => {
    const response = await api.get<Document>(`/documents/${id}`)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`)
  },

  download: async (id: string, filename: string): Promise<void> => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    })
    
    // Create a blob URL and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}

