import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material'
import { PTWScenario } from '../services/ptwService'
import { useState, useEffect } from 'react'

interface PTWComparisonDialogProps {
  open: boolean
  onClose: () => void
  scenarios: PTWScenario[]
  selectedScenario?: PTWScenario
  opportunityScenarios?: PTWScenario[] // Scenarios from the same opportunity
}

export default function PTWComparisonDialog({
  open,
  onClose,
  scenarios,
  selectedScenario,
  opportunityScenarios = [],
}: PTWComparisonDialogProps) {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([])

  useEffect(() => {
    if (selectedScenario) {
      // Default to selecting the clicked scenario and all others from the same opportunity
      const sameOpportunity = opportunityScenarios.length > 0 
        ? opportunityScenarios.filter(s => s.id !== selectedScenario.id)
        : scenarios.filter(s => s.opportunity_id === selectedScenario.opportunity_id && s.id !== selectedScenario.id)
      
      // Select the clicked scenario and up to 4 others from the same opportunity
      const toSelect = [selectedScenario.id, ...sameOpportunity.slice(0, 4).map(s => s.id)]
      setSelectedScenarios(toSelect)
    }
  }, [selectedScenario, opportunityScenarios, scenarios])

  if (!selectedScenario) return null

  const formatCurrency = (value?: number) => {
    if (!value) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value?: number) => {
    if (!value) return '0%'
    return `${value}%`
  }

  const getScenarioTypeColor = (type: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning'> = {
      base: 'primary',
      aggressive: 'error',
      conservative: 'warning',
      best_value: 'secondary',
    }
    return colors[type] || 'default'
  }

  // Helper function to check if a value differs from others in the array
  const isDifferent = (values: (number | string | undefined)[], index: number): boolean => {
    if (values.length <= 1) return false
    const value = values[index]
    if (value === undefined || value === null) return true
    // Check if this value is different from at least one other value
    return values.some((v, i) => i !== index && v !== undefined && v !== null && v !== value)
  }

  // Helper function to get background color for cells that differ
  const getDifferenceHighlight = (values: (number | string | undefined)[], index: number) => {
    if (isDifferent(values, index)) {
      return { backgroundColor: 'rgba(255, 193, 7, 0.2)' } // Light yellow/orange
    }
    return {}
  }

  // Get scenarios to compare - use opportunity scenarios if available, otherwise all scenarios
  const availableScenarios = opportunityScenarios.length > 0 
    ? opportunityScenarios 
    : scenarios.filter(s => s.opportunity_id === selectedScenario.opportunity_id || !selectedScenario.opportunity_id)
  
  // Get selected scenarios for comparison
  const allScenariosToCompare = availableScenarios.filter(s => selectedScenarios.includes(s.id))
  
  // If no scenarios selected, default to the clicked one
  if (allScenariosToCompare.length === 0 && selectedScenario) {
    allScenariosToCompare.push(selectedScenario)
  }

  const handleToggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    )
  }

  const handleSelectAll = () => {
    if (selectedScenarios.length === availableScenarios.length) {
      setSelectedScenarios([selectedScenario.id])
    } else {
      setSelectedScenarios(availableScenarios.map(s => s.id))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Scenario Comparison: {selectedScenario.name}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {availableScenarios.length > 1 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Select Scenarios to Compare
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedScenarios.length === availableScenarios.length}
                      indeterminate={selectedScenarios.length > 0 && selectedScenarios.length < availableScenarios.length}
                      onChange={handleSelectAll}
                    />
                  }
                  label="Select All"
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {availableScenarios.map((scenario) => (
                    <FormControlLabel
                      key={scenario.id}
                      control={
                        <Checkbox
                          checked={selectedScenarios.includes(scenario.id)}
                          onChange={() => handleToggleScenario(scenario.id)}
                        />
                      }
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">{scenario.name}</Typography>
                          <Chip
                            label={scenario.scenario_type}
                            size="small"
                            color={getScenarioTypeColor(scenario.scenario_type)}
                          />
                        </Box>
                      }
                    />
                  ))}
                </Box>
              </FormGroup>
            </Paper>
          )}
          
          {allScenariosToCompare.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                Select at least one scenario to compare
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
                  {allScenariosToCompare.map((scenario) => (
                    <TableCell key={scenario.id} align="center" sx={{ fontWeight: 700 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {scenario.name}
                        </Typography>
                        <Chip
                          label={scenario.scenario_type}
                          size="small"
                          color={getScenarioTypeColor(scenario.scenario_type)}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Total Labor Cost</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.total_labor_cost)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center"
                        sx={getDifferenceHighlight(values, index)}
                      >
                        {formatCurrency(scenario.total_labor_cost)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Direct Costs</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.direct_costs)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center"
                        sx={getDifferenceHighlight(values, index)}
                      >
                        {formatCurrency(scenario.direct_costs)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Indirect Costs</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.indirect_costs)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center"
                        sx={getDifferenceHighlight(values, index)}
                      >
                        {formatCurrency(scenario.indirect_costs)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow sx={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Total Cost</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.total_cost)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center" 
                        sx={{ 
                          fontWeight: 700,
                          ...getDifferenceHighlight(values, index)
                        }}
                      >
                        {formatCurrency(scenario.total_cost)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow sx={{ backgroundColor: 'rgba(99, 102, 241, 0.2)' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Total Price</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.total_price)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center" 
                        sx={{ 
                          fontWeight: 700, 
                          color: 'primary.main',
                          ...getDifferenceHighlight(values, index)
                        }}
                      >
                        {formatCurrency(scenario.total_price)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Overhead Rate</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.overhead_rate)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center"
                        sx={getDifferenceHighlight(values, index)}
                      >
                        {formatPercent(scenario.overhead_rate)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>G&A Rate</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.gaa_rate)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center"
                        sx={getDifferenceHighlight(values, index)}
                      >
                        {formatPercent(scenario.gaa_rate)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Fee Rate</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.fee_rate)
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center"
                        sx={getDifferenceHighlight(values, index)}
                      >
                        {formatPercent(scenario.fee_rate)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Competitive Position</TableCell>
                  {allScenariosToCompare.map((scenario, index) => {
                    const values = allScenariosToCompare.map(s => s.competitive_position || 'N/A')
                    return (
                      <TableCell 
                        key={scenario.id} 
                        align="center"
                        sx={getDifferenceHighlight(values, index)}
                      >
                        {scenario.competitive_position || 'N/A'}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
              </TableContainer>
          )}

          {selectedScenario.description && allScenariosToCompare.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedScenario.description}
              </Typography>
            </Box>
          )}

          {allScenariosToCompare.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Labor Categories Comparison
              </Typography>
              <TableContainer component={Paper} sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      {allScenariosToCompare.map((scenario) => (
                        <TableCell key={scenario.id} align="center" sx={{ fontWeight: 700 }}>
                          {scenario.name}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Get all unique categories across all scenarios */}
                    {(() => {
                      const allCategories = new Set<string>()
                      allScenariosToCompare.forEach(scenario => {
                        if (scenario.labor_categories) {
                          scenario.labor_categories.forEach(cat => {
                            if (cat.category) {
                              allCategories.add(cat.category)
                            }
                          })
                        }
                      })
                      
                      const uniqueCategories = Array.from(allCategories)
                      
                      if (uniqueCategories.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={allScenariosToCompare.length + 1} align="center" sx={{ py: 3 }}>
                              <Typography variant="body2" color="text.secondary">
                                No labor categories defined for selected scenarios.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )
                      }
                      
                      return uniqueCategories.map((categoryName) => {
                        // Get all rates, hours, and totals for this category across scenarios
                        const categoryData = allScenariosToCompare.map(scenario => {
                          const cat = scenario.labor_categories?.find(c => c.category === categoryName)
                          return cat ? { rate: cat.rate, hours: cat.hours, total: cat.rate * cat.hours } : null
                        })
                        
                        const rates = categoryData.map(d => d?.rate ?? undefined)
                        const hours = categoryData.map(d => d?.hours ?? undefined)
                        const totals = categoryData.map(d => d?.total ?? undefined)
                        
                        return (
                          <TableRow key={categoryName}>
                            <TableCell sx={{ fontWeight: 600 }}>{categoryName}</TableCell>
                            {allScenariosToCompare.map((scenario, index) => {
                              const category = scenario.labor_categories?.find(cat => cat.category === categoryName)
                              if (category) {
                                const total = category.rate * category.hours
                                // Check if this cell should be highlighted (if any field differs)
                                const cellHighlight = getDifferenceHighlight(rates, index).backgroundColor || 
                                                    getDifferenceHighlight(hours, index).backgroundColor ||
                                                    getDifferenceHighlight(totals, index).backgroundColor
                                
                                return (
                                  <TableCell 
                                    key={scenario.id} 
                                    align="center"
                                    sx={cellHighlight ? { backgroundColor: 'rgba(255, 193, 7, 0.1)' } : {}}
                                  >
                                    <Box>
                                      <Typography 
                                        variant="body2"
                                        sx={getDifferenceHighlight(rates, index)}
                                      >
                                        Rate: ${category.rate}/hr
                                      </Typography>
                                      <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={getDifferenceHighlight(hours, index)}
                                      >
                                        Hours: {category.hours.toLocaleString()}
                                      </Typography>
                                      <Typography 
                                        variant="body2" 
                                        sx={{ fontWeight: 600, mt: 0.5, ...getDifferenceHighlight(totals, index) }}
                                      >
                                        Total: {formatCurrency(total)}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                )
                              } else {
                                return (
                                  <TableCell 
                                    key={scenario.id} 
                                    align="center"
                                    sx={{ backgroundColor: 'rgba(244, 67, 54, 0.1)' }}
                                  >
                                    <Typography variant="body2" color="text.secondary">
                                      N/A
                                    </Typography>
                                  </TableCell>
                                )
                              }
                            })}
                          </TableRow>
                        )
                      })
                    })()}
                    
                    {/* Summary row with totals */}
                    <TableRow sx={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', borderTop: 2 }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total Labor Cost</TableCell>
                      {allScenariosToCompare.map((scenario) => (
                        <TableCell key={scenario.id} align="center" sx={{ fontWeight: 700 }}>
                          {formatCurrency(scenario.total_labor_cost)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

