import { useState, useEffect } from 'react'
import React from 'react'
import {
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material'
import { Add, Compare, Calculate, Edit, Delete, ExpandMore, Business } from '@mui/icons-material'
import { ptwService, PTWScenario, LaborCategory } from '../services/ptwService'
import { opportunityService, Opportunity } from '../services/opportunityService'
import PTWScenarioForm from '../components/PTWScenarioForm'
import PTWComparisonDialog from '../components/PTWComparisonDialog'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PTWPage() {
  const [tabValue, setTabValue] = useState(0)
  const [scenarios, setScenarios] = useState<PTWScenario[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [openComparisonDialog, setOpenComparisonDialog] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<PTWScenario | null>(null)
  const [comparisonScenario, setComparisonScenario] = useState<PTWScenario | null>(null)
  const [laborCategories, setLaborCategories] = useState<LaborCategory[]>([
    { category: 'Senior Engineer', rate: 150, hours: 1000 },
    { category: 'Mid Engineer', rate: 120, hours: 2000 },
    { category: 'Junior Engineer', rate: 90, hours: 1500 },
  ])
  const [rates, setRates] = useState({
    overhead: 20,
    gaa: 10,
    fee: 5,
  })
  const { toast, showToast, hideToast } = useToast()

  useEffect(() => {
    loadOpportunities()
  }, [])

  useEffect(() => {
    if (tabValue === 1) {
      loadScenarios()
    }
  }, [tabValue])

  const loadOpportunities = async () => {
    try {
      const data = await opportunityService.list({ limit: 100 })
      setOpportunities(data.opportunities)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
    }
  }

  const loadScenarios = async () => {
    try {
      setLoading(true)
      const data = await ptwService.list()
      setScenarios(data.scenarios || [])
    } catch (error: any) {
      console.error('Failed to load scenarios:', error)
      console.error('Error response:', error.response)
      console.error('Error data:', error.response?.data)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load scenarios'
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Group scenarios by opportunity
  const groupedScenarios = React.useMemo(() => {
    const grouped: Record<string, { opportunity: Opportunity | null; scenarios: PTWScenario[] }> = {}
    const ungrouped: PTWScenario[] = []

    scenarios.forEach((scenario) => {
      if (scenario.opportunity_id) {
        if (!grouped[scenario.opportunity_id]) {
          const opp = opportunities.find(o => o.id === scenario.opportunity_id)
          grouped[scenario.opportunity_id] = {
            opportunity: opp || null,
            scenarios: []
          }
        }
        grouped[scenario.opportunity_id].scenarios.push(scenario)
      } else {
        ungrouped.push(scenario)
      }
    })

    // Add ungrouped scenarios to a special group
    if (ungrouped.length > 0) {
      grouped['_ungrouped'] = {
        opportunity: null,
        scenarios: ungrouped
      }
    }

    return grouped
  }, [scenarios, opportunities])

  const calculateTotals = () => {
    const totalLabor = laborCategories.reduce((sum, cat) => sum + (cat.rate * cat.hours), 0)
    const overhead = totalLabor * (rates.overhead / 100)
    const gaaBase = totalLabor + overhead
    const gaa = gaaBase * (rates.gaa / 100)
    const costBase = gaaBase + gaa
    const fee = costBase * (rates.fee / 100)
    const totalCost = costBase + fee
    return { totalLabor, overhead, gaa, fee, totalCost }
  }

  const totals = calculateTotals()

  const handleSaveScenario = async () => {
    try {
      if (laborCategories.length === 0) {
        showToast('Add at least one labor category', 'error')
        return
      }
      
      const scenarioData = {
        name: `Scenario ${scenarios.length + 1}`,
        scenario_type: 'base',
        labor_categories: laborCategories,
        overhead_rate: rates.overhead,
        gaa_rate: rates.gaa,
        fee_rate: rates.fee,
      }
      
      await ptwService.create(scenarioData)
      showToast('Scenario saved successfully', 'success')
      setOpenDialog(false)
      // Reload scenarios if viewing comparison tab
      if (tabValue === 1) {
        // Would need opportunity_id to reload
      }
    } catch (error: any) {
      console.error('Failed to save scenario:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save scenario'
      showToast(errorMessage, 'error')
    }
  }

  const handleCreateScenario = async (data: any) => {
    try {
      // Use labor categories from the form data (data.labor_categories)
      // This ensures we're using what the user entered in the form
      const scenarioData = {
        ...data,
        labor_categories: data.labor_categories || [],
      }
      
      await ptwService.create(scenarioData)
      showToast('Scenario created successfully', 'success')
      setOpenDialog(false)
      setSelectedScenario(null)
      // Reload scenarios if on comparison tab
      if (tabValue === 1) {
        loadScenarios()
      }
    } catch (error: any) {
      console.error('Failed to create scenario:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create scenario'
      showToast(errorMessage, 'error')
    }
  }

  const handleUpdateScenario = async (data: any) => {
    if (!selectedScenario) return
    
    try {
      // Use labor categories from the form data (data.labor_categories)
      // This ensures we're using what the user edited in the form
      const scenarioData = {
        ...data,
        labor_categories: data.labor_categories || [],
      }
      
      await ptwService.update(selectedScenario.id, scenarioData)
      showToast('Scenario updated successfully', 'success')
      setOpenDialog(false)
      setSelectedScenario(null)
      // Reload scenarios
      if (tabValue === 1) {
        loadScenarios()
      }
    } catch (error: any) {
      console.error('Failed to update scenario:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update scenario'
      showToast(errorMessage, 'error')
    }
  }

  const handleEditClick = async (scenario: PTWScenario) => {
    try {
      // Fetch full scenario details
      const fullScenario = await ptwService.get(scenario.id)
      setSelectedScenario(fullScenario)
      
      // Always update labor categories and rates from the scenario being edited
      // This ensures each scenario shows its own data
      if (fullScenario.labor_categories && fullScenario.labor_categories.length > 0) {
        setLaborCategories([...fullScenario.labor_categories])
      } else {
        setLaborCategories([])
      }
      
      if (fullScenario.overhead_rate !== undefined) {
        setRates(prev => ({ ...prev, overhead: fullScenario.overhead_rate }))
      }
      if (fullScenario.gaa_rate !== undefined) {
        setRates(prev => ({ ...prev, gaa: fullScenario.gaa_rate }))
      }
      if (fullScenario.fee_rate !== undefined) {
        setRates(prev => ({ ...prev, fee: fullScenario.fee_rate }))
      }
      
      setOpenDialog(true)
    } catch (error: any) {
      console.error('Failed to load scenario:', error)
      // Fallback to using the scenario from the list
      setSelectedScenario(scenario)
      if (scenario.labor_categories && scenario.labor_categories.length > 0) {
        setLaborCategories([...scenario.labor_categories])
      }
      setOpenDialog(true)
    }
  }

  const handleCompare = async (scenario: PTWScenario) => {
    try {
      // Fetch full scenario details to ensure we have all fields
      const fullScenario = await ptwService.get(scenario.id)
      setComparisonScenario(fullScenario)
      setOpenComparisonDialog(true)
    } catch (error: any) {
      console.error('Failed to load scenario details:', error)
      // Fallback to using the scenario from the list
      setComparisonScenario(scenario)
      setOpenComparisonDialog(true)
    }
  }

  // Get scenarios from the same opportunity for comparison
  const getOpportunityScenarios = (scenario: PTWScenario): PTWScenario[] => {
    if (!scenario.opportunity_id) {
      // If no opportunity, return all ungrouped scenarios
      return scenarios.filter(s => !s.opportunity_id)
    }
    // Return all scenarios from the same opportunity
    return scenarios.filter(s => s.opportunity_id === scenario.opportunity_id)
  }

  return (
    <Box className="fade-in">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Price-to-Win</Typography>
        <Button 
          variant="contained" 
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
        >
          New Scenario
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Build Scenario" />
          <Tab label="Compare Scenarios" />
        </Tabs>
      </Paper>

      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Labor Categories
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Rate ($/hr)</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {laborCategories.map((cat, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <TextField
                            size="small"
                            value={cat.category}
                            onChange={(e) => {
                              const updated = [...laborCategories]
                              updated[index].category = e.target.value
                              setLaborCategories(updated)
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={cat.rate}
                            onChange={(e) => {
                              const updated = [...laborCategories]
                              updated[index].rate = parseFloat(e.target.value) || 0
                              setLaborCategories(updated)
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={cat.hours}
                            onChange={(e) => {
                              const updated = [...laborCategories]
                              updated[index].hours = parseFloat(e.target.value) || 0
                              setLaborCategories(updated)
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          ${(cat.rate * cat.hours).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => {
                  setLaborCategories([...laborCategories, { category: '', rate: 0, hours: 0 }])
                }}
                sx={{ mt: 2 }}
              >
                Add Category
              </Button>
            </Paper>

            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Indirect Rates
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Overhead Rate (%)"
                    type="number"
                    value={rates.overhead}
                    onChange={(e) => setRates({ ...rates, overhead: parseFloat(e.target.value) || 0 })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="G&A Rate (%)"
                    type="number"
                    value={rates.gaa}
                    onChange={(e) => setRates({ ...rates, gaa: parseFloat(e.target.value) || 0 })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Fee Rate (%)"
                    type="number"
                    value={rates.fee}
                    onChange={(e) => setRates({ ...rates, fee: parseFloat(e.target.value) || 0 })}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  Cost Breakdown
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Labor
                  </Typography>
                  <Typography variant="h6">
                    ${totals.totalLabor.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Overhead ({rates.overhead}%)
                  </Typography>
                  <Typography variant="h6">
                    ${totals.overhead.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    G&A ({rates.gaa}%)
                  </Typography>
                  <Typography variant="h6">
                    ${totals.gaa.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Fee ({rates.fee}%)
                  </Typography>
                  <Typography variant="h6">
                    ${totals.fee.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ mt: 3, pt: 2, borderTop: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Price
                  </Typography>
                  <Typography variant="h4" color="primary">
                    ${totals.totalCost.toLocaleString()}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Calculate />}
                  sx={{ mt: 2 }}
                  onClick={() => setOpenDialog(true)}
                >
                  Save Scenario
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" gutterBottom>
              Scenario Comparison
            </Typography>
            <Button 
              variant="outlined" 
              size="small"
              onClick={loadScenarios}
            >
              Refresh
            </Button>
          </Box>
          {loading ? (
            <LoadingSpinner message="Loading scenarios..." />
          ) : Object.keys(groupedScenarios).length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                No scenarios to compare. Create scenarios first.
              </Typography>
            </Box>
          ) : (
            <Box>
              {Object.entries(groupedScenarios).map(([opportunityId, group]) => (
                <Accordion key={opportunityId} defaultExpanded sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box display="flex" alignItems="center" gap={2} width="100%">
                      <Business color="primary" />
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {group.opportunity ? group.opportunity.name : 'Ungrouped Scenarios'}
                      </Typography>
                      <Chip 
                        label={`${group.scenarios.length} scenario${group.scenarios.length !== 1 ? 's' : ''}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Scenario</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Total Price</TableCell>
                            <TableCell>Total Cost</TableCell>
                            <TableCell>Competitive Position</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {group.scenarios.map((scenario) => (
                            <TableRow key={scenario.id}>
                              <TableCell>{scenario.name}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={scenario.scenario_type} 
                                  size="small" 
                                  color={scenario.scenario_type === 'aggressive' ? 'error' : scenario.scenario_type === 'conservative' ? 'warning' : 'primary'}
                                />
                              </TableCell>
                              <TableCell>${scenario.total_price?.toLocaleString() || '0'}</TableCell>
                              <TableCell>${scenario.total_cost?.toLocaleString() || '0'}</TableCell>
                              <TableCell>{scenario.competitive_position || 'N/A'}</TableCell>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditClick(scenario)}
                                  sx={{
                                    '&:hover': {
                                      background: 'rgba(99, 102, 241, 0.2)',
                                    },
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <Button 
                                  size="small" 
                                  startIcon={<Compare />}
                                  onClick={() => handleCompare(scenario)}
                                  sx={{ ml: 1 }}
                                >
                                  Compare
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </Paper>
      )}

      <PTWScenarioForm
        open={openDialog}
        onClose={() => {
          setOpenDialog(false)
          setSelectedScenario(null)
        }}
        onSubmit={selectedScenario ? handleUpdateScenario : handleCreateScenario}
        initialData={selectedScenario ? {
          name: selectedScenario.name,
          opportunity_id: selectedScenario.opportunity_id,
          scenario_type: selectedScenario.scenario_type,
          description: selectedScenario.description,
          labor_categories: selectedScenario.labor_categories || [],
          overhead_rate: selectedScenario.overhead_rate || rates.overhead,
          gaa_rate: selectedScenario.gaa_rate || rates.gaa,
          fee_rate: selectedScenario.fee_rate || rates.fee,
        } : undefined}
        opportunities={opportunities}
        laborCategories={selectedScenario?.labor_categories || laborCategories}
        rates={selectedScenario ? {
          overhead: selectedScenario.overhead_rate || rates.overhead,
          gaa: selectedScenario.gaa_rate || rates.gaa,
          fee: selectedScenario.fee_rate || rates.fee,
        } : rates}
      />
      <PTWComparisonDialog
        open={openComparisonDialog}
        onClose={() => {
          setOpenComparisonDialog(false)
          setComparisonScenario(null)
        }}
        scenarios={scenarios}
        selectedScenario={comparisonScenario || undefined}
        opportunityScenarios={comparisonScenario ? getOpportunityScenarios(comparisonScenario) : []}
      />
      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={hideToast}
      />
    </Box>
  )
}

