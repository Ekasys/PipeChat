import { ReactNode, useMemo } from 'react'
import {
  Box,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import { alpha } from '@mui/material/styles'

export interface FlowStep {
  value: string
  label: string
  description?: string
  icon: ReactNode
  accentColor: string
}

export interface FinalState {
  label: string
  color: string
  icon: ReactNode
}

interface FlowStepperProps {
  steps: FlowStep[]
  current: string
  onStepChange?: (value: string) => void
  loading?: boolean
  finalStates?: Record<string, FinalState>
}

export default function FlowStepper({
  steps,
  current,
  onStepChange,
  loading = false,
  finalStates,
}: FlowStepperProps) {
  const stepColumns = steps.length * 2 - 1

  const { activeIndex, isFinalState, finalState } = useMemo(() => {
    const index = steps.findIndex(step => step.value === current)
    if (index !== -1) {
      return { activeIndex: index, isFinalState: false, finalState: undefined }
    }

    const finalStateEntry = finalStates?.[current]
    if (finalStateEntry) {
      return { activeIndex: steps.length - 1, isFinalState: true, finalState: finalStateEntry }
    }

    return { activeIndex: 0, isFinalState: false, finalState: undefined }
  }, [current, finalStates, steps])

  return (
    <Box
      sx={{
        position: 'relative',
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.55) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.35)',
        overflow: 'hidden',
      }}
    >
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 2,
            backdropFilter: 'blur(4px)',
          }}
        >
          <CircularProgress color="primary" size={32} />
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${stepColumns}, 1fr)`,
          alignItems: 'center',
          gap: { xs: 1.5, md: 2.5 },
        }}
      >
        {steps.map((step, index) => {
          const gridColumn = index * 2 + 1
          const completed = activeIndex > index
          const active = activeIndex === index && !isFinalState
          const accented = active || completed || (isFinalState && index === steps.length - 1)

          const handleClick = () => {
            if (loading || !onStepChange) return
            if (step.value === current) return
            onStepChange(step.value)
          }

          const circleBackground = accented
            ? `linear-gradient(135deg, ${alpha(step.accentColor, 0.95)} 0%, ${alpha(
                step.accentColor,
                0.65
              )} 100%)`
            : 'rgba(15, 23, 42, 0.55)'

          const circleBorder = accented
            ? `1px solid ${alpha(step.accentColor, 0.8)}`
            : '1px solid rgba(148, 163, 184, 0.3)'

          const circleShadow = accented
            ? `0 12px 24px ${alpha(step.accentColor, 0.4)}`
            : '0 6px 14px rgba(15, 23, 42, 0.35)'

          const connectorColumn = gridColumn + 1
          const nextStep = steps[index + 1]

          return (
            <Box
              key={step.value}
              sx={{
                gridColumn,
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Tooltip title={step.description || step.label} enterDelay={200}>
                <Box
                  role={onStepChange ? 'button' : undefined}
                  tabIndex={onStepChange ? 0 : undefined}
                  onClick={handleClick}
                  onKeyPress={(e) => {
                    if (onStepChange && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      handleClick()
                    }
                  }}
                  sx={{
                    width: { xs: 52, md: 56 },
                    height: { xs: 52, md: 56 },
                    borderRadius: '50%',
                    background: circleBackground,
                    border: circleBorder,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: circleShadow,
                    cursor: onStepChange && !loading ? 'pointer' : 'default',
                    transform: active ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.25s ease',
                    position: 'relative',
                    '&:hover': onStepChange && !loading
                      ? {
                          transform: 'scale(1.08)',
                          boxShadow: `0 16px 30px ${alpha(step.accentColor, 0.45)}`,
                        }
                      : undefined,
                    '&:focus-visible': onStepChange
                      ? {
                          outline: 'none',
                          boxShadow: `0 0 0 3px ${alpha(step.accentColor, 0.5)}`,
                        }
                      : undefined,
                  }}
                >
                  {step.icon}
                </Box>
              </Tooltip>
              <Typography
                variant="subtitle2"
                sx={{
                  color: accented ? '#fff' : 'rgba(226,232,240,0.8)',
                  fontWeight: accented ? 700 : 500,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontSize: { xs: '0.7rem', md: '0.75rem' },
                }}
              >
                {step.label}
              </Typography>
            </Box>
          )
        })}

        {steps.map((step, index) => {
          if (index === steps.length - 1) return null
          const connectorColumn = index * 2 + 2
          const nextStep = steps[index + 1]
          const completed = activeIndex > index || (isFinalState && index >= steps.length - 2)

          return (
            <Box
              key={`${step.value}-connector`}
              sx={{
                gridColumn: connectorColumn,
                height: 4,
                borderRadius: 999,
                background: completed
                  ? `linear-gradient(90deg, ${alpha(step.accentColor, 0.8)} 0%, ${alpha(
                      nextStep.accentColor,
                      0.8
                    )} 100%)`
                  : 'linear-gradient(90deg, rgba(148, 163, 184, 0.35) 0%, rgba(71, 85, 105, 0.15) 100%)',
                opacity: completed ? 1 : 0.6,
                boxShadow: completed ? `0 6px 18px ${alpha(nextStep.accentColor, 0.25)}` : 'none',
              }}
            />
          )
        })}
      </Box>

      {isFinalState && finalState && (
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: alpha(finalState.color, 0.2),
              color: finalState.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {finalState.icon}
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: alpha(finalState.color, 0.9),
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {finalState.label}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

