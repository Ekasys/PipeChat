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
  Chip,
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
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
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

type DeltaInfo = {
  text: string
  positive: boolean
}

function computeDelta(current: number, previous: number, labelPrefix = ''): DeltaInfo {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { text: `${labelPrefix}stable`, positive: true }
  }
  if (previous === 0) {
    if (current === 0) return { text: `${labelPrefix}stable`, positive: true }
    return { text: `${labelPrefix}+${current.toFixed(1)}`, positive: true }
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.abs(delta).toFixed(1)
  if (Math.abs(delta) < 0.2) return { text: `${labelPrefix}stable`, positive: true }
  return {
    text: `${labelPrefix}${delta >= 0 ? '+' : '-'}${rounded}%`,
    positive: delta >= 0,
  }
}

function MetricCard({
  title,
  value,
  subtitle,
  color,
  icon,
  trend,
  delta,
  index,
  onClick,
}: {
  title: string
  value: string
  subtitle?: string
  color: string
  icon: ReactNode
  trend: number[]
  delta: DeltaInfo
  index: number
  onClick?: () => void
}) {
  const trendSeries = trend.length ? trend : [0, 0, 0, 0, 0]
  const chartData = trendSeries.map((point, pointIndex) => ({ point: pointIndex, value: point }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, delay: 0.08 * index, ease: 'easeOut' }}
      style={{ height: '100%' }}
    >
      <Paper
        onClick={onClick}
        sx={{
          p: 2,
          borderRadius: 3,
          cursor: onClick ? 'pointer' : 'default',
          border: `1px solid ${alpha(color, 0.35)}`,
          background: `linear-gradient(150deg, ${alpha(color, 0.13)} 0%, ${alpha(color, 0.04)} 70%, transparent 100%)`,
          transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
          '&:hover': {
            transform: onClick ? 'translateY(-2px)' : 'none',
            boxShadow: `0 22px 35px ${alpha(color, 0.22)}`,
            borderColor: alpha(color, 0.52),
          },
        }}
      >
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                background: `linear-gradient(140deg, ${alpha(color, 0.9)} 0%, ${alpha(color, 0.35)} 180%)`,
                color: '#fff',
                boxShadow: `0 0 0 3px ${alpha(color, 0.16)}`,
              }}
            >
              {icon}
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 680, fontSize: '0.98rem' }}>
              {title}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={delta.text}
            sx={{
              height: 22,
              fontSize: 11,
              fontWeight: 700,
              border: `1px solid ${alpha(delta.positive ? '#34d399' : '#fb7185', 0.4)}`,
              background: alpha(delta.positive ? '#34d399' : '#fb7185', 0.14),
              color: delta.positive ? '#6ef9bf' : '#ff95a7',
            }}
          />
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 760,
            fontSize: { xs: '1.88rem', md: '2.05rem' },
            color,
            lineHeight: 1.1,
            mb: 1,
            fontFamily: 'var(--font-display)',
          }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.92, mb: 1 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ height: 32, mt: subtitle ? 1 : 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.4}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </motion.div>
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

  const trendTail = trendsDisplay.slice(-6)
  const latestTrend = trendTail[trendTail.length - 1]
  const previousTrend = trendTail.length > 1 ? trendTail[trendTail.length - 2] : latestTrend

  const cards = useMemo(() => {
    const pipelineSeries = trendTail.map((item, idx) => {
      const total = (item.won || 0) + (item.lost || 0)
      return total * (idx + 1)
    })
    const activeSeries = trendTail.map((item) => (item.won || 0) + (item.lost || 0))
    const winSeries = trendTail.map((item) => item.won || 0)
    const lossSeries = trendTail.map((item) => item.lost || 0)
    const proposalSeries = trendTail.map((item, idx) => (item.won || 0) + Math.max(0, 4 - idx))

    return [
      {
        title: 'Pipeline Value',
        value: metrics ? formatCurrency(metrics.pipeline_value) : '$0',
        subtitle: `Weighted: ${metrics ? formatCurrency(metrics.weighted_pipeline_value) : '$0'}`,
        color: METRIC_CARD_COLORS.pipeline,
        icon: <TrendingUp fontSize="small" />,
        trend: pipelineSeries,
        delta: computeDelta(metrics?.pipeline_value || 0, metrics?.weighted_pipeline_value || 0, ''),
      },
      {
        title: 'Active Opportunities',
        value: metricNumber(metrics?.active_opportunities || 0),
        color: METRIC_CARD_COLORS.active,
        icon: <Assignment fontSize="small" />,
        trend: activeSeries,
        delta: computeDelta(latestTrend?.won || 0, previousTrend?.won || 0, ''),
        onClick: () => navigate('/opportunities?status=active'),
      },
      {
        title: 'Win Rate',
        value: `${metrics?.win_rate?.toFixed(1) || 0}%`,
        subtitle: `Won: ${metrics?.won_count || 0} | Lost: ${metrics?.lost_count || 0}`,
        color: METRIC_CARD_COLORS.win,
        icon: <CheckCircle fontSize="small" />,
        trend: winSeries,
        delta: computeDelta(latestTrend?.won || 0, previousTrend?.won || 0, ''),
      },
      {
        title: 'Upcoming Deadlines',
        value: metricNumber(metrics?.upcoming_deadlines || 0),
        color: METRIC_CARD_COLORS.deadlines,
        icon: <Schedule fontSize="small" />,
        trend: lossSeries,
        delta: computeDelta(previousTrend?.lost || 0, latestTrend?.lost || 0, ''),
      },
      {
        title: 'Active Proposals',
        value: metricNumber(metrics?.active_proposals || 0),
        subtitle: metrics?.proposals_by_phase
          ? `Pink: ${metrics.proposals_by_phase.pink_team} | Red: ${metrics.proposals_by_phase.red_team} | Gold: ${metrics.proposals_by_phase.gold_team}`
          : undefined,
        color: METRIC_CARD_COLORS.proposals,
        icon: <Description fontSize="small" />,
        trend: proposalSeries,
        delta: computeDelta(
          metrics?.active_proposals || 0,
          (metrics?.proposals_by_phase?.submitted || 0) + (metrics?.proposals_by_phase?.won || 0),
          '',
        ),
        onClick: () => navigate('/proposals'),
      },
    ]
  }, [latestTrend?.lost, latestTrend?.won, metrics, navigate, previousTrend?.lost, previousTrend?.won, trendTail])

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

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="55vh">
        <CircularProgress />
      </Box>
    )
  }

  const chartCardSx = {
    p: 2,
    borderRadius: 3,
    height: '100%',
    border: `1px solid ${alpha(theme.palette.primary.light, 0.24)}`,
    background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.72)} 55%)`,
    transition: 'transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: alpha(theme.palette.primary.light, 0.48),
      boxShadow: `0 22px 36px ${alpha(theme.palette.primary.main, 0.2)}`,
    },
  }

  const tooltipStyle = {
    background: alpha(theme.palette.background.paper, 0.97),
    border: `1px solid ${alpha(theme.palette.primary.light, 0.28)}`,
    borderRadius: 8,
    color: theme.palette.text.primary,
  } as const

  return (
    <Box className="fade-in" sx={{ px: { xs: 0, md: 1 }, pb: 3 }}>
      <Paper
        sx={{
          position: 'sticky',
          top: 8,
          zIndex: 8,
          px: { xs: 2, md: 3 },
          py: 2,
          mb: 2,
          borderRadius: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          border: `1px solid ${alpha(theme.palette.primary.light, 0.24)}`,
          background: `linear-gradient(140deg, ${alpha(theme.palette.background.paper, 0.92)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
          backdropFilter: 'blur(14px)',
          boxShadow: `0 18px 30px ${alpha(theme.palette.primary.main, 0.15)}`,
        }}
      >
        <Box>
          <Typography variant="h4" className="headline-display" sx={{ fontSize: { xs: '1.72rem', md: '2.35rem' } }}>
            Dashboard
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <TextField
            type="date"
            label="Start Date"
            size="small"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            type="date"
            label="End Date"
            size="small"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <IconButton
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            sx={{
              border: `1px solid ${alpha(theme.palette.primary.light, 0.35)}`,
              borderRadius: 2,
              width: 40,
              height: 40,
              background: alpha(theme.palette.primary.main, 0.08),
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
          <Button variant="outlined" onClick={(e) => setExportAnchor(e.currentTarget)} sx={{ height: 40, px: 2 }}>
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
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            xl: 'repeat(5, 1fr)',
          },
          gap: 2,
          mb: 3,
        }}
      >
        {cards.map((card, index) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            color={card.color}
            icon={card.icon}
            trend={card.trend}
            delta={card.delta}
            index={index}
            onClick={card.onClick}
          />
        ))}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.2 }}
          >
            <Paper sx={chartCardSx}>
              <Typography variant="h6" sx={{ fontWeight: 660, mb: 2 }}>
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
          </motion.div>
        </Grid>

        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.28 }}
          >
            <Paper sx={chartCardSx}>
              <Typography variant="h6" sx={{ fontWeight: 660, mb: 2 }}>
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
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  )
}
