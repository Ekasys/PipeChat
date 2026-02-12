import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import api from '../services/api'
import { useToast } from '../hooks/useToast'

interface User {
  id?: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  role: string
  is_active: boolean
}

interface UserFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user?: User | null
}

export default function UserForm({ open, onClose, onSuccess, user }: UserFormProps) {
  const { toast, showToast, hideToast } = useToast()
  const [loading, setLoading] = useState(false)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<User>({
    defaultValues: {
      email: '',
      username: '',
      first_name: '',
      last_name: '',
      role: 'analyst',
      is_active: true,
    },
  })

  useEffect(() => {
    if (user) {
      reset({
        email: user.email || '',
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.role || 'analyst',
        is_active: user.is_active !== undefined ? user.is_active : true,
      })
    } else {
      reset({
        email: '',
        username: '',
        first_name: '',
        last_name: '',
        role: 'analyst',
        is_active: true,
      })
    }
  }, [user, reset, open])

  const onSubmit = async (data: User) => {
    try {
      setLoading(true)
      if (user?.id) {
        // Update existing user
        await api.put(`/admin/users/${user.id}`, data)
        showToast('User updated successfully', 'success')
      } else {
        // Create new user - backend will generate a temporary password if omitted
        const response = await api.post('/admin/users', data)
        const tempPassword = response.data?.temp_password
        if (tempPassword) {
          window.prompt('Temporary password (copy this now):', tempPassword)
        }
        showToast('User created successfully', 'success')
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Failed to save user:', error)
      const errorMsg =
        error.response?.data?.detail || error.message || 'Failed to save user'
      showToast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
        <DialogContent>
          {!user && (
            <Alert severity="info" sx={{ mb: 2 }}>
              A temporary password will be generated. The user will be required to change it on first login.
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="first_name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="First Name"
                    fullWidth
                    error={!!errors.first_name}
                    helperText={errors.first_name?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="last_name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Last Name"
                    fullWidth
                    error={!!errors.last_name}
                    helperText={errors.last_name?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email"
                    type="email"
                    fullWidth
                    required
                    error={!!errors.email}
                    helperText={errors.email?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="username"
                control={control}
                rules={{
                  required: 'Username is required',
                  minLength: {
                    value: 3,
                    message: 'Username must be at least 3 characters',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Username"
                    fullWidth
                    required
                    error={!!errors.username}
                    helperText={errors.username?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="role"
                control={control}
                rules={{ required: 'Role is required' }}
                render={({ field }) => (
                  <FormControl fullWidth required error={!!errors.role}>
                    <InputLabel>Role</InputLabel>
                    <Select {...field} label="Role">
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="capture">Capture Manager</MenuItem>
                      <MenuItem value="proposal">Proposal Manager</MenuItem>
                      <MenuItem value="analyst">Analyst</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                        color="primary"
                      />
                    }
                    label="Active"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Saving...' : user ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

