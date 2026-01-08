// Type definitions for Professional Planning feature

// Re-export all types from demoScenarios.ts
export type {
  ScenarioType,
  ActionStatus,
  Priority,
  ActionCategory,
  KeyMetrics,
  ActionItem,
  PortfolioItem,
  Scenario,
  TimelineAction,
  MonthBlock,
  InvestmentGuide,
  ThreeMonthRoadmap,
  UserCurrentState,
} from '../data/demoScenarios'

// Financial input data interface (subset of App.tsx's FinancialData)
export interface FinancialInputData {
  // Basic info
  userName: string  // NEW: for personalization
  currentAge: string
  targetRetirementAge: string
  targetRetirementAsset: string

  // Income & Expense
  income: string
  spouseIncome: string
  expense: string

  // Housing
  housingType: 'own' | 'jeonse' | 'rent'
  realEstate: string
  hasMortgage: boolean
  mortgageAmount: string
  jeonseDeposit: string
  hasJeonseDebt: boolean
  jeonseDebtAmount: string
  monthlyRent: string
  rentDeposit: string

  // Assets
  savings: string
  stocks: string
  otherFinancialAsset: string

  // Debt
  otherDebt: string

  // Pensions
  nationalPension: string
  retirementPension: string
  privatePension: string
}

// Financial event types
export type FinancialEventType = 'education' | 'wedding' | 'housing' | 'car' | 'medical' | 'career'

export interface FinancialEvent {
  type: FinancialEventType
  yearsFromNow: number
  amount: number  // in 만원
}

// User preferences from interactive survey
export interface UserPreferences {
  spendingReductionRate: number  // 0.0, 0.1, 0.2, 0.3
  lockUpPeriod: number           // 1, 3, 5, 10 (years)
  financialEvents: FinancialEvent[]
}

// Event option definition for UI
export interface EventOption {
  type: FinancialEventType
  label: string
  example: string
}

// Survey step props
export interface SurveyStepProps {
  question: string
  description?: string
  options: {
    label: string
    value: string | number
    description: string
  }[]
  selectedValue?: string | number
  onSelect: (value: string | number) => void
}

// Financial events step props
export interface FinancialEventsStepProps {
  events: FinancialEvent[]
  onChange: (events: FinancialEvent[]) => void
}
