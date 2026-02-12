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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  Box,
} from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { Opportunity } from '../services/opportunityService'
import { LaborCategory } from '../services/ptwService'

interface PTWScenarioFormData {
  name: string
  opportunity_id?: string
  scenario_type: string
  description?: string
  labor_categories: LaborCategory[]
  overhead_rate: number
  gaa_rate: number
  fee_rate: number
}

interface PTWScenarioFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: PTWScenarioFormData) => void
  initialData?: Partial<PTWScenarioFormData>
  opportunities?: Opportunity[]
  laborCategories?: LaborCategory[]
  rates?: { overhead: number; gaa: number; fee: number }
}

export default function PTWScenarioForm({
  open,
  onClose,
  onSubmit,
  initialData,
  opportunities = [],
  laborCategories = [],
  rates = { overhead: 20, gaa: 10, fee: 5 },
}: PTWScenarioFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<PTWScenarioFormData>({
    defaultValues: initialData || {
      scenario_type: 'base',
      labor_categories: laborCategories.length > 0 ? laborCategories : [],
      overhead_rate: rates.overhead,
      gaa_rate: rates.gaa,
      fee_rate: rates.fee,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'labor_categories',
  })

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        // When editing, use the initialData which contains the scenario's data
        const categories = initialData.labor_categories && initialData.labor_categories.length > 0
          ? initialData.labor_categories
          : []
        reset({
          name: initialData.name || '',
          opportunity_id: initialData.opportunity_id || '',
          scenario_type: initialData.scenario_type || 'base',
          description: initialData.description || '',
          labor_categories: categories,
          overhead_rate: initialData.overhead_rate ?? rates.overhead,
          gaa_rate: initialData.gaa_rate ?? rates.gaa,
          fee_rate: initialData.fee_rate ?? rates.fee,
        })
      } else {
        // When creating new, use current builder state or empty array
        reset({
          scenario_type: 'base',
          labor_categories: laborCategories.length > 0 ? laborCategories : [],
          overhead_rate: rates.overhead,
          gaa_rate: rates.gaa,
          fee_rate: rates.fee,
        })
      }
    }
  }, [open, initialData, reset, laborCategories, rates])

  const handleFormSubmit = async (data: PTWScenarioFormData) => {
    await onSubmit(data)
    reset()
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initialData ? 'Edit Scenario' : 'Create New PTW Scenario'}
      </DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Scenario Name"
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
              <FormControl fullWidth>
                <InputLabel>Opportunity (Optional)</InputLabel>
                <Controller
                  name="opportunity_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Opportunity (Optional)"
                      sx={{
                        background: 'rgba(15, 23, 42, 0.5)',
                      }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {opportunities.map((opp) => (
                        <MenuItem key={opp.id} value={opp.id}>
                          {opp.name}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Scenario Type</InputLabel>
                <Controller
                  name="scenario_type"
                  control={control}
                  rules={{ required: 'Scenario type is required' }}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Scenario Type"
                      sx={{
                        background: 'rgba(15, 23, 42, 0.5)',
                      }}
                    >
                      <MenuItem value="base">Base</MenuItem>
                      <MenuItem value="aggressive">Aggressive</MenuItem>
                      <MenuItem value="conservative">Conservative</MenuItem>
                      <MenuItem value="best_value">Best Value</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                {...register('description')}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Overhead Rate (%)"
                type="number"
                {...register('overhead_rate', { valueAsNumber: true, min: 0 })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="G&A Rate (%)"
                type="number"
                {...register('gaa_rate', { valueAsNumber: true, min: 0 })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Fee Rate (%)"
                type="number"
                {...register('fee_rate', { valueAsNumber: true, min: 0 })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(15, 23, 42, 0.5)',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
                Labor Categories
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Rate ($/hr)</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            No labor categories. Click "Add Category" to add one.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              {...register(`labor_categories.${index}.category` as const)}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  background: 'rgba(15, 23, 42, 0.5)',
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              {...register(`labor_categories.${index}.rate` as const, { valueAsNumber: true })}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  background: 'rgba(15, 23, 42, 0.5)',
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              {...register(`labor_categories.${index}.hours` as const, { valueAsNumber: true })}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  background: 'rgba(15, 23, 42, 0.5)',
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              ${((watch(`labor_categories.${index}.rate`) || 0) * (watch(`labor_categories.${index}.hours`) || 0)).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => remove(index)}
                              sx={{
                                '&:hover': {
                                  background: 'rgba(244, 67, 54, 0.2)',
                                },
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => append({ category: '', rate: 0, hours: 0 })}
                size="small"
              >
                Add Category
              </Button>
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

