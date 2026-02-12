import api from './api'

export interface RFPSummary {
  summary: string
  sections: Record<string, string>
  text_length: number
}

export interface WinTheme {
  win_themes: string[]
}

export interface Risk {
  risk: string
  severity: string
  recommendation: string
}

export const aiService = {
  parseRFP: async (documentId: string, model?: string): Promise<RFPSummary> => {
    const response = await api.post<RFPSummary>('/ai/parse-rfp', { 
      document_id: documentId,
      model: model,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minute timeout for large PDFs
    })
    return response.data
  },

  tailorResume: async (resumeText: string, sowText: string, model?: string): Promise<{ tailored_resume: string }> => {
    const response = await api.post<{ tailored_resume: string }>('/ai/tailor-resume', {
      resume_text: resumeText,
      sow_text: sowText,
      model: model,
    })
    return response.data
  },

  draftProposal: async (opportunityId: string, sectionType: string, model?: string): Promise<{ content: string }> => {
    const response = await api.post<{ content: string }>('/ai/draft-proposal', {
      opportunity_id: opportunityId,
      section_type: sectionType,
      model: model,
    })
    return response.data
  },

  getWinThemes: async (opportunityId: string, model?: string, regenerate?: boolean): Promise<WinTheme> => {
    const response = await api.get<WinTheme>(`/ai/opportunities/${opportunityId}/win-themes`, {
      params: { 
        model: model,
        regenerate: regenerate ? 'true' : undefined,
      },
    })
    return response.data
  },

  analyzeRisks: async (proposalText: string, model?: string): Promise<{ risks: Risk[] }> => {
    const response = await api.post<{ risks: Risk[] }>('/ai/analyze-risks', {
      proposal_text: proposalText,
      model: model,
    })
    return response.data
  },

  generateCompanyField: async (websiteUrl: string, fieldName: string, model?: string): Promise<{ content: string }> => {
    const response = await api.post<{ content: string }>('/ai/generate-company-field', {
      website_url: websiteUrl,
      field_name: fieldName,
      model: model,
    })
    return response.data
  },
}

