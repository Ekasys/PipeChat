import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Button,
  IconButton,
} from '@mui/material'
import { Search, Clear } from '@mui/icons-material'

interface FilterOptions {
  search?: string
  organization_type?: string
  account_type?: string
  relationship_health?: string
  influence_level?: string
  relationship_strength?: string
  sort_by?: string
  sort_order?: string
}

interface SearchFilterBarProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  onClear: () => void
  type: 'account' | 'contact'
}

export default function SearchFilterBar({
  filters,
  onFiltersChange,
  onClear,
  type,
}: SearchFilterBarProps) {
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    onFiltersChange({ ...filters, [key]: value || undefined })
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            placeholder={`Search ${type === 'account' ? 'accounts' : 'contacts'}...`}
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              endAdornment: filters.search && (
                <IconButton
                  size="small"
                  onClick={() => handleFilterChange('search', '')}
                  sx={{ mr: -1 }}
                >
                  <Clear fontSize="small" />
                </IconButton>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'rgba(15, 23, 42, 0.5)',
              },
            }}
          />
        </Grid>

        {type === 'account' ? (
          <>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Organization Type</InputLabel>
                <Select
                  value={filters.organization_type || ''}
                  onChange={(e) => handleFilterChange('organization_type', e.target.value)}
                  label="Organization Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Federal">Federal</MenuItem>
                  <MenuItem value="State">State</MenuItem>
                  <MenuItem value="Local">Local</MenuItem>
                  <MenuItem value="Commercial">Commercial</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={filters.account_type || ''}
                  onChange={(e) => handleFilterChange('account_type', e.target.value)}
                  label="Account Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="customer">Customer</MenuItem>
                  <MenuItem value="teaming_partner">Teaming Partner</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Health Score</InputLabel>
                <Select
                  value={filters.relationship_health || ''}
                  onChange={(e) => handleFilterChange('relationship_health', e.target.value)}
                  label="Health Score"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Excellent">Excellent</MenuItem>
                  <MenuItem value="Good">Good</MenuItem>
                  <MenuItem value="Fair">Fair</MenuItem>
                  <MenuItem value="Poor">Poor</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Influence</InputLabel>
                <Select
                  value={filters.influence_level || ''}
                  onChange={(e) => handleFilterChange('influence_level', e.target.value)}
                  label="Influence"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Champion">Champion</MenuItem>
                  <MenuItem value="Influencer">Influencer</MenuItem>
                  <MenuItem value="Neutral">Neutral</MenuItem>
                  <MenuItem value="Blocker">Blocker</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Relationship</InputLabel>
                <Select
                  value={filters.relationship_strength || ''}
                  onChange={(e) => handleFilterChange('relationship_strength', e.target.value)}
                  label="Relationship"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Strong">Strong</MenuItem>
                  <MenuItem value="Moderate">Moderate</MenuItem>
                  <MenuItem value="Weak">Weak</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </>
        )}

        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Sort By</InputLabel>
            <Select
              value={filters.sort_by || 'created_at'}
              onChange={(e) => handleFilterChange('sort_by', e.target.value)}
              label="Sort By"
            >
              {type === 'account' ? (
                <>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="created_at">Created Date</MenuItem>
                  <MenuItem value="relationship_health_score">Health Score</MenuItem>
                </>
              ) : (
                <>
                  <MenuItem value="first_name">First Name</MenuItem>
                  <MenuItem value="last_name">Last Name</MenuItem>
                  <MenuItem value="created_at">Created Date</MenuItem>
                </>
              )}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Order</InputLabel>
            <Select
              value={filters.sort_order || 'desc'}
              onChange={(e) => handleFilterChange('sort_order', e.target.value)}
              label="Order"
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {(filters.search ||
          filters.organization_type ||
          filters.account_type ||
          filters.relationship_health ||
          filters.influence_level ||
          filters.relationship_strength) && (
          <Grid item xs={12} sm={6} md={1}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<Clear />}
              onClick={onClear}
            >
              Clear
            </Button>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
