import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { Opportunity } from '../services/opportunityService'

interface ProposalFormData {
  name: string
  opportunity_id: string
  version?: string
}

interface ProposalFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: ProposalFormData) => void
  initialData?: Partial<ProposalFormData>
  opportunities?: Opportunity[]
  lockedOpportunityId?: string // When set, opportunity is locked and cannot be changed
  lockedOpportunityName?: string // Display name for locked opportunity
}

export default function ProposalForm({
  open,
  onClose,
  onSubmit,
  initialData,
  opportunities = [],
  lockedOpportunityId,
  lockedOpportunityName,
}: ProposalFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    setValue,
  } = useForm<ProposalFormData>({
    defaultValues: initialData || {
      version: '1.0',
      opportunity_id: lockedOpportunityId || '',
    },
  })

  // Set opportunity_id when locked or when form opens
  React.useEffect(() => {
    if (lockedOpportunityId) {
      setValue('opportunity_id', lockedOpportunityId)
    } else if (open && !initialData && opportunities.length === 1) {
      // Auto-select if only one opportunity available
      setValue('opportunity_id', opportunities[0].id)
    }
  }, [lockedOpportunityId, open, opportunities, setValue, initialData])

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      if (initialData) {
        reset(initialData)
      } else {
        reset({
          version: '1.0',
        })
      }
    }
  }, [open, initialData, reset])

  const handleFormSubmit = async (data: ProposalFormData) => {
    // Ensure opportunity_id is set if locked
    if (lockedOpportunityId) {
      data.opportunity_id = lockedOpportunityId
    }
    await onSubmit(data)
    // Don't close here - let parent handle it after success
    reset()
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initialData ? 'Edit Proposal' : 'Create New Proposal'}
      </DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Proposal Name"
                {...register('name', { required: 'Name is required' })}
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              {lockedOpportunityId ? (
                <TextField
                  fullWidth
                  label="Opportunity"
                  value={lockedOpportunityName || 'Current Opportunity'}
                  disabled
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(15, 23, 42, 0.3)',
                    },
                  }}
                  helperText="This proposal is linked to the current opportunity"
                />
              ) : (
                <FormControl fullWidth error={!!errors.opportunity_id}>
                  <InputLabel>Opportunity</InputLabel>
                  <Controller
                    name="opportunity_id"
                    control={control}
                    rules={{ required: 'Opportunity is required' }}
                    render={({ field }) => (
                      <Select
                        {...field}
                        label="Opportunity"
                        sx={{
                          background: 'rgba(15, 23, 42, 0.5)',
                        }}
                      >
                        {opportunities.length === 0 ? (
                          <MenuItem value="" disabled>No opportunities available</MenuItem>
                        ) : (
                          opportunities.map((opp) => (
                            <MenuItem key={opp.id} value={opp.id}>
                              {opp.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    )}
                  />
                </FormControl>
              )}
              {errors.opportunity_id && !lockedOpportunityId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                  {errors.opportunity_id.message}
                </Typography>
              )}
              {/* Hidden field to ensure opportunity_id is submitted when locked */}
              {lockedOpportunityId && (
                <input type="hidden" {...register('opportunity_id')} value={lockedOpportunityId} />
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Version"
                {...register('version')}
                defaultValue="1.0"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCancel} variant="outlined">
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            {initialData ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

