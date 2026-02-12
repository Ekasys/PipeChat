import api from './api'

export interface DashboardMetrics {
  pipeline_value: number
  weighted_pipeline_value: number
  active_opportunities: number
  win_rate: number
  upcoming_deadlines: number
  won_count: number
  lost_count: number
  active_proposals?: number
  proposals_by_phase?: {
    pink_team: number
    red_team: number
    gold_team: number
    submitted: number
    won: number
    lost: number
  }
}

export interface FunnelData {
  stage: string
  count: number
  value: number
}

export interface TrendData {
  month: string
  won: number
  lost: number
}

export const dashboardService = {
  getMetrics: async (params?: { start_date?: string; end_date?: string }): Promise<DashboardMetrics> => {
    const response = await api.get<DashboardMetrics>('/dashboard/metrics', { params })
    return response.data
  },

  getFunnel: async (): Promise<{ funnel: FunnelData[] }> => {
    const response = await api.get<{ funnel: FunnelData[] }>('/dashboard/funnel')
    return response.data
  },

  getTrends: async (months: number = 12): Promise<{ trends: TrendData[] }> => {
    const response = await api.get<{ trends: TrendData[] }>('/dashboard/trends', {
      params: { months },
    })
    return response.data
  },

  getDrillDown: async (groupBy: string): Promise<{ data: any[] }> => {
    const response = await api.get<{ data: any[] }>('/dashboard/drill-down', {
      params: { group_by: groupBy },
    })
    return response.data
  },

  getForecast: async (months: number = 12): Promise<any> => {
    const response = await api.get('/dashboard/forecast', {
      params: { months },
    })
    return response.data
  },
}

