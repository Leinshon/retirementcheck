import { useState } from 'react'
import './DiagnosisReportV2.css'
import { householdFinance2025, type AgeGroup, estimatePercentiles } from './data/householdFinance2025'

// globalData 타입 정의
interface GlobalData {
  customerName: string
  currentAge: number
  spouseAge: number
  lifeExpectancy: number
  targetRetirementAge: number
  targetMonthlyCashflow: number
  targetAsset: number
  nationalPensionPersonal: number
  nationalPensionSpouse: number
  retirementPensionPersonal: number
  retirementPensionSpouse: number
  privatePensionPersonal: number
  privatePensionSpouse: number
  otherIncomePersonal: number
  otherIncomeSpouse: number
  realEstateAsset: number
  cashAsset: number
  investmentAsset: number
  pensionAsset: number
  mortgageAmount: number
  mortgageRate: number
  creditLoanAmount: number
  creditLoanRate: number
  otherDebtAmount: number
  otherDebtRate: number
  monthlyIncome: number
  monthlyFixedExpense: number
  monthlyLivingExpense: number
  // 지출 세부 항목 (5개 섹션)
  expenseFood: number           // 식비
  expenseTransport: number      // 교통비
  expenseShopping: number       // 쇼핑/미용비
  expenseLeisure: number        // 유흥/여가비
  expenseOther: number          // 기타 비용
  // 진단 결과 요약 (직접 입력)
  diagnosisSummary: string      // 진단 결과 요약 (빈 문자열이면 자동 생성)
}

const defaultGlobalData: GlobalData = {
  customerName: '고객',
  currentAge: 40,
  spouseAge: 38,
  lifeExpectancy: 90,
  targetRetirementAge: 55,
  targetMonthlyCashflow: 300,
  targetAsset: 10,
  nationalPensionPersonal: 85,
  nationalPensionSpouse: 65,
  retirementPensionPersonal: 55,
  retirementPensionSpouse: 35,
  privatePensionPersonal: 40,
  privatePensionSpouse: 20,
  otherIncomePersonal: 20,
  otherIncomeSpouse: 0,
  realEstateAsset: 6.0,
  cashAsset: 0.5,
  investmentAsset: 2.0,
  pensionAsset: 1.0,
  mortgageAmount: 8000,
  mortgageRate: 4.5,
  creditLoanAmount: 3000,
  creditLoanRate: 6.8,
  otherDebtAmount: 1000,
  otherDebtRate: 5.0,
  monthlyIncome: 800,
  monthlyFixedExpense: 180,
  monthlyLivingExpense: 350,
  // 지출 세부 항목 기본값
  expenseFood: 80,              // 식비
  expenseTransport: 30,         // 교통비
  expenseShopping: 40,          // 쇼핑/미용비
  expenseLeisure: 50,           // 유흥/여가비
  expenseOther: 30,             // 기타 비용
  // 진단 결과 요약 (직접 입력)
  diagnosisSummary: ''          // 진단 결과 요약 (빈 문자열이면 자동 생성)
}

const DiagnosisReportV2 = () => {
  // 개발 모드 체크 (?dev=1)
  const isDevMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1'

  const [data] = useState<GlobalData>(() => {
    if (typeof window !== 'undefined') {
      // localStorage에서 데이터 로드 (개발 모드든 아니든 항상 시도)
      const saved = localStorage.getItem('professionalDiagnosisData')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // ProfessionalDiagnosis에서 financialAsset으로 저장한 경우 호환성 처리
          if (parsed.financialAsset !== undefined && parsed.cashAsset === undefined) {
            parsed.cashAsset = Math.round(parsed.financialAsset * 0.2 * 10) / 10 // 20%를 현금으로
            parsed.investmentAsset = Math.round(parsed.financialAsset * 0.8 * 10) / 10 // 80%를 투자로
          }
          return { ...defaultGlobalData, ...parsed }
        } catch {
          return defaultGlobalData
        }
      }
    }
    return defaultGlobalData
  })

  // 개발 모드일 때 콘솔에 데이터 출력
  if (isDevMode) {
    console.log('DiagnosisReportV2 Dev Mode - Loaded Data:', data)
  }

  // 계산 로직
  const financialAsset = data.cashAsset + data.investmentAsset // 금융자산 = 현금 + 투자
  const totalAsset = data.realEstateAsset + financialAsset + data.pensionAsset
  const totalDebt = data.mortgageAmount + data.creditLoanAmount + data.otherDebtAmount
  const netWorth = Math.round((totalAsset - totalDebt / 10000) * 100) / 100

  // 생활비 = 지출 세부 항목 합계
  const livingExpense = data.expenseFood + data.expenseTransport + data.expenseShopping + data.expenseLeisure + data.expenseOther

  // 월 이자 계산 (먼저 계산하여 currentExpenseBase에 포함)
  const monthlyInterest = Math.round(
    (data.mortgageAmount * data.mortgageRate / 100 / 12) +
    (data.creditLoanAmount * data.creditLoanRate / 100 / 12) +
    (data.otherDebtAmount * data.otherDebtRate / 100 / 12)
  )

  // 현재 지출 기준 (이자 포함)
  const currentExpenseBase = data.monthlyFixedExpense + livingExpense + monthlyInterest
  const inflationRate = 0.03 // 물가상승률 3%
  const yearsToRetirementForExpense = Math.max(0, data.targetRetirementAge - data.currentAge)

  // 국민연금 물가상승률 반영 (은퇴시점 기준)
  const nationalPensionInflated = Math.round(
    (data.nationalPensionPersonal + data.nationalPensionSpouse) * Math.pow(1 + inflationRate, yearsToRetirementForExpense)
  )

  // 월 연금 (국민연금은 물가상승 반영)
  const monthlyPension =
    nationalPensionInflated +
    data.retirementPensionPersonal + data.retirementPensionSpouse +
    data.privatePensionPersonal + data.privatePensionSpouse +
    data.otherIncomePersonal + data.otherIncomeSpouse

  // 은퇴 시점 예상 지출 = 현재 지출 × (1 + 물가상승률)^은퇴까지 연수 × 70%
  const monthlyExpense = Math.round(currentExpenseBase * Math.pow(1 + inflationRate, yearsToRetirementForExpense) * 0.7)
  const monthlyGap = monthlyPension - monthlyExpense

  const currentMonthlyExpense = data.monthlyFixedExpense + livingExpense + monthlyInterest
  const currentMonthlyGap = data.monthlyIncome - currentMonthlyExpense

  const realEstateRatio = Math.round((data.realEstateAsset / totalAsset) * 100)
  const cashRatio = Math.round((data.cashAsset / totalAsset) * 100)
  const investmentRatio = Math.round((data.investmentAsset / totalAsset) * 100)
  const pensionRatio = 100 - realEstateRatio - cashRatio - investmentRatio

  // 유동자산 = 금융자산 + 연금자산 (부채는 현금흐름에서 이자로 반영되므로 여기서 빼지 않음)
  const liquidAsset = Math.round((financialAsset + data.pensionAsset) * 100) / 100

  const yearsToRetirement = Math.max(0, data.targetRetirementAge - data.currentAge)
  const growthRate = 0.025
  const liquidAssetAtRetirement = Math.round(liquidAsset * Math.pow(1 + growthRate, yearsToRetirement) * 100) / 100

  const retirementYears = data.lifeExpectancy - data.targetRetirementAge
  const annualShortfall = monthlyGap < 0 ? Math.abs(monthlyGap) * 12 / 10000 : 0

  const yearsOfWithdrawal = liquidAssetAtRetirement <= 0
    ? 0
    : annualShortfall > 0
      ? Math.round(liquidAssetAtRetirement / annualShortfall * 10) / 10
      : 999
  // 자산 소진 연령 (기대수명 초과 시 기대수명+1로 제한)
  const rawDepletionAge = data.targetRetirementAge + Math.floor(yearsOfWithdrawal)
  const assetDepletionAge = Math.min(rawDepletionAge, data.lifeExpectancy + 1)
  const isAssetSustainable = rawDepletionAge > data.lifeExpectancy // 기대수명까지 자산 유지 가능 여부

  const pensionCoverageRate = Math.round((monthlyPension / monthlyExpense) * 100)

  const totalDemand = Math.round((retirementYears * monthlyExpense * 12 / 10000) * 100) / 100
  const totalPensionSupply = Math.round((retirementYears * monthlyPension * 12 / 10000) * 100) / 100
  const totalSupply = Math.round((totalPensionSupply + Math.max(0, liquidAssetAtRetirement)) * 100) / 100
  const supplyDeficit = Math.round((totalDemand - totalSupply) * 100) / 100
  const supplyRatio = totalDemand > 0 ? Math.round((totalSupply / totalDemand) * 100) : 0
  const deficitRatio = 100 - supplyRatio

  // 동연령대 비교 계산
  const getAgeGroup = (age: number): AgeGroup => {
    if (age < 30) return '29세이하'
    if (age < 40) return '30대'
    if (age < 50) return '40대'
    if (age < 60) return '50대'
    if (age < 65) return '60대'
    return '65세이상'
  }
  const ageGroup = getAgeGroup(data.currentAge)
  const ageStats = householdFinance2025[ageGroup]

  const annualIncome = data.monthlyIncome * 12
  const incomePercentiles = estimatePercentiles(ageStats.income.median)
  const getIncomePercentileRange = (income: number): { start: number; end: number; display: string } => {
    // 연령대별 분위 경계값 기반 백분위 구간 계산
    if (income >= incomePercentiles.p90) return { start: 0, end: 10, display: '상위 10%' }
    if (income >= incomePercentiles.p80) return { start: 10, end: 20, display: '상위 10~20%' }
    if (income >= incomePercentiles.p70) return { start: 20, end: 30, display: '상위 20~30%' }
    if (income >= incomePercentiles.p60) return { start: 30, end: 40, display: '상위 30~40%' }
    if (income >= ageStats.income.median) return { start: 40, end: 50, display: '상위 40~50%' }
    if (income >= incomePercentiles.p40) return { start: 50, end: 60, display: '상위 50~60%' }
    if (income >= incomePercentiles.p30) return { start: 60, end: 70, display: '상위 60~70%' }
    if (income >= incomePercentiles.p20) return { start: 70, end: 80, display: '상위 70~80%' }
    return { start: 80, end: 100, display: '상위 80~100%' }
  }
  const incomePercentile = getIncomePercentileRange(annualIncome)

  // 순자산 백분위 (연령대별 분위 경계값 활용)
  const netWorthPercentiles = estimatePercentiles(ageStats.netWorth.median)
  const getNetWorthPercentileRange = (netWorthValue: number): { start: number; end: number; display: string } => {
    const netWorthInManwon = netWorthValue * 10000 // 억원 -> 만원 변환
    if (netWorthInManwon >= netWorthPercentiles.p90) return { start: 0, end: 10, display: '상위 10%' }
    if (netWorthInManwon >= netWorthPercentiles.p80) return { start: 10, end: 20, display: '상위 10~20%' }
    if (netWorthInManwon >= netWorthPercentiles.p70) return { start: 20, end: 30, display: '상위 20~30%' }
    if (netWorthInManwon >= netWorthPercentiles.p60) return { start: 30, end: 40, display: '상위 30~40%' }
    if (netWorthInManwon >= ageStats.netWorth.median) return { start: 40, end: 50, display: '상위 40~50%' }
    if (netWorthInManwon >= netWorthPercentiles.p40) return { start: 50, end: 60, display: '상위 50~60%' }
    if (netWorthInManwon >= netWorthPercentiles.p30) return { start: 60, end: 70, display: '상위 60~70%' }
    if (netWorthInManwon >= netWorthPercentiles.p20) return { start: 70, end: 80, display: '상위 70~80%' }
    return { start: 80, end: 100, display: '상위 80~100%' }
  }
  const netWorthPercentile = getNetWorthPercentileRange(netWorth)

  // 저축률 백분위 (통계청 2023 가계금융복지조사 기준 - 평균 저축률 약 15~20%)
  const savingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0
  const getSavingsPercentileRange = (rate: number): { start: number; end: number; display: string } => {
    if (rate >= 35) return { start: 0, end: 10, display: '상위 10%' }
    if (rate >= 28) return { start: 10, end: 20, display: '상위 10~20%' }
    if (rate >= 22) return { start: 20, end: 30, display: '상위 20~30%' }
    if (rate >= 17) return { start: 30, end: 40, display: '상위 30~40%' }
    if (rate >= 13) return { start: 40, end: 50, display: '상위 40~50%' }
    if (rate >= 9) return { start: 50, end: 60, display: '상위 50~60%' }
    if (rate >= 5) return { start: 60, end: 70, display: '상위 60~70%' }
    if (rate >= 0) return { start: 70, end: 80, display: '상위 70~80%' }
    return { start: 80, end: 100, display: '상위 80~100%' }
  }
  const savingsPercentile = getSavingsPercentileRange(savingsRate)

  // 은퇴 시기 시뮬레이션 (5년 빠르게/늦게)
  const calculateRetirementScenario = (retireAge: number) => {
    const yearsToRetire = Math.max(0, retireAge - data.currentAge)
    const retireYears = data.lifeExpectancy - retireAge

    // 은퇴 시점까지 자산 성장 (연 복리)
    // 추가로 근로기간 동안 매년 저축액이 누적 (늦게 은퇴할수록 더 많이 저축)
    let assetAtRetire = liquidAsset
    const annualSavings = currentMonthlyGap > 0 ? currentMonthlyGap * 12 / 10000 : 0
    for (let year = 0; year < yearsToRetire; year++) {
      assetAtRetire = assetAtRetire * (1 + growthRate) + annualSavings
    }
    assetAtRetire = Math.round(assetAtRetire * 100) / 100

    // 은퇴 시점 기준 월지출 (물가상승률 반영)
    const expenseAtRetire = Math.round(currentExpenseBase * Math.pow(1 + inflationRate, yearsToRetire) * 0.7)

    // 은퇴 시점 기준 월연금 (국민연금 물가상승 반영)
    const pensionAtRetire = Math.round(
      (data.nationalPensionPersonal + data.nationalPensionSpouse) * Math.pow(1 + inflationRate, yearsToRetire)
    ) + data.retirementPensionPersonal + data.retirementPensionSpouse +
      data.privatePensionPersonal + data.privatePensionSpouse +
      data.otherIncomePersonal + data.otherIncomeSpouse

    const gapAtRetire = pensionAtRetire - expenseAtRetire
    const shortfallAtRetire = gapAtRetire < 0 ? Math.abs(gapAtRetire) * 12 / 10000 : 0

    const yearsOfWithdraw = assetAtRetire <= 0
      ? 0
      : shortfallAtRetire > 0
        ? Math.round(assetAtRetire / shortfallAtRetire * 10) / 10
        : 999
    const depletionAge = retireAge + Math.floor(yearsOfWithdraw)
    return {
      retireAge,
      assetAtRetire,
      depletionAge: Math.min(depletionAge, data.lifeExpectancy + 10),
      sustainable: yearsOfWithdraw >= retireYears
    }
  }

  const earlyRetirement = calculateRetirementScenario(data.targetRetirementAge - 5)
  const normalRetirement = calculateRetirementScenario(data.targetRetirementAge)
  const lateRetirement = calculateRetirementScenario(data.targetRetirementAge + 5)

  // 리스크 수준 판단
  const getRiskLevel = (value: number, thresholds: [number, number]) => {
    if (value >= thresholds[1]) return 'high'
    if (value >= thresholds[0]) return 'medium'
    return 'low'
  }

  // 규칙 기반 소견 생성
  const generateVerdict = () => {
    const findings: string[] = []
    const recommendations: string[] = []

    if (monthlyGap < 0) {
      findings.push(`은퇴 후 월 ${Math.abs(monthlyGap)}만원의 현금흐름 부족이 예상됩니다`)
      if (currentMonthlyGap > 0) {
        recommendations.push(`현재 월 저축여력 ${currentMonthlyGap}만원을 활용한 자산 축적 전략 수립`)
      }
    }

    if (realEstateRatio >= 70) {
      findings.push(`부동산 비중이 ${realEstateRatio}%로 유동성 리스크가 높습니다`)
      recommendations.push('부동산 일부 현금화 또는 역모기지 활용 검토')
    } else if (realEstateRatio >= 50) {
      findings.push(`자산의 ${realEstateRatio}%가 부동산에 집중되어 있습니다`)
    }

    if (pensionCoverageRate < 50) {
      findings.push(`연금 충당률이 ${pensionCoverageRate}%로 매우 낮습니다`)
      recommendations.push('개인연금 추가 가입 또는 연금저축 확대 검토')
    } else if (pensionCoverageRate < 70) {
      findings.push(`연금으로 생활비의 ${pensionCoverageRate}%만 충당 가능합니다`)
    }

    if (yearsOfWithdrawal < retirementYears) {
      const depletionMsg = `현재 구조 유지 시 ${assetDepletionAge}세에 금융자산 소진이 예상됩니다`
      if (!findings.includes(depletionMsg)) {
        findings.push(depletionMsg)
      }
      recommendations.push(`${data.lifeExpectancy}세까지 자산 유지를 위한 현금흐름 개선 필요`)
    }

    if (supplyDeficit > 0) {
      findings.push(`은퇴 후 총 ${supplyDeficit}억원의 자금 부족이 예상됩니다`)
    }

    const findingText = findings.length > 0
      ? findings.slice(0, 2).join('. ') + '.'
      : '현재 재무 구조가 안정적입니다.'

    const recommendationText = recommendations.length > 0
      ? recommendations[0] + '이 필요합니다.'
      : ''

    return { findingText, recommendationText }
  }

  const verdict = generateVerdict()

  const getSavingsGrade = () => {
    if (savingsRate < 0) return { grade: '적자', className: 'grade-danger' }
    if (savingsRate < 10) return { grade: '부족', className: 'grade-warning' }
    if (savingsRate < 20) return { grade: '보통', className: 'grade-caution' }
    if (savingsRate < 30) return { grade: '양호', className: 'grade-good' }
    return { grade: '우수', className: 'grade-excellent' }
  }
  const savingsGrade = getSavingsGrade()

  const handlePrint = () => {
    window.print()
  }

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const now = new Date()
  const todayShort = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="report-container-v2">
      <button className="print-button" onClick={handlePrint}>
        인쇄하기
      </button>

      {/* 표지 */}
      <div className="report-page page-cover">
        <div className="cover-content">
          <div className="cover-brand">
            <div className="cover-logo">LYCON PLANNING</div>
            <div className="cover-tagline">은퇴 설계 전문</div>
          </div>

          <div className="cover-title-section">
            <h1 className="cover-title" style={{ color: '#1a202c', WebkitTextFillColor: '#1a202c', opacity: 1 }}>은퇴 준비 진단서</h1>
            <p className="cover-subtitle">Retirement Planning Diagnosis Report</p>
          </div>

          <div className="cover-client-info">
            <div className="cover-client-row">
              <span className="cover-label">성명</span>
              <span className="cover-value">{data.customerName}</span>
            </div>
            <div className="cover-client-row">
              <span className="cover-label">연령</span>
              <span className="cover-value">만 {data.currentAge}세</span>
            </div>
            <div className="cover-client-row">
              <span className="cover-label">목표 은퇴</span>
              <span className="cover-value">만 {data.targetRetirementAge}세</span>
            </div>
            <div className="cover-client-row">
              <span className="cover-label">진단일</span>
              <span className="cover-value">{today}</span>
            </div>
          </div>

          <div className="cover-footer">
            <div className="cover-footer-text">본 진단서는 고객님의 재무 상황을 바탕으로 작성되었습니다.</div>
            <div className="cover-footer-contact">Lycon Planning | lyconplanning.com</div>
          </div>
        </div>
      </div>

      {/* 1페이지: 기초진단 */}
      <div className="report-page">
        <header className="report-header">
          <div className="report-header-left">
            <div className="report-logo">Lycon Planning</div>
            <h1 className="report-title">기초진단</h1>
          </div>
          <div className="report-header-right">
            <span className="report-info-label">성명</span>
            <span className="report-info-value">{data.customerName}</span>
            <span className="report-info-label">연령</span>
            <span className="report-info-value">만 {data.currentAge}세</span>
            <span className="report-info-label">진단일</span>
            <span className="report-info-value">{today}</span>
            <span className="report-info-label">목표 은퇴</span>
            <span className="report-info-value">만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 재무정보 요약 */}
        <section className="report-section financial-summary">
          <h2 className="section-title">재무정보 요약</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">총자산</span>
              <span className="summary-value">{totalAsset}억원</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">총부채</span>
              <span className="summary-value negative">{(totalDebt / 10000).toFixed(1)}억원</span>
            </div>
            <div className="summary-item highlight">
              <span className="summary-label">순자산</span>
              <span className="summary-value">{netWorth}억원</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">월 저축여력</span>
              <span className="summary-value">{currentMonthlyGap > 0 ? '+' : ''}{currentMonthlyGap}만원</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">저축률</span>
              <span className="summary-value">{savingsRate.toFixed(0)}%</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">은퇴까지</span>
              <span className="summary-value">{yearsToRetirement}년</span>
            </div>
          </div>
        </section>

        {/* 현금흐름 분석 (현재) + 제안 */}
        <div className="report-two-column">
          <section className="report-section half">
            <h2 className="section-title">현재 현금흐름</h2>
            <div className="cashflow-grid">
              <div className="cashflow-item">
                <div className="cashflow-label">월 소득</div>
                <div className="cashflow-bar-container">
                  <div
                    className="cashflow-bar income"
                    style={{ width: `${Math.min(100, (data.monthlyIncome / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%` }}
                  >
                    <span className="cashflow-bar-label">{data.monthlyIncome}만원</span>
                  </div>
                </div>
              </div>
              <div className="cashflow-item">
                <div className="cashflow-label">월 지출</div>
                <div className="cashflow-bar-container">
                  <div
                    className="cashflow-bar expense"
                    style={{ width: `${Math.min(100, (currentMonthlyExpense / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%` }}
                  >
                    <span className="cashflow-bar-label">{currentMonthlyExpense}만원</span>
                  </div>
                </div>
              </div>
              <div className="cashflow-item highlight">
                <div className="cashflow-label">저축 여력</div>
                <div className="cashflow-bar-container">
                  {(() => {
                    const barWidth = Math.min(100, Math.abs(currentMonthlyGap) / currentMonthlyExpense * 100)
                    const isNarrow = barWidth < 25
                    return (
                      <>
                        <div
                          className={`cashflow-bar gap ${currentMonthlyGap >= 0 ? 'positive' : 'negative'}`}
                          style={{ width: `${barWidth}%` }}
                        >
                          {!isNarrow && <span className="cashflow-bar-label">{currentMonthlyGap >= 0 ? '+' : ''}{currentMonthlyGap}만원</span>}
                        </div>
                        {isNarrow && <span className="cashflow-bar-label-outside">{currentMonthlyGap >= 0 ? '+' : ''}{currentMonthlyGap}만원</span>}
                      </>
                    )
                  })()}
                </div>
                <div className={`cashflow-grade ${savingsGrade.className}`}>
                  {savingsGrade.grade}
                </div>
              </div>
            </div>
          </section>

          <section className="report-section half suggestion-section">
            {(() => {
              // 현재 저축률 계산
              const currentSavingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0
              const needsReduction = currentSavingsRate < 30 // 저축률 30% 미만이면 절감 제안

              if (needsReduction) {
                // 절감 제안
                const suggestedExpense = Math.round(currentMonthlyExpense * 0.85)
                const suggestedGap = data.monthlyIncome - suggestedExpense
                const expenseReduction = currentMonthlyExpense - suggestedExpense
                const getSuggestedGrade = () => {
                  const suggestedSavingsRate = data.monthlyIncome > 0 ? (suggestedGap / data.monthlyIncome) * 100 : 0
                  if (suggestedSavingsRate < 0) return { grade: '적자', className: 'grade-danger' }
                  if (suggestedSavingsRate < 10) return { grade: '부족', className: 'grade-warning' }
                  if (suggestedSavingsRate < 20) return { grade: '보통', className: 'grade-caution' }
                  if (suggestedSavingsRate < 30) return { grade: '양호', className: 'grade-good' }
                  return { grade: '우수', className: 'grade-excellent' }
                }
                const suggestedGrade = getSuggestedGrade()
                return (
                  <>
                    <h2 className="section-title">제안 (지출 15% 절감 시)</h2>
                    <div className="cashflow-grid">
                      <div className="cashflow-item">
                        <div className="cashflow-label">월 소득</div>
                        <div className="cashflow-bar-container">
                          <div
                            className="cashflow-bar income"
                            style={{ width: `${Math.min(100, (data.monthlyIncome / Math.max(data.monthlyIncome, suggestedExpense)) * 100)}%` }}
                          >
                            <span className="cashflow-bar-label">{data.monthlyIncome}만원</span>
                          </div>
                        </div>
                      </div>
                      <div className="cashflow-item">
                        <div className="cashflow-label">월 지출</div>
                        <div className="cashflow-bar-container">
                          <div
                            className="cashflow-bar expense suggested"
                            style={{ width: `${Math.min(100, (suggestedExpense / Math.max(data.monthlyIncome, suggestedExpense)) * 100)}%` }}
                          >
                            <span className="cashflow-bar-label">{suggestedExpense}만원 (-{expenseReduction})</span>
                          </div>
                        </div>
                      </div>
                      <div className="cashflow-item highlight">
                        <div className="cashflow-label">저축 여력</div>
                        <div className="cashflow-bar-container">
                          {(() => {
                            const barWidth = Math.min(100, Math.abs(suggestedGap) / suggestedExpense * 100)
                            const isNarrow = barWidth < 25
                            return (
                              <>
                                <div
                                  className={`cashflow-bar gap ${suggestedGap >= 0 ? 'positive' : 'negative'}`}
                                  style={{ width: `${barWidth}%` }}
                                >
                                  {!isNarrow && <span className="cashflow-bar-label">{suggestedGap >= 0 ? '+' : ''}{suggestedGap}만원</span>}
                                </div>
                                {isNarrow && <span className="cashflow-bar-label-outside">{suggestedGap >= 0 ? '+' : ''}{suggestedGap}만원</span>}
                              </>
                            )
                          })()}
                        </div>
                        <div className={`cashflow-grade ${suggestedGrade.className}`}>
                          {suggestedGrade.grade}
                        </div>
                      </div>
                    </div>
                  </>
                )
              } else {
                // 현재 유지 권장 (저축률 30% 이상)
                return (
                  <>
                    <h2 className="section-title">제안 (현재 유지)</h2>
                    <div className="cashflow-grid">
                      <div className="cashflow-item">
                        <div className="cashflow-label">월 소득</div>
                        <div className="cashflow-bar-container">
                          <div
                            className="cashflow-bar income"
                            style={{ width: `${Math.min(100, (data.monthlyIncome / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%` }}
                          >
                            <span className="cashflow-bar-label">{data.monthlyIncome}만원</span>
                          </div>
                        </div>
                      </div>
                      <div className="cashflow-item">
                        <div className="cashflow-label">월 지출</div>
                        <div className="cashflow-bar-container">
                          <div
                            className="cashflow-bar expense"
                            style={{ width: `${Math.min(100, (currentMonthlyExpense / Math.max(data.monthlyIncome, currentMonthlyExpense)) * 100)}%` }}
                          >
                            <span className="cashflow-bar-label">{currentMonthlyExpense}만원</span>
                          </div>
                        </div>
                      </div>
                      <div className="cashflow-item highlight">
                        <div className="cashflow-label">저축 여력</div>
                        <div className="cashflow-bar-container">
                          {(() => {
                            const barWidth = Math.min(100, Math.abs(currentMonthlyGap) / currentMonthlyExpense * 100)
                            const isNarrow = barWidth < 25
                            return (
                              <>
                                <div
                                  className={`cashflow-bar gap ${currentMonthlyGap >= 0 ? 'positive' : 'negative'}`}
                                  style={{ width: `${barWidth}%` }}
                                >
                                  {!isNarrow && <span className="cashflow-bar-label">{currentMonthlyGap >= 0 ? '+' : ''}{currentMonthlyGap}만원</span>}
                                </div>
                                {isNarrow && <span className="cashflow-bar-label-outside">{currentMonthlyGap >= 0 ? '+' : ''}{currentMonthlyGap}만원</span>}
                              </>
                            )
                          })()}
                        </div>
                        <div className="cashflow-grade grade-excellent">
                          우수
                        </div>
                      </div>
                    </div>
                    <div className="maintain-message">현재 저축률 {Math.round(currentSavingsRate)}%로 우수합니다. 현재 수준을 유지하세요.</div>
                  </>
                )
              }
            })()}
          </section>
        </div>

        {/* 현금흐름 TIP - 저축률 30% 미만일 때만 표시 */}
        {(() => {
          const currentSavingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0
          if (currentSavingsRate >= 30) return null // 저축률 우수하면 절감 TIP 표시 안함

          const monthlySaving = Math.round(currentMonthlyExpense * 0.15) // 15% 절감액
          const yearsToRetirement = data.targetRetirementAge - data.currentAge
          const months = yearsToRetirement * 12
          const monthlyRate = 0.10 / 12 // 연 10%의 월 이율

          // 적립식 복리 계산: FV = PMT * ((1 + r)^n - 1) / r
          const futureValue = monthlySaving * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)

          // 금액 포맷팅 함수
          const formatAmount = (amount: number) => {
            if (amount >= 10000) {
              return `${Math.round(amount / 10000 * 10) / 10}억원`
            }
            return `${Math.round(amount).toLocaleString()}만원`
          }

          return (
            <div className="cashflow-tip">
              <span className="tip-label">TIP</span>
              <span className="tip-content">
                월 {monthlySaving}만원 절감액을 연평균 10% 수익률로 은퇴시점까지 매월 투자하면, 은퇴자산이 <strong>{formatAmount(futureValue)}</strong> 늘어납니다. 현금흐름은 모든 자산관리의 출발점입니다.
              </span>
            </div>
          )
        })()}

        {/* 지출 분석 */}
        <section className="report-section expense-analysis-section">
          <h2 className="section-title">지출 분석</h2>
          {(() => {
            // 고정비 = monthlyFixedExpense + 이자, 변동비 = 지출 세부 항목 합계
            const fixedExpense = data.monthlyFixedExpense + monthlyInterest
            const variableExpense = data.expenseFood + data.expenseTransport + data.expenseShopping + data.expenseLeisure + data.expenseOther
            const totalAllExpense = fixedExpense + variableExpense
            const fixedRatio = totalAllExpense > 0 ? Math.round((fixedExpense / totalAllExpense) * 100) : 0
            const variableRatio = 100 - fixedRatio

            const foodRatio = variableExpense > 0 ? Math.round((data.expenseFood / variableExpense) * 100) : 0
            const transportRatio = variableExpense > 0 ? Math.round((data.expenseTransport / variableExpense) * 100) : 0
            const shoppingRatio = variableExpense > 0 ? Math.round((data.expenseShopping / variableExpense) * 100) : 0
            const leisureRatio = variableExpense > 0 ? Math.round((data.expenseLeisure / variableExpense) * 100) : 0
            const otherRatio = 100 - foodRatio - transportRatio - shoppingRatio - leisureRatio

            const colors: Record<string, string> = {
              'food': '#1a365d',
              'transport': '#2c5282',
              'shopping': '#3182ce',
              'leisure': '#63b3ed',
              'other-expense': '#bee3f8',
            }

            const expenseItems = [
              { key: 'food', label: '식비', amount: data.expenseFood, ratio: foodRatio, savingPotential: 'low', savingTip: '외식 빈도 조절로 10~15% 절감 가능' },
              { key: 'transport', label: '교통비', amount: data.expenseTransport, ratio: transportRatio, savingPotential: 'medium', savingTip: '대중교통 활용, 카풀로 20~30% 절감 가능' },
              { key: 'shopping', label: '쇼핑/미용', amount: data.expenseShopping, ratio: shoppingRatio, savingPotential: 'high', savingTip: '충동구매 자제, 세일 활용으로 30~40% 절감 가능' },
              { key: 'leisure', label: '유흥/여가', amount: data.expenseLeisure, ratio: leisureRatio, savingPotential: 'high', savingTip: '구독서비스 정리, 무료 활동으로 40~50% 절감 가능' },
              { key: 'other-expense', label: '기타', amount: data.expenseOther, ratio: otherRatio, savingPotential: 'medium', savingTip: '불필요한 지출 점검으로 20~30% 절감 가능' },
            ].filter(item => item.amount > 0)

            // 절감 가능성이 높은 항목 찾기
            const highPotentialItems = expenseItems
              .filter(item => item.savingPotential === 'high' && item.amount > 0)
              .sort((a, b) => b.amount - a.amount)

            const topSavingItem = highPotentialItems[0] || expenseItems.sort((a, b) => b.amount - a.amount)[0]

            return (
              <div className="expense-analysis-layout">
                {/* 고정비/변동비 구분 */}
                <div className="expense-category-row">
                  <div className="expense-category fixed">
                    <div className="expense-category-header">
                      <span className="expense-category-title">고정비 <span className="expense-category-hint">(매월 일정하게 나가는 필수 지출)</span></span>
                      <span className="expense-category-amount">{fixedExpense}만원</span>
                    </div>
                    <div className="expense-category-desc">주거비, 보험료, 통신비, 대출이자 등 ({fixedRatio}%)</div>
                  </div>
                  <div className="expense-category variable">
                    <div className="expense-category-header">
                      <span className="expense-category-title">변동비 <span className="expense-category-hint">(선택에 따라 조절 가능한 지출)</span></span>
                      <span className="expense-category-amount">{variableExpense}만원</span>
                    </div>
                    <div className="expense-category-desc">식비, 쇼핑, 여가 등 ({variableRatio}%)</div>
                  </div>
                </div>

                {/* 변동비 스택 바 그래프 */}
                <div className="expense-stacked-bar">
                  <div className="stacked-bar-label">변동비 구성</div>
                  <div className="stacked-bar-container">
                    {expenseItems.map(item => (
                      <div
                        key={item.key}
                        className="stacked-bar-segment"
                        style={{ width: `${item.ratio}%`, backgroundColor: colors[item.key] }}
                        title={`${item.label}: ${item.amount}만원 (${item.ratio}%)`}
                      >
                        {item.ratio >= 15 && <span className="segment-label">{item.label}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 항목별 상세 */}
                <div className="expense-items-grid">
                  {expenseItems.sort((a, b) => b.amount - a.amount).map(item => (
                    <div key={item.key} className={`expense-item-row ${item.savingPotential === 'high' ? 'high-potential' : ''}`}>
                      <div className="expense-item-info">
                        <span className={`expense-dot ${item.key}`} style={{ backgroundColor: colors[item.key] }}></span>
                        <span className="expense-item-label">{item.label}</span>
                      </div>
                      <div className="expense-item-values">
                        <span className="expense-item-amount">{item.amount}만원</span>
                        <span className="expense-item-ratio">{item.ratio}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 절감 해설 */}
                {topSavingItem && (
                  <div className="expense-insight">
                    <div className="insight-header">절감 포인트</div>
                    <div className="insight-content">
                      <strong>{topSavingItem.label}</strong> 항목이 변동비의 {topSavingItem.ratio}%를 차지합니다. {topSavingItem.savingTip}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </section>

        {/* 자산 구성 */}
        <div className="report-two-column">
          <section className="report-section half">
            <h2 className="section-title">자산 분석</h2>
            <div className="asset-analysis-layout">
              <div className="asset-pie-container">
                <svg viewBox="0 0 100 100" className="asset-pie">
                  {(() => {
                    const r = 40
                    const cx = 50
                    const cy = 50
                    let startAngle = -90

                    const getArc = (percent: number) => {
                      const angle = (percent / 100) * 360
                      const endAngle = startAngle + angle
                      const largeArc = angle > 180 ? 1 : 0
                      const startRad = (startAngle * Math.PI) / 180
                      const endRad = (endAngle * Math.PI) / 180
                      const x1 = cx + r * Math.cos(startRad)
                      const y1 = cy + r * Math.sin(startRad)
                      const x2 = cx + r * Math.cos(endRad)
                      const y2 = cy + r * Math.sin(endRad)
                      startAngle = endAngle
                      return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
                    }

                    const assetItems = [
                      { key: 'realestate', ratio: realEstateRatio, color: '#1a365d' },
                      { key: 'cash', ratio: cashRatio, color: '#3182ce' },
                      { key: 'investment', ratio: investmentRatio, color: '#2c5282' },
                      { key: 'pension', ratio: pensionRatio, color: '#63b3ed' },
                    ].sort((a, b) => b.ratio - a.ratio)

                    return (
                      <>
                        {assetItems.map(item => (
                          <path key={item.key} d={getArc(item.ratio)} fill={item.color} />
                        ))}
                      </>
                    )
                  })()}
                </svg>
                <div className="asset-pie-legend">
                  {[
                    { key: 'realestate', label: '부동산', ratio: realEstateRatio },
                    { key: 'cash', label: '현금', ratio: cashRatio },
                    { key: 'investment', label: '투자', ratio: investmentRatio },
                    { key: 'pension', label: '연금', ratio: pensionRatio },
                  ].sort((a, b) => b.ratio - a.ratio).map(item => (
                    <div className="pie-legend-item" key={item.key}>
                      <span className={`legend-dot ${item.key}`}></span>
                      <span>{item.label} {item.ratio}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="asset-summary-comment">
              {realEstateRatio >= 70
                ? `부동산 ${realEstateRatio}%로 편중. 유동성 확보 필요`
                : realEstateRatio >= 50
                  ? `부동산 ${realEstateRatio}%, 금융 ${cashRatio + investmentRatio}%로 균형 유지`
                  : `금융자산 ${cashRatio + investmentRatio}% 중심의 유동적 포트폴리오`
              }
            </div>
          </section>

          <section className="report-section half">
            <h2 className="section-title">부채 분석</h2>
            {totalDebt === 0 ? (
              <div className="debt-analysis">
                <div className="no-debt-message">
                  <span className="no-debt-text">부채 없음</span>
                  <span className="no-debt-desc">훌륭합니다! 부채 없이 자산을 관리하고 계십니다.</span>
                </div>
              </div>
            ) : (
              (() => {
                // 부채 구성 비율 계산
                const mortgageRatio = Math.round((data.mortgageAmount / totalDebt) * 100)
                const creditRatio = Math.round((data.creditLoanAmount / totalDebt) * 100)
                const otherRatio = 100 - mortgageRatio - creditRatio

                // 이자 적정성 판단 (기준: 주담대 4.5% 이하, 신용대출 7% 이하)
                const isMortgageRateGood = data.mortgageRate <= 4.5
                const isCreditRateGood = data.creditLoanRate <= 7.0

                // 이자/소득 비율
                const annualInterest = monthlyInterest * 12
                const annualIncomeCalc = data.monthlyIncome * 12
                const interestToIncome = annualIncomeCalc > 0 ? Math.round((annualInterest / annualIncomeCalc) * 100) : 0

                return (
                  <div className="debt-analysis">
                    <div className="asset-pie-container">
                      <svg viewBox="0 0 100 100" className="asset-pie">
                        {(() => {
                          const r = 40
                          const cx = 50
                          const cy = 50
                          let startAngle = -90

                          const getArc = (percent: number) => {
                            if (percent <= 0) return ''
                            const angle = (percent / 100) * 360
                            const endAngle = startAngle + angle
                            const largeArc = angle > 180 ? 1 : 0
                            const startRad = (startAngle * Math.PI) / 180
                            const endRad = (endAngle * Math.PI) / 180
                            const x1 = cx + r * Math.cos(startRad)
                            const y1 = cy + r * Math.sin(startRad)
                            const x2 = cx + r * Math.cos(endRad)
                            const y2 = cy + r * Math.sin(endRad)
                            startAngle = endAngle
                            return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
                          }

                          const debtItems = [
                            { key: 'mortgage', amount: data.mortgageAmount, ratio: mortgageRatio, color: 'var(--report-primary)' },
                            { key: 'credit', amount: data.creditLoanAmount, ratio: creditRatio, color: 'var(--report-danger)' },
                            { key: 'other', amount: data.otherDebtAmount, ratio: otherRatio, color: 'var(--report-warning)' },
                          ]
                            .filter(item => item.amount > 0)
                            .sort((a, b) => b.amount - a.amount)

                          return (
                            <>
                              {debtItems.map(item => (
                                <path key={item.key} d={getArc(item.ratio)} fill={item.color} />
                              ))}
                            </>
                          )
                        })()}
                      </svg>
                      <div className="asset-pie-legend">
                        {[
                          { key: 'mortgage', label: '주담대', amount: data.mortgageAmount, ratio: mortgageRatio, rate: data.mortgageRate, isGood: isMortgageRateGood },
                          { key: 'credit', label: '신용', amount: data.creditLoanAmount, ratio: creditRatio, rate: data.creditLoanRate, isGood: isCreditRateGood },
                          { key: 'other', label: '기타', amount: data.otherDebtAmount, ratio: otherRatio, rate: data.otherDebtRate, isGood: null },
                        ]
                          .filter(item => item.amount > 0)
                          .sort((a, b) => b.amount - a.amount)
                          .map(item => (
                            <div className="pie-legend-item" key={item.key}>
                              <span className={`legend-dot ${item.key}`}></span>
                              <span>{item.label} {item.ratio}% <span className={`rate-badge ${item.isGood === null ? '' : item.isGood ? 'good' : 'warning'}`}>금리 {item.rate}%</span></span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                    <div className="debt-summary-comment">
                      {(() => {
                        const comments = []
                        // 총 부채 규모 코멘트
                        comments.push(`총 ${(totalDebt / 10000).toFixed(1)}억, 월 이자 ${monthlyInterest}만원`)
                        // 이자/소득 비율 코멘트
                        if (interestToIncome > 20) {
                          comments.push(`이자 부담 ${interestToIncome}%로 과다 (권장 20% 이하)`)
                        } else if (interestToIncome > 10) {
                          comments.push(`이자 부담 ${interestToIncome}%로 주의 필요`)
                        } else {
                          comments.push(`이자 부담 ${interestToIncome}%로 양호`)
                        }
                        // 금리 코멘트
                        if (data.creditLoanAmount > 0 && !isCreditRateGood) {
                          comments.push(`신용대출 금리 ${data.creditLoanRate}% - 대환 검토 권장`)
                        }
                        return comments.join('. ')
                      })()}
                    </div>
                  </div>
                )
              })()
            )}
          </section>
        </div>

        {/* 자산 구성 관련 팁 - 동적 */}
        {(() => {
          const tips: string[] = []

          // DSR 계산 (월 이자 / 월 소득)
          const dsr = data.monthlyIncome > 0 ? (monthlyInterest / data.monthlyIncome) * 100 : 0

          // 부동산 비중 체크 (70% 이상이면 경고)
          if (realEstateRatio >= 70) {
            tips.push(`부동산 비중이 ${realEstateRatio}%로 높습니다. 은퇴 후 현금 유동성 확보를 위해 금융자산 비중을 늘리는 것을 권장합니다.`)
          }

          // 현금 비중 체크 (5% 미만이면 경고)
          if (cashRatio < 5 && totalAsset > 0) {
            tips.push(`현금성 자산이 ${cashRatio}%로 낮습니다. 비상금으로 최소 6개월 생활비는 현금으로 보유하세요.`)
          }

          // DSR 체크 (40% 이상이면 경고)
          if (dsr >= 40) {
            tips.push(`이자 부담이 월소득의 ${dsr.toFixed(0)}%입니다. 40% 이하로 낮추면 대출 한도와 생활비에 여유가 생깁니다.`)
          } else if (dsr >= 25) {
            tips.push(`이자 부담이 월소득의 ${dsr.toFixed(0)}%로 관리 가능한 수준이나, 금리 상승에 대비하세요.`)
          }

          // 부채비율 체크 (총자산 대비 부채)
          const debtRatio = totalAsset > 0 ? (totalDebt / 10000 / totalAsset) * 100 : 0
          if (debtRatio >= 50) {
            tips.push(`부채가 총자산의 ${debtRatio.toFixed(0)}%입니다. 고금리 부채부터 상환을 권장합니다.`)
          }

          // 팁이 없으면 양호 메시지
          if (tips.length === 0) {
            tips.push('자산 구성이 균형잡혀 있습니다. 현재 배분을 유지하면서 꾸준히 금융자산을 늘려가세요.')
          }

          return (
            <div className="tip-box">
              <span className="tip-label">TIP</span>
              <span className="tip-text">{tips.join(' ')}</span>
            </div>
          )
        })()}

        {/* 동연령대 비교 */}
        <section className="report-section">
          <h2 className="section-title">동연령대 비교 ({ageGroup})</h2>
          {(() => {
            // 인디케이터 위치 계산 (start 기준, 우측이 상위이므로 뒤집음)
            const incomeIndicatorIdx = 9 - Math.floor(incomePercentile.start / 10)
            const netWorthIndicatorIdx = 9 - Math.floor(netWorthPercentile.start / 10)
            const savingsIndicatorIdx = 9 - Math.floor(savingsPercentile.start / 10)
            return (
              <>
                <div className="percentile-row">
                  <div className="percentile-row-label">연소득</div>
                  <div className="percentile-track-wrapper">
                    <div className="percentile-track">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                        <div key={idx} className="percentile-segment">
                          {idx === incomeIndicatorIdx && <div className="percentile-indicator" />}
                        </div>
                      ))}
                    </div>
                    <div className="percentile-labels">
                      <span>하위</span>
                      <span className="percentile-detail">{incomePercentile.display} ({(data.monthlyIncome * 12 / 10000).toFixed(1)}억)</span>
                      <span>상위</span>
                    </div>
                  </div>
                </div>
                <div className="percentile-row">
                  <div className="percentile-row-label">순자산</div>
                  <div className="percentile-track-wrapper">
                    <div className="percentile-track">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                        <div key={idx} className="percentile-segment">
                          {idx === netWorthIndicatorIdx && <div className="percentile-indicator" />}
                        </div>
                      ))}
                    </div>
                    <div className="percentile-labels">
                      <span>하위</span>
                      <span className="percentile-detail">{netWorthPercentile.display} ({netWorth}억)</span>
                      <span>상위</span>
                    </div>
                  </div>
                </div>
                <div className="percentile-row">
                  <div className="percentile-row-label">저축률</div>
                  <div className="percentile-track-wrapper">
                    <div className="percentile-track">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                        <div key={idx} className="percentile-segment">
                          {idx === savingsIndicatorIdx && <div className="percentile-indicator" />}
                        </div>
                      ))}
                    </div>
                    <div className="percentile-labels">
                      <span>하위</span>
                      <span className="percentile-detail">{savingsPercentile.display} ({savingsRate.toFixed(0)}%)</span>
                      <span>상위</span>
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </section>

        <footer className="report-footer">
          <div className="footer-brand">Lycon Planning</div>
          <div className="footer-tagline">기초진단 1 / 3</div>
        </footer>
      </div>

      {/* 2페이지: 정밀진단 */}
      <div className="report-page page-2">
        <header className="report-header">
          <div className="report-header-left">
            <div className="report-logo">Lycon Planning</div>
            <h1 className="report-title">정밀진단</h1>
          </div>
          <div className="report-header-right">
            <span className="report-info-label">성명</span>
            <span className="report-info-value">{data.customerName}</span>
            <span className="report-info-label">연령</span>
            <span className="report-info-value">만 {data.currentAge}세</span>
            <span className="report-info-label">진단일</span>
            <span className="report-info-value">{today}</span>
            <span className="report-info-label">목표 은퇴</span>
            <span className="report-info-value">만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 은퇴 가능 여부 판단 */}
        <section className="report-section retirement-verdict-section">
          <h2 className="section-title">은퇴 가능 여부 판단</h2>
          {(() => {
            // 은퇴 가능 여부 판단 로직
            const isRetirementPossible = monthlyGap >= 0
            const coverageGap = monthlyExpense - monthlyPension
            const requiredAdditionalAsset = coverageGap > 0 ? Math.round((coverageGap * 12 * retirementYears) / 10000 * 10) / 10 : 0
            const hasEnoughAsset = liquidAssetAtRetirement >= requiredAdditionalAsset

            // 종합 판단
            let verdictStatus: 'possible' | 'conditional' | 'difficult'
            let verdictMessage: string
            let verdictDetail: string

            if (isRetirementPossible) {
              verdictStatus = 'possible'
              verdictMessage = `${data.targetRetirementAge}세 은퇴 가능`
              verdictDetail = `연금 수입만으로 예상 생활비를 충당할 수 있습니다.`
            } else if (hasEnoughAsset) {
              verdictStatus = 'conditional'
              verdictMessage = `${data.targetRetirementAge}세 은퇴 조건부 가능`
              if (isAssetSustainable) {
                verdictDetail = `연금만으로는 부족하나, 보유 자산으로 기대수명(${data.lifeExpectancy}세)까지 충분히 보완 가능합니다.`
              } else {
                verdictDetail = `연금만으로는 부족하나, 보유 자산으로 보완 가능합니다. 다만 ${assetDepletionAge}세 이후 자산 소진에 대비가 필요합니다.`
              }
            } else {
              verdictStatus = 'difficult'
              verdictMessage = `${data.targetRetirementAge}세 은퇴 재검토 필요`
              verdictDetail = `현재 준비 상황으로는 은퇴 후 현금흐름 유지가 어렵습니다. 추가 준비가 필요합니다.`
            }

            return (
              <div className={`retirement-verdict ${verdictStatus}`}>
                <div className="verdict-header">
                  <div className={`verdict-badge ${verdictStatus}`}>
                    {verdictStatus === 'possible' && '가능'}
                    {verdictStatus === 'conditional' && '조건부'}
                    {verdictStatus === 'difficult' && '재검토'}
                  </div>
                  <div className="verdict-title">{verdictMessage}</div>
                </div>
                <div className="verdict-detail">{verdictDetail}</div>
                <div className="verdict-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">예상 월 생활비</span>
                    <span className="breakdown-value">{monthlyExpense}만원</span>
                    <span className="breakdown-desc">물가상승 연3%, 은퇴직전 지출의 70%</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">예상 월 연금</span>
                    <span className="breakdown-value">{monthlyPension}만원</span>
                    <span className="breakdown-desc">국민(물가반영)+퇴직+개인연금 합산</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">월 현금흐름</span>
                    <span className={`breakdown-value ${monthlyGap >= 0 ? 'positive' : 'negative'}`}>
                      {monthlyGap >= 0 ? '+' : ''}{monthlyGap}만원
                    </span>
                    <span className="breakdown-desc">{monthlyGap >= 0 ? '자산 보존 가능' : '자산에서 인출 필요'}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">연금 충당률</span>
                    <span className={`breakdown-value ${pensionCoverageRate >= 80 ? 'positive' : pensionCoverageRate >= 60 ? '' : 'negative'}`}>
                      {pensionCoverageRate}%
                    </span>
                    <span className="breakdown-desc">
                      {pensionCoverageRate >= 80 ? '여유' : pensionCoverageRate >= 60 ? '적정' : pensionCoverageRate >= 40 ? '부족' : '심각한 부족'}
                    </span>
                  </div>
                </div>
                <div className="verdict-reference">
                  노후생활비 기준 (KB금융 2025, 2인가구): 최소 248만원 / 적정 350만원 → {data.targetRetirementAge}세 기준 최소 {Math.round(248 * Math.pow(1.03, yearsToRetirementForExpense))}만원 / 적정 {Math.round(350 * Math.pow(1.03, yearsToRetirementForExpense))}만원
                </div>
              </div>
            )
          })()}
        </section>

        {/* 3층 연금 */}
        <section className="report-section">
          <h2 className="section-title">3층 연금 준비현황</h2>
          <div className="pension-three-column">
            <div className="pension-column">
              <div className="pension-column-header layer-1">1층</div>
              <div className="pension-column-title">국민연금</div>
              <div className="pension-column-value">
                {data.nationalPensionPersonal + data.nationalPensionSpouse}만원/월
              </div>
              <div className="pension-column-note">
                {data.targetRetirementAge}세 기준 {Math.round((data.nationalPensionPersonal + data.nationalPensionSpouse) * Math.pow(1.03, yearsToRetirementForExpense))}만원/월 (물가상승 연3%)
              </div>
            </div>
            <div className="pension-column">
              <div className="pension-column-header layer-2">2층</div>
              <div className="pension-column-title">퇴직연금</div>
              <div className="pension-column-value">
                {data.retirementPensionPersonal + data.retirementPensionSpouse}만원/월
              </div>
              {(data.retirementPensionPersonal + data.retirementPensionSpouse) > 0 && (
                <div className="pension-column-note">{retirementYears}년 인출 가정</div>
              )}
            </div>
            <div className="pension-column">
              <div className="pension-column-header layer-3">3층</div>
              <div className="pension-column-title">개인연금</div>
              <div className="pension-column-value">
                {data.privatePensionPersonal + data.privatePensionSpouse}만원/월
              </div>
              {(data.privatePensionPersonal + data.privatePensionSpouse) > 0 && (
                <div className="pension-column-note">{retirementYears}년 인출 가정</div>
              )}
            </div>
          </div>
        </section>

        {/* 3층 연금 관련 팁 */}
        <div className="tip-box">
          <span className="tip-label">TIP</span>
          <span className="tip-text">국민연금만으로는 생활비의 30~40%밖에 충당이 안 돼요. 퇴직연금과 개인연금을 함께 쌓아야 안정적인 노후가 됩니다.</span>
        </div>

        {/* 은퇴 후 자금 수급 분석 */}
        <section className="report-section">
          <h2 className="section-title">
            은퇴 후 자금 수급 분석 <span className="section-title-en">Demand vs Supply</span>
            <span className="section-note">* 현재 물가 기준</span>
          </h2>
          <div className="demand-supply-chart">
            <div className="ds-row">
              <span className="ds-label">총수요</span>
              <div className="ds-track">
                <div className="ds-bar demand" style={{ width: '100%' }}>
                  <span className="ds-value">{totalDemand}억</span>
                </div>
              </div>
            </div>
            <div className="ds-row">
              <span className="ds-label">총공급</span>
              <div className="ds-track">
                <div className="ds-bar supply" style={{ width: `${supplyRatio}%` }}>
                  <span className="ds-value">{totalSupply}억</span>
                </div>
                {supplyDeficit > 0 && (
                  <div className="ds-bar deficit" style={{ width: `${deficitRatio}%` }}>
                    <span className="ds-value">-{supplyDeficit}억</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="ds-legend">
            <div className="ds-legend-item">
              <span className="ds-legend-box demand"></span>
              <span>총 지출 수요 ({retirementYears}년)</span>
            </div>
            <div className="ds-legend-item">
              <span className="ds-legend-box supply"></span>
              <span>확보 현금흐름</span>
            </div>
            {supplyDeficit > 0 && (
              <div className="ds-legend-item">
                <span className="ds-legend-box deficit"></span>
                <span>부족분</span>
              </div>
            )}
          </div>
        </section>

        {/* 은퇴 시점 예상 자산 */}
        <section className="report-section">
          <h2 className="section-title">은퇴 시점 예상 자산 ({data.targetRetirementAge}세)</h2>
          {(() => {
            // 은퇴 시점 자산 추정 (현재 자산 + 저축 누적, 단순 성장률 적용)
            const annualSavings = currentMonthlyGap > 0 ? currentMonthlyGap * 12 / 10000 : 0 // 억원
            const realEstateGrowth = 0.02 // 부동산 연 2% 성장
            const financialGrowth = 0.05 // 금융자산 연 5% 성장
            const pensionGrowth = 0.04 // 연금자산 연 4% 성장

            const realEstateAtRetirement = Math.round(data.realEstateAsset * Math.pow(1 + realEstateGrowth, yearsToRetirement) * 10) / 10
            const financialAtRetirement = Math.round((financialAsset * Math.pow(1 + financialGrowth, yearsToRetirement) + annualSavings * ((Math.pow(1 + financialGrowth, yearsToRetirement) - 1) / financialGrowth)) * 10) / 10
            const pensionAtRetirement = Math.round(data.pensionAsset * Math.pow(1 + pensionGrowth, yearsToRetirement) * 10) / 10
            const totalAtRetirement = Math.round((realEstateAtRetirement + financialAtRetirement + pensionAtRetirement) * 10) / 10

            // 부채는 은퇴 시점에 상환 가정 (단순화)
            const debtAtRetirement = Math.round(totalDebt * 0.5) // 절반 상환 가정
            const netWorthAtRetirement = Math.round((totalAtRetirement - debtAtRetirement / 10000) * 10) / 10

            const realEstateRatioAtRetirement = Math.round((realEstateAtRetirement / totalAtRetirement) * 100)
            const financialRatioAtRetirement = Math.round((financialAtRetirement / totalAtRetirement) * 100)
            const pensionRatioAtRetirement = 100 - realEstateRatioAtRetirement - financialRatioAtRetirement

            return (
              <div className="retirement-asset-preview">
                <div className="asset-comparison-col">
                  <div className="asset-comparison-item">
                    <div className="comparison-label">현재</div>
                    <div className="comparison-value">{totalAsset}억</div>
                  </div>
                  <div className="asset-comparison-arrow">↓</div>
                  <div className="asset-comparison-item highlight">
                    <div className="comparison-label">{yearsToRetirement}년 후</div>
                    <div className="comparison-value">{totalAtRetirement}억</div>
                  </div>
                </div>
                <div className="asset-detail-col">
                  <div className="asset-breakdown-list">
                    <div className="asset-breakdown-item">
                      <span className="legend-dot realestate"></span>
                      <span className="breakdown-name">부동산</span>
                      <span className="breakdown-amount">{realEstateAtRetirement}억</span>
                      <span className="breakdown-ratio">({realEstateRatioAtRetirement}%)</span>
                    </div>
                    <div className="asset-breakdown-item">
                      <span className="legend-dot financial"></span>
                      <span className="breakdown-name">금융자산</span>
                      <span className="breakdown-amount">{financialAtRetirement}억</span>
                      <span className="breakdown-ratio">({financialRatioAtRetirement}%)</span>
                    </div>
                    <div className="asset-breakdown-item">
                      <span className="legend-dot pension"></span>
                      <span className="breakdown-name">연금</span>
                      <span className="breakdown-amount">{pensionAtRetirement}억</span>
                      <span className="breakdown-ratio">({pensionRatioAtRetirement}%)</span>
                    </div>
                  </div>
                  <div className="asset-summary-stats">
                    <div className="summary-stat-item">
                      <span className="stat-label">예상 총자산</span>
                      <span className="stat-value">{totalAtRetirement}억원</span>
                    </div>
                    <div className="summary-stat-item">
                      <span className="stat-label">예상 부채</span>
                      <span className="stat-value negative">{(debtAtRetirement / 10000).toFixed(1)}억원</span>
                    </div>
                    <div className="summary-stat-item highlight">
                      <span className="stat-label">예상 순자산</span>
                      <span className="stat-value">{netWorthAtRetirement}억원</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
          <div className="calculation-note">
            <span className="note-label">산출 기준</span>
            <span className="note-content">
              부동산 연 2% 성장, 금융자산 연 5% 성장(저축 누적 포함), 연금 연 4% 성장, 부채 50% 상환 가정
            </span>
          </div>
        </section>

        {/* 생애주기 이벤트 타임라인 */}
        <section className="report-section">
          <h2 className="section-title">예상 생애주기 이벤트</h2>
          {(() => {
            // 생애주기 이벤트 생성 (현재 나이 기준)
            interface LifeEvent {
              age: number
              event: string
              cost: number // 만원
              type: 'education' | 'wedding' | 'health' | 'housing' | 'retirement'
            }

            const events: LifeEvent[] = []

            // 자녀 교육비 (가정: 현재 10세, 15세 자녀가 있다고 가정 - 실제로는 입력받아야 함)
            // 40대 기준 예상 이벤트
            if (data.currentAge <= 50) {
              // 대학 등록금 (자녀 18-22세 가정)
              const childAge1 = Math.max(0, 48 - data.currentAge) // 첫째가 대학갈 때 부모 나이 48세 가정
              if (childAge1 > 0 && data.currentAge + childAge1 <= data.lifeExpectancy) {
                events.push({
                  age: data.currentAge + childAge1,
                  event: '자녀 대학 등록금',
                  cost: 4000,
                  type: 'education'
                })
              }
            }

            // 자녀 결혼 자금
            if (data.currentAge <= 60) {
              const weddingAge = Math.max(0, 58 - data.currentAge) // 자녀 결혼 시 부모 58세 가정
              if (weddingAge > 0 && data.currentAge + weddingAge <= data.lifeExpectancy) {
                events.push({
                  age: data.currentAge + weddingAge,
                  event: '자녀 결혼 자금',
                  cost: 5000,
                  type: 'wedding'
                })
              }
            }

            // 은퇴 시점
            if (data.targetRetirementAge > data.currentAge) {
              events.push({
                age: data.targetRetirementAge,
                event: '은퇴',
                cost: 0,
                type: 'retirement'
              })
            }

            // 주택 리모델링 (은퇴 전후)
            const remodelAge = Math.max(data.currentAge + 5, data.targetRetirementAge - 3)
            if (remodelAge <= data.lifeExpectancy && remodelAge > data.currentAge) {
              events.push({
                age: remodelAge,
                event: '주택 리모델링',
                cost: 3000,
                type: 'housing'
              })
            }

            // 의료비 증가 시점 (70대 이후)
            if (data.lifeExpectancy >= 70 && data.currentAge < 70) {
              events.push({
                age: 70,
                event: '의료비 증가',
                cost: 2000,
                type: 'health'
              })
            }

            // 요양/간병 (80대)
            if (data.lifeExpectancy >= 80 && data.currentAge < 80) {
              events.push({
                age: 80,
                event: '요양/간병 비용',
                cost: 5000,
                type: 'health'
              })
            }

            // 나이순 정렬
            events.sort((a, b) => a.age - b.age)

            // 비용이 있는 이벤트만 필터링
            const costEvents = events.filter(e => e.cost > 0)
            const nextEvent = costEvents[0]
            const laterEvents = costEvents.slice(1)

            // 총 예상 비용 계산
            const totalEventCost = events.reduce((sum, e) => sum + e.cost, 0)

            return (
              <div className="lifecycle-highlight-layout">
                {nextEvent && (
                  <div className="next-event-card">
                    <div className="next-event-badge">가장 가까운 큰 지출</div>
                    <div className="next-event-countdown">
                      <span className="countdown-num">{nextEvent.age - data.currentAge}</span>
                      <span className="countdown-unit">년 후</span>
                    </div>
                    <div className="next-event-info">
                      <div className="next-event-name">{nextEvent.event}</div>
                      <div className="next-event-cost">{(nextEvent.cost / 10000).toFixed(1)}억원</div>
                      <div className="next-event-monthly">
                        월 {Math.round(nextEvent.cost / ((nextEvent.age - data.currentAge) * 12))}만원 준비 필요
                      </div>
                    </div>
                  </div>
                )}
                <div className="later-events-list">
                  <div className="later-events-header">
                    <span className="later-events-title">이후 예정 지출</span>
                    <span className="later-events-total">총 {(totalEventCost / 10000).toFixed(1)}억</span>
                  </div>
                  {laterEvents.map((event, idx) => (
                    <div key={idx} className="later-event-item">
                      <span className="later-event-years">{event.age - data.currentAge}년 후</span>
                      <span className="later-event-name">{event.event}</span>
                      <span className="later-event-cost">{(event.cost / 10000).toFixed(1)}억</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </section>

        {/* 은퇴 시기 시뮬레이션 */}
        <section className="report-section">
          <h2 className="section-title">은퇴 시기별 비교</h2>
          <p className="section-desc">은퇴 시기를 5년 앞당기거나 늦추면 어떻게 될까요?</p>
          <div className="retirement-scenarios">
            <div className={`scenario-card ${earlyRetirement.retireAge === data.targetRetirementAge - 5 ? '' : ''}`}>
              <div className="scenario-header early">5년 일찍</div>
              <div className="scenario-body">
                <div className="scenario-age">{earlyRetirement.retireAge}세 은퇴</div>
                <div className="scenario-stat">
                  <span className="scenario-label">은퇴 시 금융자산</span>
                  <span className="scenario-value">{earlyRetirement.assetAtRetire}억</span>
                </div>
                <div className="scenario-stat">
                  <span className="scenario-label">자산 소진시점</span>
                  <span className={`scenario-value ${!earlyRetirement.sustainable ? 'danger' : ''}`}>
                    {earlyRetirement.sustainable ? '소진 안됨' : `${earlyRetirement.depletionAge}세`}
                  </span>
                </div>
              </div>
            </div>
            <div className="scenario-card current">
              <div className="scenario-header current">현재 계획</div>
              <div className="scenario-body">
                <div className="scenario-age">{normalRetirement.retireAge}세 은퇴</div>
                <div className="scenario-stat">
                  <span className="scenario-label">은퇴 시 금융자산</span>
                  <span className="scenario-value">{normalRetirement.assetAtRetire}억</span>
                </div>
                <div className="scenario-stat">
                  <span className="scenario-label">자산 소진시점</span>
                  <span className={`scenario-value ${!normalRetirement.sustainable ? 'danger' : ''}`}>
                    {normalRetirement.sustainable ? '소진 안됨' : `${normalRetirement.depletionAge}세`}
                  </span>
                </div>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-header late">5년 늦게</div>
              <div className="scenario-body">
                <div className="scenario-age">{lateRetirement.retireAge}세 은퇴</div>
                <div className="scenario-stat">
                  <span className="scenario-label">은퇴 시 금융자산</span>
                  <span className="scenario-value">{lateRetirement.assetAtRetire}억</span>
                </div>
                <div className="scenario-stat">
                  <span className="scenario-label">자산 소진시점</span>
                  <span className={`scenario-value ${!lateRetirement.sustainable ? 'danger' : ''}`}>
                    {lateRetirement.sustainable ? '소진 안됨' : `${lateRetirement.depletionAge}세`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 리스크 진단 */}
        <section className="report-section">
          <h2 className="section-title">리스크 진단</h2>
          <div className="risk-grid">
            <div className="risk-item">
              <div className="risk-label">부동산 편중</div>
              <div className="risk-bar-container">
                <div className="risk-bar-bg">
                  <div className="risk-zone high" style={{ width: '30%' }} />
                  <div className="risk-zone medium" style={{ width: '30%' }} />
                  <div className="risk-zone low" style={{ width: '40%' }} />
                </div>
                <div
                  className={`risk-indicator ${getRiskLevel(realEstateRatio, [50, 70])}`}
                  style={{ left: `${Math.max(0, Math.min(100, 100 - realEstateRatio))}%` }}
                />
              </div>
              <div className="risk-value">{realEstateRatio}%</div>
            </div>
            <div className="risk-item">
              <div className="risk-label">현금흐름</div>
              <div className="risk-bar-container">
                <div className="risk-bar-bg">
                  <div className="risk-zone high" style={{ width: '30%' }} />
                  <div className="risk-zone medium" style={{ width: '30%' }} />
                  <div className="risk-zone low" style={{ width: '40%' }} />
                </div>
                <div
                  className={`risk-indicator ${monthlyGap >= 0 ? 'low' : getRiskLevel(Math.abs(monthlyGap), [50, 150])}`}
                  style={{ left: `${monthlyGap >= 0 ? 100 : Math.max(0, Math.min(100, 100 - Math.abs(monthlyGap) / 2))}%` }}
                />
              </div>
              <div className="risk-value">{monthlyGap >= 0 ? '+' : ''}{monthlyGap}만원</div>
            </div>
            <div className="risk-item">
              <div className="risk-label">연금 충당률</div>
              <div className="risk-bar-container">
                <div className="risk-bar-bg">
                  <div className="risk-zone high" style={{ width: '30%' }} />
                  <div className="risk-zone medium" style={{ width: '30%' }} />
                  <div className="risk-zone low" style={{ width: '40%' }} />
                </div>
                <div
                  className={`risk-indicator ${pensionCoverageRate >= 80 ? 'low' : pensionCoverageRate >= 50 ? 'medium' : 'high'}`}
                  style={{ left: `${Math.min(100, pensionCoverageRate)}%` }}
                />
              </div>
              <div className="risk-value">{pensionCoverageRate}%</div>
            </div>
          </div>
        </section>

        <footer className="report-footer">
          <div className="footer-brand">Lycon Planning</div>
          <div className="footer-tagline">정밀진단 2 / 3</div>
        </footer>
      </div>

      {/* 3페이지: 종합의견 + 전문진단 안내 */}
      <div className="report-page page-3">
        <header className="report-header">
          <div className="report-header-left">
            <div className="report-logo">Lycon Planning</div>
            <h1 className="report-title">종합의견</h1>
          </div>
          <div className="report-header-right">
            <span className="report-info-label">성명</span>
            <span className="report-info-value">{data.customerName}</span>
            <span className="report-info-label">연령</span>
            <span className="report-info-value">만 {data.currentAge}세</span>
            <span className="report-info-label">진단일</span>
            <span className="report-info-value">{today}</span>
            <span className="report-info-label">목표 은퇴</span>
            <span className="report-info-value">만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 종합 소견 */}
        <section className="report-section opinion-section">
          <h2 className="section-title">진단 결과 요약</h2>
          <div className="opinion-content">
            {data.diagnosisSummary ? (
              <p className="opinion-finding">{data.diagnosisSummary}</p>
            ) : (
              <>
                <p className="opinion-finding">{verdict.findingText}</p>
                {verdict.recommendationText && (
                  <p className="opinion-recommendation">{verdict.recommendationText}</p>
                )}
              </>
            )}
          </div>
        </section>

        {/* 전문가 코멘트 */}
        <section className="report-section expert-comment-section">
          <h2 className="section-title">전문가 코멘트</h2>
          <div className="expert-comment-content">
            <textarea
              className="expert-comment-input"
              placeholder="전문가 의견을 입력하세요..."
              rows={4}
            />
          </div>
        </section>

        {/* 다음 단계 */}
        <section className="report-section cta-section">
          <h2 className="section-title">다음 단계</h2>
          <div className="cta-cards">
            <div className="cta-card">
              <div className="cta-card-number">1</div>
              <div className="cta-card-content">
                <div className="cta-card-title">진단 결과 상세 설명</div>
                <div className="cta-card-desc">이 진단서의 각 항목에 대한 자세한 해설</div>
              </div>
            </div>
            <div className="cta-card">
              <div className="cta-card-number">2</div>
              <div className="cta-card-content">
                <div className="cta-card-title">투자 포트폴리오 가이드</div>
                <div className="cta-card-desc">현재 투자 분석 및 최적 투자 전략 제안</div>
              </div>
            </div>
            <div className="cta-card">
              <div className="cta-card-number">3</div>
              <div className="cta-card-content">
                <div className="cta-card-title">맞춤 액션 플랜</div>
                <div className="cta-card-desc">지금 당장 실행할 수 있는 구체적인 행동 가이드</div>
              </div>
            </div>
          </div>
          <button className="cta-button" onClick={() => window.open('https://lyconplanning.com/consultation', '_blank')}>
            2차 미팅 예약하기
          </button>
        </section>

        {/* 전문진단 안내 */}
        <section className="report-section specialist-section">
          <h2 className="section-title">전문진단 안내</h2>
          <p className="section-desc">기초진단과 정밀진단 결과를 바탕으로, 아래 전문진단을 통해 더 깊은 분석이 가능합니다.</p>
          <div className="specialist-options-list">
            <div className="options-group">
              <div className="options-group-header">기본 제공</div>
              <label className="option-item included">
                <input type="checkbox" checked disabled />
                <span className="option-check"></span>
                <span className="option-name">은퇴 목표 달성 시나리오 2종</span>
                <span className="option-tag free">기본</span>
              </label>
              <label className="option-item included">
                <input type="checkbox" checked disabled />
                <span className="option-check"></span>
                <span className="option-name">투자 포트폴리오 분석</span>
                <span className="option-tag free">기본</span>
              </label>
            </div>
            <div className="options-group">
              <div className="options-group-header">추가 분석 (선택)</div>
              <label className="option-item">
                <input type="checkbox" />
                <span className="option-check"></span>
                <span className="option-name">절세 방안 분석</span>
                <span className="option-desc">연금 인출 순서, 세액공제 최적화</span>
              </label>
              <label className="option-item">
                <input type="checkbox" />
                <span className="option-check"></span>
                <span className="option-name">주택연금 적합성 분석</span>
                <span className="option-desc">가입 시기, 예상 수령액 시뮬레이션</span>
              </label>
              <label className="option-item">
                <input type="checkbox" />
                <span className="option-check"></span>
                <span className="option-name">재건축/재개발 리스크 분석</span>
                <span className="option-desc">사업 일정, 추가 분담금, 이주 계획</span>
              </label>
              <label className="option-item">
                <input type="checkbox" />
                <span className="option-check"></span>
                <span className="option-name">상속/증여 플랜</span>
                <span className="option-desc">사전 증여 vs 상속, 절세 전략</span>
              </label>
              <label className="option-item">
                <input type="checkbox" />
                <span className="option-check"></span>
                <span className="option-name">보험 포트폴리오 점검</span>
                <span className="option-desc">은퇴 후 필요 보장, 정리 대상 보험</span>
              </label>
            </div>
          </div>
        </section>

        <footer className="report-footer">
          <div className="footer-brand">Lycon Planning</div>
          <div className="footer-tagline">종합의견 3 / 3</div>
        </footer>
      </div>

      {/* 4페이지 - 진단 이력 */}
      {(() => {
        // 이전 진단 데이터 (더미)
        const prevData = {
          monthlyIncome: 750,
          monthlyFixedExpense: 170,
          monthlyLivingExpense: 330,
          realEstateAsset: 5.5,
          financialAsset: 2.2,
          pensionAsset: 0.8,
          totalDebt: 1.1,
          nationalPension: 145,
          retirementPension: 85,
          privatePension: 55,
          otherIncome: 15,
          targetRetirementAge: 55,
          yearsToRetirement: 16,
          assetDepletionAge: 78
        }

        // 현재 데이터 계산
        const currentData = {
          monthlyIncome: data.monthlyIncome,
          monthlyFixedExpense: data.monthlyFixedExpense,
          monthlyLivingExpense: data.monthlyLivingExpense,
          monthlySavings: data.monthlyIncome - data.monthlyFixedExpense - data.monthlyLivingExpense,
          realEstateAsset: data.realEstateAsset,
          financialAsset: data.cashAsset + data.investmentAsset,
          pensionAsset: data.pensionAsset,
          totalDebt: (data.mortgageAmount + data.creditLoanAmount + data.otherDebtAmount) / 10000,
          nationalPension: data.nationalPensionPersonal + data.nationalPensionSpouse,
          retirementPension: data.retirementPensionPersonal + data.retirementPensionSpouse,
          privatePension: data.privatePensionPersonal + data.privatePensionSpouse,
          otherIncome: data.otherIncomePersonal + data.otherIncomeSpouse,
          targetRetirementAge: data.targetRetirementAge,
          yearsToRetirement: data.targetRetirementAge - data.currentAge
        }

        const prevSavings = prevData.monthlyIncome - prevData.monthlyFixedExpense - prevData.monthlyLivingExpense
        const prevNetAsset = prevData.realEstateAsset + prevData.financialAsset + prevData.pensionAsset - prevData.totalDebt
        const currentNetAsset = currentData.realEstateAsset + currentData.financialAsset + currentData.pensionAsset - currentData.totalDebt

        // 변동 계산 헬퍼 함수
        const getChangeClass = (current: number, prev: number, isPositiveBetter = true) => {
          const diff = current - prev
          if (diff === 0) return 'same'
          if (isPositiveBetter) return diff > 0 ? 'up' : 'down'
          return diff < 0 ? 'up' : 'down'
        }

        const formatChange = (current: number, prev: number, unit: string, decimals = 0) => {
          const diff = current - prev
          if (diff === 0) return '유지'
          const sign = diff > 0 ? '+' : ''
          return `${sign}${decimals > 0 ? diff.toFixed(decimals) : diff}${unit}`
        }

        return (
      <div className="report-page page-history">
        <header className="report-header">
          <div className="report-header-left">
            <div className="report-logo">Lycon Planning</div>
            <h1 className="report-title">진단 이력</h1>
          </div>
          <div className="report-header-right">
            <span className="report-info-label">성명</span>
            <span className="report-info-value">{data.customerName}</span>
            <span className="report-info-label">연령</span>
            <span className="report-info-value">만 {data.currentAge}세</span>
            <span className="report-info-label">진단일</span>
            <span className="report-info-value">{today}</span>
            <span className="report-info-label">목표 은퇴</span>
            <span className="report-info-value">만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 현금흐름 비교 */}
        <section className="report-section history-section">
          <h2 className="section-title">월간 현금흐름</h2>
          <table className="history-table">
            <thead>
              <tr>
                <th className="col-item">항목</th>
                <th className="col-current">{todayShort}</th>
                <th className="col-prev">2024.06</th>
                <th className="col-change">변동</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="item-name">월 수입</td>
                <td className="item-value">{currentData.monthlyIncome}만원</td>
                <td className="item-value prev">{prevData.monthlyIncome}만원</td>
                <td className={`item-change ${getChangeClass(currentData.monthlyIncome, prevData.monthlyIncome)}`}>
                  {formatChange(currentData.monthlyIncome, prevData.monthlyIncome, '만원')}
                </td>
              </tr>
              <tr>
                <td className="item-name">월 고정지출</td>
                <td className="item-value">{currentData.monthlyFixedExpense}만원</td>
                <td className="item-value prev">{prevData.monthlyFixedExpense}만원</td>
                <td className={`item-change ${getChangeClass(currentData.monthlyFixedExpense, prevData.monthlyFixedExpense, false)}`}>
                  {formatChange(currentData.monthlyFixedExpense, prevData.monthlyFixedExpense, '만원')}
                </td>
              </tr>
              <tr>
                <td className="item-name">월 생활비</td>
                <td className="item-value">{currentData.monthlyLivingExpense}만원</td>
                <td className="item-value prev">{prevData.monthlyLivingExpense}만원</td>
                <td className={`item-change ${getChangeClass(currentData.monthlyLivingExpense, prevData.monthlyLivingExpense, false)}`}>
                  {formatChange(currentData.monthlyLivingExpense, prevData.monthlyLivingExpense, '만원')}
                </td>
              </tr>
              <tr className="row-total">
                <td className="item-name">월 저축 여력</td>
                <td className="item-value">{currentData.monthlySavings}만원</td>
                <td className="item-value prev">{prevSavings}만원</td>
                <td className={`item-change ${getChangeClass(currentData.monthlySavings, prevSavings)}`}>
                  {formatChange(currentData.monthlySavings, prevSavings, '만원')}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 자산 현황 비교 */}
        <section className="report-section history-section">
          <h2 className="section-title">자산 현황</h2>
          <table className="history-table">
            <thead>
              <tr>
                <th className="col-item">항목</th>
                <th className="col-current">{todayShort}</th>
                <th className="col-prev">2024.06</th>
                <th className="col-change">변동</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="item-name">부동산 자산</td>
                <td className="item-value">{currentData.realEstateAsset.toFixed(1)}억원</td>
                <td className="item-value prev">{prevData.realEstateAsset}억원</td>
                <td className={`item-change ${getChangeClass(currentData.realEstateAsset, prevData.realEstateAsset)}`}>
                  {formatChange(currentData.realEstateAsset, prevData.realEstateAsset, '억원', 1)}
                </td>
              </tr>
              <tr>
                <td className="item-name">금융 자산</td>
                <td className="item-value">{currentData.financialAsset.toFixed(1)}억원</td>
                <td className="item-value prev">{prevData.financialAsset}억원</td>
                <td className={`item-change ${getChangeClass(currentData.financialAsset, prevData.financialAsset)}`}>
                  {formatChange(currentData.financialAsset, prevData.financialAsset, '억원', 1)}
                </td>
              </tr>
              <tr>
                <td className="item-name">연금 자산</td>
                <td className="item-value">{currentData.pensionAsset.toFixed(1)}억원</td>
                <td className="item-value prev">{prevData.pensionAsset}억원</td>
                <td className={`item-change ${getChangeClass(currentData.pensionAsset, prevData.pensionAsset)}`}>
                  {formatChange(currentData.pensionAsset, prevData.pensionAsset, '억원', 1)}
                </td>
              </tr>
              <tr>
                <td className="item-name">총 부채</td>
                <td className="item-value">{currentData.totalDebt.toFixed(1)}억원</td>
                <td className="item-value prev">{prevData.totalDebt}억원</td>
                <td className={`item-change ${getChangeClass(currentData.totalDebt, prevData.totalDebt, false)}`}>
                  {formatChange(currentData.totalDebt, prevData.totalDebt, '억원', 1)}
                </td>
              </tr>
              <tr className="row-total">
                <td className="item-name">순자산</td>
                <td className="item-value">{currentNetAsset.toFixed(1)}억원</td>
                <td className="item-value prev">{prevNetAsset.toFixed(1)}억원</td>
                <td className={`item-change ${getChangeClass(currentNetAsset, prevNetAsset)}`}>
                  {formatChange(currentNetAsset, prevNetAsset, '억원', 1)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 연금 수령액 비교 */}
        <section className="report-section history-section">
          <h2 className="section-title">예상 연금 수령액 (월)</h2>
          <table className="history-table">
            <thead>
              <tr>
                <th className="col-item">항목</th>
                <th className="col-current">{todayShort}</th>
                <th className="col-prev">2024.06</th>
                <th className="col-change">변동</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="item-name">국민연금 (본인+배우자)</td>
                <td className="item-value">{currentData.nationalPension}만원</td>
                <td className="item-value prev">{prevData.nationalPension}만원</td>
                <td className={`item-change ${getChangeClass(currentData.nationalPension, prevData.nationalPension)}`}>
                  {formatChange(currentData.nationalPension, prevData.nationalPension, '만원')}
                </td>
              </tr>
              <tr>
                <td className="item-name">퇴직연금 (본인+배우자)</td>
                <td className="item-value">{currentData.retirementPension}만원</td>
                <td className="item-value prev">{prevData.retirementPension}만원</td>
                <td className={`item-change ${getChangeClass(currentData.retirementPension, prevData.retirementPension)}`}>
                  {formatChange(currentData.retirementPension, prevData.retirementPension, '만원')}
                </td>
              </tr>
              <tr>
                <td className="item-name">개인연금 (본인+배우자)</td>
                <td className="item-value">{currentData.privatePension}만원</td>
                <td className="item-value prev">{prevData.privatePension}만원</td>
                <td className={`item-change ${getChangeClass(currentData.privatePension, prevData.privatePension)}`}>
                  {formatChange(currentData.privatePension, prevData.privatePension, '만원')}
                </td>
              </tr>
              <tr className="row-total">
                <td className="item-name">총 예상 연금</td>
                <td className="item-value">{currentData.nationalPension + currentData.retirementPension + currentData.privatePension}만원</td>
                <td className="item-value prev">{prevData.nationalPension + prevData.retirementPension + prevData.privatePension}만원</td>
                <td className={`item-change ${getChangeClass(currentData.nationalPension + currentData.retirementPension + currentData.privatePension, prevData.nationalPension + prevData.retirementPension + prevData.privatePension)}`}>
                  {formatChange(currentData.nationalPension + currentData.retirementPension + currentData.privatePension, prevData.nationalPension + prevData.retirementPension + prevData.privatePension, '만원')}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 은퇴 준비 지표 비교 */}
        <section className="report-section history-section">
          <h2 className="section-title">은퇴 준비 지표</h2>
          <table className="history-table">
            <thead>
              <tr>
                <th className="col-item">항목</th>
                <th className="col-current">{todayShort}</th>
                <th className="col-prev">2024.06</th>
                <th className="col-change">변동</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="item-name">목표 은퇴 나이</td>
                <td className="item-value">{currentData.targetRetirementAge}세</td>
                <td className="item-value prev">{prevData.targetRetirementAge}세</td>
                <td className={`item-change ${currentData.targetRetirementAge === prevData.targetRetirementAge ? 'same' : 'up'}`}>
                  {currentData.targetRetirementAge === prevData.targetRetirementAge ? '유지' : formatChange(currentData.targetRetirementAge, prevData.targetRetirementAge, '세')}
                </td>
              </tr>
              <tr>
                <td className="item-name">은퇴까지 남은 기간</td>
                <td className="item-value">{currentData.yearsToRetirement}년</td>
                <td className="item-value prev">{prevData.yearsToRetirement}년</td>
                <td className="item-change same">
                  {formatChange(currentData.yearsToRetirement, prevData.yearsToRetirement, '년')}
                </td>
              </tr>
              <tr>
                <td className="item-name">예상 자산 소진 시점</td>
                <td className="item-value">{assetDepletionAge}세</td>
                <td className="item-value prev">{prevData.assetDepletionAge}세</td>
                <td className={`item-change ${getChangeClass(assetDepletionAge, prevData.assetDepletionAge)}`}>
                  {formatChange(assetDepletionAge, prevData.assetDepletionAge, '세')}
                </td>
              </tr>
              <tr>
                <td className="item-name">목표 달성 여부</td>
                <td className={`item-value ${assetDepletionAge >= data.lifeExpectancy ? 'good' : assetDepletionAge >= data.lifeExpectancy - 5 ? 'warning' : 'bad'}`}>
                  {assetDepletionAge >= data.lifeExpectancy ? '달성' : assetDepletionAge >= data.lifeExpectancy - 5 ? '근접' : '미달'}
                </td>
                <td className="item-value prev warning">미달</td>
                <td className={`item-change ${assetDepletionAge > prevData.assetDepletionAge ? 'up' : 'same'}`}>
                  {assetDepletionAge > prevData.assetDepletionAge ? '개선' : '유지'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="report-footer">
          <div className="footer-brand">Lycon Planning</div>
          <div className="footer-tagline">진단 이력</div>
        </footer>
      </div>
        )
      })()}

      {/* 부록 - 은퇴 준비 기본 상식 */}
      <div className="report-page page-4">
        <header className="report-header">
          <div className="report-header-left">
            <div className="report-logo">Lycon Planning</div>
            <h1 className="report-title">은퇴 준비 기본 상식</h1>
          </div>
          <div className="report-header-right">
            <span className="report-info-label">성명</span>
            <span className="report-info-value">{data.customerName}</span>
            <span className="report-info-label">연령</span>
            <span className="report-info-value">만 {data.currentAge}세</span>
            <span className="report-info-label">진단일</span>
            <span className="report-info-value">{today}</span>
            <span className="report-info-label">목표 은퇴</span>
            <span className="report-info-value">만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 은퇴란 무엇인가 */}
        <section className="report-section knowledge-section">
          <h2 className="section-title">은퇴란 무엇인가요?</h2>
          <div className="knowledge-content">
            <p>은퇴는 단순히 "회사를 그만두는 것"이 아닙니다.</p>
            <p><strong>매달 들어오던 월급이 멈추는 순간</strong>입니다. 하지만 생활비, 병원비, 경조사비는 계속 나갑니다.</p>
            <p>그래서 은퇴 준비의 핵심은 <strong>"월급 없이도 돈이 들어오는 구조"</strong>를 만드는 것입니다.</p>
          </div>
        </section>

        {/* 3층 연금 */}
        <section className="report-section knowledge-section">
          <h2 className="section-title">연금의 3가지 종류</h2>
          <div className="pension-layers">
            <div className="pension-layer layer-1">
              <div className="layer-number">1층</div>
              <div className="layer-content">
                <div className="layer-title">국민연금</div>
                <div className="layer-desc">나라에서 주는 연금. 10년 이상 내면 받을 수 있어요. 평균 월 60~100만원 정도.</div>
              </div>
            </div>
            <div className="pension-layer layer-2">
              <div className="layer-number">2층</div>
              <div className="layer-content">
                <div className="layer-title">퇴직연금</div>
                <div className="layer-desc">회사에서 쌓아주는 연금. 퇴직금을 연금으로 받으면 세금도 아끼고 오래 쓸 수 있어요.</div>
              </div>
            </div>
            <div className="pension-layer layer-3">
              <div className="layer-number">3층</div>
              <div className="layer-content">
                <div className="layer-title">개인연금</div>
                <div className="layer-desc">내가 직접 넣는 연금. 연금저축, IRP 등이 있어요. 세금 혜택도 받을 수 있어요.</div>
              </div>
            </div>
          </div>
          <div className="knowledge-tip">
            <strong>핵심:</strong> 1층만으로는 부족해요. 2층, 3층을 함께 쌓아야 안정적인 노후가 됩니다.
          </div>
        </section>

        {/* 복리의 힘 */}
        <section className="report-section knowledge-section">
          <h2 className="section-title">복리란? (돈이 돈을 버는 마법)</h2>
          <div className="knowledge-content">
            <p>1,000만원을 연 7%로 굴리면:</p>
            <div className="compound-example">
              <div className="compound-item">
                <span className="compound-year">10년 후</span>
                <span className="compound-amount">약 2,000만원</span>
              </div>
              <div className="compound-item">
                <span className="compound-year">20년 후</span>
                <span className="compound-amount">약 4,000만원</span>
              </div>
              <div className="compound-item">
                <span className="compound-year">30년 후</span>
                <span className="compound-amount">약 7,600만원</span>
              </div>
            </div>
            <p className="compound-lesson">내가 일하지 않아도 돈이 스스로 불어납니다. <strong>시간이 오래 걸릴수록 효과가 커져요.</strong></p>
          </div>
        </section>

        {/* 인플레이션 */}
        <section className="report-section knowledge-section">
          <h2 className="section-title">물가 상승의 무서움</h2>
          <div className="knowledge-content">
            <p>지금 짜장면 한 그릇이 8,000원이에요. 20년 전에는 3,000원이었어요.</p>
            <p>물가는 매년 조금씩 올라요. <strong>지금 100만원으로 살 수 있는 것들이, 20년 후에는 60만원어치밖에 못 사요.</strong></p>
            <p>그래서 은퇴 자금은 "지금 필요한 돈"이 아니라 <strong>"미래에 필요한 돈"</strong>으로 계산해야 해요.</p>
          </div>
        </section>

        {/* 핵심 숫자 */}
        <section className="report-section knowledge-section">
          <h2 className="section-title">기억해야 할 숫자들</h2>
          <div className="key-numbers">
            <div className="key-number-item">
              <div className="key-number">70%</div>
              <div className="key-number-desc">은퇴 후 생활비는 현재의 약 70% 정도 필요해요</div>
            </div>
            <div className="key-number-item">
              <div className="key-number">25~30년</div>
              <div className="key-number-desc">60세에 은퇴하면 90세까지 30년을 준비해야 해요</div>
            </div>
            <div className="key-number-item">
              <div className="key-number">3억~5억</div>
              <div className="key-number-desc">연금 외에 추가로 필요한 노후 자금 (2인 가구 기준)</div>
            </div>
          </div>
        </section>

        <footer className="report-footer">
          <div className="footer-brand">Lycon Planning</div>
          <div className="footer-tagline">부록</div>
        </footer>
      </div>
    </div>
  )
}

export default DiagnosisReportV2
