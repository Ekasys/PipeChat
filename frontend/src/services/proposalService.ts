import api from './api'

export type StructureSource = 'rfp' | 'user' | 'template'

export interface RFPReference {
  section_number?: string
  page_range?: string
  clause_text_snippet?: string
}

export interface ProposalSection {
  id: string
  volume_id: string
  heading: string
  order_index: number
  source: StructureSource
  rfp_reference?: RFPReference
  parent_section_id?: string | null
  content?: string
  children?: ProposalSection[]
  created_at: string
  updated_at: string
}

export interface ProposalVolume {
  id: string
  proposal_id: string
  tenant_id: string
  owner_id?: string
  name: string  // Custom name (exact label from RFP or user)
  volume_type?: 'technical' | 'management' | 'past_performance' | 'pricing' | 'executive_summary' | 'other'  // Optional helper
  status: 'draft' | 'in_review' | 'approved' | 'final' | 'locked'
  source?: StructureSource  // Optional for backward compatibility, defaults to 'user'
  order_index?: number
  rfp_reference?: RFPReference
  description?: string
  content?: string
  compliance_notes?: string
  page_count?: string
  word_count?: number
  page_limit?: string
  rfp_sections?: string[]  // Legacy field
  executive_summary?: string
  technical_approach?: string
  sections?: ProposalSection[]
  created_at: string
  updated_at: string
}

export interface Proposal {
  id: string
  name: string
  opportunity_id: string
  current_phase: string
  status: string
  version?: string
  executive_summary?: string
  technical_approach?: string
  management_approach?: string
  past_performance?: string
  win_themes?: string[]
  volumes?: ProposalVolume[]
  created_at: string
  updated_at: string
}

export const proposalService = {
  list: async (opportunityId?: string): Promise<{ proposals: Proposal[] }> => {
    const params = opportunityId ? { opportunity_id: opportunityId } : {}
    console.log('Fetching proposals with params:', params, 'opportunityId:', opportunityId)
    const response = await api.get<{ proposals: Proposal[] }>('/proposals/proposals', { params })
    console.log('Received proposals:', response.data.proposals.length, 'for opportunity:', opportunityId)
    return response.data
  },

  get: async (id: string): Promise<Proposal> => {
    const response = await api.get<Proposal>(`/proposals/proposals/${id}`)
    return response.data
  },

  create: async (data: Partial<Proposal>): Promise<Proposal> => {
    const payload: any = {
      name: data.name,
      opportunity_id: data.opportunity_id,
    }
    
    if (data.version) payload.version = data.version
    if (data.executive_summary) payload.executive_summary = data.executive_summary
    if (data.technical_approach) payload.technical_approach = data.technical_approach
    if (data.win_themes) payload.win_themes = data.win_themes
    
    const response = await api.post<Proposal>('/proposals/proposals', payload)
    return response.data
  },

  update: async (id: string, data: Partial<Proposal>): Promise<Proposal> => {
    const response = await api.put<Proposal>(`/proposals/proposals/${id}`, data)
    return response.data
  },

  transitionPhase: async (id: string, newPhase: string): Promise<Proposal> => {
    // Send raw string body so both legacy (string Body) and tolerant servers work
    const response = await api.post<Proposal>(
      `/proposals/proposals/${id}/transition`,
      newPhase
    )
    return response.data
  },

  export: async (id: string): Promise<Blob> => {
    const response = await api.get(`/proposals/proposals/${id}/export`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Volume methods
  listVolumes: async (proposalId: string): Promise<{ volumes: ProposalVolume[] }> => {
    const response = await api.get<{ volumes: ProposalVolume[] }>(
      `/proposals/${proposalId}/volumes`
    )
    return response.data
  },

  getVolume: async (proposalId: string, volumeId: string): Promise<ProposalVolume> => {
    const response = await api.get<ProposalVolume>(
      `/proposals/${proposalId}/volumes/${volumeId}`
    )
    return response.data
  },

  createVolume: async (proposalId: string, data: Partial<ProposalVolume>): Promise<ProposalVolume> => {
    const response = await api.post<ProposalVolume>(
      `/proposals/${proposalId}/volumes`,
      data
    )
    return response.data
  },

  updateVolume: async (
    proposalId: string,
    volumeId: string,
    data: Partial<ProposalVolume>
  ): Promise<ProposalVolume> => {
    const response = await api.put<ProposalVolume>(
      `/proposals/${proposalId}/volumes/${volumeId}`,
      data
    )
    return response.data
  },

  deleteVolume: async (proposalId: string, volumeId: string): Promise<void> => {
    await api.delete(`/proposals/${proposalId}/volumes/${volumeId}`)
  },

  reorderVolumes: async (
    proposalId: string,
    volumeOrders: Array<{ volume_id: string; order_index: number }>
  ): Promise<{ volumes: ProposalVolume[] }> => {
    const response = await api.post<{ volumes: ProposalVolume[] }>(
      `/proposals/${proposalId}/volumes/reorder`,
      volumeOrders
    )
    return response.data
  },

  // Section methods
  listSections: async (proposalId: string, volumeId: string): Promise<{ sections: ProposalSection[] }> => {
    const response = await api.get<{ sections: ProposalSection[] }>(
      `/proposals/${proposalId}/volumes/${volumeId}/sections`
    )
    return response.data
  },

  getSection: async (proposalId: string, volumeId: string, sectionId: string): Promise<ProposalSection> => {
    const response = await api.get<ProposalSection>(
      `/proposals/${proposalId}/volumes/${volumeId}/sections/${sectionId}`
    )
    return response.data
  },

  createSection: async (
    proposalId: string,
    volumeId: string,
    data: Partial<ProposalSection>
  ): Promise<ProposalSection> => {
    const response = await api.post<ProposalSection>(
      `/proposals/${proposalId}/volumes/${volumeId}/sections`,
      data
    )
    return response.data
  },

  updateSection: async (
    proposalId: string,
    volumeId: string,
    sectionId: string,
    data: Partial<ProposalSection>
  ): Promise<ProposalSection> => {
    const response = await api.put<ProposalSection>(
      `/proposals/${proposalId}/volumes/${volumeId}/sections/${sectionId}`,
      data
    )
    return response.data
  },

  deleteSection: async (proposalId: string, volumeId: string, sectionId: string): Promise<void> => {
    await api.delete(`/proposals/${proposalId}/volumes/${volumeId}/sections/${sectionId}`)
  },

  reorderSections: async (
    proposalId: string,
    volumeId: string,
    sectionOrders: Array<{ section_id: string; order_index: number }>
  ): Promise<{ sections: ProposalSection[] }> => {
    const response = await api.post<{ sections: ProposalSection[] }>(
      `/proposals/${proposalId}/volumes/${volumeId}/sections/reorder`,
      sectionOrders
    )
    return response.data
  },
}

