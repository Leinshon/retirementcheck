import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type {
  FinancialInputData,
  UserPreferences,
  EventOption,
} from './types/professional'
import { generateAllScenarios } from './utils/scenarioGenerator'
import './ProfessionalApp.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const initialData: FinancialInputData = {
  userName: '',
  currentAge: '',
  targetRetirementAge: '',
  targetRetirementAsset: '',
  income: '',
  spouseIncome: '',
  expense: '',
  housingType: 'own',
  realEstate: '',
  hasMortgage: false,
  mortgageAmount: '',
  jeonseDeposit: '',
  hasJeonseDebt: false,
  jeonseDebtAmount: '',
  monthlyRent: '',
  rentDeposit: '',
  savings: '',
  stocks: '',
  otherFinancialAsset: '',
  otherDebt: '',
  nationalPension: '',
  retirementPension: '',
  privatePension: '',
}

const initialPreferences: UserPreferences = {
  spendingReductionRate: 0.1,
  lockUpPeriod: 5,
  financialEvents: [],
}

const eventOptions: EventOption[] = [
  { type: 'education', label: '자녀 대학 등록금', example: '4년간 1억원' },
  { type: 'wedding', label: '자녀 결혼 자금 지원', example: '5천만원' },
  { type: 'housing', label: '주택 구매 또는 이사', example: '전세/매매 자금' },
  { type: 'car', label: '자동차 구매', example: '3천-5천만원' },
  { type: 'medical', label: '부모님 의료비/요양비 지원', example: '연 500-1000만원' },
  { type: 'career', label: '창업 또는 경력 전환', example: '휴직/수입 감소 기간' },
]

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

function ProfessionalApp() {
  const [data, setData] = useState<FinancialInputData>(initialData)
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences)
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [showNavigateButton, setShowNavigateButton] = useState(false)
  const navigate = useNavigate()

  const totalSteps = 9
  const progressPercent = (currentStep / totalSteps) * 100

  // Helper function to get personalized greeting
  const getPersonalizedName = () => {
    return data.userName.trim() || '사용자'
  }

  // Helper function to get validation message after Step 1
  const getValidationMessage = () => {
    if (!data.currentAge || !data.targetRetirementAge) return null

    const age = parseInt(data.currentAge)
    const targetAge = parseInt(data.targetRetirementAge)
    const yearsLeft = targetAge - age

    if (yearsLeft > 20) {
      return '은퇴 준비를 일찍 시작하셨네요! 충분한 시간이 있어 매우 유리합니다.'
    } else if (yearsLeft > 10) {
      return '은퇴까지 적절한 시간이 남아있습니다. 지금부터 체계적으로 준비하면 목표 달성이 가능합니다.'
    } else if (yearsLeft > 0) {
      return '은퇴가 가까워지고 있지만 걱정하지 마세요. 효율적인 전략으로 목표에 다가갈 수 있습니다.'
    }
    return null
  }

  // Load 40s average sample data and jump to graph
  const load40sAverageData = () => {
    // 40대 평균 데이터 (householdFinance2025.ts 기준)
    const age = 45
    const retireAge = 60
    const hasSpouse = true

    // 연소득 (만원) - 통계는 가계소득(household)이므로 이미 본인+배우자 합계
    const annualHouseholdIncome = 9333  // 가구 전체 연소득
    const monthlyHouseholdIncome = Math.round(annualHouseholdIncome / 12)  // 778만원

    // 소득 배분 (본인 67%, 배우자 33% 가정)
    const monthlyIncome = Math.round(monthlyHouseholdIncome * 0.67)  // 521만원
    const spouseIncome = Math.round(monthlyHouseholdIncome * 0.33)  // 257만원

    // 월 지출 (가처분소득의 80%)
    const annualDisposableIncome = 7311
    const monthlyExpense = Math.round((annualDisposableIncome * 0.8) / 12)

    // 금융자산 (만원)
    const financialAsset = 16401
    const savings = Math.round(financialAsset * 0.5)
    const stocks = Math.round(financialAsset * 0.3)
    const otherFinancialAsset = Math.round(financialAsset * 0.2)

    // 실물자산 (부동산)
    const realEstate = 46313

    // 부채
    const totalDebt = 14325
    const otherDebt = totalDebt

    // 국민연금 예상 수령액 (부부 2인 기준, 각 100만원)
    const nationalPension = hasSpouse ? 200 : 100

    // 은퇴 목표 자산 (월 지출 × 12개월 × 25년)
    const targetAsset = Math.max(100000, Math.round(monthlyExpense * 12 * 25))

    setData({
      userName: '윤용섭',
      currentAge: String(age),
      targetRetirementAge: String(retireAge),
      targetRetirementAsset: String(targetAsset),
      income: String(monthlyIncome),
      spouseIncome: String(spouseIncome),
      expense: String(monthlyExpense),
      housingType: 'own',
      realEstate: String(realEstate),
      hasMortgage: false,
      mortgageAmount: '',
      jeonseDeposit: '',
      hasJeonseDebt: false,
      jeonseDebtAmount: '',
      monthlyRent: '',
      rentDeposit: '',
      savings: String(savings),
      stocks: String(stocks),
      otherFinancialAsset: String(otherFinancialAsset),
      otherDebt: String(otherDebt),
      nationalPension: String(nationalPension),
      retirementPension: '0',
      privatePension: '0',
    })

    // Set default preferences (since we're skipping the survey)
    setPreferences({
      spendingReductionRate: 0.1,  // 10% 절감 (조금 줄일 수 있어요)
      lockUpPeriod: 5,              // 5년 (중장기)
      financialEvents: [],           // 주요 지출 이벤트 없음
    })

    // Clear errors
    setErrors({})

    // Jump directly to Step 9 (graph)
    setCurrentStep(9)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle input change
  const handleInputChange = (field: keyof FinancialInputData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Navigate steps
  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => (prev + 1) as Step)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Validate current step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!data.currentAge || parseInt(data.currentAge) < 20) {
        newErrors.currentAge = '현재 나이를 입력해주세요 (20세 이상)'
      }
      if (!data.targetRetirementAge || parseInt(data.targetRetirementAge) <= parseInt(data.currentAge)) {
        newErrors.targetRetirementAge = '은퇴 나이는 현재 나이보다 커야 합니다'
      }
      if (!data.targetRetirementAsset || parseInt(data.targetRetirementAsset) < 1000) {
        newErrors.targetRetirementAsset = '목표 은퇴 자산을 입력해주세요 (최소 1000만원)'
      }
    }

    if (step === 2) {
      const hasIncomeOrExpense =
        parseInt(data.income || '0') > 0 ||
        parseInt(data.spouseIncome || '0') > 0 ||
        parseInt(data.expense || '0') > 0

      if (!hasIncomeOrExpense) {
        newErrors.income = '소득 또는 지출 정보를 최소 하나 이상 입력해주세요'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      goToNextStep()
    }
  }

  // Handle financial events
  const toggleEventType = (type: string) => {
    const existing = preferences.financialEvents.find((e) => e.type === type)
    if (existing) {
      setPreferences((prev) => ({
        ...prev,
        financialEvents: prev.financialEvents.filter((e) => e.type !== type),
      }))
    } else {
      setPreferences((prev) => ({
        ...prev,
        financialEvents: [
          ...prev.financialEvents,
          { type: type as any, yearsFromNow: 5, amount: 5000 },
        ],
      }))
    }
  }

  const updateEvent = (type: string, field: 'yearsFromNow' | 'amount', value: number) => {
    setPreferences((prev) => ({
      ...prev,
      financialEvents: prev.financialEvents.map((e) =>
        e.type === type ? { ...e, [field]: value } : e
      ),
    }))
  }

  // Calculate baseline projection (current plan without scenarios)
  const calculateBaselineProjection = () => {
    const currentAge = parseInt(data.currentAge || '0')
    const retirementAge = parseInt(data.targetRetirementAge || '0')
    const lifeExpectancy = 90

    const WAGE_GROWTH_RATE = 0.033
    const INFLATION_RATE = 0.03
    const POST_RETIREMENT_EXPENSE_RATIO = 0.75
    const MEDICAL_COST_INCREASE_AGE = 75
    const MEDICAL_COST_MULTIPLIER = 1.2

    const getNationalPensionStartAge = (age: number): number => {
      if (age < 50) return 65
      if (age < 53) return 64
      if (age < 56) return 63
      if (age < 59) return 62
      return 61
    }

    const nationalPensionStartAge = getNationalPensionStartAge(currentAge)
    const privatePensionStartAge = 55

    const financialAssets =
      parseInt(data.savings || '0') +
      parseInt(data.stocks || '0') +
      parseInt(data.otherFinancialAsset || '0')

    let housingNetWorth = 0
    if (data.housingType === 'own') {
      const realEstateValue = parseInt(data.realEstate || '0')
      const mortgage = data.hasMortgage ? parseInt(data.mortgageAmount || '0') : 0
      housingNetWorth = realEstateValue - mortgage
    } else if (data.housingType === 'jeonse') {
      const jeonseDeposit = parseInt(data.jeonseDeposit || '0')
      const jeonseDebt = data.hasJeonseDebt ? parseInt(data.jeonseDebtAmount || '0') : 0
      housingNetWorth = jeonseDeposit - jeonseDebt
    } else if (data.housingType === 'rent') {
      housingNetWorth = parseInt(data.rentDeposit || '0')
    }

    const otherDebt = parseInt(data.otherDebt || '0')
    const initialAsset = financialAssets + housingNetWorth - otherDebt

    const baseMonthlyIncome = parseInt(data.income || '0') + parseInt(data.spouseIncome || '0')
    const baseMonthlyExpense = parseInt(data.expense || '0')
    const monthlyRent = data.housingType === 'rent' ? parseInt(data.monthlyRent || '0') : 0

    const annualReturn = 0.03

    const years: number[] = []
    const netWorth: number[] = []

    let currentAsset = initialAsset
    let currentIncome = baseMonthlyIncome
    let currentExpense = baseMonthlyExpense

    for (let age = currentAge; age <= lifeExpectancy; age++) {
      years.push(age)
      const yearsSinceStart = age - currentAge

      if (age < retirementAge) {
        currentIncome = baseMonthlyIncome * Math.pow(1 + WAGE_GROWTH_RATE, yearsSinceStart)
        const inflatedExpense = baseMonthlyExpense * Math.pow(1 + INFLATION_RATE, yearsSinceStart)
        currentExpense = inflatedExpense * (1 - preferences.spendingReductionRate)
        const annualSavings = (currentIncome - currentExpense - monthlyRent) * 12
        const eventsThisYear = preferences.financialEvents.filter(
          e => currentAge + e.yearsFromNow === age
        )
        const eventCosts = eventsThisYear.reduce((sum, e) => sum + e.amount, 0)
        currentAsset += annualSavings - eventCosts
        currentAsset *= (1 + annualReturn)
      } else {
        const yearsSinceRetirement = age - retirementAge
        const baseRetirementExpense = baseMonthlyExpense *
          Math.pow(1 + INFLATION_RATE, retirementAge - currentAge) *
          POST_RETIREMENT_EXPENSE_RATIO
        let monthlyExpenseThisYear = baseRetirementExpense * Math.pow(1 + INFLATION_RATE, yearsSinceRetirement)

        if (age >= MEDICAL_COST_INCREASE_AGE) {
          monthlyExpenseThisYear *= MEDICAL_COST_MULTIPLIER
        }

        let monthlyPensionThisYear = 0
        if (age >= nationalPensionStartAge) {
          const pensionYears = age - nationalPensionStartAge
          const baseNationalPension = parseInt(data.nationalPension || '0')
          const adjustedNationalPension = baseNationalPension * Math.pow(1 + INFLATION_RATE, pensionYears)
          monthlyPensionThisYear += adjustedNationalPension
        }

        if (age >= privatePensionStartAge) {
          const retirementPensionTotal = parseInt(data.retirementPension || '0')
          const privatePensionTotal = parseInt(data.privatePension || '0')
          const totalPensionAssets = retirementPensionTotal + privatePensionTotal

          if (totalPensionAssets > 0) {
            const testWithdrawal = totalPensionAssets / 10
            const withdrawalPeriod = testWithdrawal > 1500 ? 20 : 10
            const annualWithdrawal = totalPensionAssets / withdrawalPeriod
            const yearsSinceStart = age - privatePensionStartAge
            if (yearsSinceStart < withdrawalPeriod) {
              monthlyPensionThisYear += annualWithdrawal / 12
            }
          }
        }

        const annualPension = monthlyPensionThisYear * 12
        const annualExpenses = monthlyExpenseThisYear * 12
        const annualCashFlow = annualPension - annualExpenses
        currentAsset += annualCashFlow
      }

      netWorth.push(Math.max(0, Math.round(currentAsset)))
    }

    return { years, netWorth, retirementAge }
  }

  // Generate scenarios (with loading state)
  const handleGenerateScenarios = () => {
    setIsGenerating(true)
    setShowNavigateButton(false)

    // Show button after 5 seconds
    setTimeout(() => {
      setShowNavigateButton(true)
    }, 5000)
  }

  // Navigate to diagnosis result page
  const navigateToScenarios = () => {
    const { userState, scenarios, roadmaps } = generateAllScenarios(data, preferences)
    const baselineProjection = calculateBaselineProjection()

    navigate('/professional/diagnosis', {
      state: { userState, scenarios, roadmaps, baselineProjection },
    })
  }

  // Render step header
  const renderStepHeader = (_stepNumber: number, _title: string) => (
    <header className="prof-step-header">
      <button className="prof-back-btn" onClick={goToPrevStep} disabled={currentStep === 1}>
        뒤로
      </button>
      <div className="prof-progress">
        <div className="prof-progress-bar">
          <div className="prof-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="prof-progress-text">{currentStep}/{totalSteps}</span>
      </div>
    </header>
  )

  // Step 1: 기본 정보
  const renderStep1 = () => (
    <>
      {renderStepHeader(1, '기본 정보')}
      <div className="prof-step-content">
        <h2 className="prof-step-title">
          {data.userName ? `${getPersonalizedName()}님, 반갑습니다!` : '기본 정보를 입력해주세요'}
        </h2>
        <p className="prof-step-description">
          {data.userName
            ? '은퇴 후 어떤 생활을 꿈꾸시나요? 함께 계획을 세워보겠습니다'
            : '은퇴 계획의 기본이 되는 정보입니다'}
        </p>

        <div className="prof-input-list">
          <div className="prof-input-group">
            <label htmlFor="userName">이름 (선택)</label>
            <div className="prof-input-wrapper">
              <input
                id="userName"
                type="text"
                placeholder="예: 김민수"
                value={data.userName}
                onChange={(e) => handleInputChange('userName', e.target.value)}
              />
            </div>
            <p className="prof-input-hint">
              맞춤형 분석 리포트에서 사용됩니다
            </p>
          </div>

          <div className="prof-input-group">
            <label htmlFor="currentAge">
              현재 나이 <span className="required">*</span>
            </label>
            <div className="prof-input-wrapper">
              <input
                id="currentAge"
                type="text"
                inputMode="numeric"
                placeholder="35"
                value={data.currentAge}
                onChange={(e) => handleInputChange('currentAge', e.target.value)}
                className={errors.currentAge ? 'error' : ''}
              />
              <span className="unit">세</span>
            </div>
            {errors.currentAge && <span className="error-text">{errors.currentAge}</span>}
          </div>

          <div className="prof-input-group">
            <label htmlFor="targetRetirementAge">
              목표 은퇴 나이 <span className="required">*</span>
            </label>
            <div className="prof-input-wrapper">
              <input
                id="targetRetirementAge"
                type="text"
                inputMode="numeric"
                placeholder="55"
                value={data.targetRetirementAge}
                onChange={(e) => handleInputChange('targetRetirementAge', e.target.value)}
                className={errors.targetRetirementAge ? 'error' : ''}
              />
              <span className="unit">세</span>
            </div>
            {errors.targetRetirementAge && (
              <span className="error-text">{errors.targetRetirementAge}</span>
            )}
          </div>

          <div className="prof-input-group">
            <label htmlFor="targetRetirementAsset">
              목표 은퇴 자산 <span className="required">*</span>
            </label>
            <div className="prof-input-wrapper">
              <input
                id="targetRetirementAsset"
                type="text"
                inputMode="numeric"
                placeholder="50000"
                value={data.targetRetirementAsset}
                onChange={(e) => handleInputChange('targetRetirementAsset', e.target.value)}
                className={errors.targetRetirementAsset ? 'error' : ''}
              />
              <span className="unit">만원</span>
            </div>
            {errors.targetRetirementAsset && (
              <span className="error-text">{errors.targetRetirementAsset}</span>
            )}
          </div>
        </div>

        {getValidationMessage() && (
          <div className="prof-validation-message">
            <p>{getValidationMessage()}</p>
          </div>
        )}

        <div className="prof-button-group">
          <button className="prof-sample-btn" onClick={load40sAverageData}>
            40대 평균값으로 바로 확인하기
          </button>
          <span className="button-separator">또는</span>
          <button className="prof-next-btn" onClick={handleNext} style={{ marginTop: 0 }}>
            직접 입력하기
          </button>
        </div>
      </div>
    </>
  )

  // Step 2: 소득 & 지출
  const renderStep2 = () => {
    const monthlyIncome = parseInt(data.income || '0') + parseInt(data.spouseIncome || '0')
    const monthlyExpense = parseInt(data.expense || '0')
    const monthlySavings = monthlyIncome - monthlyExpense

    return (
      <>
        {renderStepHeader(2, '소득 & 지출')}
        <div className="prof-step-content">
          <h2 className="prof-step-title">{getPersonalizedName()}님의 소득과 지출</h2>
          <p className="prof-step-description">귀하의 재무 현황을 알려주시면 정확한 분석이 가능합니다</p>

          <div className="prof-input-list">
            <div className="prof-input-group">
              <label htmlFor="income">본인 월 소득</label>
              <div className="prof-input-wrapper">
                <input
                  id="income"
                  type="text"
                  inputMode="numeric"
                  placeholder="300"
                  value={data.income}
                  onChange={(e) => handleInputChange('income', e.target.value)}
                />
                <span className="unit">만원</span>
              </div>
            </div>

            <div className="prof-input-group">
              <label htmlFor="spouseIncome">배우자 월 소득</label>
              <div className="prof-input-wrapper">
                <input
                  id="spouseIncome"
                  type="text"
                  inputMode="numeric"
                  placeholder="200"
                  value={data.spouseIncome}
                  onChange={(e) => handleInputChange('spouseIncome', e.target.value)}
                />
                <span className="unit">만원</span>
              </div>
            </div>

            <div className="prof-input-group">
              <label htmlFor="expense">월 지출</label>
              <div className="prof-input-wrapper">
                <input
                  id="expense"
                  type="text"
                  inputMode="numeric"
                  placeholder="250"
                  value={data.expense}
                  onChange={(e) => handleInputChange('expense', e.target.value)}
                />
                <span className="unit">만원</span>
              </div>
            </div>
          </div>

          {monthlyIncome > 0 && monthlyExpense > 0 && (
            <div className="prof-insight-box">
              <span className="insight-label">월 저축 가능 금액</span>
              <span className="insight-value">
                {monthlySavings > 0
                  ? `${monthlySavings.toLocaleString()}만원`
                  : '지출이 소득을 초과합니다'}
              </span>
            </div>
          )}

          {errors.income && <span className="error-text">{errors.income}</span>}

          <button className="prof-next-btn" onClick={handleNext}>
            다음
          </button>
        </div>
      </>
    )
  }

  // Step 3: 주거
  const renderStep3 = () => {
    const housingAsset =
      data.housingType === 'own'
        ? parseInt(data.realEstate || '0')
        : data.housingType === 'jeonse'
          ? parseInt(data.jeonseDeposit || '0')
          : parseInt(data.rentDeposit || '0')

    const housingDebt =
      data.housingType === 'own'
        ? parseInt(data.mortgageAmount || '0')
        : parseInt(data.jeonseDebtAmount || '0')

    return (
      <>
        {renderStepHeader(3, '주거')}
        <div className="prof-step-content">
          <h2 className="prof-step-title">주거 형태를 선택해주세요</h2>
          <p className="prof-step-description">부동산 자산을 계산합니다</p>

          <div className="prof-housing-types">
            <button
              className={`prof-housing-btn ${data.housingType === 'own' ? 'active' : ''}`}
              onClick={() => handleInputChange('housingType', 'own')}
            >
              자가
            </button>
            <button
              className={`prof-housing-btn ${data.housingType === 'jeonse' ? 'active' : ''}`}
              onClick={() => handleInputChange('housingType', 'jeonse')}
            >
              전세
            </button>
            <button
              className={`prof-housing-btn ${data.housingType === 'rent' ? 'active' : ''}`}
              onClick={() => handleInputChange('housingType', 'rent')}
            >
              월세
            </button>
          </div>

          <div className="prof-input-list">
            {data.housingType === 'own' && (
              <>
                <div className="prof-input-group">
                  <label htmlFor="realEstate">부동산 시세</label>
                  <div className="prof-input-wrapper">
                    <input
                      id="realEstate"
                      type="text"
                      inputMode="numeric"
                      placeholder="50000"
                      value={data.realEstate}
                      onChange={(e) => handleInputChange('realEstate', e.target.value)}
                    />
                    <span className="unit">만원</span>
                  </div>
                </div>

                <div className="prof-checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={data.hasMortgage}
                      onChange={(e) => handleInputChange('hasMortgage', e.target.checked)}
                    />
                    주택담보대출 있음
                  </label>
                </div>

                {data.hasMortgage && (
                  <div className="prof-input-group">
                    <label htmlFor="mortgageAmount">주택담보대출 잔액</label>
                    <div className="prof-input-wrapper">
                      <input
                        id="mortgageAmount"
                        type="text"
                        inputMode="numeric"
                        placeholder="20000"
                        value={data.mortgageAmount}
                        onChange={(e) => handleInputChange('mortgageAmount', e.target.value)}
                      />
                      <span className="unit">만원</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {data.housingType === 'jeonse' && (
              <>
                <div className="prof-input-group">
                  <label htmlFor="jeonseDeposit">전세 보증금</label>
                  <div className="prof-input-wrapper">
                    <input
                      id="jeonseDeposit"
                      type="text"
                      inputMode="numeric"
                      placeholder="30000"
                      value={data.jeonseDeposit}
                      onChange={(e) => handleInputChange('jeonseDeposit', e.target.value)}
                    />
                    <span className="unit">만원</span>
                  </div>
                </div>

                <div className="prof-checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={data.hasJeonseDebt}
                      onChange={(e) => handleInputChange('hasJeonseDebt', e.target.checked)}
                    />
                    전세자금대출 있음
                  </label>
                </div>

                {data.hasJeonseDebt && (
                  <div className="prof-input-group">
                    <label htmlFor="jeonseDebtAmount">전세자금대출 잔액</label>
                    <div className="prof-input-wrapper">
                      <input
                        id="jeonseDebtAmount"
                        type="text"
                        inputMode="numeric"
                        placeholder="10000"
                        value={data.jeonseDebtAmount}
                        onChange={(e) => handleInputChange('jeonseDebtAmount', e.target.value)}
                      />
                      <span className="unit">만원</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {data.housingType === 'rent' && (
              <>
                <div className="prof-input-group">
                  <label htmlFor="rentDeposit">월세 보증금</label>
                  <div className="prof-input-wrapper">
                    <input
                      id="rentDeposit"
                      type="text"
                      inputMode="numeric"
                      placeholder="5000"
                      value={data.rentDeposit}
                      onChange={(e) => handleInputChange('rentDeposit', e.target.value)}
                    />
                    <span className="unit">만원</span>
                  </div>
                </div>

                <div className="prof-input-group">
                  <label htmlFor="monthlyRent">월세</label>
                  <div className="prof-input-wrapper">
                    <input
                      id="monthlyRent"
                      type="text"
                      inputMode="numeric"
                      placeholder="50"
                      value={data.monthlyRent}
                      onChange={(e) => handleInputChange('monthlyRent', e.target.value)}
                    />
                    <span className="unit">만원</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {housingAsset > 0 && (
            <div className="prof-insight-box">
              <span className="insight-label">주거 자산</span>
              <span className="insight-value">
                {(housingAsset - housingDebt).toLocaleString()}만원
                {housingDebt > 0 && ` (부채 ${housingDebt.toLocaleString()}만원)`}
              </span>
            </div>
          )}

          <button className="prof-next-btn" onClick={handleNext}>
            다음
          </button>
        </div>
      </>
    )
  }

  // Step 4: 자산 & 부채
  const renderStep4 = () => {
    const totalAsset =
      parseInt(data.savings || '0') +
      parseInt(data.stocks || '0') +
      parseInt(data.otherFinancialAsset || '0')
    const totalDebt = parseInt(data.otherDebt || '0')

    return (
      <>
        {renderStepHeader(4, '자산 & 부채')}
        <div className="prof-step-content">
          <h2 className="prof-step-title">금융 자산과 부채를 입력해주세요</h2>
          <p className="prof-step-description">주거 관련 자산은 제외됩니다</p>

          <div className="prof-input-list">
            <div className="prof-input-group">
              <label htmlFor="savings">예금/적금</label>
              <div className="prof-input-wrapper">
                <input
                  id="savings"
                  type="text"
                  inputMode="numeric"
                  placeholder="3000"
                  value={data.savings}
                  onChange={(e) => handleInputChange('savings', e.target.value)}
                />
                <span className="unit">만원</span>
              </div>
            </div>

            <div className="prof-input-group">
              <label htmlFor="stocks">주식/펀드</label>
              <div className="prof-input-wrapper">
                <input
                  id="stocks"
                  type="text"
                  inputMode="numeric"
                  placeholder="2000"
                  value={data.stocks}
                  onChange={(e) => handleInputChange('stocks', e.target.value)}
                />
                <span className="unit">만원</span>
              </div>
            </div>

            <div className="prof-input-group">
              <label htmlFor="otherFinancialAsset">기타 금융자산</label>
              <div className="prof-input-wrapper">
                <input
                  id="otherFinancialAsset"
                  type="text"
                  inputMode="numeric"
                  placeholder="1000"
                  value={data.otherFinancialAsset}
                  onChange={(e) => handleInputChange('otherFinancialAsset', e.target.value)}
                />
                <span className="unit">만원</span>
              </div>
            </div>

            <div className="prof-input-group">
              <label htmlFor="otherDebt">기타 부채</label>
              <div className="prof-input-wrapper">
                <input
                  id="otherDebt"
                  type="text"
                  inputMode="numeric"
                  placeholder="500"
                  value={data.otherDebt}
                  onChange={(e) => handleInputChange('otherDebt', e.target.value)}
                />
                <span className="unit">만원</span>
              </div>
            </div>
          </div>

          {totalAsset > 0 && (
            <div className="prof-insight-box">
              <span className="insight-label">금융 자산</span>
              <span className="insight-value">
                {(totalAsset - totalDebt).toLocaleString()}만원
                {totalDebt > 0 && ` (부채 ${totalDebt.toLocaleString()}만원)`}
              </span>
            </div>
          )}

          <button className="prof-next-btn" onClick={handleNext}>
            다음
          </button>
        </div>
      </>
    )
  }

  // Step 5: 연금
  const renderStep5 = () => (
    <>
      {renderStepHeader(5, '연금')}
      <div className="prof-step-content">
        <h2 className="prof-step-title">연금 정보를 입력해주세요</h2>
        <p className="prof-step-description">현재 적립된 금액 또는 예상 수령액을 입력하세요</p>

        <div className="prof-input-list">
          <div className="prof-input-group">
            <label htmlFor="nationalPension">국민연금 (예상 월 수령액)</label>
            <div className="prof-input-wrapper">
              <input
                id="nationalPension"
                type="text"
                inputMode="numeric"
                placeholder="100"
                value={data.nationalPension}
                onChange={(e) => handleInputChange('nationalPension', e.target.value)}
              />
              <span className="unit">만원</span>
            </div>
          </div>

          <div className="prof-input-group">
            <label htmlFor="retirementPension">퇴직연금 (IRP 포함)</label>
            <div className="prof-input-wrapper">
              <input
                id="retirementPension"
                type="text"
                inputMode="numeric"
                placeholder="3000"
                value={data.retirementPension}
                onChange={(e) => handleInputChange('retirementPension', e.target.value)}
              />
              <span className="unit">만원</span>
            </div>
          </div>

          <div className="prof-input-group">
            <label htmlFor="privatePension">개인연금 (연금저축)</label>
            <div className="prof-input-wrapper">
              <input
                id="privatePension"
                type="text"
                inputMode="numeric"
                placeholder="2000"
                value={data.privatePension}
                onChange={(e) => handleInputChange('privatePension', e.target.value)}
              />
              <span className="unit">만원</span>
            </div>
          </div>
        </div>

        <button className="prof-next-btn" onClick={handleNext}>
          다음: 맞춤 설정
        </button>
      </div>
    </>
  )

  // Step 6: 설문 - 지출 절감
  const renderStep6 = () => (
    <>
      {renderStepHeader(6, '지출 절감 의지')}
      <div className="prof-step-content">
        <h2 className="prof-step-title">
          은퇴 목표 달성을 위해 현재 지출을 얼마나 줄일 수 있나요?
        </h2>

        <div className="prof-survey-options">
          {[
            { value: 0, label: '지출을 줄이기 어려워요', description: '현재 지출 수준 유지' },
            { value: 0.1, label: '조금 줄일 수 있어요', description: '약 10% 절감 가능' },
            { value: 0.2, label: '적극적으로 줄일 수 있어요', description: '약 20% 절감 가능' },
            { value: 0.3, label: '대폭 줄일 수 있어요', description: '약 30% 이상 절감 가능' },
          ].map((option) => (
            <label
              key={option.value}
              className={`prof-survey-option ${preferences.spendingReductionRate === option.value ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="spending"
                checked={preferences.spendingReductionRate === option.value}
                onChange={() =>
                  setPreferences((prev) => ({ ...prev, spendingReductionRate: option.value }))
                }
              />
              <div className="prof-option-content">
                <span className="prof-option-label">{option.label}</span>
                <span className="prof-option-description">{option.description}</span>
              </div>
            </label>
          ))}
        </div>

        <button className="prof-next-btn" onClick={goToNextStep}>
          다음
        </button>
      </div>
    </>
  )

  // Step 7: 설문 - 투자 기간
  const renderStep7 = () => (
    <>
      {renderStepHeader(7, '투자 기간')}
      <div className="prof-step-content">
        <h2 className="prof-step-title">
          투자한 자금을 건드리지 않고 유지할 수 있는 기간은 얼마나 되나요?
        </h2>

        <div className="prof-survey-options">
          {[
            { value: 1, label: '1년 미만', description: '단기 투자, 유동성 우선' },
            { value: 3, label: '1-3년', description: '중단기 투자' },
            { value: 5, label: '3-5년', description: '중장기 투자' },
            { value: 10, label: '5년 이상', description: '장기 투자, 높은 수익률 추구' },
          ].map((option) => (
            <label
              key={option.value}
              className={`prof-survey-option ${preferences.lockUpPeriod === option.value ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="lockup"
                checked={preferences.lockUpPeriod === option.value}
                onChange={() =>
                  setPreferences((prev) => ({ ...prev, lockUpPeriod: option.value }))
                }
              />
              <div className="prof-option-content">
                <span className="prof-option-label">{option.label}</span>
                <span className="prof-option-description">{option.description}</span>
              </div>
            </label>
          ))}
        </div>

        <button className="prof-next-btn" onClick={goToNextStep}>
          다음
        </button>
      </div>
    </>
  )

  // Step 8: 설문 - 재무 이벤트
  const renderStep8 = () => (
    <>
      {renderStepHeader(8, '재무 이벤트')}
      <div className="prof-step-content">
        <h2 className="prof-step-title">은퇴 전까지 예상되는 주요 지출 이벤트가 있나요?</h2>
        <p className="prof-step-description">복수 선택 가능합니다</p>

        <div className="prof-event-options">
          {eventOptions.map((option) => {
            const event = preferences.financialEvents.find((e) => e.type === option.type)
            const isSelected = !!event

            return (
              <div key={option.type} className="prof-event-option">
                <label className="prof-event-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleEventType(option.type)}
                  />
                  <span className="prof-event-label">
                    {option.label}
                    <span className="prof-event-example">예: {option.example}</span>
                  </span>
                </label>

                {isSelected && event && (
                  <div className="prof-event-details">
                    <div className="prof-event-detail-item">
                      <label>예상 시기</label>
                      <div className="prof-range-wrapper">
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={event.yearsFromNow}
                          onChange={(e) =>
                            updateEvent(option.type, 'yearsFromNow', parseInt(e.target.value))
                          }
                        />
                        <span className="prof-range-value">{event.yearsFromNow}년 후</span>
                      </div>
                    </div>
                    <div className="prof-event-detail-item">
                      <label>예상 금액</label>
                      <div className="prof-input-wrapper">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="5000"
                          value={event.amount || ''}
                          onChange={(e) =>
                            updateEvent(option.type, 'amount', parseInt(e.target.value) || 0)
                          }
                        />
                        <span className="unit">만원</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          className="prof-skip-btn"
          onClick={() => {
            setPreferences((prev) => ({ ...prev, financialEvents: [] }))
            goToNextStep()
          }}
        >
          없음 / 건너뛰기
        </button>

        <button className="prof-next-btn" onClick={handleNext}>
          다음
        </button>
      </div>
    </>
  )

  // Step 9: 순자산 그래프 프리뷰
  const renderStep9 = () => {
    const currentAge = parseInt(data.currentAge || '0')
    const retirementAge = parseInt(data.targetRetirementAge || '0')
    const lifeExpectancy = 90

    // Custom plugin to draw retirement age line
    const retirementLinePlugin = {
      id: 'retirementLine',
      afterDatasetsDraw(chart: any) {
        const ctx = chart.ctx
        const xAxis = chart.scales.x
        const yAxis = chart.scales.y

        // Find retirement age index in the data
        const labels = chart.data.labels
        const retirementIndex = labels.indexOf(retirementAge)

        if (retirementIndex >= 0) {
          const x = xAxis.getPixelForValue(retirementIndex)

          // Draw vertical dashed line
          ctx.save()
          ctx.beginPath()
          ctx.setLineDash([5, 5])
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2
          ctx.moveTo(x, yAxis.top)
          ctx.lineTo(x, yAxis.bottom)
          ctx.stroke()

          // Draw label
          ctx.fillStyle = '#f59e0b'
          ctx.font = 'bold 12px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`은퇴 (${retirementAge}세)`, x, yAxis.top - 10)
          ctx.restore()
        }
      }
    }

    // Constants for realistic projection
    const WAGE_GROWTH_RATE = 0.033      // 3.3% annual wage increase
    const INFLATION_RATE = 0.03         // 3% annual inflation
    const POST_RETIREMENT_EXPENSE_RATIO = 0.75  // 75% of working expenses
    const MEDICAL_COST_INCREASE_AGE = 75        // Age when medical costs increase
    const MEDICAL_COST_MULTIPLIER = 1.2         // 20% increase in expenses

    // Calculate national pension start age based on current age
    const getNationalPensionStartAge = (age: number): number => {
      if (age < 50) return 65
      if (age < 53) return 64
      if (age < 56) return 63
      if (age < 59) return 62
      return 61
    }

    const nationalPensionStartAge = getNationalPensionStartAge(currentAge)
    const privatePensionStartAge = 55

    // Calculate initial net worth (순자산)
    // 금융자산
    const financialAssets =
      parseInt(data.savings || '0') +
      parseInt(data.stocks || '0') +
      parseInt(data.otherFinancialAsset || '0')

    // 주거 순자산
    let housingNetWorth = 0
    if (data.housingType === 'own') {
      // 자가: 부동산 평가액 - 주택담보대출
      const realEstateValue = parseInt(data.realEstate || '0')
      const mortgage = data.hasMortgage ? parseInt(data.mortgageAmount || '0') : 0
      housingNetWorth = realEstateValue - mortgage
    } else if (data.housingType === 'jeonse') {
      // 전세: 전세 보증금 (자산) - 전세자금대출 (부채)
      const jeonseDeposit = parseInt(data.jeonseDeposit || '0')
      const jeonseDebt = data.hasJeonseDebt ? parseInt(data.jeonseDebtAmount || '0') : 0
      housingNetWorth = jeonseDeposit - jeonseDebt
    } else if (data.housingType === 'rent') {
      // 월세: 보증금만 자산으로 포함
      housingNetWorth = parseInt(data.rentDeposit || '0')
    }

    // 기타 부채 (전세자금대출은 이미 주거 순자산에서 차감됨)
    const otherDebt = parseInt(data.otherDebt || '0')

    const initialAsset = financialAssets + housingNetWorth - otherDebt

    console.log('===== 초기 순자산 계산 =====')
    console.log(`금융자산: ${financialAssets.toLocaleString()}만원 (예금 ${data.savings} + 주식 ${data.stocks} + 기타 ${data.otherFinancialAsset})`)
    if (data.housingType === 'own') {
      console.log(`주거 순자산: ${housingNetWorth.toLocaleString()}만원 (자가: 부동산 ${data.realEstate} - 담보대출 ${data.hasMortgage ? data.mortgageAmount : 0})`)
    } else if (data.housingType === 'jeonse') {
      const jeonseDeposit = parseInt(data.jeonseDeposit || '0')
      const jeonseDebtAmount = data.hasJeonseDebt ? parseInt(data.jeonseDebtAmount || '0') : 0
      console.log(`주거 순자산: ${housingNetWorth.toLocaleString()}만원 (전세: 보증금 ${jeonseDeposit} - 전세자금대출 ${jeonseDebtAmount})`)
    } else {
      console.log(`주거 순자산: ${housingNetWorth.toLocaleString()}만원 (월세: 보증금 ${data.rentDeposit})`)
    }
    console.log(`기타 부채: ${otherDebt.toLocaleString()}만원`)
    console.log(`초기 순자산: ${initialAsset.toLocaleString()}만원 = ${financialAssets} + ${housingNetWorth} - ${otherDebt}`)
    console.log('==========================')

    // Initial income and expenses
    const baseMonthlyIncome = parseInt(data.income || '0') + parseInt(data.spouseIncome || '0')
    const baseMonthlyExpense = parseInt(data.expense || '0')
    const monthlyRent = data.housingType === 'rent' ? parseInt(data.monthlyRent || '0') : 0

    // Conservative annual return rate (3% to show urgency)
    const annualReturn = 0.03
    // const retirementReturn = 0.02 // Even more conservative post-retirement

    // Generate projection data
    const years: number[] = []
    const netWorth: number[] = []

    let currentAsset = initialAsset
    let currentIncome = baseMonthlyIncome
    let currentExpense = baseMonthlyExpense

    for (let age = currentAge; age <= lifeExpectancy; age++) {
      years.push(age)
      const yearsSinceStart = age - currentAge

      // BEFORE RETIREMENT
      if (age < retirementAge) {
        // 1. Apply wage growth (3.3% annually)
        currentIncome = baseMonthlyIncome * Math.pow(1 + WAGE_GROWTH_RATE, yearsSinceStart)

        // 2. Apply expense inflation (3% annually) and spending reduction
        const inflatedExpense = baseMonthlyExpense * Math.pow(1 + INFLATION_RATE, yearsSinceStart)
        currentExpense = inflatedExpense * (1 - preferences.spendingReductionRate)

        // 3. Calculate annual savings
        const annualSavings = (currentIncome - currentExpense - monthlyRent) * 12

        // 4. Apply financial events
        const eventsThisYear = preferences.financialEvents.filter(
          e => currentAge + e.yearsFromNow === age
        )
        const eventCosts = eventsThisYear.reduce((sum, e) => sum + e.amount, 0) // e.amount is already in 만원

        // 5. Add savings and subtract event costs
        currentAsset += annualSavings - eventCosts

        // 6. Apply investment returns
        currentAsset *= (1 + annualReturn)

        console.log(`Age ${age} (은퇴 전): Income=${currentIncome.toFixed(0)}만원/월, Expense=${currentExpense.toFixed(0)}만원/월, AnnualSavings=${annualSavings.toFixed(0)}만원/년, EventCosts=${eventCosts}만원, Asset=${currentAsset.toFixed(0)}만원`)
      }

      // AFTER RETIREMENT
      else {
        const yearsSinceRetirement = age - retirementAge

        // 1. Calculate post-retirement monthly expenses with inflation
        const baseRetirementExpense = baseMonthlyExpense *
          Math.pow(1 + INFLATION_RATE, retirementAge - currentAge) *
          POST_RETIREMENT_EXPENSE_RATIO

        let monthlyExpenseThisYear = baseRetirementExpense * Math.pow(1 + INFLATION_RATE, yearsSinceRetirement)

        // 2. Increase medical costs after age 75
        if (age >= MEDICAL_COST_INCREASE_AGE) {
          monthlyExpenseThisYear *= MEDICAL_COST_MULTIPLIER
        }

        // 3. Calculate pension income (age-dependent)
        let monthlyPensionThisYear = 0

        // National pension: User input is the expected amount at pension start age
        // Apply inflation only AFTER pension starts
        if (age >= nationalPensionStartAge) {
          const pensionYears = age - nationalPensionStartAge
          const baseNationalPension = parseInt(data.nationalPension || '0')
          const adjustedNationalPension = baseNationalPension * Math.pow(1 + INFLATION_RATE, pensionYears)
          monthlyPensionThisYear += adjustedNationalPension
        }

        // Private pensions: User input is TOTAL accumulated amount (not monthly)
        // Convert to monthly payment based on withdrawal period
        let withdrawalInfo = ''
        if (age >= privatePensionStartAge) {
          const retirementPensionTotal = parseInt(data.retirementPension || '0')
          const privatePensionTotal = parseInt(data.privatePension || '0')
          const totalPensionAssets = retirementPensionTotal + privatePensionTotal

          // Calculate annual withdrawal amount
          let annualWithdrawal = 0
          if (totalPensionAssets > 0) {
            // If annual withdrawal > 1500만원, use 20 years; otherwise 10 years
            const testWithdrawal = totalPensionAssets / 10
            const withdrawalPeriod = testWithdrawal > 1500 ? 20 : 10
            annualWithdrawal = totalPensionAssets / withdrawalPeriod

            // Only receive if within withdrawal period
            const yearsSinceStart = age - privatePensionStartAge
            if (yearsSinceStart < withdrawalPeriod) {
              monthlyPensionThisYear += annualWithdrawal / 12
              withdrawalInfo = ` [연금자산: ${totalPensionAssets}만원 / ${withdrawalPeriod}년 = 연 ${annualWithdrawal.toFixed(0)}만원]`
            } else {
              withdrawalInfo = ` [연금자산 수령 완료 (${withdrawalPeriod}년)]`
            }
          }
        }

        // 4. Calculate annual cash flow
        const annualPension = monthlyPensionThisYear * 12
        const annualExpenses = monthlyExpenseThisYear * 12
        const annualCashFlow = annualPension - annualExpenses

        console.log(`Age ${age}: NP=${data.nationalPension}, RP=${data.retirementPension}, PP=${data.privatePension} | Pension=${monthlyPensionThisYear.toFixed(0)}만원/월, Expense=${monthlyExpenseThisYear.toFixed(0)}만원/월, CashFlow=${annualCashFlow.toFixed(0)}만원/년, Asset=${currentAsset.toFixed(0)}만원${withdrawalInfo}`)

        // 5. Update asset: subtract deficit from pension shortfall
        // If pension < expenses, we withdraw from assets
        // If pension > expenses, we can save the surplus
        currentAsset += annualCashFlow

        // 6. Asset does NOT grow during retirement for conservative projection
        // (We're not assuming investment returns to show urgency)
        // If we wanted to show growth, we'd multiply by (1 + retirementReturn)
        // but for crisis/urgency, we show pure depletion
      }

      netWorth.push(Math.max(0, Math.round(currentAsset)))
    }

    // Calculate key metrics
    const finalAsset = netWorth[netWorth.length - 1]
    const retirementAsset = netWorth[retirementAge - currentAge]

    // Calculate target asset line (목표 은퇴 자산 유지)
    // 사용자 입력은 현재 물가 기준이므로, 은퇴 시점까지의 물가상승 반영 필요
    const targetAssetToday = parseInt(data.targetRetirementAsset || '0')
    const yearsToRetirement = retirementAge - currentAge
    const targetAssetAtRetirement = targetAssetToday * Math.pow(1 + INFLATION_RATE, yearsToRetirement)

    // 그래프에는 은퇴 시점부터 물가상승 반영한 목표 자산 표시
    const targetLine = years.map((age) => {
      if (age < retirementAge) {
        // 은퇴 전: 현재 시점부터 해당 나이까지의 물가상승 반영
        const yearsFromNow = age - currentAge
        return targetAssetToday * Math.pow(1 + INFLATION_RATE, yearsFromNow)
      } else {
        // 은퇴 후: 은퇴 시점의 목표 자산 유지 (물가상승 이미 반영됨)
        return targetAssetAtRetirement
      }
    })

    // Determine if projection is concerning (falls below target)
    const isConcerning = retirementAsset < targetAssetAtRetirement * 0.8 || finalAsset < targetAssetAtRetirement * 0.5

    // Chart data with target line
    const chartData = {
      labels: years,
      datasets: [
        {
          label: '예상 순자산',
          data: netWorth,
          borderColor: isConcerning ? '#ef4444' : '#4361ee',
          backgroundColor: isConcerning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(67, 97, 238, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: '목표 은퇴 자산',
          data: targetLine,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            font: {
              size: 12,
            },
            padding: 15,
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || ''
              return `${label}: ${context.parsed.y.toLocaleString()}만원`
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '나이',
          },
          ticks: {
            maxTicksLimit: 12,
          },
        },
        y: {
          title: {
            display: true,
            text: '순자산 (만원)',
          },
          ticks: {
            callback: (value: any) => {
              return (value / 10000).toFixed(0) + '억'
            },
          },
        },
      },
    }

    // If generating scenarios, show loading screen
    if (isGenerating) {
      return (
        <>
          {renderStepHeader(9, showNavigateButton ? '분석 완료' : '시나리오 생성 중')}
          <div className="prof-step-content">
            <div className="prof-generating-screen">
              {!showNavigateButton && (
                <>
                  <div className="generating-icon">
                    <div className="spinner"></div>
                  </div>
                  <h2 className="generating-title">{getPersonalizedName()}님의 전문가 분석 진행 중</h2>
                  <p className="generating-description">
                    {getPersonalizedName()}님의 정보를 바탕으로 맞춤형 은퇴 시나리오를 준비하고 있습니다.<br />
                    잠시만 기다려주세요.
                  </p>
                </>
              )}

              {showNavigateButton && (
                <>
                  <div className="generating-icon">
                    <div className="success-icon">✓</div>
                  </div>
                  <h2 className="generating-title">{getPersonalizedName()}님, 분석이 완료되었습니다</h2>
                  <p className="generating-description">
                    {getPersonalizedName()}님의 재무 상황을 분석하여 맞춤형 은퇴 시나리오를 준비했습니다.<br />
                    지금 바로 확인해보세요.
                  </p>
                </>
              )}

              <div className="retirement-tips">
                <h3 className="tips-title">은퇴 준비 핵심 팁</h3>
                <div className="tip-item">
                  <span className="tip-number">1</span>
                  <div className="tip-content">
                    <h4>조기 시작이 핵심</h4>
                    <p>복리 효과로 10년 일찍 시작하면 2배 이상의 자산 축적 가능</p>
                  </div>
                </div>
                <div className="tip-item">
                  <span className="tip-number">2</span>
                  <div className="tip-content">
                    <h4>분산 투자 필수</h4>
                    <p>주식, 채권, 부동산 등 다양한 자산에 분산하여 리스크 관리</p>
                  </div>
                </div>
                <div className="tip-item">
                  <span className="tip-number">3</span>
                  <div className="tip-content">
                    <h4>정기적인 점검</h4>
                    <p>최소 연 1회 은퇴 계획을 점검하고 필요시 조정</p>
                  </div>
                </div>
                <div className="tip-item">
                  <span className="tip-number">4</span>
                  <div className="tip-content">
                    <h4>세액공제 활용</h4>
                    <p>연금저축, IRP 등을 통해 연간 최대 900만원 세액공제 혜택</p>
                  </div>
                </div>
              </div>

              {showNavigateButton && (
                <button className="prof-navigate-btn" onClick={navigateToScenarios}>
                  은퇴 진단 결과 보러가기
                </button>
              )}
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        {renderStepHeader(9, '순자산 예상')}
        <div className="prof-step-content">
          <h2 className="prof-step-title">90세까지 순자산 예상</h2>
          <p className="prof-step-description">
            현재 입력하신 정보를 바탕으로 90세까지의 순자산 추이를 보여드립니다
          </p>

          <div className="prof-chart-container">
            <Line data={chartData} options={chartOptions} plugins={[retirementLinePlugin]} />
          </div>

          {isConcerning && (
            <div className="prof-warning-box">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <strong>주의가 필요합니다</strong>
                <p>
                  현재 계획으로는 목표 은퇴 자산 달성이 어려울 수 있습니다.
                  전문가의 맞춤 시나리오를 통해 개선 방법을 확인해보세요.
                </p>
              </div>
            </div>
          )}

          <div className="prof-projection-summary">
            <div className="prof-summary-item">
              <span className="summary-label">현재 순자산</span>
              <span className="summary-value">{initialAsset.toLocaleString()}만원</span>
            </div>
            <div className="prof-summary-item">
              <span className="summary-label">{retirementAge}세 (은퇴 시점) 예상 자산</span>
              <span className="summary-value" style={{
                color: retirementAsset < targetAssetAtRetirement * 0.8 ? '#ef4444' : '#1e293b'
              }}>
                {retirementAsset.toLocaleString()}만원
              </span>
              {retirementAsset < targetAssetAtRetirement && (
                <span className="summary-note" style={{ color: '#ef4444', fontSize: '12px' }}>
                  목표 대비 {Math.round((retirementAsset / targetAssetAtRetirement) * 100)}%
                </span>
              )}
            </div>
            <div className="prof-summary-item">
              <span className="summary-label">90세 예상 자산</span>
              <span className="summary-value" style={{ color: finalAsset > 0 ? '#10b981' : '#ef4444' }}>
                {finalAsset.toLocaleString()}만원
              </span>
            </div>
          </div>

          <p className="prof-chart-note">
            * 이 그래프는 보수적인 가정을 기반으로 합니다:<br />
            - 은퇴 전: 연 3.3% 임금 상승, 연 3% 물가 상승, 투자 수익률 {(annualReturn * 100).toFixed(1)}%<br />
            - 은퇴 후: 지출 75% 수준, 연금 수령 (국민연금 만 {nationalPensionStartAge}세부터), 투자수익 없음<br />
            - 목표 은퇴 자산: 입력하신 {targetAssetToday.toLocaleString()}만원(현재가치)은 {yearsToRetirement}년 후 약 {Math.round(targetAssetAtRetirement).toLocaleString()}만원(물가상승 반영)<br />
            - 연금 계산: 국민연금은 월 수령액 기준, 퇴직/개인연금은 현재 적립액을 {(() => {
              const rpTotal = parseInt(data.retirementPension || '0')
              const ppTotal = parseInt(data.privatePension || '0')
              const total = rpTotal + ppTotal
              if (total === 0) return '10년'
              const testWithdrawal = total / 10
              return testWithdrawal > 1500 ? '20년' : '10년'
            })()} 동안 균등 분할 수령<br />
            * DEBUG - 현재 월소득: {baseMonthlyIncome.toLocaleString()}만원, 월지출: {baseMonthlyExpense.toLocaleString()}만원, 은퇴후 월지출: {Math.round(baseMonthlyExpense * POST_RETIREMENT_EXPENSE_RATIO).toLocaleString()}만원<br />
            * 전문가의 맞춤 전략으로 더 나은 결과를 얻을 수 있습니다.
          </p>

          <button className="prof-generate-btn" onClick={handleGenerateScenarios}>
            맞춤 시나리오 생성하기
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="professional-app">
      <div className="prof-container">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
        {currentStep === 6 && renderStep6()}
        {currentStep === 7 && renderStep7()}
        {currentStep === 8 && renderStep8()}
        {currentStep === 9 && renderStep9()}
      </div>
    </div>
  )
}

export default ProfessionalApp
