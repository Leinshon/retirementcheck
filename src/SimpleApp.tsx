import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
import './App.css'
import './SimpleApp.css'

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

type InvestmentStyle = 'conservative' | 'balanced' | 'aggressive'

// 백테스팅 ETF 목록
const backtestETFs = [
  { symbol: 'SPY', name: 'S&P 500', ticker: 'SPY', maxYears: 30 },
  { symbol: 'QQQ', name: 'NASDAQ 100', ticker: 'QQQ', maxYears: 25 },
  { symbol: '069500.KS', name: 'KODEX 200', ticker: 'KODEX200', maxYears: 22 },
  { symbol: '238720.KS', name: 'TIGER 일본니케이225', ticker: 'TIGER니케이', maxYears: 14 },
]

// 포트폴리오 데이터
const portfolios = {
  conservative: {
    name: '보수적',
    expectedReturn: 5.2,
    allocation: [
      { name: '미국 단기채', ticker: 'SHY', ratio: 40, color: '#10b981' },
      { name: '미국 중기채', ticker: 'IEF', ratio: 25, color: '#06b6d4' },
      { name: '금', ticker: 'GLD', ratio: 15, color: '#f59e0b' },
      { name: 'S&P500', ticker: 'SPY', ratio: 20, color: '#4361ee' },
    ],
  },
  balanced: {
    name: '균형',
    expectedReturn: 8.3,
    allocation: [
      { name: 'S&P500', ticker: 'SPY', ratio: 40, color: '#4361ee' },
      { name: 'NASDAQ100', ticker: 'QQQ', ratio: 15, color: '#7c3aed' },
      { name: '미국 중기채', ticker: 'IEF', ratio: 20, color: '#06b6d4' },
      { name: '금', ticker: 'GLD', ratio: 15, color: '#f59e0b' },
      { name: '미국 단기채', ticker: 'SHY', ratio: 10, color: '#10b981' },
    ],
  },
  aggressive: {
    name: '공격적',
    expectedReturn: 12.1,
    allocation: [
      { name: 'S&P500', ticker: 'SPY', ratio: 45, color: '#4361ee' },
      { name: 'NASDAQ100', ticker: 'QQQ', ratio: 35, color: '#7c3aed' },
      { name: '금', ticker: 'GLD', ratio: 10, color: '#f59e0b' },
      { name: '미국 중기채', ticker: 'IEF', ratio: 10, color: '#06b6d4' },
    ],
  },
}

function SimpleApp() {
  // 입력 상태
  const [currentAge, setCurrentAge] = useState(35)
  const [retirementAge, setRetirementAge] = useState(60)
  const [currentAsset, setCurrentAsset] = useState(5000) // 만원
  const [monthlySaving, setMonthlySaving] = useState(100) // 만원
  const [targetMonthlyExpense, setTargetMonthlyExpense] = useState(300) // 만원
  const [investmentStyle, setInvestmentStyle] = useState<InvestmentStyle>('balanced')

  // 토글 상태
  const [showDetails, setShowDetails] = useState(false)

  // 백테스팅 상태
  const [backtestYearsInput, setBacktestYearsInput] = useState('5')
  const [backtestETF, setBacktestETF] = useState(backtestETFs[0])
  const [backtestMonthlyInput, setBacktestMonthlyInput] = useState('50')
  const [backtestResult, setBacktestResult] = useState<{
    totalInvested: number
    currentValue: number
    returnRate: number
    chartData: { date: string; invested: number; value: number }[]
  } | null>(null)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestError, setBacktestError] = useState<string | null>(null)

  // 계산 결과
  const yearsToRetirement = Math.max(0, retirementAge - currentAge)
  const retirementYears = Math.max(1, 90 - retirementAge) // 기대수명 90세 기준
  const portfolio = portfolios[investmentStyle]
  const annualReturn = portfolio.expectedReturn / 100

  // 은퇴 시점 예상 자산 계산 (복리)
  const calculateProjectedAsset = () => {
    const yearlySaving = monthlySaving * 12
    let asset = currentAsset

    for (let i = 0; i < yearsToRetirement; i++) {
      asset = asset * (1 + annualReturn) + yearlySaving
    }

    return Math.round(asset)
  }

  const projectedAsset = calculateProjectedAsset()

  // 필요 총자산 (은퇴 후 원하는 월 생활비 기준)
  const targetAsset = targetMonthlyExpense * 12 * retirementYears

  // 달성률
  const achievementRate = targetAsset > 0 ? (projectedAsset / targetAsset) * 100 : 0

  // 예상 월 수령액
  const expectedMonthly = Math.round(projectedAsset / (retirementYears * 12))

  // 부족액
  const shortfall = Math.max(0, targetMonthlyExpense - expectedMonthly)

  // 목표 달성을 위해 필요한 추가 월 저축액 계산
  const calculateRequiredAdditionalSaving = () => {
    if (achievementRate >= 100) return 0

    const shortfallAsset = targetAsset - projectedAsset
    const fvFactor = (Math.pow(1 + annualReturn, yearsToRetirement) - 1) / annualReturn
    const requiredYearlySaving = shortfallAsset / fvFactor
    return Math.ceil(requiredYearlySaving / 12)
  }

  // 목표 달성을 위해 은퇴를 얼마나 늦춰야 하는지
  const calculateRequiredDelayYears = () => {
    if (achievementRate >= 100) return 0

    let years = 0
    let asset = projectedAsset
    const yearlySaving = monthlySaving * 12

    while (asset < targetAsset && years < 20) {
      asset = asset * (1 + annualReturn) + yearlySaving
      years++
    }

    return years
  }

  const additionalSavingNeeded = calculateRequiredAdditionalSaving()
  const delayYearsNeeded = calculateRequiredDelayYears()

  // 저축 배분 계산 (연간)
  const yearlySaving = monthlySaving * 12
  const calculateAllocation = () => {
    let remaining = yearlySaving
    const allocation = {
      pensionSaving: 0,
      irp: 0,
      isa: 0,
      general: 0,
    }

    allocation.pensionSaving = Math.min(remaining, 600)
    remaining -= allocation.pensionSaving

    allocation.irp = Math.min(remaining, 300)
    remaining -= allocation.irp

    allocation.isa = Math.min(remaining, 2000)
    remaining -= allocation.isa

    allocation.general = remaining

    return allocation
  }

  const savingAllocation = calculateAllocation()

  // 달성률에 따른 메시지 및 스타일
  const getResultMessage = () => {
    if (achievementRate >= 100) {
      return {
        title: '목표 달성 가능',
        message: `${retirementAge}세에 은퇴해도 월 ${targetMonthlyExpense.toLocaleString()}만원 생활이 가능합니다.`,
        type: 'success',
      }
    } else if (achievementRate >= 80) {
      return {
        title: '거의 달성 가능',
        message: `월 ${shortfall.toLocaleString()}만원이 부족합니다. 조금만 더 노력하면 목표 달성이 가능합니다.`,
        type: 'warning',
      }
    } else if (achievementRate >= 50) {
      return {
        title: '추가 노력 필요',
        message: `목표의 ${Math.round(achievementRate)}%만 달성됩니다. 월 ${shortfall.toLocaleString()}만원이 부족합니다.`,
        type: 'caution',
      }
    } else {
      return {
        title: '계획 조정 필요',
        message: `현재 계획으로는 목표의 ${Math.round(achievementRate)}%만 달성됩니다.`,
        type: 'danger',
      }
    }
  }

  const result = getResultMessage()

  // 필요 수익률에 따라 투자 성향 자동 선택
  useEffect(() => {
    if (yearsToRetirement <= 0 || targetAsset <= currentAsset) return

    const yearlySavingAmount = monthlySaving * 12
    let requiredReturn = 0

    let low = 0, high = 0.20
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2
      let asset = currentAsset
      for (let j = 0; j < yearsToRetirement; j++) {
        asset = asset * (1 + mid) + yearlySavingAmount
      }
      if (asset < targetAsset) {
        low = mid
      } else {
        high = mid
      }
      requiredReturn = mid
    }

    const requiredReturnPercent = requiredReturn * 100

    if (requiredReturnPercent <= 6) {
      setInvestmentStyle('conservative')
    } else if (requiredReturnPercent <= 10) {
      setInvestmentStyle('balanced')
    } else {
      setInvestmentStyle('aggressive')
    }
  }, [currentAsset, monthlySaving, targetMonthlyExpense, yearsToRetirement, targetAsset])

  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}억원`
    }
    return `${value.toLocaleString()}만원`
  }

  // 억원 보조 텍스트 (1억 이상일 때만 표시)
  const formatEokHelper = (value: number): string | null => {
    if (value < 10000) return null
    const eok = value / 10000
    return `${eok.toFixed(2).replace(/\.?0+$/, '')}억원`
  }

  // 백테스팅 실행
  const runBacktest = async () => {
    const backtestYears = parseInt(backtestYearsInput) || 5
    const backtestMonthly = parseInt(backtestMonthlyInput) || 50

    setBacktestLoading(true)
    setBacktestError(null)
    setBacktestResult(null)

    try {
      const response = await fetch(
        `/api/etf-history?symbol=${backtestETF.symbol}&years=${backtestYears}`
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '데이터를 가져오는데 실패했습니다')
      }

      const data = await response.json()

      if (!data.data || data.data.length < 2) {
        throw new Error('충분한 과거 데이터가 없습니다. 다른 기간이나 ETF를 선택해주세요.')
      }

      const monthlyData = data.data as { date: string; price: number }[]

      // DCA 시뮬레이션: 매월 초 정액 매수
      let totalShares = 0
      const monthlyInvestment = backtestMonthly * 10000 // 만원 -> 원
      const chartData: { date: string; invested: number; value: number }[] = []

      for (let i = 0; i < monthlyData.length - 1; i++) {
        const month = monthlyData[i]
        const shares = monthlyInvestment / month.price
        totalShares += shares

        const cumulativeInvested = monthlyInvestment * (i + 1)
        const currentValue = totalShares * month.price

        chartData.push({
          date: month.date,
          invested: Math.round(cumulativeInvested / 10000), // 만원 단위
          value: Math.round(currentValue / 10000), // 만원 단위
        })
      }

      const currentPrice = monthlyData[monthlyData.length - 1].price
      const currentValue = totalShares * currentPrice
      const totalInvested = monthlyInvestment * (monthlyData.length - 1)
      const returnRate = ((currentValue - totalInvested) / totalInvested) * 100

      // 마지막 데이터 포인트 추가
      chartData.push({
        date: monthlyData[monthlyData.length - 1].date,
        invested: Math.round(totalInvested / 10000),
        value: Math.round(currentValue / 10000),
      })

      setBacktestResult({
        totalInvested: Math.round(totalInvested / 10000), // 만원 단위
        currentValue: Math.round(currentValue / 10000), // 만원 단위
        returnRate: Math.round(returnRate * 10) / 10,
        chartData,
      })
    } catch (error) {
      setBacktestError(error instanceof Error ? error.message : '오류가 발생했습니다')
    } finally {
      setBacktestLoading(false)
    }
  }

  return (
    <div className="app">
      <h1>은퇴 준비 간단 진단</h1>

      {/* 소개 영역 */}
      <div className="app-intro">
        <p className="intro-notice">
          내가 원하는 시점에 은퇴 가능한지 <strong>핵심만 빠르게</strong> 확인하세요. <br></br>입력하면 바로 결과가 나옵니다.
        </p>
        <div className="intro-features">
          <span>목표 달성률</span>
          <span>저축 배분</span>
          <span>ETF 구성</span>
        </div>
        <div className="intro-guide">
          <span className="guide-tip">더 상세한 분석이 필요하다면</span>
          <Link to="/" className="intro-link">전체 버전 보기</Link>
        </div>
      </div>

      {/* 입력 영역 */}
      <section className="input-section insight-section">
        <h2>기본 정보</h2>
        <div className="input-grid">
          <div className="input-group">
            <label>현재 나이</label>
            <div className="input-wrapper">
              <input
                type="text"
                inputMode="numeric"
                value={currentAge}
                onChange={(e) => setCurrentAge(Number(e.target.value.replace(/\D/g, '')) || 0)}
                placeholder="0"
              />
              <span className="currency">세</span>
            </div>
          </div>
          <div className="input-group">
            <label>목표 은퇴 나이</label>
            <div className="input-wrapper">
              <input
                type="text"
                inputMode="numeric"
                value={retirementAge}
                onChange={(e) => setRetirementAge(Number(e.target.value.replace(/\D/g, '')) || 0)}
                placeholder="0"
              />
              <span className="currency">세</span>
            </div>
          </div>
        </div>

        {/* 슬라이더 입력 */}
        <div className="slider-input-section">
          <div className="slider-input-group">
            <div className="slider-header">
              <span className="slider-label">현재 금융자산</span>
              <div className="slider-value-input">
                <input
                  type="text"
                  inputMode="numeric"
                  value={currentAsset}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/\D/g, '')) || 0
                    setCurrentAsset(Math.min(val, 100000))
                  }}
                />
                <span className="slider-unit">만원</span>
              </div>
            </div>
            {formatEokHelper(currentAsset) && (
              <span className="eok-helper">{formatEokHelper(currentAsset)}</span>
            )}
            <input
              type="range"
              className="withdrawal-slider"
              min={0}
              max={100000}
              step={1000}
              value={currentAsset}
              onChange={(e) => setCurrentAsset(Number(e.target.value))}
            />
            <div className="slider-range">
              <span>0</span>
              <span>10억</span>
            </div>
          </div>

          <div className="slider-input-group">
            <div className="slider-header">
              <span className="slider-label">월 저축 가능액</span>
              <div className="slider-value-input">
                <input
                  type="text"
                  inputMode="numeric"
                  value={monthlySaving}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/\D/g, '')) || 0
                    setMonthlySaving(Math.min(val, 500))
                  }}
                />
                <span className="slider-unit">만원</span>
              </div>
            </div>
            <input
              type="range"
              className="withdrawal-slider"
              min={0}
              max={500}
              step={10}
              value={monthlySaving}
              onChange={(e) => setMonthlySaving(Number(e.target.value))}
            />
            <div className="slider-range">
              <span>0</span>
              <span>500만원</span>
            </div>
          </div>

          <div className="slider-input-group">
            <div className="slider-header">
              <span className="slider-label">은퇴 후 원하는 월 생활비</span>
              <div className="slider-value-input">
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetMonthlyExpense}
                  onChange={(e) => {
                    const val = Number(e.target.value.replace(/\D/g, ''))
                    setTargetMonthlyExpense(Math.min(val, 1000))
                  }}
                  onBlur={() => {
                    if (targetMonthlyExpense < 100) setTargetMonthlyExpense(100)
                  }}
                />
                <span className="slider-unit">만원</span>
              </div>
            </div>
            <input
              type="range"
              className="withdrawal-slider"
              min={100}
              max={1000}
              step={10}
              value={targetMonthlyExpense}
              onChange={(e) => setTargetMonthlyExpense(Number(e.target.value))}
            />
            <div className="slider-range">
              <span>100만원</span>
              <span>1,000만원</span>
            </div>
            <span className="target-asset-hint">
              → 필요 은퇴자산: <strong>{formatCurrency(targetAsset)}</strong> (은퇴 후 {retirementYears}년간 필요금액)
            </span>
          </div>
        </div>

        <div className="input-group full-width">
          <label>투자 성향</label>
          <div className="style-selector">
            <button
              className={`style-btn ${investmentStyle === 'conservative' ? 'active' : ''}`}
              onClick={() => setInvestmentStyle('conservative')}
            >
              보수적
            </button>
            <button
              className={`style-btn ${investmentStyle === 'balanced' ? 'active' : ''}`}
              onClick={() => setInvestmentStyle('balanced')}
            >
              균형
            </button>
            <button
              className={`style-btn ${investmentStyle === 'aggressive' ? 'active' : ''}`}
              onClick={() => setInvestmentStyle('aggressive')}
            >
              공격적
            </button>
          </div>
          <span className="input-hint">선택한 포트폴리오 예상 수익률: 연 {portfolio.expectedReturn}%</span>
        </div>
      </section>

      {/* 결과 구분선 */}
      <div className="results-divider">
        <span className="divider-line"></span>
        <span className="divider-text">진단 결과</span>
        <span className="divider-line"></span>
      </div>

      {/* 핵심 결과 */}
      <section className={`insight-section simple-result-card ${result.type}`}>
        <div className="simple-result-header">
          <h2>{result.title}</h2>
          <span className="achievement-badge">{Math.round(achievementRate)}%</span>
        </div>

        <div className="monthly-comparison-box">
          <div className="monthly-item">
            <span className="monthly-label">예상 월 수령액</span>
            <span className="monthly-value">{expectedMonthly.toLocaleString()}만원</span>
          </div>
          <span className="monthly-vs">vs</span>
          <div className="monthly-item target">
            <span className="monthly-label">목표 월 생활비</span>
            <span className="monthly-value">{targetMonthlyExpense.toLocaleString()}만원</span>
          </div>
        </div>

        <p className="result-message">{result.message}</p>

        {achievementRate < 100 && (
          <div className="solutions-box">
            <span className="solutions-title">해결 방안</span>
            <div className="solutions-grid">
              <div className="solution-item">
                <span className="solution-label">저축 늘리기</span>
                <span className="solution-value">월 +{additionalSavingNeeded.toLocaleString()}만원</span>
              </div>
              <span className="solution-or">또는</span>
              <div className="solution-item">
                <span className="solution-label">은퇴 늦추기</span>
                <span className="solution-value">+{delayYearsNeeded}년</span>
              </div>
            </div>
          </div>
        )}

        {/* 자산 요약 */}
        <div className="asset-flow">
          <div className="asset-box">
            <span className="asset-label">현재 금융자산</span>
            <span className="asset-value">{formatCurrency(currentAsset)}</span>
          </div>
          <span className="asset-arrow">→</span>
          <div className="asset-box highlight">
            <span className="asset-label">{yearsToRetirement}년 후</span>
            <span className="asset-value">{formatCurrency(projectedAsset)}</span>
          </div>
          <span className="asset-arrow">vs</span>
          <div className="asset-box">
            <span className="asset-label">필요 자산</span>
            <span className="asset-value">{formatCurrency(targetAsset)}</span>
          </div>
        </div>
      </section>

      {/* 저축 배분 추천 */}
      <section className="insight-section">
        <h2>저축 가능금액 배분 추천</h2>
        <div className="simple-allocation-grid">
          {savingAllocation.pensionSaving > 0 && (
            <div className="allocation-card-simple">
              <div className="allocation-card-header">
                <span className="allocation-rank">1순위</span>
                <span className="allocation-name">연금저축</span>
              </div>
              <div className="allocation-progress">
                <div
                  className="allocation-progress-fill"
                  style={{ width: `${Math.min((savingAllocation.pensionSaving / 600) * 100, 100)}%` }}
                />
              </div>
              <div className="allocation-card-footer">
                <span className="allocation-amount">{savingAllocation.pensionSaving.toLocaleString()}만원 / 600만원</span>
                <span className="allocation-benefit">세액공제 16.5%</span>
              </div>
            </div>
          )}
          {savingAllocation.irp > 0 && (
            <div className="allocation-card-simple">
              <div className="allocation-card-header">
                <span className="allocation-rank">2순위</span>
                <span className="allocation-name">IRP</span>
              </div>
              <div className="allocation-progress">
                <div
                  className="allocation-progress-fill"
                  style={{ width: `${Math.min((savingAllocation.irp / 300) * 100, 100)}%` }}
                />
              </div>
              <div className="allocation-card-footer">
                <span className="allocation-amount">{savingAllocation.irp.toLocaleString()}만원 / 300만원</span>
                <span className="allocation-benefit">세액공제 16.5%</span>
              </div>
            </div>
          )}
          {savingAllocation.isa > 0 && (
            <div className="allocation-card-simple">
              <div className="allocation-card-header">
                <span className="allocation-rank">3순위</span>
                <span className="allocation-name">ISA</span>
              </div>
              <div className="allocation-progress">
                <div
                  className="allocation-progress-fill isa"
                  style={{ width: `${Math.min((savingAllocation.isa / 2000) * 100, 100)}%` }}
                />
              </div>
              <div className="allocation-card-footer">
                <span className="allocation-amount">{savingAllocation.isa.toLocaleString()}만원 / 2,000만원</span>
                <span className="allocation-benefit">비과세 200만원</span>
              </div>
            </div>
          )}
          {savingAllocation.general > 0 && (
            <div className="allocation-card-simple">
              <div className="allocation-card-header">
                <span className="allocation-rank">4순위</span>
                <span className="allocation-name">일반 계좌</span>
              </div>
              <div className="allocation-progress">
                <div
                  className="allocation-progress-fill general"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="allocation-card-footer">
                <span className="allocation-amount">{savingAllocation.general.toLocaleString()}만원</span>
                <span className="allocation-benefit">한도 없음</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 포트폴리오 */}
      <section className="insight-section">
        <h2>{portfolio.name} 포트폴리오 (연 {portfolio.expectedReturn}%)</h2>
        <div className="portfolio-bar-simple">
          {portfolio.allocation.map((item) => (
            <div
              key={item.ticker}
              className="portfolio-segment"
              style={{ width: `${item.ratio}%`, backgroundColor: item.color }}
              title={`${item.name} (${item.ticker}) ${item.ratio}%`}
            >
              {item.ratio >= 20 ? (
                <span>{item.ticker} {item.ratio}%</span>
              ) : item.ratio >= 10 ? (
                <span>{item.ratio}%</span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="portfolio-legend-simple">
          {portfolio.allocation.map((item) => (
            <div key={item.ticker} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: item.color }}></span>
              <span className="legend-name">{item.name}</span>
              <span className="legend-ticker">{item.ticker}</span>
              <span className="legend-ratio">{item.ratio}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* 계산 가정 */}
      <section className="insight-section">
        <details className="simple-details" open={showDetails} onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}>
          <summary>계산 가정 보기</summary>
          <div className="details-content">
            <div className="detail-box">
              <ul>
                <li>투자 수익률: 연 {portfolio.expectedReturn}% ({portfolio.name} 포트폴리오)</li>
                <li>기대수명: 90세 (은퇴 후 {retirementYears}년)</li>
                <li>인플레이션: 미반영 (실질 수익률 기준)</li>
              </ul>
            </div>
          </div>
        </details>
      </section>

      {/* 백테스팅 */}
      <section className="insight-section backtest-section">
        <h2>만약 과거부터 투자했다면?</h2>
        <p className="backtest-description">
          Yahoo Finance의 실제 과거 가격 데이터를 기반으로 매월 정액 적립식 투자(DCA) 결과를 계산합니다.
        </p>
        <div className="backtest-inputs">
          <div className="backtest-row">
            <div className="backtest-input-group">
              <label>기간</label>
              <div className="backtest-input-wrapper">
                <input
                  type="text"
                  inputMode="numeric"
                  value={backtestYearsInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    if (val === '' || parseInt(val) <= backtestETF.maxYears) {
                      setBacktestYearsInput(val)
                    }
                  }}
                  onBlur={() => {
                    if (backtestYearsInput === '' || parseInt(backtestYearsInput) < 1) {
                      setBacktestYearsInput('1')
                    }
                  }}
                  placeholder="5"
                />
                <span>년 전부터</span>
              </div>
            </div>
            <div className="backtest-input-group">
              <label>월 투자금액</label>
              <div className="backtest-input-wrapper">
                <span>매월</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={backtestMonthlyInput}
                  onChange={(e) => setBacktestMonthlyInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => {
                    if (backtestMonthlyInput === '' || parseInt(backtestMonthlyInput) < 1) {
                      setBacktestMonthlyInput('1')
                    }
                  }}
                  placeholder="50"
                />
                <span>만원씩</span>
              </div>
            </div>
          </div>
          <div className="backtest-row">
            <div className="backtest-input-group full-width">
              <label>ETF</label>
              <select
                value={backtestETF.symbol}
                onChange={(e) => {
                  const etf = backtestETFs.find(f => f.symbol === e.target.value)!
                  setBacktestETF(etf)
                  const currentYears = parseInt(backtestYearsInput) || 5
                  if (currentYears > etf.maxYears) {
                    setBacktestYearsInput(String(etf.maxYears))
                  }
                }}
              >
                {backtestETFs.map(etf => (
                  <option key={etf.symbol} value={etf.symbol}>
                    {etf.name} (최대 {etf.maxYears}년)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="backtest-btn"
            onClick={runBacktest}
            disabled={backtestLoading}
          >
            {backtestLoading ? '계산 중...' : '계산하기'}
          </button>
        </div>

        {backtestError && (
          <div className="backtest-error">
            {backtestError}
          </div>
        )}

        {backtestResult && (
          <div className="backtest-result">
            <div className="backtest-result-row">
              <span className="backtest-label">총 투자금액</span>
              <span className="backtest-value">{formatCurrency(backtestResult.totalInvested)}</span>
            </div>
            <div className="backtest-result-row highlight">
              <span className="backtest-label">현재 평가금액</span>
              <span className="backtest-value">{formatCurrency(backtestResult.currentValue)}</span>
            </div>
            <div className={`backtest-result-row return ${backtestResult.returnRate >= 0 ? 'positive' : 'negative'}`}>
              <span className="backtest-label">수익률</span>
              <span className="backtest-value">
                {backtestResult.returnRate >= 0 ? '+' : ''}{backtestResult.returnRate}%
              </span>
            </div>

            {/* 그래프 */}
            <div className="backtest-chart">
              <Line
                data={{
                  labels: backtestResult.chartData.map(d => d.date),
                  datasets: [
                    {
                      label: '평가금액',
                      data: backtestResult.chartData.map(d => d.value),
                      borderColor: '#4361ee',
                      backgroundColor: 'rgba(67, 97, 238, 0.1)',
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                      pointHoverRadius: 4,
                    },
                    {
                      label: '투자금액',
                      data: backtestResult.chartData.map(d => d.invested),
                      borderColor: '#9ca3af',
                      backgroundColor: 'transparent',
                      borderDash: [5, 5],
                      tension: 0,
                      pointRadius: 0,
                      pointHoverRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 12 },
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = context.parsed.y ?? 0
                          if (value >= 10000) {
                            return `${context.dataset.label}: ${(value / 10000).toFixed(1)}억원`
                          }
                          return `${context.dataset.label}: ${value.toLocaleString()}만원`
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: {
                        maxTicksLimit: 6,
                        font: { size: 11 },
                      },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => {
                          const num = Number(value)
                          if (num >= 10000) return `${(num / 10000).toFixed(1)}억`
                          return `${num}만`
                        },
                        font: { size: 11 },
                      },
                      grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* 푸터 */}
      <footer className="simple-footer">
        <p>이 결과는 참고용이며, 실제 투자 결과는 다를 수 있습니다.</p>
        <Link to="/" className="full-link">더 상세한 분석은 전체 버전에서</Link>
      </footer>
    </div>
  )
}

export default SimpleApp
