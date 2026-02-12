import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Avatar,
  Divider,
} from '@mui/material'
import { Add, Email, Phone, Event, Note, Description } from '@mui/icons-material'
import { format } from 'date-fns'
import api from '../services/api'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'

export interface Activity {
  id: string
  activity_type: string
  subject?: string
  description?: string
  outcome?: string
  activity_date: string
  user_id: string
  account_id?: string
  contact_id?: string
  opportunity_id?: string
}

interface ActivityTimelineProps {
  accountId?: string
  contactId?: string
  onActivityAdded?: () => void
}

const activityTypeIcons: Record<string, React.ReactNode> = {
  email: <Email fontSize="small" />,
  call: <Phone fontSize="small" />,
  meeting: <Event fontSize="small" />,
  note: <Note fontSize="small" />,
  document: <Description fontSize="small" />,
}

const activityTypeColors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  email: 'primary',
  call: 'success',
  meeting: 'info',
  note: 'warning',
  document: 'secondary',
}

export default function ActivityTimeline({ accountId, contactId, onActivityAdded }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [formData, setFormData] = useState({
    activity_type: 'note',
    subject: '',
    description: '',
    outcome: '',
  })
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    if (accountId || contactId) {
      loadActivities()
    }
  }, [accountId, contactId])

  const loadActivities = async () => {
    try {
      setLoading(true)
      let endpoint = ''
      if (accountId) {
        endpoint = `/crm/accounts/${accountId}/activities`
      } else if (contactId) {
        endpoint = `/crm/contacts/${contactId}/activities`
      } else {
        return
      }

      const response = await api.get<{ timeline: Activity[] }>(endpoint)
      setActivities(response.data.timeline || [])
    } catch (error) {
      console.error('Failed to load activities:', error)
      showToast('Failed to load activities', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateActivity = async () => {
    try {
      let endpoint = ''
      if (accountId) {
        endpoint = `/crm/accounts/${accountId}/activities`
      } else if (contactId) {
        endpoint = `/crm/contacts/${contactId}/activities`
      } else {
        return
      }

      await api.post(endpoint, formData)
      showToast('Activity created successfully', 'success')
      setOpenDialog(false)
      setFormData({ activity_type: 'note', subject: '', description: '', outcome: '' })
      loadActivities()
      onActivityAdded?.()
    } catch (error) {
      console.error('Failed to create activity:', error)
      showToast('Failed to create activity', 'error')
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Loading activities...
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Activity Timeline</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
        >
          Add Activity
        </Button>
      </Box>

      {activities.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No activities yet. Add your first activity to get started.
          </Typography>
        </Paper>
      ) : (
        <Box>
          {activities.map((activity, index) => (
            <Box key={activity.id} sx={{ position: 'relative', mb: 3 }}>
              {/* Timeline line */}
              {index < activities.length - 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 20,
                    top: 48,
                    bottom: -24,
                    width: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    zIndex: 0,
                  }}
                />
              )}
              
              <Box display="flex" gap={2}>
                {/* Timeline dot */}
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Avatar
                    sx={{
                      bgcolor: activityTypeColors[activity.activity_type] === 'primary' ? 'primary.main' :
                               activityTypeColors[activity.activity_type] === 'success' ? 'success.main' :
                               activityTypeColors[activity.activity_type] === 'info' ? 'info.main' :
                               activityTypeColors[activity.activity_type] === 'warning' ? 'warning.main' :
                               activityTypeColors[activity.activity_type] === 'error' ? 'error.main' :
                               'grey.700',
                      width: 40,
                      height: 40,
                    }}
                  >
                    {activityTypeIcons[activity.activity_type] || <Note fontSize="small" />}
                  </Avatar>
                </Box>
                
                {/* Content */}
                <Box flex={1}>
                  <Paper
                    sx={{
                      p: 2,
                      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: 'rgba(99, 102, 241, 0.5)',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                      },
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {activity.subject || activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(activity.activity_date), 'MMM dd, yyyy h:mm a')}
                        </Typography>
                      </Box>
                      <Chip
                        label={activity.activity_type}
                        size="small"
                        color={activityTypeColors[activity.activity_type] || 'default'}
                      />
                    </Box>
                    {activity.description && (
                      <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        {activity.description}
                      </Typography>
                    )}
                    {activity.outcome && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(99, 102, 241, 0.1)', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Outcome:
                        </Typography>
                        <Typography variant="body2">{activity.outcome}</Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Activity</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Activity Type</InputLabel>
                <Select
                  value={formData.activity_type}
                  onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                  label="Activity Type"
                >
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="call">Call</MenuItem>
                  <MenuItem value="meeting">Meeting</MenuItem>
                  <MenuItem value="note">Note</MenuItem>
                  <MenuItem value="document">Document</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Outcome (Optional)"
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateActivity}
            disabled={!formData.activity_type}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={hideToast} />
    </Box>
  )
}
