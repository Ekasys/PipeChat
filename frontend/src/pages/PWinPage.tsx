import { useState } from 'react'
import {
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Slider,
  Button,
  Card,
  CardContent,
} from '@mui/material'
import { Calculate } from '@mui/icons-material'

export default function PWinPage() {
  const [scores, setScores] = useState({
    customer: 50,
    technical: 50,
    performance: 50,
    price: 50,
  })
  const [weights, setWeights] = useState({
    customer: 25,
    technical: 30,
    performance: 25,
    price: 20,
  })
  const [calculatedPWin, setCalculatedPWin] = useState<number | null>(null)

  const calculatePWin = () => {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
    if (totalWeight === 0) return

    const normalizedWeights = {
      customer: weights.customer / totalWeight,
      technical: weights.technical / totalWeight,
      performance: weights.performance / totalWeight,
      price: weights.price / totalWeight,
    }

    const pwin =
      scores.customer * normalizedWeights.customer +
      scores.technical * normalizedWeights.technical +
      scores.performance * normalizedWeights.performance +
      scores.price * normalizedWeights.price

    setCalculatedPWin(Math.round(pwin * 100) / 100)
  }

  return (
    <Box className="fade-in">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, mb: 4 }}>
        PWin Calculator
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scoring Components
            </Typography>

            {(['customer', 'technical', 'performance', 'price'] as const).map((component) => (
              <Box key={component} mb={3}>
                <Typography gutterBottom>
                  {component.charAt(0).toUpperCase() + component.slice(1)} Score
                </Typography>
                <Slider
                  value={scores[component]}
                  onChange={(_, value) => setScores({ ...scores, [component]: value as number })}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' },
                  ]}
                />
                <TextField
                  type="number"
                  value={scores[component]}
                  onChange={(e) =>
                    setScores({ ...scores, [component]: parseInt(e.target.value) || 0 })
                  }
                  inputProps={{ min: 0, max: 100 }}
                  size="small"
                  sx={{ mt: 1, width: 100 }}
                />
              </Box>
            ))}

            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              Weights (%)
            </Typography>

            {(['customer', 'technical', 'performance', 'price'] as const).map((component) => (
              <Box key={component} mb={2}>
                <Typography gutterBottom>
                  {component.charAt(0).toUpperCase() + component.slice(1)} Weight
                </Typography>
                <Slider
                  value={weights[component]}
                  onChange={(_, value) => setWeights({ ...weights, [component]: value as number })}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                />
                <TextField
                  type="number"
                  value={weights[component]}
                  onChange={(e) =>
                    setWeights({ ...weights, [component]: parseInt(e.target.value) || 0 })
                  }
                  inputProps={{ min: 0, max: 100 }}
                  size="small"
                  sx={{ mt: 1, width: 100 }}
                />
              </Box>
            ))}

            <Button
              variant="contained"
              startIcon={<Calculate />}
              onClick={calculatePWin}
              size="large"
              sx={{ mt: 3 }}
            >
              Calculate PWin
            </Button>
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
                Calculated PWin
              </Typography>
              {calculatedPWin !== null ? (
                <Typography 
                  variant="h2"
                  sx={{
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {calculatedPWin}%
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
                  Click "Calculate PWin" to see results
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

