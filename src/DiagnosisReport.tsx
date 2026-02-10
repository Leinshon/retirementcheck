import { useState } from 'react'
import './DiagnosisReport.css'
import { householdFinance2025, type AgeGroup } from './data/householdFinance2025'

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
  financialAsset: number
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
  financialAsset: 2.5,
  pensionAsset: 1.0,
  mortgageAmount: 8000,
  mortgageRate: 4.5,
  creditLoanAmount: 3000,
  creditLoanRate: 6.8,
  otherDebtAmount: 1000,
  otherDebtRate: 5.0,
  monthlyIncome: 800,
  monthlyFixedExpense: 180,
  monthlyLivingExpense: 350
}

const DiagnosisReport = () => {
  const [data] = useState<GlobalData>(() => {
    // localStorage에서 저장된 데이터 불러오기
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('professionalDiagnosisData')
      if (saved) {
        try {
          return { ...defaultGlobalData, ...JSON.parse(saved) }
        } catch {
          return defaultGlobalData
        }
      }
    }
    return defaultGlobalData
  })

  // 계산 로직
  const totalAsset = data.realEstateAsset + data.financialAsset + data.pensionAsset
  const totalDebt = data.mortgageAmount + data.creditLoanAmount + data.otherDebtAmount
  const netWorth = Math.round((totalAsset - totalDebt / 10000) * 100) / 100

  const monthlyPension =
    data.nationalPensionPersonal + data.nationalPensionSpouse +
    data.retirementPensionPersonal + data.retirementPensionSpouse +
    data.privatePensionPersonal + data.privatePensionSpouse +
    data.otherIncomePersonal + data.otherIncomeSpouse

  // 은퇴 후 월지출 = 현재 지출의 70% (은퇴 후 지출 감소 반영)
  const currentExpenseBase = data.monthlyFixedExpense + data.monthlyLivingExpense
  const monthlyExpense = Math.round(currentExpenseBase * 0.7)
  const monthlyGap = monthlyPension - monthlyExpense

  // 현재 현금흐름
  const monthlyInterest = Math.round(
    (data.mortgageAmount * data.mortgageRate / 100 / 12) +
    (data.creditLoanAmount * data.creditLoanRate / 100 / 12) +
    (data.otherDebtAmount * data.otherDebtRate / 100 / 12)
  )
  const currentMonthlyExpense = data.monthlyFixedExpense + data.monthlyLivingExpense + monthlyInterest
  const currentMonthlyGap = data.monthlyIncome - currentMonthlyExpense

  // 자산 비율 (합이 100%가 되도록 마지막 항목은 나머지로 계산)
  const realEstateRatio = Math.round((data.realEstateAsset / totalAsset) * 100)
  const financialRatio = Math.round((data.financialAsset / totalAsset) * 100)
  const pensionRatio = 100 - realEstateRatio - financialRatio

  // 유동자산 = 금융자산 + 연금자산 - 부채 (부동산 제외)
  const liquidAsset = Math.round((data.financialAsset + data.pensionAsset - totalDebt / 10000) * 100) / 100

  // 은퇴 시점까지 유동자산 성장 (연 2.5% 복리)
  const yearsToRetirement = Math.max(0, data.targetRetirementAge - data.currentAge)
  const growthRate = 0.025
  const liquidAssetAtRetirement = Math.round(liquidAsset * Math.pow(1 + growthRate, yearsToRetirement) * 100) / 100

  // 자산 소진 시점 계산 (은퇴 시점 유동자산 기준)
  const retirementYears = data.lifeExpectancy - data.targetRetirementAge
  const annualShortfall = monthlyGap < 0 ? Math.abs(monthlyGap) * 12 / 10000 : 0 // 억원

  // 유동자산이 마이너스면 즉시 소진 (0년), 연금이 충분하면 999년
  const yearsOfWithdrawal = liquidAssetAtRetirement <= 0
    ? 0 // 유동자산이 마이너스면 은퇴 즉시 소진
    : annualShortfall > 0
      ? Math.round(liquidAssetAtRetirement / annualShortfall * 10) / 10
      : 999 // 연금이 지출을 충당하면 소진 안됨
  const assetDepletionAge = data.targetRetirementAge + Math.floor(yearsOfWithdrawal)
  const shortfallYears = Math.max(0, retirementYears - yearsOfWithdrawal)

  // 연금 충당률
  const pensionCoverageRate = Math.round((monthlyPension / monthlyExpense) * 100)

  // 총수요/총공급 계산 (억원, 은퇴 시점 자산 기준)
  const totalDemand = Math.round((retirementYears * monthlyExpense * 12 / 10000) * 100) / 100
  const totalPensionSupply = Math.round((retirementYears * monthlyPension * 12 / 10000) * 100) / 100
  const totalSupply = Math.round((totalPensionSupply + Math.max(0, liquidAssetAtRetirement)) * 100) / 100
  const supplyDeficit = Math.round((totalDemand - totalSupply) * 100) / 100
  const supplyRatio = totalDemand > 0 ? Math.round((totalSupply / totalDemand) * 100) : 0
  const deficitRatio = 100 - supplyRatio

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

    // 1. 현금흐름 분석
    if (monthlyGap < 0) {
      findings.push(`은퇴 후 월 ${Math.abs(monthlyGap)}만원의 현금흐름 부족이 예상됩니다`)
      if (currentMonthlyGap > 0) {
        recommendations.push(`현재 월 저축여력 ${currentMonthlyGap}만원을 활용한 자산 축적 전략 수립`)
      }
    }

    // 2. 자산 구성 분석
    if (realEstateRatio >= 70) {
      findings.push(`부동산 비중이 ${realEstateRatio}%로 유동성 리스크가 높습니다`)
      recommendations.push('부동산 일부 현금화 또는 역모기지 활용 검토')
    } else if (realEstateRatio >= 50) {
      findings.push(`자산의 ${realEstateRatio}%가 부동산에 집중되어 있습니다`)
    }

    // 3. 연금 충당률 분석
    if (pensionCoverageRate < 50) {
      findings.push(`연금 충당률이 ${pensionCoverageRate}%로 매우 낮습니다`)
      recommendations.push('개인연금 추가 가입 또는 연금저축 확대 검토')
    } else if (pensionCoverageRate < 70) {
      findings.push(`연금으로 생활비의 ${pensionCoverageRate}%만 충당 가능합니다`)
    }

    // 4. 자산 지속성 분석
    if (yearsOfWithdrawal < retirementYears) {
      const depletionMsg = `현재 구조 유지 시 ${assetDepletionAge}세에 금융자산 소진이 예상됩니다`
      if (!findings.includes(depletionMsg)) {
        findings.push(depletionMsg)
      }
      recommendations.push(`${data.lifeExpectancy}세까지 자산 유지를 위한 현금흐름 개선 필요`)
    }

    // 5. 총수요/총공급 분석
    if (supplyDeficit > 0) {
      findings.push(`은퇴 후 총 ${supplyDeficit}억원의 자금 부족이 예상됩니다`)
    }

    // 결과 조합
    const findingText = findings.length > 0
      ? findings.slice(0, 2).join('. ') + '.'
      : '현재 재무 구조가 안정적입니다.'

    const recommendationText = recommendations.length > 0
      ? recommendations[0] + '이 필요합니다.'
      : ''

    return { findingText, recommendationText }
  }

  const verdict = generateVerdict()

  // 저축률 평가
  const savingsRate = data.monthlyIncome > 0 ? (currentMonthlyGap / data.monthlyIncome) * 100 : 0
  const getSavingsGrade = () => {
    if (savingsRate < 0) return { grade: '적자', className: 'grade-danger' }
    if (savingsRate < 10) return { grade: '부족', className: 'grade-warning' }
    if (savingsRate < 20) return { grade: '보통', className: 'grade-caution' }
    if (savingsRate < 30) return { grade: '양호', className: 'grade-good' }
    return { grade: '우수', className: 'grade-excellent' }
  }
  const savingsGrade = getSavingsGrade()

  // 은퇴 후 현금흐름 평가 (연금 충당률 기반)
  const getRetirementGrade = () => {
    if (monthlyGap < 0 && pensionCoverageRate < 50) return { grade: '위험', className: 'grade-danger' }
    if (monthlyGap < 0 && pensionCoverageRate < 70) return { grade: '부족', className: 'grade-warning' }
    if (monthlyGap < 0) return { grade: '주의', className: 'grade-caution' }
    if (pensionCoverageRate >= 100) return { grade: '충분', className: 'grade-excellent' }
    return { grade: '양호', className: 'grade-good' }
  }
  const retirementGrade = getRetirementGrade()

  // 인쇄 핸들러
  const handlePrint = () => {
    window.print()
  }

  // 오늘 날짜
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  return (
    <div className="report-container">
      {/* 인쇄 버튼 (화면에서만 표시) */}
      <button className="print-button" onClick={handlePrint}>
        인쇄하기
      </button>

      <div className="report-page">
        {/* 헤더 */}
        <header className="report-header">
          <div className="report-header-left">
            <div className="report-logo">Lycon Planning</div>
            <h1 className="report-title">은퇴 준비 진단표</h1>
          </div>
          <div className="report-header-right">
            <span className="report-info-label">성명</span>
            <span className="report-info-value">{data.customerName}</span>
            <span className="report-info-label">연령</span>
            <span className="report-info-value">만 {data.currentAge}세</span>
            <span className="report-info-label">검진일</span>
            <span className="report-info-value">{today}</span>
            <span className="report-info-label">목표 은퇴</span>
            <span className="report-info-value">만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 현금흐름 분석 (현재 vs 은퇴 후) */}
        <div className="report-two-column">
          {/* 현재 현금흐름 */}
          <section className="report-section half">
            <h2 className="section-title">현재 현금흐름 <span className="section-title-en">Current</span></h2>
            <div className="cashflow-grid">
              {(() => {
                // 연령대 결정
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

                // 연소득 중앙값 기준 상위 % 계산
                const annualIncome = data.monthlyIncome * 12
                const medianIncome = ageStats.income.median
                const getIncomePercentile = (income: number) => {
                  const ratio = income / medianIncome
                  if (ratio >= 2.5) return 1
                  if (ratio >= 2.0) return 3
                  if (ratio >= 1.7) return 5
                  if (ratio >= 1.4) return 10
                  if (ratio >= 1.2) return 20
                  if (ratio >= 1.0) return 30
                  if (ratio >= 0.8) return 50
                  return 70
                }
                // 연지출 기준 상위 % 계산 (지출 많을수록 상위)
                const annualExpense = currentMonthlyExpense * 12
                const medianExpense = ageStats.disposableIncome.median * 0.7 // 가처분소득의 약 70%를 소비지출로 추정
                const getExpensePercentile = (expense: number) => {
                  const ratio = expense / medianExpense
                  if (ratio >= 2.0) return 3
                  if (ratio >= 1.6) return 5
                  if (ratio >= 1.3) return 10
                  if (ratio >= 1.1) return 20
                  if (ratio >= 0.9) return 40
                  if (ratio >= 0.7) return 60
                  return 80
                }
                const incomePercentile = getIncomePercentile(annualIncome)
                const expensePercentile = getExpensePercentile(annualExpense)

                return (
                  <>
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
                      <div className="cashflow-percentile">동연령대 상위 {incomePercentile}%</div>
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
                      <div className="cashflow-percentile">동연령대 상위 {expensePercentile}%</div>
                    </div>
                  </>
                )
              })()}
              <div className="cashflow-item highlight">
                <div className="cashflow-label">저축/투자 여력</div>
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

          {/* 예상 현금흐름 (은퇴 후) */}
          <section className="report-section half">
            <h2 className="section-title">은퇴 후 예상 현금흐름 <span className="section-title-en">After Retirement</span></h2>
            <div className="cashflow-grid">
              <div className="cashflow-item">
                <div className="cashflow-label">월 소득(연금)</div>
                <div className="cashflow-bar-container">
                  <div
                    className="cashflow-bar income"
                    style={{ width: `${Math.min(100, (monthlyPension / Math.max(monthlyPension, monthlyExpense)) * 100)}%` }}
                  >
                    <span className="cashflow-bar-label">{monthlyPension}만원</span>
                  </div>
                </div>
                <div className="cashflow-note">충당률 {pensionCoverageRate}%</div>
              </div>
              <div className="cashflow-item">
                <div className="cashflow-label">월 지출</div>
                <div className="cashflow-bar-container">
                  <div
                    className="cashflow-bar expense"
                    style={{ width: `${Math.min(100, (monthlyExpense / Math.max(monthlyPension, monthlyExpense)) * 100)}%` }}
                  >
                    {/* 금액은 바 그래프 위에 라벨로 표시 */}
                    <span className="cashflow-bar-label">{monthlyExpense}만원</span>
                  </div>
                </div>
                {/* 현재지출의 70% 적용 설명 */}
                <div className="cashflow-note">현재의 70%</div>
              </div>
              <div className="cashflow-item highlight">
                <div className="cashflow-label">{monthlyGap >= 0 ? '월 잉여금액' : '월 부족금액'}</div>
                <div className="cashflow-bar-container">
                  {(() => {
                    const barWidth = Math.min(100, Math.abs(monthlyGap) / monthlyExpense * 100)
                    const isNarrow = barWidth < 25
                    return (
                      <>
                        <div
                          className={`cashflow-bar gap ${monthlyGap >= 0 ? 'positive' : 'negative'}`}
                          style={{ width: `${barWidth}%` }}
                        >
                          {!isNarrow && <span className="cashflow-bar-label">{monthlyGap >= 0 ? '+' : ''}{monthlyGap}만원</span>}
                        </div>
                        {isNarrow && <span className="cashflow-bar-label-outside">{monthlyGap >= 0 ? '+' : ''}{monthlyGap}만원</span>}
                      </>
                    )
                  })()}
                </div>
                <div className={`cashflow-grade ${retirementGrade.className}`}>
                  {retirementGrade.grade}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 총수요/총공급 분석 */}
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

        {/* 자산 구성 + 자산 지속성 (2컬럼) */}
        <div className="report-two-column">
          {/* 자산 구성분석 */}
          <section className="report-section half">
            <h2 className="section-title">자산 구성분석 <span className="section-title-en">Asset Composition</span></h2>
            <div className="asset-stack-bar">
              <div
                className="asset-segment realestate"
                style={{ width: `${realEstateRatio}%` }}
                title={`부동산 ${realEstateRatio}%`}
              />
              <div
                className="asset-segment financial"
                style={{ width: `${financialRatio}%` }}
                title={`금융 ${financialRatio}%`}
              />
              <div
                className="asset-segment pension"
                style={{ width: `${pensionRatio}%` }}
                title={`연금 ${pensionRatio}%`}
              />
            </div>
            <div className="asset-legend">
              <div className="asset-legend-item">
                <span className="legend-dot realestate"></span>
                <span>부동산 {data.realEstateAsset}억 ({realEstateRatio}%)</span>
              </div>
              <div className="asset-legend-item">
                <span className="legend-dot financial"></span>
                <span>금융자산 {data.financialAsset}억 ({financialRatio}%)</span>
              </div>
              <div className="asset-legend-item">
                <span className="legend-dot pension"></span>
                <span>연금 평가금액 {data.pensionAsset}억 ({pensionRatio}%)</span>
              </div>
            </div>
            <div className="asset-summary">
              <div className="asset-summary-row">
                <span>총자산</span>
                <span>{totalAsset}억원</span>
              </div>
              <div className="asset-summary-row debt">
                <span>- 부채 <span className="debt-detail">({[
                  data.mortgageAmount > 0 && `주담대 ${(data.mortgageAmount / 10000).toFixed(1)}억`,
                  data.creditLoanAmount > 0 && `신용 ${(data.creditLoanAmount / 10000).toFixed(1)}억`,
                  data.otherDebtAmount > 0 && `기타 ${(data.otherDebtAmount / 10000).toFixed(1)}억`
                ].filter(Boolean).join(', ')})</span></span>
                <span>{(totalDebt / 10000).toFixed(1)}억원</span>
              </div>
              <div className="asset-summary-row total">
                <span>순자산</span>
                <span>{netWorth}억원</span>
              </div>
            </div>
          </section>

          {/* 자산 지속성 */}
          <section className="report-section half">
            <h2 className="section-title">자산 지속성 <span className="section-title-en">Sustainability</span></h2>
            <div className="sustainability-timeline">
              <div className="timeline-bar">
                <div
                  className="timeline-filled"
                  style={{ width: `${Math.min(100, (yearsOfWithdrawal / retirementYears) * 100)}%` }}
                />
                {(() => {
                  // 소진 시점 위치 계산 (0% ~ 100%)
                  const depletionRatio = Math.min(1, yearsOfWithdrawal / retirementYears)
                  const markerPosition = Math.max(5, Math.min(95, depletionRatio * 100))

                  // 마커 라벨: 충분하면 "충분", 아니면 소진 나이 표시
                  const markerLabel = yearsOfWithdrawal >= retirementYears
                    ? '충분'
                    : `${assetDepletionAge}세 소진`

                  return (
                    <div
                      className="timeline-marker"
                      style={{ left: `${markerPosition}%` }}
                    >
                      <span className="marker-label">{markerLabel}</span>
                    </div>
                  )
                })()}
              </div>
              <div className="timeline-labels">
                <span>{data.targetRetirementAge}세</span>
                <span>{data.lifeExpectancy}세</span>
              </div>
            </div>
            <div className="sustainability-stats">
              <div className="stat-row">
                <span className="stat-label">지속 가능</span>
                <span className="stat-value">{Math.min(yearsOfWithdrawal, retirementYears).toFixed(0)}년</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">필요 기간</span>
                <span className="stat-value">{retirementYears}년</span>
              </div>
              <div className={`stat-row ${shortfallYears > 0 ? 'negative' : 'positive'}`}>
                <span className="stat-label">부족 기간</span>
                <span className="stat-value">{shortfallYears > 0 ? `${Math.round(shortfallYears)}년` : '-'}</span>
              </div>
            </div>
            <div className="sustainability-note">
              * 유동자산 기준 (부동산 제외), 연 2.5% 성장 가정, 은퇴 시점 {liquidAssetAtRetirement}억원
            </div>
          </section>
        </div>

        {/* 리스크 진단 */}
        <section className="report-section">
          <h2 className="section-title">리스크 진단 <span className="section-title-en">Risk Diagnosis</span></h2>
          <div className="risk-grid">
            <div className="risk-item">
              <div className="risk-label">부동산 편중</div>
              <div className="risk-bar-container">
                <div className="risk-zone-labels">
                  <span className="zone-label high">위험</span>
                  <span className="zone-label medium">주의</span>
                  <span className="zone-label low">적정</span>
                </div>
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
              <div className="risk-label">현금흐름 적자</div>
              <div className="risk-bar-container">
                <div className="risk-zone-labels">
                  <span className="zone-label high">위험</span>
                  <span className="zone-label medium">주의</span>
                  <span className="zone-label low">적정</span>
                </div>
                <div className="risk-bar-bg">
                  <div className="risk-zone high" style={{ width: '30%' }} />
                  <div className="risk-zone medium" style={{ width: '30%' }} />
                  <div className="risk-zone low" style={{ width: '40%' }} />
                </div>
                {/* 잉여(+)면 적정(오른쪽), 적자(-)면 금액에 따라 위치 */}
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
                <div className="risk-zone-labels">
                  <span className="zone-label high">위험</span>
                  <span className="zone-label medium">주의</span>
                  <span className="zone-label low">적정</span>
                </div>
                <div className="risk-bar-bg">
                  <div className="risk-zone high" style={{ width: '30%' }} />
                  <div className="risk-zone medium" style={{ width: '30%' }} />
                  <div className="risk-zone low" style={{ width: '40%' }} />
                </div>
                {/* 0-100% 범위로 제한, 100% 초과시 오른쪽 끝 */}
                <div
                  className={`risk-indicator ${pensionCoverageRate >= 80 ? 'low' : pensionCoverageRate >= 50 ? 'medium' : 'high'}`}
                  style={{ left: `${Math.min(100, pensionCoverageRate)}%` }}
                />
              </div>
              <div className="risk-value">{pensionCoverageRate}%</div>
            </div>
          </div>
        </section>

        {/* 개선 가능성 */}
        <section className="report-section">
          <h2 className="section-title">
            개선 가능성 <span className="section-title-en">Improvement Potential</span>
            <span className="section-note">단위: 유동자산(억)</span>
          </h2>
          {(() => {
            // 개선 시 계산: 연 8% 성장률, 생활비 15% 절감, 연금 20% 증가
            const improvedGrowthRate = 0.08
            const expenseReduction = 0.15 // 15% 생활비 절감
            const pensionIncrease = 0.20 // 20% 연금 증가

            // 개선 시 은퇴 시점 자산 (8% 성장률 적용, 유동자산 기준)
            const improvedAtRetirement = Math.round(liquidAsset * Math.pow(1 + improvedGrowthRate, yearsToRetirement) * 100) / 100

            // 개선 시 월 현금흐름 (연금 증가 + 지출 절감)
            const improvedMonthlyPension = Math.round(monthlyPension * (1 + pensionIncrease))
            const improvedMonthlyExpense = Math.round(monthlyExpense * (1 - expenseReduction))
            const improvedMonthlyGap = improvedMonthlyPension - improvedMonthlyExpense
            const improvedAnnualShortfall = improvedMonthlyGap < 0 ? Math.abs(improvedMonthlyGap) * 12 / 10000 : 0

            // 개선 시 각 연도별 자산 추이 계산
            const improvedYearlyAssets: number[] = []
            let improvedAsset = improvedAtRetirement
            for (let year = 0; year <= retirementYears; year++) {
              improvedYearlyAssets.push(Math.max(0, improvedAsset))
              // 다음 해: 자산 성장 후 생활비 인출 (개선된 부족액 적용)
              improvedAsset = improvedAsset * (1 + improvedGrowthRate) - improvedAnnualShortfall
            }

            // 개선 시 최종 자산 (기대수명 시점)
            const improvedFinalAsset = improvedYearlyAssets[retirementYears] || 0

            // Y축 최대값: 개선시 자산 중 최대값 기준, 최소 1억
            const maxImprovedAsset = Math.max(...improvedYearlyAssets)
            const yAxisMax = Math.max(1, Math.ceil(Math.max(liquidAssetAtRetirement, maxImprovedAsset, 0) * 1.1))

            return (
              <>
                <div className="improvement-chart">
                  <div className="chart-y-axis">
                    <span>{yAxisMax}</span>
                    <span>{Math.round(yAxisMax / 2)}</span>
                    <span>0</span>
                  </div>
                  <div className="chart-area">
                    {(() => {
                      // 소진 시점을 X축 비율로 계산 (0~300)
                      const depletionRatio = Math.min(1, yearsOfWithdrawal / retirementYears)
                      const depletionX = Math.round(depletionRatio * 300)

                      // Y좌표 계산 함수 (자산값 -> SVG Y좌표, 100이 0억, 0이 최대)
                      // 마이너스 자산은 100(바닥)으로 클램핑
                      const assetToY = (asset: number) => Math.min(100, Math.max(0, 100 - (asset / yAxisMax) * 100))

                      // 현재 유지시 시작 Y위치 (마이너스면 바닥에서 시작)
                      const currentStartY = liquidAssetAtRetirement <= 0 ? 100 : assetToY(liquidAssetAtRetirement)

                      // 현재 유지시 경로: 마이너스면 바닥에서 계속, 아니면 소진 시점까지 선형 감소
                      const currentPath = liquidAssetAtRetirement <= 0
                        ? `M 0,100 L 300,100` // 마이너스 자산: 처음부터 바닥
                        : depletionRatio >= 1
                          ? `M 0,${currentStartY} L 300,${currentStartY}` // 소진 안됨
                          : `M 0,${currentStartY} L ${depletionX},100 L 300,100` // 소진 시점에서 0 도달

                      // 개선 시 경로: 포인트들을 연결
                      const improvedPoints = improvedYearlyAssets.map((asset, idx) => {
                        const x = Math.round((idx / retirementYears) * 300)
                        const y = assetToY(asset)
                        return `${x},${y}`
                      })
                      const improvedPath = `M ${improvedPoints.join(' L ')}`

                      return (
                        <svg viewBox="0 0 300 100" preserveAspectRatio="none">
                          {/* 개선 시 경로 */}
                          <path
                            d={improvedPath}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeDasharray="5,3"
                          />
                          {/* 현재 유지 시 경로 */}
                          <path
                            d={currentPath}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2"
                          />
                        </svg>
                      )
                    })()}
                    <div className="chart-legend">
                      <div className="chart-legend-item improved">
                        <span className="legend-line dashed"></span>
                        <span>개선 시 ({data.lifeExpectancy}세 {improvedFinalAsset.toFixed(1)}억)</span>
                      </div>
                      <div className="chart-legend-item current">
                        <span className="legend-line solid"></span>
                        <span>현재 유지 시 ({assetDepletionAge}세 소진)</span>
                      </div>
                    </div>
                  </div>
                  <div className="chart-x-axis">
                    {(() => {
                      // 5년 단위로 X축 라벨 생성
                      const labels: number[] = []
                      for (let age = data.targetRetirementAge; age <= data.lifeExpectancy; age += 5) {
                        labels.push(age)
                      }
                      // 마지막 값이 기대수명과 다르면 추가
                      if (labels[labels.length - 1] !== data.lifeExpectancy) {
                        labels.push(data.lifeExpectancy)
                      }
                      return labels.map((age, idx) => (
                        <span key={idx}>{age}세</span>
                      ))
                    })()}
                  </div>
                </div>
              </>
            )
          })()}
        </section>

        {/* 푸터 - 1페이지 */}
        <footer className="report-footer">
          <div className="footer-brand">Lycon Planning</div>
          <div className="footer-tagline">1 / 3</div>
        </footer>
      </div>

      {/* 2페이지 - 은퇴 준비 기본 상식 */}
      <div className="report-page page-2">
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
          <div className="footer-tagline">2 / 3</div>
        </footer>
      </div>

      {/* 3페이지 - 종합 소견 */}
      <div className="report-page page-3">
        <header className="report-header">
          <div className="report-header-left">
            <div className="report-logo">Lycon Planning</div>
            <h1 className="report-title">종합 소견</h1>
          </div>
          <div className="report-header-right">
            <span className="report-info-label">성명</span>
            <span className="report-info-value">{data.customerName}</span>
            <span className="report-info-label">연령</span>
            <span className="report-info-value">만 {data.currentAge}세</span>
            <span className="report-info-label">검진일</span>
            <span className="report-info-value">{today}</span>
            <span className="report-info-label">목표 은퇴</span>
            <span className="report-info-value">만 {data.targetRetirementAge}세</span>
          </div>
        </header>

        {/* 종합 소견 */}
        <section className="report-section opinion-section">
          <h2 className="section-title">종합 소견 <span className="section-title-en">Summary</span></h2>
          <div className="opinion-content">
            <p className="opinion-finding">{verdict.findingText}</p>
            {verdict.recommendationText && (
              <p className="opinion-recommendation">{verdict.recommendationText}</p>
            )}
          </div>
        </section>

        {/* 상담 예약 CTA */}
        <section className="report-section cta-section">
          <h2 className="section-title">다음 단계</h2>
          <div className="cta-content">
            <p className="cta-description">
              이 진단표는 현재 상황을 간단히 파악한 것입니다.<br />
              더 정확한 분석과 맞춤 전략을 원하시면 전문 상담을 예약해 주세요.
            </p>
            <div className="cta-benefits">
              <div className="cta-benefit-item">
                <span className="benefit-title">세금 최적화 전략</span>
                <span className="benefit-desc">연금저축, IRP 활용으로 세금 아끼는 방법</span>
              </div>
              <div className="cta-benefit-item">
                <span className="benefit-title">자산 재배치 플랜</span>
                <span className="benefit-desc">부동산, 금융자산 비중 조절 방안</span>
              </div>
              <div className="cta-benefit-item">
                <span className="benefit-title">연금 수령 시기 최적화</span>
                <span className="benefit-desc">언제 받는 게 유리한지 분석</span>
              </div>
            </div>
            <button className="cta-button" onClick={() => window.open('https://lyconplanning.com/consultation', '_blank')}>
              전문 상담 예약하기
            </button>
          </div>
        </section>

        {/* 푸터 - 3페이지 */}
        <footer className="report-footer">
          <div className="footer-brand">Lycon Planning</div>
          <div className="footer-tagline">3 / 3</div>
        </footer>
      </div>
    </div>
  )
}

export default DiagnosisReport
