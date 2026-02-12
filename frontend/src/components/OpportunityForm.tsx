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

interface OpportunityFormData {
  name: string
  agency?: string
  sub_agency?: string
  stage: string
  status?: string
  bd_status?: string
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
  contract_vehicle?: string
  number_of_years?: number
  account_id?: string
}

interface OpportunityFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: OpportunityFormData) => void
  initialData?: Partial<OpportunityFormData>
}

const formatDate = (value?: string) =>
  value ? new Date(value).toISOString().split('T')[0] : undefined

export default function OpportunityForm({
  open,
  onClose,
  onSubmit,
  initialData,
}: OpportunityFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<OpportunityFormData>({
    defaultValues: initialData
      ? {
          ...initialData,
          due_date: formatDate(initialData.due_date),
          rfp_submission_date: formatDate(initialData.rfp_submission_date),
          next_task_due: formatDate(initialData.next_task_due),
          award_date: formatDate(initialData.award_date),
        }
      : {
          stage: 'qualification',
          status: 'active',
          role: 'prime',
        },
  })

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          ...initialData,
          due_date: formatDate(initialData.due_date),
          rfp_submission_date: formatDate(initialData.rfp_submission_date),
          next_task_due: formatDate(initialData.next_task_due),
          award_date: formatDate(initialData.award_date),
        })
      } else {
        reset({
          stage: 'qualification',
          status: 'active',
          role: 'prime',
        })
      }
    }
  }, [open, initialData, reset])

  const handleFormSubmit = (data: OpportunityFormData) => {
    // Merge any fields from initialData that aren't in the form (like account_id)
    const submitData = {
      ...data,
      ...(initialData?.account_id && { account_id: initialData.account_id }),
    }
    onSubmit(submitData)
    reset()
    onClose()
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initialData ? 'Edit Opportunity' : 'Create New Opportunity'}
      </DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Opportunity Title"
                {...register('name', { required: 'Title is required' })}
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Opportunity Summary"
                placeholder="Provide the high-level summary or synopsis for this pursuit"
                {...register('summary')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Controller
                  name="status"
                  control={control}
                  defaultValue={initialData?.status || 'active'}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Status"
                      sx={{ background: 'rgba(15, 23, 42, 0.5)' }}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="won">Won</MenuItem>
                      <MenuItem value="lost">Lost</MenuItem>
                      <MenuItem value="withdrawn">Withdrawn</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.stage}>
                <InputLabel>BD Stage</InputLabel>
                <Controller
                  name="stage"
                  control={control}
                  rules={{ required: 'Stage is required' }}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="BD Stage"
                      sx={{ background: 'rgba(15, 23, 42, 0.5)' }}
                    >
                      <MenuItem value="qualification">Qualification</MenuItem>
                      <MenuItem value="pursuit">Pursuit</MenuItem>
                      <MenuItem value="proposal">Proposal</MenuItem>
                      <MenuItem value="negotiation">Negotiation</MenuItem>
                      <MenuItem value="award">Award Decision</MenuItem>
                      <MenuItem value="won">Won</MenuItem>
                      <MenuItem value="lost">Lost</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
              {errors.stage && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                  {errors.stage.message}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="BD Status"
                {...register('bd_status')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Agency"
                {...register('agency')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sub Agency"
                {...register('sub_agency')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Capture Manager Assigned"
                {...register('capture_manager')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Controller
                  name="role"
                  control={control}
                  defaultValue={initialData?.role || 'prime'}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Role"
                      sx={{ background: 'rgba(15, 23, 42, 0.5)' }}
                    >
                      <MenuItem value="prime">Prime</MenuItem>
                      <MenuItem value="sub">Sub</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contract Vehicle"
                {...register('contract_vehicle')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Estimated Value ($)"
                type="number"
                {...register('value', { valueAsNumber: true })}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="RFP/RFI Submission Date"
                type="date"
                {...register('rfp_submission_date')}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="BD Due Date"
                type="date"
                {...register('due_date')}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Award Date"
                type="date"
                {...register('award_date')}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="PWin (%)"
                type="number"
                {...register('pwin', { valueAsNumber: true, min: 0, max: 100 })}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="PTW ($)"
                type="number"
                {...register('ptw', { valueAsNumber: true })}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Number of Years"
                type="number"
                {...register('number_of_years', { valueAsNumber: true })}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Next Task Due"
                type="date"
                {...register('next_task_due')}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Next Task Comments"
                {...register('next_task_comments')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="History & Notes"
                {...register('history_notes')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Agency POCs"
                placeholder="List points of contact (Name – Role – Email – Phone)"
                {...register('agency_pocs')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Business Sectors"
                placeholder="Separate multiple sectors with commas"
                {...register('business_sectors')}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(15, 23, 42, 0.5)' } }}
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

