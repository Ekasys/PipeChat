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
import { useForm, Controller } from 'react-hook-form'
import { useState, useEffect } from 'react'

interface AccountFormData {
  name: string
  agency?: string
  organization_type?: string
  account_type?: string
  relationship_health_score?: string
  website?: string
  address?: string
  phone?: string
  naics_codes?: string[]
  contract_vehicles?: string[]
  notes?: string
}

interface AccountFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: AccountFormData) => void
  initialData?: Partial<AccountFormData>
}

export default function AccountForm({
  open,
  onClose,
  onSubmit,
  initialData,
}: AccountFormProps) {
  const [naicsCodes, setNaicsCodes] = useState<string[]>(initialData?.naics_codes || [])
  const [naicsInput, setNaicsInput] = useState('')
  const [contractVehicles, setContractVehicles] = useState<string[]>(initialData?.contract_vehicles || [])
  const [vehicleInput, setVehicleInput] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    setValue,
  } = useForm<AccountFormData>({
    defaultValues: initialData || {},
  })

  useEffect(() => {
    if (open) {
      if (initialData) {
        reset(initialData)
        setNaicsCodes(initialData.naics_codes || [])
        setContractVehicles(initialData.contract_vehicles || [])
      } else {
        reset({
          name: '',
          agency: '',
          organization_type: '',
          relationship_health_score: '',
          website: '',
          address: '',
          phone: '',
          notes: '',
        })
        setNaicsCodes([])
        setContractVehicles([])
      }
    }
  }, [open, initialData, reset])

  const handleFormSubmit = (data: AccountFormData) => {
    const submitData = {
      ...data,
      naics_codes: naicsCodes.length > 0 ? naicsCodes : undefined,
      contract_vehicles: contractVehicles.length > 0 ? contractVehicles : undefined,
    }
    onSubmit(submitData)
    reset()
    setNaicsCodes([])
    setContractVehicles([])
    onClose()
  }

  const handleCancel = () => {
    reset()
    setNaicsCodes([])
    setContractVehicles([])
    onClose()
  }

  const handleAddNaicsCode = () => {
    if (naicsInput.trim() && !naicsCodes.includes(naicsInput.trim())) {
      setNaicsCodes([...naicsCodes, naicsInput.trim()])
      setNaicsInput('')
    }
  }

  const handleRemoveNaicsCode = (code: string) => {
    setNaicsCodes(naicsCodes.filter((c) => c !== code))
  }

  const handleAddVehicle = () => {
    if (vehicleInput.trim() && !contractVehicles.includes(vehicleInput.trim())) {
      setContractVehicles([...contractVehicles, vehicleInput.trim()])
      setVehicleInput('')
    }
  }

  const handleRemoveVehicle = (vehicle: string) => {
    setContractVehicles(contractVehicles.filter((v) => v !== vehicle))
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initialData ? 'Edit Account' : 'Create New Account'}
      </DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Account Name"
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
              <TextField
                fullWidth
                label="Agency"
                {...register('agency')}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Organization Type</InputLabel>
                <Controller
                  name="organization_type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Organization Type"
                      sx={{
                        background: 'rgba(15, 23, 42, 0.5)',
                      }}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="Federal">Federal</MenuItem>
                      <MenuItem value="State">State</MenuItem>
                      <MenuItem value="Local">Local</MenuItem>
                      <MenuItem value="Commercial">Commercial</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Controller
                  name="account_type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Account Type"
                      sx={{
                        background: 'rgba(15, 23, 42, 0.5)',
                      }}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="customer">Customer</MenuItem>
                      <MenuItem value="teaming_partner">Teaming Partner</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                type="url"
                {...register('website', {
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL',
                  },
                })}
                error={!!errors.website}
                helperText={errors.website?.message}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                {...register('phone')}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                {...register('address')}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box>
                <TextField
                  fullWidth
                  size="small"
                  label="NAICS Codes"
                  value={naicsInput}
                  onChange={(e) => setNaicsInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddNaicsCode()
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <Button size="small" onClick={handleAddNaicsCode}>
                        Add
                      </Button>
                    ),
                  }}
                  sx={{
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(15, 23, 42, 0.5)',
                    },
                  }}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {naicsCodes.map((code) => (
                    <Chip
                      key={code}
                      label={code}
                      onDelete={() => handleRemoveNaicsCode(code)}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box>
                <TextField
                  fullWidth
                  size="small"
                  label="Contract Vehicles"
                  value={vehicleInput}
                  onChange={(e) => setVehicleInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddVehicle()
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <Button size="small" onClick={handleAddVehicle}>
                        Add
                      </Button>
                    ),
                  }}
                  sx={{
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(15, 23, 42, 0.5)',
                    },
                  }}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {contractVehicles.map((vehicle) => (
                    <Chip
                      key={vehicle}
                      label={vehicle}
                      onDelete={() => handleRemoveVehicle(vehicle)}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Relationship Health</InputLabel>
                <Controller
                  name="relationship_health_score"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Relationship Health"
                      sx={{
                        background: 'rgba(15, 23, 42, 0.5)',
                      }}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="Excellent">Excellent</MenuItem>
                      <MenuItem value="Good">Good</MenuItem>
                      <MenuItem value="Fair">Fair</MenuItem>
                      <MenuItem value="Poor">Poor</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={4}
                {...register('notes')}
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

