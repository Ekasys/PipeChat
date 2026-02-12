import api from './api'

export interface CompanyProfile {
  id: string
  tenant_id: string
  company_name: string
  legal_name?: string
  duns_number?: string
  cage_code?: string
  uei?: string
  website?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country: string
  mission_statement?: string
  vision_statement?: string
  company_overview?: string
  core_values?: string[]
  differentiators?: string[]
  business_type?: string
  size_standard?: string
  naics_codes?: string[]
  sic_codes?: string[]
  contract_vehicles?: string[]
  certifications?: string[]
  security_clearances?: string[]
  compliance_frameworks?: string[]
  core_capabilities?: string[]
  technical_expertise?: string[]
  service_offerings?: string[]
  industry_experience?: string[]
  past_performance_highlights?: Array<{
    contract_name?: string
    agency?: string
    value?: number
    description?: string
    period?: string
  }>
  key_contracts?: Array<{
    contract_name?: string
    agency?: string
    value?: number
    description?: string
  }>
  awards_recognition?: Array<{
    award_name?: string
    organization?: string
    year?: string
    description?: string
  }>
  key_personnel?: Array<{
    name?: string
    title?: string
    expertise?: string
    bio?: string
  }>
  executive_team?: Array<{
    name?: string
    title?: string
    bio?: string
  }>
  standard_boilerplate?: Record<string, string>
  win_themes?: string[]
  proposal_templates?: Record<string, any>
  annual_revenue?: string
  number_of_employees?: string
  years_in_business?: number
  created_at: string
  updated_at: string
}

export const companyProfileService = {
  get: async (): Promise<CompanyProfile> => {
    const response = await api.get<CompanyProfile>('/company-profile')
    return response.data
  },

  create: async (data: Partial<CompanyProfile>): Promise<CompanyProfile> => {
    const response = await api.post<CompanyProfile>('/company-profile', data)
    return response.data
  },

  update: async (data: Partial<CompanyProfile>): Promise<CompanyProfile> => {
    const response = await api.put<CompanyProfile>('/company-profile', data)
    return response.data
  },

  getContext: async (): Promise<Record<string, any>> => {
    const response = await api.get<Record<string, any>>('/company-profile/context')
    return response.data
  },
}

