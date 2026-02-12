import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Grid,
  Paper,
  Box,
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  IconButton,
  TextField,
} from '@mui/material'
import {
  TrendingUp,
  Assignment,
  CheckCircle,
  Schedule,
  Refresh,
  Description,
} from '@mui/icons-material'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList } from 'recharts'
import { dashboardService, DashboardMetrics, FunnelData, TrendData } from '../services/dashboardService'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [funnel, setFunnel] = useState<FunnelData[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (dateRange.start || dateRange.end) {
      const timer = setTimeout(() => {
        loadDashboardData()
      }, 500) // Debounce date changes
      return () => clearTimeout(timer)
    }
  }, [dateRange.start, dateRange.end])

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      
      const metricsParams: any = {}
      if (dateRange.start) {
        metricsParams.start_date = dateRange.start
      }
      if (dateRange.end) {
        metricsParams.end_date = dateRange.end
      }
      
      const [metricsData, funnelData, trendsData] = await Promise.all([
        dashboardService.getMetrics(metricsParams),
        dashboardService.getFunnel(),
        dashboardService.getTrends(),
      ])
      setMetrics(metricsData)
      setFunnel(funnelData.funnel)
      setTrends(trendsData.trends)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleExport = (format: string) => {
    window.open(`/api/v1/dashboard/export/${format}`, '_blank')
    setExportAnchor(null)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 800 }}>
          Dashboard
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Box display="flex" gap={1} alignItems="center">
            <TextField
              type="date"
              label="Start Date"
              size="small"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150 }}
            />
            <TextField
              type="date"
              label="End Date"
              size="small"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150 }}
            />
            {(dateRange.start || dateRange.end) && (
              <Button
                size="small"
                onClick={() => {
                  setDateRange({ start: '', end: '' })
                  loadDashboardData()
                }}
              >
                Clear
              </Button>
            )}
          </Box>
          <IconButton
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            sx={{
              '&:hover': {
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
              },
            }}
          >
            <Refresh sx={{ 
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }} />
          </IconButton>
          <Button
            variant="outlined"
            onClick={(e) => setExportAnchor(e.currentTarget)}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportAnchor}
            open={Boolean(exportAnchor)}
            onClose={() => setExportAnchor(null)}
          >
            <MenuItem onClick={() => handleExport('pdf')}>Export as PDF</MenuItem>
            <MenuItem onClick={() => handleExport('excel')}>Export as Excel</MenuItem>
            <MenuItem onClick={() => handleExport('powerpoint')}>Export as PowerPoint</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Metrics Cards Row */}
      <Box 
        sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 3,
          mb: 3,
        }}
      >
        <Paper 
          sx={{ 
            p: 3,
            height: '100%',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                mr: 1.5,
              }}
            >
              <TrendingUp sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" fontWeight={600}>Pipeline Value</Typography>
          </Box>
          <Typography 
            variant="h4" 
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            {metrics ? formatCurrency(metrics.pipeline_value) : '$0'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
            Weighted: {metrics ? formatCurrency(metrics.weighted_pipeline_value) : '$0'}
          </Typography>
        </Paper>

        <Paper 
          onClick={() => navigate('/opportunities?status=active')}
          sx={{ 
            p: 3,
            height: '100%',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(219, 39, 119, 0.2) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 20px rgba(236, 72, 153, 0.3)',
              border: '1px solid rgba(236, 72, 153, 0.5)',
            },
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                mr: 1.5,
              }}
            >
              <Assignment sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" fontWeight={600}>Active Opportunities</Typography>
          </Box>
          <Typography 
            variant="h4" 
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {metrics?.active_opportunities || 0}
          </Typography>
        </Paper>

        <Paper 
          sx={{ 
            p: 3,
            height: '100%',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.2) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                mr: 1.5,
              }}
            >
              <CheckCircle sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" fontWeight={600}>Win Rate</Typography>
          </Box>
          <Typography 
            variant="h4"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            {metrics?.win_rate?.toFixed(1) || 0}%
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
            Won: {metrics?.won_count || 0} | Lost: {metrics?.lost_count || 0}
          </Typography>
        </Paper>

        <Paper 
          sx={{ 
            p: 3,
            height: '100%',
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                mr: 1.5,
              }}
            >
              <Schedule sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" fontWeight={600}>Upcoming Deadlines</Typography>
          </Box>
          <Typography 
            variant="h4"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {metrics?.upcoming_deadlines || 0}
          </Typography>
        </Paper>

        <Paper 
          onClick={() => navigate('/proposals')}
          sx={{ 
            p: 3,
            height: '100%',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
            },
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                mr: 1.5,
              }}
            >
              <Description sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" fontWeight={600}>Active Proposals</Typography>
          </Box>
          <Typography 
            variant="h4"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            {metrics?.active_proposals || 0}
          </Typography>
          {metrics?.proposals_by_phase && (
            <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
              Pink: {metrics.proposals_by_phase.pink_team} | Red: {metrics.proposals_by_phase.red_team} | Gold: {metrics.proposals_by_phase.gold_team}
            </Typography>
          )}
        </Paper>
      </Box>

      <Grid container spacing={3}>

        {/* Funnel Chart */}
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ 
              p: 3,
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight={700}>
              Opportunity Funnel
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnel}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="stage" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip 
                  contentStyle={{
                    background: 'rgba(30, 41, 59, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="count" 
                  fill="url(#colorGradient1)" 
                  name="Count"
                  radius={[8, 8, 0, 0]}
                />
                <Bar 
                  dataKey="value" 
                  fill="url(#colorGradient2)" 
                  name="Value ($)"
                  radius={[8, 8, 0, 0]}
                />
                <defs>
                  <linearGradient id="colorGradient1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#667eea" stopOpacity={1} />
                    <stop offset="100%" stopColor="#764ba2" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="colorGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={1} />
                    <stop offset="100%" stopColor="#db2777" stopOpacity={1} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Trends Chart */}
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ 
              p: 3,
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight={700}>
              Win/Loss Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="month" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip 
                  contentStyle={{
                    background: 'rgba(30, 41, 59, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="won" 
                  stroke="url(#lineGradient1)" 
                  strokeWidth={3}
                  dot={{ fill: '#22c55e', r: 5 }}
                  name="Won" 
                />
                <Line 
                  type="monotone" 
                  dataKey="lost" 
                  stroke="url(#lineGradient2)" 
                  strokeWidth={3}
                  dot={{ fill: '#ef4444', r: 5 }}
                  name="Lost" 
                />
                <defs>
                  <linearGradient id="lineGradient1" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <linearGradient id="lineGradient2" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
