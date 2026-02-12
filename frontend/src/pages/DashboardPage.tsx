import { ReactNode, useEffect, useMemo, useState } from 'react'
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
import { alpha, useTheme } from '@mui/material/styles'
import {
  TrendingUp,
  Assignment,
  CheckCircle,
  Schedule,
  Refresh,
  Description,
} from '@mui/icons-material'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dashboardService, DashboardMetrics, FunnelData, TrendData } from '../services/dashboardService'

const METRIC_CARD_COLORS = {
  pipeline: '#8f78ff',
  active: '#ff5ba5',
  win: '#45d685',
  deadlines: '#f8bf5a',
  proposals: '#5a9dff',
}

const FUNNEL_COLORS = ['#5f86ff', '#7f7bff', '#a56bff', '#ce5cca', '#37d38a']

function metricNumber(value: number, suffix = '') {
  return `${value}${suffix}`
}

function formatMonthLabel(value: string) {
  if (!value) return ''
  if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7)
  return value
}

function MetricCard({
  title,
  value,
  subtitle,
  color,
  icon,
  onClick,
}: {
  title: string
  value: string
  subtitle?: string
  color: string
  icon: ReactNode
  onClick?: () => void
}) {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.3,
        borderRadius: 3,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .2s ease, box-shadow .2s ease',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: `0 18px 32px ${alpha(color, 0.2)}`,
            }
          : undefined,
      }}
    >
      <Box display="flex" alignItems="center" gap={1.4} mb={1.5}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: `linear-gradient(140deg, ${alpha(color, 0.92)} 0%, ${alpha('#ffffff', 0.24)} 180%)`,
            color: '#fff',
            boxShadow: `0 0 0 4px ${alpha(color, 0.16)}`,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" sx={{ fontSize: '1.02rem', fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          fontSize: { xs: '2rem', md: '2.1rem' },
          color,
          lineHeight: 1.1,
          mb: subtitle ? 0.4 : 0,
        }}
      >
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.92 }}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [funnel, setFunnel] = useState<FunnelData[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })

  useEffect(() => {
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!dateRange.start && !dateRange.end) return
    const timer = setTimeout(() => {
      loadDashboardData()
    }, 450)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start, dateRange.end])

  const funnelDisplay = useMemo(() => {
    const maxCount = Math.max(...funnel.map((item) => item.count || 0), 1)
    return funnel.map((item, index) => ({
      ...item,
      label: `${((item.count / maxCount) * 100).toFixed(1)}%`,
      fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
    }))
  }, [funnel])

  const trendsDisplay = useMemo(
    () => trends.map((item) => ({ ...item, monthLabel: formatMonthLabel(item.month) })),
    [trends]
  )

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const metricsParams: Record<string, string> = {}
      if (dateRange.start) metricsParams.start_date = dateRange.start
      if (dateRange.end) metricsParams.end_date = dateRange.end

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="55vh">
        <CircularProgress />
      </Box>
    )
  }

  const chartCardSx = {
    p: 2.5,
    borderRadius: 3,
    height: '100%',
  }

  const tooltipStyle = {
    background: alpha(theme.palette.background.paper, 0.97),
    border: `1px solid ${alpha(theme.palette.primary.light, 0.28)}`,
    borderRadius: 10,
    color: theme.palette.text.primary,
  } as const

  return (
    <Box className="fade-in" sx={{ px: { xs: 0.2, md: 0.4 }, pb: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.2} flexWrap="wrap" gap={1.2}>
        <Typography variant="h4" sx={{ fontSize: { xs: '2rem', md: '2.7rem' } }}>
          Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            type="date"
            label="Start Date"
            size="small"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 145 }}
          />
          <TextField
            type="date"
            label="End Date"
            size="small"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 145 }}
          />
          <IconButton
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            sx={{
              border: `1px solid ${alpha(theme.palette.primary.light, 0.35)}`,
              borderRadius: 2,
              width: 38,
              height: 38,
            }}
          >
            <Refresh
              fontSize="small"
              sx={{
                color: 'text.secondary',
                animation: refreshing ? 'dash-rotate 0.85s linear infinite' : 'none',
                '@keyframes dash-rotate': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
          </IconButton>
          <Button variant="outlined" onClick={(e) => setExportAnchor(e.currentTarget)} sx={{ height: 38, px: 2.2 }}>
            Export
          </Button>
          <Menu
            anchorEl={exportAnchor}
            open={Boolean(exportAnchor)}
            onClose={() => setExportAnchor(null)}
            PaperProps={{
              sx: {
                background: alpha(theme.palette.background.paper, 0.98),
                border: `1px solid ${alpha(theme.palette.primary.light, 0.3)}`,
              },
            }}
          >
            <MenuItem onClick={() => handleExport('pdf')}>Export as PDF</MenuItem>
            <MenuItem onClick={() => handleExport('excel')}>Export as Excel</MenuItem>
            <MenuItem onClick={() => handleExport('powerpoint')}>Export as PowerPoint</MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            xl: 'repeat(5, 1fr)',
          },
          gap: 1.6,
          mb: 1.8,
        }}
      >
        <MetricCard
          title="Pipeline Value"
          value={metrics ? formatCurrency(metrics.pipeline_value) : '$0'}
          subtitle={`Weighted: ${metrics ? formatCurrency(metrics.weighted_pipeline_value) : '$0'}`}
          color={METRIC_CARD_COLORS.pipeline}
          icon={<TrendingUp fontSize="small" />}
        />
        <MetricCard
          title="Active Opportunities"
          value={metricNumber(metrics?.active_opportunities || 0)}
          color={METRIC_CARD_COLORS.active}
          icon={<Assignment fontSize="small" />}
          onClick={() => navigate('/opportunities?status=active')}
        />
        <MetricCard
          title="Win Rate"
          value={`${metrics?.win_rate?.toFixed(1) || 0}%`}
          subtitle={`Won: ${metrics?.won_count || 0} | Lost: ${metrics?.lost_count || 0}`}
          color={METRIC_CARD_COLORS.win}
          icon={<CheckCircle fontSize="small" />}
        />
        <MetricCard
          title="Upcoming Deadlines"
          value={metricNumber(metrics?.upcoming_deadlines || 0)}
          color={METRIC_CARD_COLORS.deadlines}
          icon={<Schedule fontSize="small" />}
        />
        <MetricCard
          title="Active Proposals"
          value={metricNumber(metrics?.active_proposals || 0)}
          subtitle={
            metrics?.proposals_by_phase
              ? `Pink: ${metrics.proposals_by_phase.pink_team} | Red: ${metrics.proposals_by_phase.red_team} | Gold: ${metrics.proposals_by_phase.gold_team}`
              : undefined
          }
          color={METRIC_CARD_COLORS.proposals}
          icon={<Description fontSize="small" />}
          onClick={() => navigate('/proposals')}
        />
      </Box>

      <Grid container spacing={1.6}>
        <Grid item xs={12} md={6}>
          <Paper sx={chartCardSx}>
            <Typography variant="h6" sx={{ fontWeight: 650, mb: 1.2 }}>
              Opportunity Funnel
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <FunnelChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Funnel data={funnelDisplay} dataKey="count" nameKey="stage" isAnimationActive>
                  {funnelDisplay.map((entry) => (
                    <Cell key={`funnel-cell-${entry.stage}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="label"
                    position="center"
                    fill={theme.palette.common.white}
                    stroke="none"
                    style={{ fontWeight: 600 }}
                  />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={chartCardSx}>
            <Typography variant="h6" sx={{ fontWeight: 650, mb: 1.2 }}>
              Win/Loss Trends
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendsDisplay}>
                <defs>
                  <linearGradient id="winsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64a3ff" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#64a3ff" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="lossArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff647a" stopOpacity={0.52} />
                    <stop offset="100%" stopColor="#ff647a" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={alpha(theme.palette.primary.light, 0.16)} />
                <XAxis dataKey="monthLabel" stroke={theme.palette.text.secondary} />
                <YAxis stroke={theme.palette.text.secondary} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="won"
                  stroke="#7db4ff"
                  fill="url(#winsArea)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#b9d6ff', stroke: '#7db4ff', strokeWidth: 1.5 }}
                  name="Won"
                />
                <Area
                  type="monotone"
                  dataKey="lost"
                  stroke="#ff6f88"
                  fill="url(#lossArea)"
                  strokeWidth={2.2}
                  dot={{ r: 3.5, fill: '#ff8fa1', stroke: '#ff6f88', strokeWidth: 1.4 }}
                  name="Lost"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
