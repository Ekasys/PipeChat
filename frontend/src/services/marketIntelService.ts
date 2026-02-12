import api from './api'

export interface MarketIntel {
  id: string
  title: string
  description?: string
  stage: string
  source?: string
  agency?: string
  estimated_value?: number
  expected_rfp_date?: string
  naics_codes?: string[]
  contract_vehicle?: string
  competitor_info?: any
  market_notes?: string
  sam_gov_id?: string
  sam_gov_data?: any
  sam_gov_url?: string
  // New capture qualification fields
  place_of_performance?: string
  contract_type?: string
  period_of_performance?: string
  attachments?: any[]
  attachments_fetched?: boolean
  processing_status?: 'idle' | 'processing' | 'completed' | 'error'
  processing_error?: string
  compliance_summary?: {
    total: number
    compliant: number
    partial: number
    non_compliant: number
    score: number
  }
  bid_decision?: 'bid' | 'no-bid' | 'pending'
  bid_decision_date?: string
  bid_decision_rationale?: string
  bid_score?: number
  bid_criteria_scores?: any[]
  converted_to_opportunity_id?: string
  converted_at?: string
  created_at: string
  updated_at?: string
}

export interface SAMGovOpportunity {
  noticeId?: string
  title?: string
  agency?: string
  postedDate?: string
  responseDeadline?: string
  naicsCode?: string[]
  setAside?: string
  noticeType?: string
  description?: string
  [key: string]: any
}

export interface SAMGovEntity {
  uei?: string
  legalBusinessName?: string
  cageCode?: string
  naicsCode?: string[]
  [key: string]: any
}

export interface SAMGovContract {
  contractId?: string
  title?: string
  awardDate?: string
  awardAmount?: number
  contractor?: string
  [key: string]: any
}

export interface SAMGovSearchParams {
  keywords?: string
  notice_type?: string
  posted_from?: string
  posted_to?: string
  set_aside?: string
  naics_code?: string
  limit?: number
  offset?: number
}

export const marketIntelService = {
  list: async (): Promise<{ intel: MarketIntel[] }> => {
    const response = await api.get<{ intel: MarketIntel[] }>('/market-intel/intel')
    return response.data
  },

  create: async (data: Partial<MarketIntel>): Promise<MarketIntel> => {
    const response = await api.post<MarketIntel>('/market-intel/intel', data)
    return response.data
  },

  updateStage: async (intelId: string, newStage: string): Promise<MarketIntel> => {
    // FastAPI Body(...) expects the body to be the string value directly
    const response = await api.patch<MarketIntel>(`/market-intel/intel/${intelId}/stage`, newStage)
    return response.data
  },

  searchSAMGov: async (params: SAMGovSearchParams): Promise<{
    results: SAMGovOpportunity[]
    total: number
    offset: number
    limit: number
  }> => {
    const response = await api.get<{
      results: SAMGovOpportunity[]
      total: number
      offset: number
      limit: number
    }>('/market-intel/sam-gov/search', { params })
    return response.data
  },

  getSAMGovOpportunity: async (noticeId: string): Promise<SAMGovOpportunity> => {
    const response = await api.get<SAMGovOpportunity>(`/market-intel/sam-gov/opportunities/${noticeId}`)
    return response.data
  },

  searchSAMGovEntities: async (params: {
    name?: string
    duns?: string
    cage_code?: string
    naics_code?: string
    limit?: number
    offset?: number
  }): Promise<{
    results: SAMGovEntity[]
    total: number
    offset: number
    limit: number
  }> => {
    const response = await api.get<{
      results: SAMGovEntity[]
      total: number
      offset: number
      limit: number
    }>('/market-intel/sam-gov/entities/search', { params })
    return response.data
  },

  getSAMGovEntity: async (uei: string): Promise<SAMGovEntity> => {
    const response = await api.get<SAMGovEntity>(`/market-intel/sam-gov/entities/${uei}`)
    return response.data
  },

  searchSAMGovContracts: async (params: {
    keywords?: string
    naics_code?: string
    award_date_from?: string
    award_date_to?: string
    limit?: number
    offset?: number
  }): Promise<{
    results: SAMGovContract[]
    total: number
    offset: number
    limit: number
  }> => {
    const response = await api.get<{
      results: SAMGovContract[]
      total: number
      offset: number
      limit: number
    }>('/market-intel/sam-gov/contracts/search', { params })
    return response.data
  },

  findSimilar: async (intelId: string): Promise<{ similar_opportunities: any[] }> => {
    const response = await api.get<{ similar_opportunities: any[] }>(`/market-intel/intel/${intelId}/similar`)
    return response.data
  },

  // ==================== Capture Qualification ====================

  fetchDocuments: async (intelId: string): Promise<{
    success: boolean
    attachments_found: number
    attachments_downloaded: number
    attachments: any[]
  }> => {
    const response = await api.post(`/market-intel/intel/${intelId}/fetch-documents`)
    return response.data
  },

  downloadAttachment: async (intelId: string, attachmentIdx: number): Promise<Blob> => {
    const response = await api.get(`/market-intel/intel/${intelId}/attachments/${attachmentIdx}`, {
      responseType: 'blob'
    })
    return response.data
  },

  extractRequirements: async (intelId: string): Promise<{
    success: boolean
    requirements_extracted: number
  }> => {
    const response = await api.post(`/market-intel/intel/${intelId}/extract-requirements`)
    return response.data
  },

  getComplianceMatrix: async (intelId: string): Promise<{
    intel_id: string
    requirements: ComplianceRequirement[]
    summary: ComplianceSummary
  }> => {
    const response = await api.get(`/market-intel/intel/${intelId}/compliance-matrix`)
    return response.data
  },

  updateComplianceRequirement: async (requirementId: string, data: Partial<ComplianceRequirement>): Promise<any> => {
    const response = await api.patch(`/market-intel/compliance-requirements/${requirementId}`, data)
    return response.data
  },

  calculateBidScore: async (intelId: string, criteriaScores: Record<string, number>): Promise<{
    intel_id: string
    bid_score: number
    recommendation: string
    criteria_scores: any[]
    thresholds: any
  }> => {
    const response = await api.post(`/market-intel/intel/${intelId}/calculate-bid-score`, criteriaScores)
    return response.data
  },

  setBidDecision: async (intelId: string, decision: string, rationale?: string): Promise<any> => {
    const response = await api.post(`/market-intel/intel/${intelId}/bid-decision`, { decision, rationale })
    return response.data
  },

  convertToOpportunity: async (intelId: string, additionalData?: any): Promise<{
    success: boolean
    opportunity_id: string
    opportunity_name: string
    intel_id: string
    documents_transferred?: number
  }> => {
    const response = await api.post(`/market-intel/intel/${intelId}/convert-to-opportunity`, additionalData || {})
    return response.data
  },

  delete: async (intelId: string): Promise<{ message: string; id: string }> => {
    const response = await api.delete(`/market-intel/intel/${intelId}`)
    return response.data
  },
}

// Additional types for capture qualification
export interface ComplianceRequirement {
  id: string
  requirement_number?: string
  section?: string
  requirement_text: string
  requirement_type?: string
  compliance_status: 'pending' | 'compliant' | 'partial' | 'non_compliant' | 'not_applicable'
  compliance_notes?: string
  gap_description?: string
  mitigation_plan?: string
  response_approach?: string
  weight?: number
  confidence_score?: number
  source_document?: string
  extracted_by_ai?: boolean
}

export interface ComplianceSummary {
  total: number
  compliant: number
  partial: number
  non_compliant: number
  pending: number
  score: number
}

export interface BidCriteria {
  name: string
  description?: string
  category?: string
  weight: number
  max_score: number
  scoring_guidance?: Record<string, string>
  evaluation_questions?: string[]
}

