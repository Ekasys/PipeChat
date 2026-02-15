import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Paper, Avatar, Chip, Tooltip, IconButton } from '@mui/material'
import { Person, Visibility } from '@mui/icons-material'

interface OrgChartNode {
  id: string
  name: string
  title?: string
  department?: string
  influence_level?: string
  email?: string
  phone?: string
  children?: OrgChartNode[]
}

interface OrgChartProps {
  data: OrgChartNode[]
  accountName?: string
}

const OrgChartNode: React.FC<{ node: OrgChartNode; level: number }> = ({ node, level }) => {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)
  const getInfluenceColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'champion':
        return 'success'
      case 'influencer':
        return 'primary'
      case 'blocker':
        return 'error'
      default:
        return 'default'
    }
  }

  const tooltipContent = (
    <Box>
      <Typography variant="subtitle2" fontWeight={600}>
        {node.name}
      </Typography>
      {node.title && <Typography variant="caption">Title: {node.title}</Typography>}
      {node.department && <Typography variant="caption" display="block">Dept: {node.department}</Typography>}
      {node.email && <Typography variant="caption" display="block">Email: {node.email}</Typography>}
      {node.phone && <Typography variant="caption" display="block">Phone: {node.phone}</Typography>}
      {node.influence_level && <Typography variant="caption" display="block">Influence: {node.influence_level}</Typography>}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Node Card */}
      <Tooltip title={tooltipContent} arrow placement="top">
        <Paper
          onClick={() => navigate(`/crm/contacts/${node.id}`)}
          sx={{
            p: 2,
            minWidth: 200,
            maxWidth: 250,
            background: 'linear-gradient(135deg, var(--pp-slate-80) 0%, var(--pp-dark-90) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
              borderColor: 'rgba(99, 102, 241, 0.5)',
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Avatar sx={{ bgcolor: '#667eea', width: 40, height: 40 }}>
              <Person />
            </Avatar>
            <Box flex={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                {node.name}
              </Typography>
              {node.title && (
                <Typography variant="caption" color="text.secondary">
                  {node.title}
                </Typography>
              )}
            </Box>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/crm/contacts/${node.id}`)
              }}
              sx={{
                '&:hover': {
                  background: 'rgba(99, 102, 241, 0.2)',
                },
              }}
            >
              <Visibility fontSize="small" />
            </IconButton>
          </Box>
          {node.department && (
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {node.department}
            </Typography>
          )}
          {node.influence_level && (
            <Chip
              label={node.influence_level}
              size="small"
              color={getInfluenceColor(node.influence_level) as any}
              sx={{ mt: 0.5 }}
            />
          )}
        </Paper>
      </Tooltip>

      {/* Children */}
      {node.children && node.children.length > 0 && expanded && (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mt: 3,
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -16,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2,
              height: 16,
              bgcolor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          {node.children.map((child, index) => (
            <Box key={child.id} sx={{ position: 'relative' }}>
              {/* Connector line */}
              {index < node.children!.length - 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -16,
                    left: '50%',
                    width: '50%',
                    height: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    zIndex: 0,
                  }}
                />
              )}
              {index > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -16,
                    left: 0,
                    width: '50%',
                    height: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    zIndex: 0,
                  }}
                />
              )}
              {node.children!.length > 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    height: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    zIndex: 0,
                  }}
                />
              )}
              <OrgChartNode node={child} level={level + 1} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

const OrgChart: React.FC<OrgChartProps> = ({ data, accountName }) => {
  if (!data || data.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No organization chart data available for this account.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Add contacts with manager relationships to build the org chart.
        </Typography>
      </Paper>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {accountName && (
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Organization Chart - {accountName}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {data.map((root) => (
          <OrgChartNode key={root.id} node={root} level={0} />
        ))}
      </Box>
    </Box>
  )
}

export default OrgChart

