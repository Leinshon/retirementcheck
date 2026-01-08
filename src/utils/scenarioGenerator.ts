// Scenario generation logic for ProfessionalApp

import type {
  FinancialInputData,
  UserPreferences,
  FinancialEvent,
  UserCurrentState,
  Scenario,
  ThreeMonthRoadmap,
  PortfolioItem,
  TimelineAction,
  ActionCategory,
} from '../types/professional'
import { etfProducts } from './portfolio'

// Event type labels
const eventTypeLabels: Record<string, string> = {
  education: '자녀 교육',
  wedding: '자녀 결혼',
  housing: '주택',
  car: '자동차',
  medical: '부모님 의료비',
  career: '경력 전환',
}

// Calculate financial asset from input data
function calculateFinancialAsset(data: FinancialInputData): number {
  const savings = parseInt(data.savings || '0')
  const stocks = parseInt(data.stocks || '0')
  const otherAsset = parseInt(data.otherFinancialAsset || '0')
  const realEstate = data.housingType === 'own' ? parseInt(data.realEstate || '0') : 0
  // Note: 전세 보증금은 집주인에게 맡긴 돈이므로 자산이 아님
  // 월세 보증금만 자산으로 포함 (소액이며 언제든 회수 가능)
  const rentDeposit = data.housingType === 'rent' ? parseInt(data.rentDeposit || '0') : 0

  const debt = parseInt(data.otherDebt || '0')
  const mortgageDebt = data.hasMortgage ? parseInt(data.mortgageAmount || '0') : 0
  const jeonseDebt = data.hasJeonseDebt ? parseInt(data.jeonseDebtAmount || '0') : 0

  // Note: pensions are monthly income, not assets
  return savings + stocks + otherAsset + realEstate + rentDeposit - debt - mortgageDebt - jeonseDebt
}

// Calculate monthly savings
function calculateMonthlySavings(data: FinancialInputData): number {
  const income = parseInt(data.income || '0')
  const spouseIncome = parseInt(data.spouseIncome || '0')
  const expense = parseInt(data.expense || '0')

  return income + spouseIncome - expense
}

// Calculate projected asset using compound interest formula
function calculateProjectedAsset(
  currentAsset: number,
  annualSaving: number,
  returnRate: number,
  years: number
): number {
  if (years <= 0) return currentAsset

  const factor = Math.pow(1 + returnRate, years)
  const compoundedAsset = currentAsset * factor

  if (returnRate === 0) {
    return compoundedAsset + annualSaving * years
  }

  const compoundedSavings = annualSaving * ((factor - 1) / returnRate)
  return Math.round(compoundedAsset + compoundedSavings)
}

// Calculate total impact of financial events
function calculateEventImpact(
  events: FinancialEvent[],
  yearsToRetirement: number,
  returnRate: number
): number {
  return events.reduce((total, event) => {
    const yearsToGrow = yearsToRetirement - event.yearsFromNow
    // Convert 만원 to 원
    const eventCostAtRetirement =
      event.amount * 10000 * Math.pow(1 + returnRate, Math.max(0, yearsToGrow))
    return total + eventCostAtRetirement
  }, 0)
}

// Generate user state from input
export function generateUserState(
  data: FinancialInputData,
  preferences: UserPreferences
): UserCurrentState {
  const currentAsset = calculateFinancialAsset(data)
  const monthlySaving = calculateMonthlySavings(data)
  const currentAge = parseInt(data.currentAge)
  const targetRetirementAge = parseInt(data.targetRetirementAge)
  const yearsToRetirement = targetRetirementAge - currentAge

  // Calculate current trend projection (assuming 5% return)
  const currentTrendReturn = 0.05
  const currentProjectedAsset = calculateProjectedAsset(
    currentAsset * 10000,
    monthlySaving * 12 * 10000,
    currentTrendReturn,
    yearsToRetirement
  )

  // Target asset adjusted for inflation (user inputs in today's currency)
  const INFLATION_RATE = 0.03
  const targetAssetToday = parseInt(data.targetRetirementAsset)
  const targetAssetAtRetirement = targetAssetToday * Math.pow(1 + INFLATION_RATE, yearsToRetirement)

  const currentAchievementRate = Math.min(
    100,
    Math.round((currentProjectedAsset / (targetAssetAtRetirement * 10000)) * 100)
  )

  return {
    name: data.userName.trim() || '사용자',
    age: currentAge,
    targetRetirementAge,
    currentAsset,
    monthlySaving,
    monthlyExpense: parseInt(data.expense || '0'),
    targetRetirementAsset: parseInt(data.targetRetirementAsset),
    currentProjectedAsset: Math.round(currentProjectedAsset / 10000),
    currentAchievementRate,
  }
}

// Generate single scenario
export function generateScenario(
  type: 'aggressive' | 'balanced',
  userState: UserCurrentState,
  data: FinancialInputData,
  preferences: UserPreferences
): Scenario {
  const isAggressive = type === 'aggressive'
  const baseMonthlyExpense = parseInt(data.expense || '0')
  const monthlyIncome = parseInt(data.income || '0') + parseInt(data.spouseIncome || '0')

  // Calculate spending reduction
  const spendingReduction = preferences.spendingReductionRate
  const actualReduction = isAggressive ? spendingReduction : spendingReduction * 0.5
  const reducedExpense = baseMonthlyExpense * (1 - actualReduction)
  const monthlySaving = monthlyIncome - reducedExpense

  // Portfolio allocation based on lock-up period
  const lockUpYears = preferences.lockUpPeriod

  // Return rates
  const aggressiveReturn = lockUpYears >= 5 ? 0.085 : 0.075
  const balancedReturn = lockUpYears >= 5 ? 0.065 : 0.055
  const returnRate = isAggressive ? aggressiveReturn : balancedReturn

  // Calculate projection
  const yearsToRetirement = userState.targetRetirementAge - userState.age
  const currentAsset = userState.currentAsset * 10000 // Convert to 원
  const annualSaving = monthlySaving * 12 * 10000

  const projectedAssetBeforeEvents = calculateProjectedAsset(
    currentAsset,
    annualSaving,
    returnRate,
    yearsToRetirement
  )

  // Subtract financial events
  const eventImpact = calculateEventImpact(
    preferences.financialEvents,
    yearsToRetirement,
    returnRate
  )

  const projectedAsset = Math.max(0, Math.round((projectedAssetBeforeEvents - eventImpact) / 10000))

  // Target asset adjusted for inflation (user inputs in today's currency)
  const INFLATION_RATE = 0.03
  const targetAssetToday = userState.targetRetirementAsset
  const targetAssetAtRetirement = targetAssetToday * Math.pow(1 + INFLATION_RATE, yearsToRetirement)

  const achievementRate = Math.min(100, Math.round((projectedAsset / targetAssetAtRetirement) * 100))

  // Monthly retirement income (4% withdrawal rate)
  const monthlyRetirementIncome = Math.round((projectedAsset * 0.04) / 12)

  // Generate portfolio allocation
  const portfolioAllocation: PortfolioItem[] = isAggressive
    ? lockUpYears >= 5
      ? [
          { name: 'S&P500', ticker: 'SPY', ratio: 45, color: etfProducts.spy.color },
          { name: 'NASDAQ100', ticker: 'QQQ', ratio: 35, color: etfProducts.qqq.color },
          { name: '금', ticker: 'GLD', ratio: 10, color: etfProducts.gld.color },
          { name: '미국 중기채', ticker: 'IEF', ratio: 10, color: etfProducts.ief.color },
        ]
      : [
          { name: 'S&P500', ticker: 'SPY', ratio: 40, color: etfProducts.spy.color },
          { name: 'NASDAQ100', ticker: 'QQQ', ratio: 30, color: etfProducts.qqq.color },
          { name: '미국 중기채', ticker: 'IEF', ratio: 15, color: etfProducts.ief.color },
          { name: '금', ticker: 'GLD', ratio: 10, color: etfProducts.gld.color },
          { name: '현금성', ticker: 'SGOV', ratio: 5, color: etfProducts.sgov.color },
        ]
    : [
        { name: 'S&P500', ticker: 'SPY', ratio: 40, color: etfProducts.spy.color },
        { name: 'NASDAQ100', ticker: 'QQQ', ratio: 20, color: etfProducts.qqq.color },
        { name: '미국 채권', ticker: 'AGG', ratio: 25, color: etfProducts.agg.color },
        { name: '금', ticker: 'GLD', ratio: 10, color: etfProducts.gld.color },
        { name: '현금성', ticker: 'SGOV', ratio: 5, color: etfProducts.sgov.color },
      ]

  // Generate highlights
  const highlights: string[] = []

  // Spending reduction highlight
  if (spendingReduction >= 0.2) {
    const reductionAmount = Math.round(baseMonthlyExpense * actualReduction)
    highlights.push(`월 지출 ${reductionAmount}만원 절감`)
  } else if (spendingReduction === 0) {
    highlights.push('현재 지출 수준 유지')
  } else {
    highlights.push(`월 저축 ${Math.round(monthlySaving)}만원으로 ${isAggressive ? '증액' : '유지'}`)
  }

  // Lock-up period highlight
  if (lockUpYears >= 5) {
    highlights.push('장기 투자 전략으로 높은 수익률 추구')
  } else if (lockUpYears <= 1) {
    highlights.push('유동성 확보를 위한 보수적 포트폴리오')
  } else {
    highlights.push(`${lockUpYears}년 투자 기간에 맞춘 포트폴리오`)
  }

  // Financial events highlight
  if (preferences.financialEvents.length > 0) {
    const totalEventCostInEok = Math.round(eventImpact / 100000000 * 10) / 10
    if (totalEventCostInEok >= 0.1) {
      highlights.push(`예정 지출 ${totalEventCostInEok}억원 반영`)
    }
  }

  // Tax deduction highlight
  highlights.push('연금저축+IRP 세액공제 한도 100% 활용')

  // Risk level based on portfolio
  const riskLevel = isAggressive ? (lockUpYears >= 5 ? 4 : 3) : (lockUpYears <= 1 ? 2 : 3)

  return {
    id: `scenario-${type}`,
    type,
    name: isAggressive ? '공격적 성장형' : '안정적 균형형',
    subtitle: isAggressive ? '적극적인 투자로 목표 초과 달성' : '현실적인 목표와 안정적인 성장',
    keyMetrics: {
      projectedAsset,
      monthlyRetirementIncome,
      achievementRate,
      requiredMonthlySaving: Math.round(monthlySaving),
      expectedReturnRate: returnRate * 100,
    },
    highlights,
    actionItems: [], // Generated in roadmap
    portfolioAllocation,
    riskLevel: riskLevel as 1 | 2 | 3 | 4 | 5,
  }
}

// Generate 3-month roadmap
export function generateRoadmap(
  scenarioId: string,
  scenario: Scenario,
  userState: UserCurrentState,
  data: FinancialInputData,
  preferences: UserPreferences
): ThreeMonthRoadmap {
  const isAggressive = scenario.type === 'aggressive'
  const lockUpPeriod = preferences.lockUpPeriod
  const hasPrivatePension = parseInt(data.privatePension || '0') > 0
  const hasRetirementPension = parseInt(data.retirementPension || '0') > 0
  const nearTermEvents = preferences.financialEvents.filter((e) => e.yearsFromNow <= 3)

  // Generate actions for Month 1
  const month1Actions: TimelineAction[] = []

  // Emergency fund or immediate investment
  if (lockUpPeriod <= 1) {
    month1Actions.push({
      id: `${scenarioId}-m1-1`,
      month: 1,
      week: 1,
      title: '비상금 확보',
      description: '3-6개월 생활비에 해당하는 비상금을 단기 예금에 확보',
      status: 'upcoming',
      category: 'saving',
      estimatedTime: '30분',
      impact: '재정 안정성 확보',
    })
  } else if (!hasPrivatePension) {
    month1Actions.push({
      id: `${scenarioId}-m1-1`,
      month: 1,
      week: 1,
      title: '연금저축계좌 개설',
      description: '세액공제 혜택을 위한 연금저축 계좌 개설',
      status: 'upcoming',
      category: 'tax',
      estimatedTime: '30분',
      impact: '연 99만원 세액공제',
    })
  } else {
    month1Actions.push({
      id: `${scenarioId}-m1-1`,
      month: 1,
      week: 1,
      title: '연금저축 납입액 최적화',
      description: '현재 납입액이 연 600만원 한도를 활용하고 있는지 확인',
      status: 'upcoming',
      category: 'tax',
      estimatedTime: '20분',
      impact: '세액공제 혜택 극대화',
    })
  }

  if (!hasRetirementPension && lockUpPeriod >= 3) {
    month1Actions.push({
      id: `${scenarioId}-m1-2`,
      month: 1,
      week: 2,
      title: 'IRP 계좌 개설',
      description: '추가 세액공제를 위한 IRP 계좌 개설',
      status: 'upcoming',
      category: 'tax',
      estimatedTime: '30분',
      impact: '연 49.5만원 추가 세액공제',
    })
  }

  month1Actions.push({
    id: `${scenarioId}-m1-3`,
    month: 1,
    week: 3,
    title: '자동이체 설정',
    description: `월급일에 맞춰 ${scenario.keyMetrics.requiredMonthlySaving}만원 자동이체 설정`,
    status: 'upcoming',
    category: 'saving',
    estimatedTime: '15분',
    impact: '저축 자동화',
  })

  if (lockUpPeriod >= 3) {
    month1Actions.push({
      id: `${scenarioId}-m1-4`,
      month: 1,
      week: 4,
      title: '해외 ETF 거래 신청',
      description: '증권사 앱에서 해외 ETF 거래를 위한 외화증권 거래 신청',
      status: 'upcoming',
      category: 'investment',
      estimatedTime: '10분',
    })
  }

  // Generate actions for Month 2
  const month2Actions: TimelineAction[] = []

  if (lockUpPeriod >= 3) {
    const topETF = scenario.portfolioAllocation[0]
    const secondETF = scenario.portfolioAllocation[1]

    month2Actions.push({
      id: `${scenarioId}-m2-1`,
      month: 2,
      week: 1,
      title: '연금저축에서 ETF 매수',
      description: `${topETF.ticker} ${topETF.ratio}%, ${secondETF.ticker} ${secondETF.ratio}% 비율로 매수`,
      status: 'upcoming',
      category: 'investment',
      estimatedTime: '20분',
      impact: '장기 복리 효과 시작',
    })
  }

  if (preferences.spendingReductionRate >= 0.2) {
    const targetReduction = Math.round(userState.monthlyExpense * preferences.spendingReductionRate)
    month2Actions.push({
      id: `${scenarioId}-m2-2`,
      month: 2,
      week: 2,
      title: '지출 최적화 실행',
      description: `3개월 지출 내역을 분석하고 ${targetReduction}만원 절감 목표 달성`,
      status: 'upcoming',
      category: 'saving',
      estimatedTime: '1시간',
      impact: `연간 ${targetReduction * 12}만원 추가 저축`,
    })
  }

  if (!isAggressive) {
    month2Actions.push({
      id: `${scenarioId}-m2-3`,
      month: 2,
      week: 3,
      title: '보험 점검',
      description: '현재 가입된 보험을 점검하고 불필요한 보험료 지출 확인',
      status: 'upcoming',
      category: 'insurance',
      estimatedTime: '1시간',
      impact: '월 지출 절감 가능',
    })
  }

  // Add near-term event preparation
  nearTermEvents.forEach((event, index) => {
    const monthlyPrepAmount = Math.round(event.amount / (event.yearsFromNow * 12))
    month2Actions.push({
      id: `${scenarioId}-m2-event-${index}`,
      month: 2,
      week: (index + 2) as 1 | 2 | 3 | 4,
      title: `${eventTypeLabels[event.type]} 자금 준비`,
      description: `${event.yearsFromNow}년 후 예정된 ${eventTypeLabels[event.type]} 자금 ${event.amount}만원 준비`,
      status: 'upcoming',
      category: 'saving',
      estimatedTime: '30분',
      impact: `월 ${monthlyPrepAmount}만원씩 적립 필요`,
    })
  })

  // Generate actions for Month 3
  const month3Actions: TimelineAction[] = [
    {
      id: `${scenarioId}-m3-1`,
      month: 3,
      week: 1,
      title: '포트폴리오 점검',
      description: '첫 달 투자 결과를 점검하고 목표 비율과의 차이 확인',
      status: 'upcoming',
      category: 'investment',
      estimatedTime: '30분',
    },
    {
      id: `${scenarioId}-m3-2`,
      month: 3,
      week: 2,
      title: '지출 패턴 분석',
      description: '3개월간의 지출을 분석하고 추가 저축 여력 확인',
      status: 'upcoming',
      category: 'saving',
      estimatedTime: '1시간',
      impact: '절약 가능 영역 발견',
    },
    {
      id: `${scenarioId}-m3-3`,
      month: 3,
      week: 4,
      title: '다음 분기 계획 수립',
      description: '3개월 성과를 바탕으로 다음 분기 투자 계획 수립',
      status: 'upcoming',
      category: 'investment',
      estimatedTime: '30분',
    },
  ]

  if (isAggressive && lockUpPeriod >= 3) {
    month3Actions.splice(1, 0, {
      id: `${scenarioId}-m3-2`,
      month: 3,
      week: 2,
      title: '리밸런싱 실행',
      description: '목표 비율에서 5% 이상 벗어난 자산이 있다면 리밸런싱',
      status: 'upcoming',
      category: 'investment',
      estimatedTime: '20분',
      impact: '리스크 관리',
    })
  }

  // Investment guide
  const portfolioSummary = isAggressive
    ? `공격적 성장을 위한 주식 중심 포트폴리오입니다. 장기적으로 연 ${scenario.keyMetrics.expectedReturnRate.toFixed(1)}% 수익률을 목표로 합니다.`
    : `안정적인 성장을 위한 균형형 포트폴리오입니다. 연 ${scenario.keyMetrics.expectedReturnRate.toFixed(1)}% 수익률을 목표로 하며 변동성을 낮췄습니다.`

  const stepByStepGuide = isAggressive
    ? [
        '증권사 앱에서 해외 ETF 거래 신청 (외화증권 거래 신청 필요)',
        `연금저축 계좌에서 ${scenario.portfolioAllocation[0].ticker}(${scenario.portfolioAllocation[0].ratio}%), ${scenario.portfolioAllocation[1].ticker}(${scenario.portfolioAllocation[1].ratio}%) 매수`,
        '매월 초 자동이체 후 적립식으로 추가 매수',
        '분기 1회 포트폴리오 점검 및 리밸런싱',
      ]
    : [
        '비상금 6개월치 확보 후 투자 시작',
        `연금저축 계좌에서 ${scenario.portfolioAllocation[0].ticker}(${scenario.portfolioAllocation[0].ratio}%), ${scenario.portfolioAllocation[1].ticker}(${scenario.portfolioAllocation[1].ratio}%), ${scenario.portfolioAllocation[2].ticker}(${scenario.portfolioAllocation[2].ratio}%) 매수`,
        '매월 적립식으로 꾸준히 투자',
        '분기 1회 포트폴리오 점검',
      ]

  const cautionNotes = [
    '투자 원금 손실 가능성이 있습니다. 여유자금으로 투자하세요.',
    lockUpPeriod <= 1
      ? '단기 투자는 변동성 리스크가 큽니다. 유동성이 필요하다면 보수적으로 운용하세요.'
      : '장기 투자 관점을 유지하고 단기 변동성에 흔들리지 마세요.',
    '연금저축/IRP는 55세 이전 해지 시 세금 불이익이 있습니다.',
    '개인의 상황에 따라 적합한 투자 방법이 다를 수 있습니다.',
  ]

  return {
    scenarioId,
    months: [
      { month: 1, theme: '기초 세팅', actions: month1Actions },
      { month: 2, theme: '투자 시작', actions: month2Actions },
      { month: 3, theme: isAggressive ? '최적화' : '안정화', actions: month3Actions },
    ],
    investmentGuide: {
      portfolioSummary,
      stepByStepGuide,
      cautionNotes,
    },
  }
}

// Main orchestrator function
export function generateAllScenarios(
  data: FinancialInputData,
  preferences: UserPreferences
): {
  userState: UserCurrentState
  scenarios: Scenario[]
  roadmaps: Record<string, ThreeMonthRoadmap>
} {
  const userState = generateUserState(data, preferences)

  const aggressive = generateScenario('aggressive', userState, data, preferences)
  const balanced = generateScenario('balanced', userState, data, preferences)

  const roadmaps = {
    [aggressive.id]: generateRoadmap(aggressive.id, aggressive, userState, data, preferences),
    [balanced.id]: generateRoadmap(balanced.id, balanced, userState, data, preferences),
  }

  return {
    userState,
    scenarios: [aggressive, balanced],
    roadmaps,
  }
}
