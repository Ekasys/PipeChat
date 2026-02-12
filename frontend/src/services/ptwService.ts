import api from './api'

export interface LaborCategory {
  category: string
  rate: number
  hours: number
}

export interface PTWScenario {
  id: string
  name: string
  opportunity_id?: string
  scenario_type: string
  description?: string
  labor_categories: LaborCategory[]
  overhead_rate: number
  gaa_rate: number
  fee_rate: number
  total_labor_cost: number
  direct_costs: number
  indirect_costs: number
  total_cost: number
  total_price: number
  competitive_position?: string
  created_at: string
}

export const ptwService = {
  create: async (data: Partial<PTWScenario>): Promise<PTWScenario> => {
    const payload: any = {
      name: data.name,
      scenario_type: data.scenario_type || 'base',
      labor_categories: data.labor_categories || [],
      overhead_rate: data.overhead_rate || 0,
      gaa_rate: data.gaa_rate || 0,
      fee_rate: data.fee_rate || 0,
    }
    
    if (data.opportunity_id) payload.opportunity_id = data.opportunity_id
    if (data.description) payload.description = data.description
    if (data.competitive_position) payload.competitive_position = data.competitive_position
    
    const response = await api.post<PTWScenario>('/ptw/scenarios', payload)
    return response.data
  },

  list: async (opportunityId?: string): Promise<{ scenarios: PTWScenario[] }> => {
    const url = opportunityId 
      ? `/ptw/scenarios?opportunity_id=${opportunityId}`
      : '/ptw/scenarios'
    const response = await api.get<{ scenarios: PTWScenario[] }>(url)
    return response.data
  },

  get: async (id: string): Promise<PTWScenario> => {
    const response = await api.get<PTWScenario>(`/ptw/scenarios/${id}`)
    return response.data
  },

  update: async (id: string, data: Partial<PTWScenario>): Promise<PTWScenario> => {
    const payload: any = {}
    
    if (data.name !== undefined) payload.name = data.name
    if (data.opportunity_id !== undefined) payload.opportunity_id = data.opportunity_id || null
    if (data.scenario_type !== undefined) payload.scenario_type = data.scenario_type
    if (data.description !== undefined) payload.description = data.description
    if (data.labor_categories !== undefined) payload.labor_categories = data.labor_categories
    if (data.overhead_rate !== undefined) payload.overhead_rate = data.overhead_rate
    if (data.gaa_rate !== undefined) payload.gaa_rate = data.gaa_rate
    if (data.fee_rate !== undefined) payload.fee_rate = data.fee_rate
    if (data.competitive_position !== undefined) payload.competitive_position = data.competitive_position
    
    const response = await api.put<PTWScenario>(`/ptw/scenarios/${id}`, payload)
    return response.data
  },

  getScenarios: async (opportunityId: string): Promise<{ scenarios: PTWScenario[] }> => {
    const response = await api.get<{ scenarios: PTWScenario[] }>(`/ptw/opportunities/${opportunityId}/scenarios`)
    return response.data
  },
}

