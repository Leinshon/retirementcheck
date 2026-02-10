import { useState, useEffect } from 'react'
import './ScenarioPlanning.css'

// 타입 정의
type EventType = 'housing' | 'deposit' | 'renovation' | 'car' | 'appliance' | 'travel' | 'childWedding' | 'parentCare' | 'debtPayoff' | 'emergency' | 'custom'
type HousingRegion = 'seoul-gangnam' | 'seoul-other' | 'gyeonggi-south' | 'gyeonggi-north' | 'metro' | 'rural' | 'undecided'

// 새로운 시나리오 타입 정의
type LifecycleGoal = 'yolo' | 'fire' | 'standard'
type InvestmentStyle = 'conservative' | 'market' | 'aggressive'
type CashflowControl = 'minimal' | 'maintain' | 'leisure'
type RetirementQuality = 'highEnd' | 'lean'
type RetirementFlexibility = 'fixed' | 'slight' | 'flexible' | 'earlier'

interface ScenarioChoices {
  lifecycleGoal: LifecycleGoal | null
  investmentStyle: InvestmentStyle | null
  cashflowControl: CashflowControl | null
  retirementQuality: RetirementQuality | null
  retirementFlexibility: RetirementFlexibility | null
}

// 시나리오 옵션 정의
const LIFECYCLE_GOAL_OPTIONS: { type: LifecycleGoal; label: string; shortLabel: string; description: string }[] = [
  { type: 'yolo', label: '현재 집중형', shortLabel: 'YOLO', description: '젊은 시절의 경험과 소비에 비중. 은퇴 자금은 최소화하되 현재의 삶의 질을 높이는 구조' },
  { type: 'fire', label: '미래 준비형', shortLabel: 'FIRE', description: '파이어족 모델. 현재 지출을 줄이고 연금/저축 비중을 높여 은퇴 시점을 앞당기는 시나리오' },
  { type: 'standard', label: '균형 성장형', shortLabel: '균형', description: '일반적인 생애 주기에 맞춰 자녀 교육, 주택 확장, 노후 준비를 표준 비율로 배분' },
]

const INVESTMENT_STYLE_OPTIONS: { type: InvestmentStyle; label: string; returnRate: string; description: string }[] = [
  { type: 'conservative', label: '보수적 방어형', returnRate: '연 1~2%', description: '예적금/채권 중심. 물가 상승률 수준의 수익률, 원금 보존에 초점' },
  { type: 'market', label: '시장 수익형', returnRate: '연 4~6%', description: '인덱스 펀드/우량주 중심. 평균적인 시장 성장을 가정' },
  { type: 'aggressive', label: '공격적 자산 증식형', returnRate: '연 8%+', description: '성장주/대체 투자 등 고수익 자산 비중을 높여 자산 규모 극대화 (변동성 위험 있음)' },
]

const CASHFLOW_CONTROL_OPTIONS: { type: CashflowControl; label: string; savingsImpact: string; description: string }[] = [
  { type: 'minimal', label: '미니멀 라이프', savingsImpact: '+30%', description: '필수 생계비 외 지출 30% 절감. 순자산 증가 속도 극대화' },
  { type: 'maintain', label: '현재 유지형', savingsImpact: '0%', description: '현재 소비 패턴 100% 유지. 심리적 만족도 유지, 자산 완만한 증가' },
  { type: 'leisure', label: '레저/자기계발형', savingsImpact: '-20%', description: '비정기 지출(여행, 교육) 확대. 자산 증식은 더디지만 인적 자본 가치 상승' },
]

const RETIREMENT_QUALITY_OPTIONS: { type: RetirementQuality; label: string; strategy: string; description: string }[] = [
  { type: 'highEnd', label: '안락한 노후형', strategy: '연금 저축 확대', description: '은퇴 후에도 현재 생활 수준 유지. 지금부터 연금 저축을 공격적으로 늘리는 시나리오' },
  { type: 'lean', label: '미니멀 노후형', strategy: '현재 집중', description: '은퇴 후 지출 최소화. 기초연금/주택연금에 의존, 현재의 부채 상환이나 자녀 지원에 집중' },
]

const RETIREMENT_FLEXIBILITY_OPTIONS: { type: RetirementFlexibility; label: string; description: string }[] = [
  { type: 'fixed', label: '계획대로 유지', description: '목표한 시점에 맞춰 은퇴하고 싶다' },
  { type: 'slight', label: '1~3년 유연', description: '필요하다면 소폭 늦출 수 있다' },
  { type: 'flexible', label: '5년 이상 유연', description: '목표 달성이 중요하므로 상당히 늦출 수 있다' },
  { type: 'earlier', label: '오히려 앞당기고 싶다', description: '가능하다면 더 빨리 은퇴하고 싶다' },
]



interface ExpenseEvent {
  id: string
  type: EventType
  customLabel?: string
  yearsFromNow: number
  expectedAge: number
  amount: number
  enabled: boolean  // 이 지출 계획이 있는지 여부
  housingRegion?: HousingRegion  // 주택구매 시 선호 지역
}



interface ScenarioPlanningData {
  customerName: string
  currentAge: number
  targetRetirementAge: number
  yearsToRetirement: number
  expenseEvents: ExpenseEvent[]
  totalExpenseAmount: number
  // 새로운 시나리오 선택
  scenarioChoices: ScenarioChoices
  // 기타 참고사항
  additionalNotes: string
  createdAt: string
  updatedAt: string
}

// 계획 중인 지출/목표 옵션 (통합)
const EVENT_OPTIONS: { type: EventType; label: string; defaultAmount: number; defaultYears: number; description: string }[] = [
  { type: 'housing', label: '내 집 마련', defaultAmount: 10000, defaultYears: 5, description: '주택 구입 시드머니 또는 매매 자금' },
  { type: 'deposit', label: '전세/월세 보증금', defaultAmount: 5000, defaultYears: 2, description: '보증금 증액 또는 이사 비용' },
  { type: 'renovation', label: '집 수리/리모델링', defaultAmount: 2000, defaultYears: 5, description: '인테리어, 대수선 등' },
  { type: 'car', label: '차량 구입/교체', defaultAmount: 4000, defaultYears: 5, description: '새 차 구입, 중고차 교체 등' },
  { type: 'appliance', label: '가전/가구 교체', defaultAmount: 500, defaultYears: 3, description: '냉장고, 에어컨, 소파 등 대형 품목' },
  { type: 'travel', label: '가족 여행', defaultAmount: 500, defaultYears: 2, description: '해외여행, 가족 휴가 등' },
  { type: 'childWedding', label: '자녀 결혼 지원', defaultAmount: 10000, defaultYears: 15, description: '결혼 자금, 신혼집 지원 등' },
  { type: 'parentCare', label: '부모 요양/간병', defaultAmount: 3000, defaultYears: 10, description: '요양원비, 간병비, 병원비 등' },
  { type: 'debtPayoff', label: '부채 상환', defaultAmount: 5000, defaultYears: 3, description: '대출 조기 상환 목표' },
  { type: 'emergency', label: '비상금/목돈 마련', defaultAmount: 3000, defaultYears: 2, description: '6개월~1년치 생활비 확보' },
]

// 주택 선호 지역 옵션
const HOUSING_REGION_OPTIONS: { region: HousingRegion; label: string; description: string }[] = [
  { region: 'seoul-gangnam', label: '서울 강남권', description: '강남, 서초, 송파 등' },
  { region: 'seoul-other', label: '서울 기타', description: '강북, 마포, 영등포 등' },
  { region: 'gyeonggi-south', label: '경기 남부', description: '성남, 용인, 수원 등' },
  { region: 'gyeonggi-north', label: '경기 북부', description: '고양, 파주, 의정부 등' },
  { region: 'metro', label: '광역시', description: '부산, 대구, 인천 등' },
  { region: 'rural', label: '지방/귀촌', description: '소도시, 농촌 지역' },
  { region: 'undecided', label: '미정', description: '아직 결정하지 않음' },
]






const ScenarioPlanning = () => {
  // GlobalData에서 기본 정보 로드
  const [customerName, setCustomerName] = useState('고객')
  const [currentAge, setCurrentAge] = useState(45)
  const [targetRetirementAge, setTargetRetirementAge] = useState(60)

  // 시나리오 선택 상태
  const [lifecycleGoal, setLifecycleGoal] = useState<LifecycleGoal | null>(null)
  const [investmentStyle, setInvestmentStyle] = useState<InvestmentStyle | null>(null)
  const [cashflowControl, setCashflowControl] = useState<CashflowControl | null>(null)
  const [retirementQuality, setRetirementQuality] = useState<RetirementQuality | null>(null)
  const [retirementFlexibility, setRetirementFlexibility] = useState<RetirementFlexibility | null>(null)

  // 지출 이벤트 (기본 체크리스트로 초기화)
  const [expenseEvents, setExpenseEvents] = useState<ExpenseEvent[]>(() =>
    EVENT_OPTIONS.map((opt) => ({
      id: `event-${opt.type}`,
      type: opt.type,
      yearsFromNow: opt.defaultYears,
      expectedAge: 45 + opt.defaultYears,  // 초기값, useEffect에서 재계산
      amount: opt.defaultAmount,
      enabled: false,  // 기본적으로 체크 해제
    }))
  )

  // 기타 지출 이벤트 (사용자가 직접 추가)
  const [customEvents, setCustomEvents] = useState<ExpenseEvent[]>([])

  // 기타 참고사항
  const [additionalNotes, setAdditionalNotes] = useState('')

  // 저장 상태
  const [isSaved, setIsSaved] = useState(false)

  // localStorage에서 GlobalData 로드
  useEffect(() => {
    const savedData = localStorage.getItem('professionalDiagnosisData')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        if (parsed.customerName) setCustomerName(parsed.customerName)
        if (parsed.currentAge) setCurrentAge(parsed.currentAge)
        if (parsed.targetRetirementAge) setTargetRetirementAge(parsed.targetRetirementAge)
      } catch {
        // 파싱 실패 시 기본값 사용
      }
    }

    // 기존 시나리오 데이터가 있으면 로드
    const savedScenario = localStorage.getItem('scenarioPlanningData')
    if (savedScenario) {
      try {
        const parsed: ScenarioPlanningData = JSON.parse(savedScenario)
        setTargetRetirementAge(parsed.targetRetirementAge)

        // 저장된 expenseEvents가 있으면 병합
        if (parsed.expenseEvents && parsed.expenseEvents.length > 0) {
          setExpenseEvents(prev => prev.map(event => {
            const saved = parsed.expenseEvents.find(e => e.type === event.type)
            if (saved) {
              // id는 현재 event의 id를 유지 (localStorage의 오래된 id로 덮어쓰지 않음)
              return { ...event, ...saved, id: event.id }
            }
            return event
          }))
          // custom 타입 이벤트는 별도 처리
          const customEvts = parsed.expenseEvents.filter(e => e.type === 'custom')
          if (customEvts.length > 0) {
            setCustomEvents(customEvts)
          }
        }

        // 기타 참고사항 로드
        if (parsed.additionalNotes) {
          setAdditionalNotes(parsed.additionalNotes)
        }
        // 시나리오 선택 로드
        if (parsed.scenarioChoices) {
          if (parsed.scenarioChoices.lifecycleGoal) setLifecycleGoal(parsed.scenarioChoices.lifecycleGoal)
          if (parsed.scenarioChoices.investmentStyle) setInvestmentStyle(parsed.scenarioChoices.investmentStyle)
          if (parsed.scenarioChoices.cashflowControl) setCashflowControl(parsed.scenarioChoices.cashflowControl)
          if (parsed.scenarioChoices.retirementQuality) setRetirementQuality(parsed.scenarioChoices.retirementQuality)
          if (parsed.scenarioChoices.retirementFlexibility) setRetirementFlexibility(parsed.scenarioChoices.retirementFlexibility)
        }
      } catch {
        // 파싱 실패 시 무시
      }
    }
  }, [])

  // 계산값
  const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge)
  const enabledExpenseEvents = [...expenseEvents.filter(e => e.enabled), ...customEvents.filter(e => e.enabled)]
  const totalExpenseAmount = enabledExpenseEvents.reduce((sum, e) => sum + e.amount, 0)

  // 기본 이벤트 토글 (체크박스)
  const toggleEvent = (id: string) => {
    setExpenseEvents(prev => prev.map(e => {
      if (e.id !== id) return e
      return { ...e, enabled: !e.enabled }
    }))
    setIsSaved(false)
  }

  // 기본 이벤트 업데이트
  const updateEvent = (id: string, field: keyof ExpenseEvent, value: string | number | boolean) => {
    setExpenseEvents(prev => prev.map(e => {
      if (e.id !== id) return e

      const updated = { ...e, [field]: value }

      // yearsFromNow 변경 시 expectedAge 재계산
      if (field === 'yearsFromNow') {
        updated.expectedAge = currentAge + (value as number)
      }

      return updated
    }))
    setIsSaved(false)
  }

  // 기타 이벤트 추가
  const addCustomEvent = () => {
    const newEvent: ExpenseEvent = {
      id: Date.now().toString(),
      type: 'custom',
      customLabel: '',
      yearsFromNow: 5,
      expectedAge: currentAge + 5,
      amount: 1000,
      enabled: true,
    }
    setCustomEvents(prev => [...prev, newEvent])
    setIsSaved(false)
  }

  // 기타 이벤트 삭제
  const removeCustomEvent = (id: string) => {
    setCustomEvents(prev => prev.filter(e => e.id !== id))
    setIsSaved(false)
  }

  // 기타 이벤트 업데이트
  const updateCustomEvent = (id: string, field: keyof ExpenseEvent, value: string | number | boolean) => {
    setCustomEvents(prev => prev.map(e => {
      if (e.id !== id) return e

      const updated = { ...e, [field]: value }

      if (field === 'yearsFromNow') {
        updated.expectedAge = currentAge + (value as number)
      }

      return updated
    }))
    setIsSaved(false)
  }

  // 복사 상태
  const [isCopied, setIsCopied] = useState(false)

  // AI용 JSON 데이터 생성
  const generateAIPromptData = () => {
    // 시나리오 선택값을 읽기 쉬운 형태로 변환
    const lifecycleGoalInfo = lifecycleGoal ? LIFECYCLE_GOAL_OPTIONS.find(o => o.type === lifecycleGoal) : null
    const investmentStyleInfo = investmentStyle ? INVESTMENT_STYLE_OPTIONS.find(o => o.type === investmentStyle) : null
    const cashflowControlInfo = cashflowControl ? CASHFLOW_CONTROL_OPTIONS.find(o => o.type === cashflowControl) : null
    const retirementQualityInfo = retirementQuality ? RETIREMENT_QUALITY_OPTIONS.find(o => o.type === retirementQuality) : null
    const retirementFlexibilityInfo = retirementFlexibility ? RETIREMENT_FLEXIBILITY_OPTIONS.find(o => o.type === retirementFlexibility) : null

    // 활성화된 지출 이벤트만 추출
    const plannedExpenses = enabledExpenseEvents.map(e => {
      const option = EVENT_OPTIONS.find(o => o.type === e.type)
      const base: {
        항목: string
        예상시기: string
        예상금액_만원: number
        선호지역?: string
      } = {
        항목: e.type === 'custom' ? (e.customLabel || '기타') : (option?.label || e.type),
        예상시기: `${e.yearsFromNow}년 후 (${currentAge + e.yearsFromNow}세)`,
        예상금액_만원: e.amount,
      }
      if (e.type === 'housing' && e.housingRegion) {
        const regionInfo = HOUSING_REGION_OPTIONS.find(r => r.region === e.housingRegion)
        base.선호지역 = regionInfo?.label || e.housingRegion
      }
      return base
    })

    const aiData = {
      고객정보: {
        이름: customerName,
        현재나이: currentAge,
        목표은퇴나이: targetRetirementAge,
        은퇴까지_남은_년수: yearsToRetirement,
      },
      재무시나리오_선택: {
        생애주기목표: lifecycleGoalInfo ? {
          선택: lifecycleGoalInfo.label,
          설명: lifecycleGoalInfo.description,
        } : null,
        투자성향: investmentStyleInfo ? {
          선택: investmentStyleInfo.label,
          예상수익률: investmentStyleInfo.returnRate,
          설명: investmentStyleInfo.description,
        } : null,
        지출통제수준: cashflowControlInfo ? {
          선택: cashflowControlInfo.label,
          저축률변화: cashflowControlInfo.savingsImpact,
          설명: cashflowControlInfo.description,
        } : null,
        은퇴후삶의질: retirementQualityInfo ? {
          선택: retirementQualityInfo.label,
          전략: retirementQualityInfo.strategy,
          설명: retirementQualityInfo.description,
        } : null,
      },
      은퇴시점유연성: retirementFlexibilityInfo ? {
        선택: retirementFlexibilityInfo.label,
        설명: retirementFlexibilityInfo.description,
      } : null,
      계획된_주요지출: {
        총_지출_건수: plannedExpenses.length,
        총_예상금액_만원: totalExpenseAmount,
        상세내역: plannedExpenses,
      },
      기타_참고사항: additionalNotes || null,
    }

    return aiData
  }

  // 저장
  const handleSave = () => {
    const data: ScenarioPlanningData = {
      customerName,
      currentAge,
      targetRetirementAge,
      yearsToRetirement,
      expenseEvents: [...expenseEvents, ...customEvents].map(e => ({
        ...e,
        expectedAge: currentAge + e.yearsFromNow,
      })),
      totalExpenseAmount,
      scenarioChoices: {
        lifecycleGoal,
        investmentStyle,
        cashflowControl,
        retirementQuality,
        retirementFlexibility,
      },
      additionalNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem('scenarioPlanningData', JSON.stringify(data))
    setIsSaved(true)
    setIsCopied(false)
  }

  // JSON 복사
  const handleCopyJSON = async () => {
    const aiData = generateAIPromptData()
    const jsonString = JSON.stringify(aiData, null, 2)

    try {
      await navigator.clipboard.writeText(jsonString)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // 클립보드 API 실패 시 fallback
      const textarea = document.createElement('textarea')
      textarea.value = jsonString
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    if (amount >= 10000) {
      const billions = Math.floor(amount / 10000)
      const remainder = amount % 10000
      return remainder > 0 ? `${billions}억 ${remainder.toLocaleString()}만원` : `${billions}억원`
    }
    return `${amount.toLocaleString()}만원`
  }

  return (
    <div className="scenario-planning-container">
      {/* 헤더 */}
      <header className="sp-header">
        <div className="sp-header-title">시나리오 설계</div>
        <div className="sp-header-subtitle">은퇴 계획을 위한 주요 변수를 설정해주세요</div>
      </header>

      {/* 고객 정보 요약 */}
      <section className="sp-customer-summary">
        <div className="sp-customer-name">{customerName}님</div>
        <div className="sp-customer-stats">
          <div className="sp-stat-item">
            <span className="sp-stat-label">현재 나이</span>
            <span className="sp-stat-value">{currentAge}세</span>
          </div>
          <div className="sp-stat-item">
            <span className="sp-stat-label">목표 은퇴</span>
            <span className="sp-stat-value">{targetRetirementAge}세</span>
          </div>
          <div className="sp-stat-item">
            <span className="sp-stat-label">은퇴까지</span>
            <span className="sp-stat-value">{yearsToRetirement}년</span>
          </div>
        </div>
      </section>

      {/* 시나리오 선택 섹션 */}
      <section className="sp-scenario-selection">
        <h2 className="sp-scenario-title">나의 재무 시나리오 선택</h2>
        <p className="sp-scenario-subtitle">4가지 관점에서 나에게 맞는 재무 전략을 선택해주세요</p>

        {/* 1. 생애 주기 목표 */}
        <div className="sp-scenario-category">
          <h3 className="sp-scenario-category-title">1. 생애 주기 목표</h3>
          <p className="sp-scenario-category-desc">인생의 어떤 단계에 무게중심을 두시겠습니까?</p>
          <div className="sp-scenario-options">
            {LIFECYCLE_GOAL_OPTIONS.map(option => (
              <div
                key={option.type}
                className={`sp-scenario-option ${lifecycleGoal === option.type ? 'selected' : ''}`}
                onClick={() => {
                  setLifecycleGoal(option.type)
                  setIsSaved(false)
                }}
              >
                <div className="sp-scenario-option-header">
                  <span className="sp-scenario-option-label">{option.label}</span>
                  <span className="sp-scenario-option-badge">{option.shortLabel}</span>
                </div>
                <p className="sp-scenario-option-desc">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 2. 투자 성향 */}
        <div className="sp-scenario-category">
          <h3 className="sp-scenario-category-title">2. 투자 성향 및 수익률</h3>
          <p className="sp-scenario-category-desc">자산을 어떤 속도로 불려나가시겠습니까?</p>
          <div className="sp-scenario-options">
            {INVESTMENT_STYLE_OPTIONS.map(option => (
              <div
                key={option.type}
                className={`sp-scenario-option ${investmentStyle === option.type ? 'selected' : ''}`}
                onClick={() => {
                  setInvestmentStyle(option.type)
                  setIsSaved(false)
                }}
              >
                <div className="sp-scenario-option-header">
                  <span className="sp-scenario-option-label">{option.label}</span>
                  <span className="sp-scenario-option-rate">{option.returnRate}</span>
                </div>
                <p className="sp-scenario-option-desc">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. 지출 통제 수준 */}
        <div className="sp-scenario-category">
          <h3 className="sp-scenario-category-title">3. 지출 통제 수준</h3>
          <p className="sp-scenario-category-desc">나가는 돈의 효율성을 어떻게 관리하시겠습니까?</p>
          <div className="sp-scenario-options">
            {CASHFLOW_CONTROL_OPTIONS.map(option => (
              <div
                key={option.type}
                className={`sp-scenario-option ${cashflowControl === option.type ? 'selected' : ''}`}
                onClick={() => {
                  setCashflowControl(option.type)
                  setIsSaved(false)
                }}
              >
                <div className="sp-scenario-option-header">
                  <span className="sp-scenario-option-label">{option.label}</span>
                  <span className={`sp-scenario-option-impact ${option.savingsImpact.startsWith('+') ? 'positive' : option.savingsImpact.startsWith('-') ? 'negative' : ''}`}>
                    저축률 {option.savingsImpact}
                  </span>
                </div>
                <p className="sp-scenario-option-desc">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. 은퇴 후 삶의 질 */}
        <div className="sp-scenario-category">
          <h3 className="sp-scenario-category-title">4. 은퇴 후 삶의 질</h3>
          <p className="sp-scenario-category-desc">연금과 자산을 은퇴 후에 어떻게 사용하시겠습니까?</p>
          <div className="sp-scenario-options two-cols">
            {RETIREMENT_QUALITY_OPTIONS.map(option => (
              <div
                key={option.type}
                className={`sp-scenario-option ${retirementQuality === option.type ? 'selected' : ''}`}
                onClick={() => {
                  setRetirementQuality(option.type)
                  setIsSaved(false)
                }}
              >
                <div className="sp-scenario-option-header">
                  <span className="sp-scenario-option-label">{option.label}</span>
                  <span className="sp-scenario-option-strategy">{option.strategy}</span>
                </div>
                <p className="sp-scenario-option-desc">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 선택 요약 */}
        {(lifecycleGoal || investmentStyle || cashflowControl || retirementQuality) && (
          <div className="sp-scenario-summary">
            <h4 className="sp-scenario-summary-title">선택한 시나리오</h4>
            <div className="sp-scenario-summary-items">
              {lifecycleGoal && (
                <div className="sp-scenario-summary-item">
                  <span className="sp-summary-item-label">생애 목표</span>
                  <span className="sp-summary-item-value">
                    {LIFECYCLE_GOAL_OPTIONS.find(o => o.type === lifecycleGoal)?.label}
                  </span>
                </div>
              )}
              {investmentStyle && (
                <div className="sp-scenario-summary-item">
                  <span className="sp-summary-item-label">투자 성향</span>
                  <span className="sp-summary-item-value">
                    {INVESTMENT_STYLE_OPTIONS.find(o => o.type === investmentStyle)?.label}
                  </span>
                </div>
              )}
              {cashflowControl && (
                <div className="sp-scenario-summary-item">
                  <span className="sp-summary-item-label">지출 통제</span>
                  <span className="sp-summary-item-value">
                    {CASHFLOW_CONTROL_OPTIONS.find(o => o.type === cashflowControl)?.label}
                  </span>
                </div>
              )}
              {retirementQuality && (
                <div className="sp-scenario-summary-item">
                  <span className="sp-summary-item-label">노후 계획</span>
                  <span className="sp-summary-item-value">
                    {RETIREMENT_QUALITY_OPTIONS.find(o => o.type === retirementQuality)?.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Section 1: 은퇴 시점 유연성 */}
      <section className="sp-section">
        <h2 className="sp-section-title">1. 은퇴 시점 유연성</h2>
        <div className="sp-section-content">
          <div className="sp-retirement-flexibility">
            <div className="sp-retirement-current">
              <span className="sp-retirement-current-label">현재 목표 은퇴 나이</span>
              <span className="sp-retirement-current-value">{targetRetirementAge}세</span>
              <span className="sp-retirement-current-info">({yearsToRetirement}년 후)</span>
            </div>
            <p className="sp-flexibility-question">재무 목표 달성을 위해 은퇴 시점을 조정할 의향이 있으신가요?</p>
            <div className="sp-flexibility-options">
              {RETIREMENT_FLEXIBILITY_OPTIONS.map(option => (
                <div
                  key={option.type}
                  className={`sp-flexibility-option ${retirementFlexibility === option.type ? 'selected' : ''}`}
                  onClick={() => {
                    setRetirementFlexibility(option.type)
                    setIsSaved(false)
                  }}
                >
                  <span className="sp-flexibility-option-label">{option.label}</span>
                  <span className="sp-flexibility-option-desc">{option.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: 계획 중인 지출/목표 */}
      <section className="sp-section">
        <h2 className="sp-section-title">2. 계획 중인 지출/목표</h2>
        <p className="sp-section-desc">은퇴 전까지 계획하고 있는 주요 지출이나 재무 목표를 선택해주세요</p>
        <div className="sp-section-content">
          {/* 기본 체크리스트 */}
          <div className="sp-event-checklist">
            {expenseEvents.map((event) => {
              const option = EVENT_OPTIONS.find(o => o.type === event.type)
              return (
                <div key={event.id} className={`sp-event-check-item ${event.enabled ? 'enabled' : ''}`}>
                  <div className="sp-event-check-header">
                    <div className="sp-checkbox-label">
                      <input
                        type="checkbox"
                        checked={event.enabled}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleEvent(event.id)
                        }}
                        className="sp-checkbox"
                      />
                      <span
                        className="sp-event-name"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleEvent(event.id)
                        }}
                      >
                        {option?.label}
                      </span>
                    </div>
                    <span className="sp-event-desc">{option?.description}</span>
                  </div>

                  {event.enabled && (
                    <div className="sp-event-check-details">
                      <div className="sp-event-timing">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={event.yearsFromNow}
                          onChange={(e) => updateEvent(event.id, 'yearsFromNow', parseInt(e.target.value) || 1)}
                          className="sp-input sp-input-years"
                        />
                        <span className="sp-years-label">년 후</span>
                        <span className="sp-expected-age">({currentAge + event.yearsFromNow}세)</span>
                      </div>

                      <div className="sp-event-amount">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={event.amount}
                          onChange={(e) => updateEvent(event.id, 'amount', parseInt(e.target.value) || 0)}
                          className="sp-input sp-input-amount"
                        />
                        <span className="sp-amount-unit">만원</span>
                      </div>

                      {/* 주택구매 시 선호 지역 선택 */}
                      {event.type === 'housing' && (
                        <div className="sp-housing-region">
                          <span className="sp-field-label">선호 지역</span>
                          <select
                            value={event.housingRegion || 'undecided'}
                            onChange={(e) => updateEvent(event.id, 'housingRegion', e.target.value)}
                            className="sp-select sp-select-region"
                          >
                            {HOUSING_REGION_OPTIONS.map(opt => (
                              <option key={opt.region} value={opt.region}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 기타 지출 (직접 추가) */}
          {customEvents.length > 0 && (
            <div className="sp-custom-events">
              <div className="sp-custom-events-title">기타 지출</div>
              {customEvents.map((event) => (
                <div key={event.id} className="sp-event-item">
                  <div className="sp-event-row">
                    <input
                      type="text"
                      placeholder="지출 항목명 입력"
                      value={event.customLabel || ''}
                      onChange={(e) => updateCustomEvent(event.id, 'customLabel', e.target.value)}
                      className="sp-input sp-input-custom"
                    />
                    <button
                      onClick={() => removeCustomEvent(event.id)}
                      className="sp-btn-remove"
                      aria-label="삭제"
                    >
                      X
                    </button>
                  </div>

                  <div className="sp-event-row sp-event-details">
                    <div className="sp-event-timing">
                      <input
                        type="number"
                        min="1"
                        max="40"
                        value={event.yearsFromNow}
                        onChange={(e) => updateCustomEvent(event.id, 'yearsFromNow', parseInt(e.target.value) || 1)}
                        className="sp-input sp-input-years"
                      />
                      <span className="sp-years-label">년 후</span>
                      <span className="sp-expected-age">({currentAge + event.yearsFromNow}세)</span>
                    </div>

                    <div className="sp-event-amount">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={event.amount}
                        onChange={(e) => updateCustomEvent(event.id, 'amount', parseInt(e.target.value) || 0)}
                        className="sp-input sp-input-amount"
                      />
                      <span className="sp-amount-unit">만원</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={addCustomEvent} className="sp-btn-add">
            + 기타 지출 추가
          </button>

          {enabledExpenseEvents.length > 0 && (
            <div className="sp-event-summary">
              <span className="sp-summary-label">총 예상 지출</span>
              <span className="sp-summary-value">{formatAmount(totalExpenseAmount)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: 기타 참고사항 */}
      <section className="sp-section">
        <h2 className="sp-section-title">3. 기타 참고사항</h2>
        <p className="sp-section-desc">시나리오 설계 시 참고할 사항이 있다면 자유롭게 작성해주세요</p>
        <div className="sp-section-content">
          <textarea
            className="sp-additional-notes"
            value={additionalNotes}
            onChange={(e) => {
              setAdditionalNotes(e.target.value)
              setIsSaved(false)
            }}
            placeholder="예: 은퇴 후 강의/컨설팅 계획, 부동산 증여 예정, 퇴직금 예상 금액, 보험 만기금, 상속 예정 자산 등"
            rows={3}
          />
        </div>
      </section>

      {/* 저장 버튼 */}
      <div className="sp-actions">
        <button onClick={handleSave} className="sp-btn-save">
          저장하기
        </button>
        {isSaved && (
          <>
            <div className="sp-save-message">저장되었습니다</div>
            <button onClick={handleCopyJSON} className="sp-btn-copy">
              {isCopied ? '복사 완료' : 'AI용 JSON 복사'}
            </button>
          </>
        )}
      </div>

      {/* 저장 후 요약 표시 */}
      {isSaved && (
        <section className="sp-summary-section">
          <h3 className="sp-summary-title">입력 요약</h3>
          <div className="sp-summary-content">
            <div className="sp-summary-row">
              <span className="sp-summary-key">고객명</span>
              <span className="sp-summary-val">{customerName}</span>
            </div>
            <div className="sp-summary-row">
              <span className="sp-summary-key">현재 나이</span>
              <span className="sp-summary-val">{currentAge}세</span>
            </div>
            <div className="sp-summary-row">
              <span className="sp-summary-key">목표 은퇴 나이</span>
              <span className="sp-summary-val">{targetRetirementAge}세 (은퇴까지 {yearsToRetirement}년)</span>
            </div>
            <div className="sp-summary-row">
              <span className="sp-summary-key">예상 지출 이벤트</span>
              <span className="sp-summary-val">
                {enabledExpenseEvents.length === 0
                  ? '없음'
                  : `${enabledExpenseEvents.length}건 (총 ${formatAmount(totalExpenseAmount)})`}
              </span>
            </div>
            {enabledExpenseEvents.length > 0 && (
              <div className="sp-summary-events">
                {enabledExpenseEvents.map(e => (
                  <div key={e.id} className="sp-summary-event">
                    - {e.type === 'custom' ? e.customLabel : EVENT_OPTIONS.find(o => o.type === e.type)?.label}:
                    {' '}{currentAge + e.yearsFromNow}세, {formatAmount(e.amount)}
                  </div>
                ))}
              </div>
            )}
            {additionalNotes && (
              <div className="sp-summary-row">
                <span className="sp-summary-key">기타 참고사항</span>
                <span className="sp-summary-val">{additionalNotes}</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default ScenarioPlanning
