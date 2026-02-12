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
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { useEffect } from 'react'

interface ContactFormData {
  id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  title?: string
  department?: string
  influence_level?: string
  relationship_strength?: string
  account_id?: string
  manager_id?: string
  notes?: string
}

interface ContactFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: ContactFormData) => void
  initialData?: Partial<ContactFormData>
  accounts?: Array<{ id: string; name: string }>
  contacts?: Array<{ id: string; first_name: string; last_name: string; account_id?: string }>
}

export default function ContactForm({
  open,
  onClose,
  onSubmit,
  initialData,
  accounts = [],
  contacts = [],
}: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<ContactFormData>({
    defaultValues: initialData,
  })

  // Watch account_id to filter managers
  const selectedAccountId = watch('account_id')

  useEffect(() => {
    if (open) {
      if (initialData) {
        reset(initialData)
      } else {
        reset({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          title: '',
          influence_level: '',
          account_id: '',
        })
      }
    }
  }, [open, initialData, reset])

  const handleFormSubmit = (data: ContactFormData) => {
    onSubmit(data)
    reset()
    onClose()
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>
          {initialData ? 'Edit Contact' : 'Create New Contact'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('first_name', { required: 'First name is required' })}
                label="First Name"
                fullWidth
                required
                error={!!errors.first_name}
                helperText={errors.first_name?.message}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('last_name', { required: 'Last name is required' })}
                label="Last Name"
                fullWidth
                required
                error={!!errors.last_name}
                helperText={errors.last_name?.message}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                {...register('email', {
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                label="Email"
                type="email"
                fullWidth
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                {...register('phone')}
                label="Phone"
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                {...register('title')}
                label="Title"
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                {...register('department')}
                label="Department"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="influence_level"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Influence Level</InputLabel>
                    <Select {...field} label="Influence Level">
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="Champion">Champion</MenuItem>
                      <MenuItem value="Influencer">Influencer</MenuItem>
                      <MenuItem value="Neutral">Neutral</MenuItem>
                      <MenuItem value="Blocker">Blocker</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="relationship_strength"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Relationship Strength</InputLabel>
                    <Select {...field} label="Relationship Strength">
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="Strong">Strong</MenuItem>
                      <MenuItem value="Moderate">Moderate</MenuItem>
                      <MenuItem value="Weak">Weak</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            {accounts.length > 0 && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="account_id"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Account</InputLabel>
                      <Select {...field} label="Account">
                        <MenuItem value="">None</MenuItem>
                        {accounts.map((account) => (
                          <MenuItem key={account.id} value={account.id}>
                            {account.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            )}
            {contacts.length > 0 && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="manager_id"
                  control={control}
                  render={({ field }) => {
                    // Filter contacts by selected account (or initial account if editing)
                    const accountIdToFilter = selectedAccountId || initialData?.account_id
                    const filteredContacts = contacts.filter((c) => {
                      if (c.id === initialData?.id) return false // Don't show self
                      if (accountIdToFilter) {
                        return c.account_id === accountIdToFilter
                      }
                      return false // If no account selected, show no managers
                    })

                    return (
                      <FormControl fullWidth>
                        <InputLabel>Manager</InputLabel>
                        <Select {...field} label="Manager" disabled={!accountIdToFilter}>
                          <MenuItem value="">None</MenuItem>
                          {filteredContacts.map((contact) => (
                            <MenuItem key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )
                  }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                {...register('notes')}
                label="Notes"
                multiline
                rows={4}
                fullWidth
              />
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

