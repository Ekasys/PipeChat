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
  Chip,
  Box,
} from '@mui/material'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { useEffect } from 'react'
import { Add, Delete } from '@mui/icons-material'

interface PartnerFormData {
  name: string
  company_name?: string
  description?: string
  website?: string
  contact_email?: string
  contact_phone?: string
  capabilities?: string[]
  contract_vehicles?: string[]
  status: string
}

interface PartnerFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: PartnerFormData) => void
  initialData?: Partial<PartnerFormData>
}

export default function PartnerForm({
  open,
  onClose,
  onSubmit,
  initialData,
}: PartnerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<PartnerFormData>({
    defaultValues: {
      name: '',
      company_name: '',
      description: '',
      website: '',
      contact_email: '',
      contact_phone: '',
      capabilities: [] as string[],
      contract_vehicles: [] as string[],
      status: 'active',
    },
  })

  const {
    fields: capabilityFields,
    append: appendCapability,
    remove: removeCapability,
  } = useFieldArray({
    control,
    // @ts-ignore - react-hook-form type inference issue with optional array fields
    name: 'capabilities',
  })

  const {
    fields: vehicleFields,
    append: appendVehicle,
    remove: removeVehicle,
  } = useFieldArray({
    control,
    // @ts-ignore - react-hook-form type inference issue with optional array fields
    name: 'contract_vehicles',
  })

  useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          name: initialData.name || '',
          company_name: initialData.company_name || '',
          description: initialData.description || '',
          website: initialData.website || '',
          contact_email: initialData.contact_email || '',
          contact_phone: initialData.contact_phone || '',
          capabilities: initialData.capabilities || [],
          contract_vehicles: initialData.contract_vehicles || [],
          status: initialData.status || 'active',
        })
      } else {
        reset({
          name: '',
          company_name: '',
          description: '',
          website: '',
          contact_email: '',
          contact_phone: '',
          capabilities: [],
          contract_vehicles: [],
          status: 'active',
        })
      }
    }
  }, [open, initialData, reset])

  const handleFormSubmit = (data: PartnerFormData) => {
    onSubmit(data)
    reset()
    onClose()
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>
          {initialData ? 'Edit Partner' : 'Create New Partner'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('name', { required: 'Name is required' })}
                label="Name"
                fullWidth
                required
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('company_name')}
                label="Company Name"
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                {...register('description')}
                label="Description"
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('website')}
                label="Website"
                fullWidth
                type="url"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('contact_email')}
                label="Contact Email"
                fullWidth
                type="email"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('contact_phone')}
                label="Contact Phone"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select {...field} label="Status">
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <InputLabel>Capabilities</InputLabel>
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => appendCapability('')}
                >
                  Add
                </Button>
              </Box>
              {capabilityFields.map((field, index) => (
                <Box key={field.id} display="flex" gap={1} mb={1}>
                  <TextField
                    {...register(`capabilities.${index}` as const)}
                    fullWidth
                    size="small"
                    placeholder="Enter capability"
                  />
                  <Button
                    size="small"
                    color="error"
                    onClick={() => removeCapability(index)}
                  >
                    <Delete />
                  </Button>
                </Box>
              ))}
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <InputLabel>Contract Vehicles</InputLabel>
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => appendVehicle('')}
                >
                  Add
                </Button>
              </Box>
              {vehicleFields.map((field, index) => (
                <Box key={field.id} display="flex" gap={1} mb={1}>
                  <TextField
                    {...register(`contract_vehicles.${index}` as const)}
                    fullWidth
                    size="small"
                    placeholder="Enter contract vehicle"
                  />
                  <Button
                    size="small"
                    color="error"
                    onClick={() => removeVehicle(index)}
                  >
                    <Delete />
                  </Button>
                </Box>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button type="submit" variant="contained">
            {initialData ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

