import api from './api'
import { logApiCall, logApiResponse, logApiError } from '../utils/debug'

export interface Opportunity {
  id: string
  name: string
  agency?: string
  sub_agency?: string
  stage: string
  status: string
  value?: number
  pwin?: number
  ptw?: number
  due_date?: string
  rfp_submission_date?: string
  award_date?: string
  summary?: string
  history_notes?: string
  next_task_comments?: string
  next_task_due?: string
  capture_manager?: string
  agency_pocs?: string
  business_sectors?: string
  role?: string
  number_of_years?: number
  bd_status?: string
  naics_code?: string
  contract_vehicle?: string
  opportunity_type?: string
  description?: string
  requirements?: string
  account_id?: string | null
  owner_id?: string
  created_at: string
  updated_at: string
}

export const opportunityService = {
  list: async (params?: {
    skip?: number
    limit?: number
    stage?: string
    status?: string
    agency?: string
  }): Promise<{ opportunities: Opportunity[]; total: number }> => {
    const response = await api.get<{ opportunities: Opportunity[]; total: number }>(
      '/opportunities/opportunities',
      { params }
    )
    return response.data
  },

  get: async (id: string): Promise<Opportunity> => {
    const response = await api.get<Opportunity>(`/opportunities/opportunities/${id}`)
    return response.data
  },

  create: async (data: Partial<Opportunity>): Promise<Opportunity> => {
    // Convert data to match backend schema
    const payload: any = {
      name: data.name,
      stage: data.stage || 'qualification',
      status: data.status || 'active',
    }
    
    // Only include fields that are provided
    if (data.agency !== undefined && data.agency !== null && data.agency !== '') {
      payload.agency = data.agency
    }
    if (data.sub_agency) {
      payload.sub_agency = data.sub_agency
    }
    if (data.bd_status) {
      payload.bd_status = data.bd_status
    }
    if (data.summary) {
      payload.summary = data.summary
    }
    if (data.history_notes) {
      payload.history_notes = data.history_notes
    }
    if (data.next_task_comments) {
      payload.next_task_comments = data.next_task_comments
    }
    if (data.capture_manager) {
      payload.capture_manager = data.capture_manager
    }
    if (data.agency_pocs) {
      payload.agency_pocs = data.agency_pocs
    }
    if (data.business_sectors) {
      payload.business_sectors = data.business_sectors
    }
    if (data.role) {
      payload.role = data.role
    }
    if (data.contract_vehicle) {
      payload.contract_vehicle = data.contract_vehicle
    }
    if (data.naics_code) {
      payload.naics_code = data.naics_code
    }
    if (data.opportunity_type) {
      payload.opportunity_type = data.opportunity_type
    }
    if (data.description) {
      payload.description = data.description
    }
    if (data.requirements) {
      payload.requirements = data.requirements
    }
    if (data.account_id) {
      payload.account_id = data.account_id
    }
    if (data.owner_id) {
      payload.owner_id = data.owner_id
    }
    if (data.value !== undefined && data.value !== null) {
      payload.value = Number(data.value)
    }
    if (data.number_of_years !== undefined && data.number_of_years !== null) {
      payload.number_of_years = Number(data.number_of_years)
    }
    if (data.pwin !== undefined && data.pwin !== null) {
      payload.pwin = Number(data.pwin)
    }
    if (data.ptw !== undefined && data.ptw !== null) {
      payload.ptw = Number(data.ptw)
    }
    // due_date should be in ISO format if provided
    if (data.due_date) {
      const dateStr = data.due_date.includes('T') ? data.due_date : `${data.due_date}T00:00:00`
      payload.due_date = new Date(dateStr).toISOString()
    }
    if (data.rfp_submission_date) {
      const dateStr = data.rfp_submission_date.includes('T') ? data.rfp_submission_date : `${data.rfp_submission_date}T00:00:00`
      payload.rfp_submission_date = new Date(dateStr).toISOString()
    }
    if (data.next_task_due) {
      const dateStr = data.next_task_due.includes('T') ? data.next_task_due : `${data.next_task_due}T00:00:00`
      payload.next_task_due = new Date(dateStr).toISOString()
    }
    if (data.award_date) {
      const dateStr = data.award_date.includes('T') ? data.award_date : `${data.award_date}T00:00:00`
      payload.award_date = new Date(dateStr).toISOString()
    }
    
    logApiCall('POST', '/opportunities/opportunities', payload)
    
    try {
      const response = await api.post<Opportunity>('/opportunities/opportunities', payload)
      logApiResponse(response)
      return response.data
    } catch (error) {
      logApiError(error)
      throw error
    }
  },

  update: async (id: string, data: Partial<Opportunity>): Promise<Opportunity> => {
    // Convert data to match backend schema
    const payload: any = {}
    
    if (data.name !== undefined) payload.name = data.name
    if (data.agency !== undefined && data.agency !== null && data.agency !== '') {
      payload.agency = data.agency
    }
    if (data.sub_agency !== undefined) {
      payload.sub_agency = data.sub_agency
    }
    if (data.stage !== undefined) payload.stage = data.stage
    if (data.status !== undefined) payload.status = data.status
    if (data.bd_status !== undefined) payload.bd_status = data.bd_status
    if (data.summary !== undefined) payload.summary = data.summary
    if (data.history_notes !== undefined) payload.history_notes = data.history_notes
    if (data.next_task_comments !== undefined) payload.next_task_comments = data.next_task_comments
    if (data.capture_manager !== undefined) payload.capture_manager = data.capture_manager
    if (data.agency_pocs !== undefined) payload.agency_pocs = data.agency_pocs
    if (data.business_sectors !== undefined) payload.business_sectors = data.business_sectors
    if (data.role !== undefined) payload.role = data.role
    if (data.contract_vehicle !== undefined) payload.contract_vehicle = data.contract_vehicle
    if (data.naics_code !== undefined) payload.naics_code = data.naics_code
    if (data.opportunity_type !== undefined) payload.opportunity_type = data.opportunity_type
    if (data.description !== undefined) payload.description = data.description
    if (data.requirements !== undefined) payload.requirements = data.requirements
    if (data.account_id !== undefined) payload.account_id = data.account_id
    if (data.owner_id !== undefined) payload.owner_id = data.owner_id
    if (data.value !== undefined && data.value !== null) {
      payload.value = Number(data.value)
    }
    if (data.number_of_years !== undefined && data.number_of_years !== null) {
      payload.number_of_years = Number(data.number_of_years)
    }
    if (data.pwin !== undefined && data.pwin !== null) {
      payload.pwin = Number(data.pwin)
    }
    if (data.ptw !== undefined && data.ptw !== null) {
      payload.ptw = Number(data.ptw)
    }
    if (data.due_date !== undefined && data.due_date !== null && data.due_date !== '') {
      const dateStr = data.due_date.includes('T') ? data.due_date : `${data.due_date}T00:00:00`
      payload.due_date = new Date(dateStr).toISOString()
    }
    if (data.rfp_submission_date !== undefined && data.rfp_submission_date !== null && data.rfp_submission_date !== '') {
      const dateStr = data.rfp_submission_date.includes('T') ? data.rfp_submission_date : `${data.rfp_submission_date}T00:00:00`
      payload.rfp_submission_date = new Date(dateStr).toISOString()
    }
    if (data.next_task_due !== undefined && data.next_task_due !== null && data.next_task_due !== '') {
      const dateStr = data.next_task_due.includes('T') ? data.next_task_due : `${data.next_task_due}T00:00:00`
      payload.next_task_due = new Date(dateStr).toISOString()
    }
    if (data.award_date !== undefined && data.award_date !== null && data.award_date !== '') {
      const dateStr = data.award_date.includes('T') ? data.award_date : `${data.award_date}T00:00:00`
      payload.award_date = new Date(dateStr).toISOString()
    }
    
    logApiCall('PUT', `/opportunities/opportunities/${id}`, payload)
    
    try {
      const response = await api.put<Opportunity>(`/opportunities/opportunities/${id}`, payload)
      logApiResponse(response)
      return response.data
    } catch (error) {
      logApiError(error)
      throw error
    }
  },

  getTimeline: async (id: string): Promise<{ timeline: any[] }> => {
    const response = await api.get<{ timeline: any[] }>(`/opportunities/opportunities/${id}/timeline`)
    return response.data
  },

  delete: async (id: string): Promise<{ message: string; id: string }> => {
    const response = await api.delete<{ message: string; id: string }>(`/opportunities/opportunities/${id}`)
    return response.data
  },
}

