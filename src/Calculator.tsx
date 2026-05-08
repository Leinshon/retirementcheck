import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './Calculator.css'

// 소득세율표 (2024년)
const INCOME_TAX_BRACKETS = [
  { min: 0, max: 14000000, rate: 0.06, deduction: 0 },
  { min: 14000000, max: 50000000, rate: 0.15, deduction: 1260000 },
  { min: 50000000, max: 88000000, rate: 0.24, deduction: 5760000 },
  { min: 88000000, max: 150000000, rate: 0.35, deduction: 15440000 },
  { min: 150000000, max: 300000000, rate: 0.38, deduction: 19940000 },
  { min: 300000000, max: 500000000, rate: 0.40, deduction: 25940000 },
  { min: 500000000, max: 1000000000, rate: 0.42, deduction: 35940000 },
  { min: 1000000000, max: Infinity, rate: 0.45, deduction: 65940000 },
]

// 퇴직소득세 계산 (연금 수령 시)
const calculatePensionTax = (annualAmount: number, age: number): number => {
  // 연금소득세율 (55세 이상 70% 감면, 실질 3.3~5.5%)
  // 간소화: 연 1,200만원 이하 분리과세 3.3~5.5%
  let rate = 0.055 // 기본 5.5%
  if (age >= 70) rate = 0.044
  if (age >= 80) rate = 0.033

  return annualAmount * rate
}

// ETF 추천 데이터
const ETF_RECOMMENDATIONS = [
  { name: 'KODEX 200', ticker: '069500', avgReturn: 8.5, description: '국내 대형주 추종' },
  { name: 'TIGER 미국S&P500', ticker: '360750', avgReturn: 12.0, description: '미국 S&P500 추종' },
  { name: 'KODEX 미국나스닥100', ticker: '379810', avgReturn: 15.0, description: '나스닥100 추종' },
  { name: 'TIGER 미국배당다우존스', ticker: '458730', avgReturn: 10.0, description: '미국 배당주 중심' },
  { name: 'KODEX TDF2045', ticker: '329670', avgReturn: 7.0, description: '생애주기 자산배분' },
  { name: 'TIGER 단기채권액티브', ticker: '272580', avgReturn: 3.5, description: '안정적 단기채권' },
  { name: 'KODEX 국고채10년', ticker: '148070', avgReturn: 4.0, description: '국채 중심 안정형' },
  { name: 'ACE 미국빅테크TOP7Plus', ticker: '465580', avgReturn: 18.0, description: '미국 빅테크 집중' },
]

const Calculator = () => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'pension' | 'investment' | 'dc' | 'withdrawal'>('pension')

  // 연금/투자 계산 상태
  const [pensionBalance, setPensionBalance] = useState<number>(100000000)
  const [pensionReturn, setPensionReturn] = useState<number>(4)
  const [pensionPeriod, setPensionPeriod] = useState<number>(20)
  const [pensionStartAge, setPensionStartAge] = useState<number>(60)

  // 2. 적립식 투자 계산기 상태
  const [investCalcMode, setInvestCalcMode] = useState<'target' | 'future'>('target')
  const [targetAmount, setTargetAmount] = useState<number>(100000000)
  const [investReturn, setInvestReturn] = useState<number>(7)
  const [investPeriod, setInvestPeriod] = useState<number>(10)
  const [investPeriodUnit, setInvestPeriodUnit] = useState<'year' | 'month'>('year')
  // 미래 자산 예측 계산기 상태
  const [futureMonthlyAmount, setFutureMonthlyAmount] = useState<number>(1000000)
  const [futureReturn, setFutureReturn] = useState<number>(7)
  const [futurePeriod, setFuturePeriod] = useState<number>(10)
  const [futurePeriodUnit, setFuturePeriodUnit] = useState<'year' | 'month'>('year')

  // 4. 인출률 계산기 상태
  const [withdrawalBalance, setWithdrawalBalance] = useState<number>(100000000)
  const [withdrawalRate, setWithdrawalRate] = useState<number>(4)
  const [withdrawalReturn, setWithdrawalReturn] = useState<number>(5)
  const [withdrawalPeriod, setWithdrawalPeriod] = useState<number>(30)
  const [withdrawalStartAge, setWithdrawalStartAge] = useState<number>(60)

  // 3. DC형 퇴직연금 계산기 상태
  const [netSalary, setNetSalary] = useState<number>(4000000)

  // 1. 퇴직연금 인출 계산
  const calculatePensionWithdrawal = () => {
    const r = pensionReturn / 100
    const n = pensionPeriod
    const pv = pensionBalance

    // PMT = PV * r / (1 - (1+r)^-n)
    let annualWithdrawal: number
    if (r === 0) {
      annualWithdrawal = pv / n
    } else {
      annualWithdrawal = (pv * r) / (1 - Math.pow(1 + r, -n))
    }

    // 연도별 상세 계산
    const yearlyDetails = []
    let remainingBalance = pv

    for (let year = 1; year <= n; year++) {
      const age = pensionStartAge + year - 1
      const interest = remainingBalance * r
      const tax = calculatePensionTax(annualWithdrawal, age)
      const netAmount = annualWithdrawal - tax

      yearlyDetails.push({
        year,
        age,
        startBalance: remainingBalance,
        interest: Math.round(interest),
        withdrawal: Math.round(annualWithdrawal),
        tax: Math.round(tax),
        netAmount: Math.round(netAmount),
        endBalance: Math.max(0, Math.round(remainingBalance + interest - annualWithdrawal)),
      })

      remainingBalance = remainingBalance + interest - annualWithdrawal
    }

    // 첫 해 세후 금액 (대표값으로 사용)
    const firstYearNetAmount = yearlyDetails.length > 0 ? yearlyDetails[0].netAmount : 0

    return {
      annualWithdrawal: Math.round(annualWithdrawal),
      monthlyWithdrawal: Math.round(annualWithdrawal / 12),
      monthlyNetAmount: Math.round(firstYearNetAmount / 12),
      yearlyDetails,
    }
  }

  // 2. 적립식 투자 계산
  const calculateInvestment = () => {
    const r = investReturn / 100 / 12 // 월 수익률
    const n = investPeriodUnit === 'year' ? investPeriod * 12 : investPeriod // 총 개월 수
    const fv = targetAmount

    // PMT = FV * r / ((1+r)^n - 1)
    let monthlyPayment: number
    if (r === 0) {
      monthlyPayment = fv / n
    } else {
      monthlyPayment = (fv * r) / (Math.pow(1 + r, n) - 1)
    }

    const totalInvested = monthlyPayment * n
    const totalReturn = fv - totalInvested

    // 유사 수익률 ETF 추천 (수익률 차이 5% 이내)
    const recommendedETFs = ETF_RECOMMENDATIONS
      .filter(etf => Math.abs(etf.avgReturn - investReturn) <= 5)
      .sort((a, b) => Math.abs(a.avgReturn - investReturn) - Math.abs(b.avgReturn - investReturn))
      .slice(0, 4)

    return {
      monthlyPayment: Math.round(monthlyPayment),
      totalInvested: Math.round(totalInvested),
      totalReturn: Math.round(totalReturn),
      recommendedETFs,
    }
  }

  // 2-2. 미래 자산 예측 계산
  const calculateFutureAsset = () => {
    const r = futureReturn / 100 / 12 // 월 수익률
    const n = futurePeriodUnit === 'year' ? futurePeriod * 12 : futurePeriod // 총 개월 수
    const pmt = futureMonthlyAmount // 월 적립금

    // FV = PMT * ((1+r)^n - 1) / r
    let futureValue: number
    if (r === 0) {
      futureValue = pmt * n
    } else {
      futureValue = pmt * ((Math.pow(1 + r, n) - 1) / r)
    }

    const totalInvested = pmt * n
    const totalReturn = futureValue - totalInvested

    // 유사 수익률 ETF 추천 (수익률 차이 5% 이내)
    const recommendedETFs = ETF_RECOMMENDATIONS
      .filter(etf => Math.abs(etf.avgReturn - futureReturn) <= 5)
      .sort((a, b) => Math.abs(a.avgReturn - futureReturn) - Math.abs(b.avgReturn - futureReturn))
      .slice(0, 4)

    return {
      futureValue: Math.round(futureValue),
      totalInvested: Math.round(totalInvested),
      totalReturn: Math.round(totalReturn),
      recommendedETFs,
    }
  }

  // 3. DC형 퇴직연금 계산 (세후 -> 세전 역산)
  const calculateDC = () => {
    // 세후 월급에서 세전 월급 역산 (반복 계산)
    let grossSalary = netSalary * 1.3 // 초기 추정

    for (let i = 0; i < 20; i++) {
      const annualGross = grossSalary * 12

      // 4대보험 계산
      const nationalPension = Math.min(grossSalary * 0.045, 278000)
      const healthInsurance = grossSalary * 0.03545
      const longTermCare = healthInsurance * 0.1295
      const employmentInsurance = grossSalary * 0.009

      const totalInsurance = nationalPension + healthInsurance + longTermCare + employmentInsurance

      // 소득세 계산 (간이세액표 기준, 과세표준 = 연봉 - 공제)
      const taxableIncome = Math.max(0, annualGross - 25000000) // 기본공제 2,500만원 가정

      let incomeTax = 0
      for (const bracket of INCOME_TAX_BRACKETS) {
        if (taxableIncome > bracket.min) {
          incomeTax = taxableIncome * bracket.rate - bracket.deduction
          break
        }
      }
      incomeTax = Math.max(0, incomeTax) / 12 // 월 소득세

      const localTax = incomeTax * 0.1 // 지방소득세

      const calculatedNet = grossSalary - totalInsurance - incomeTax - localTax

      // 오차가 1000원 미만이면 종료
      if (Math.abs(calculatedNet - netSalary) < 1000) {
        break
      }

      // 다음 반복을 위한 조정
      grossSalary = grossSalary + (netSalary - calculatedNet)
    }

    const annualGross = grossSalary * 12

    // 최종 공제 내역 계산
    const nationalPension = Math.min(grossSalary * 0.045, 278000)
    const healthInsurance = grossSalary * 0.03545
    const longTermCare = healthInsurance * 0.1295
    const employmentInsurance = grossSalary * 0.009

    const taxableIncome = Math.max(0, annualGross - 25000000)
    let incomeTax = 0
    for (const bracket of INCOME_TAX_BRACKETS) {
      if (taxableIncome > bracket.min) {
        incomeTax = taxableIncome * bracket.rate - bracket.deduction
        break
      }
    }
    incomeTax = Math.max(0, incomeTax) / 12
    const localTax = incomeTax * 0.1

    // DC 적립금 = 세전 월급 (연간)
    const annualDC = grossSalary

    return {
      grossSalary: Math.round(grossSalary),
      annualGross: Math.round(annualGross),
      deductions: {
        nationalPension: Math.round(nationalPension),
        healthInsurance: Math.round(healthInsurance),
        longTermCare: Math.round(longTermCare),
        employmentInsurance: Math.round(employmentInsurance),
        incomeTax: Math.round(incomeTax),
        localTax: Math.round(localTax),
      },
      totalDeduction: Math.round(nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localTax),
      annualDC: Math.round(annualDC),
      monthlyDC: Math.round(annualDC / 12),
    }
  }

  // 4. 정률 인출 계산
  const calculateWithdrawal = () => {
    const rate = withdrawalRate / 100
    const returnRate = withdrawalReturn / 100
    const n = withdrawalPeriod

    const yearlyDetails = []
    let remainingBalance = withdrawalBalance
    let totalWithdrawn = 0
    let totalTax = 0

    for (let year = 1; year <= n; year++) {
      const age = withdrawalStartAge + year - 1
      const startBalance = remainingBalance

      // 연초 기준 잔액의 n% 인출
      const withdrawal = startBalance * rate
      const afterWithdrawal = startBalance - withdrawal

      // 인출 후 잔액에 대해 수익 발생
      const interest = afterWithdrawal * returnRate
      const endBalance = Math.max(0, afterWithdrawal + interest)

      const tax = calculatePensionTax(withdrawal, age)
      const netAmount = withdrawal - tax

      totalWithdrawn += withdrawal
      totalTax += tax

      yearlyDetails.push({
        year,
        age,
        startBalance: Math.round(startBalance),
        withdrawal: Math.round(withdrawal),
        tax: Math.round(tax),
        netAmount: Math.round(netAmount),
        interest: Math.round(interest),
        endBalance: Math.round(endBalance),
      })

      remainingBalance = endBalance
      if (remainingBalance <= 0) break
    }

    const firstYearNet = yearlyDetails.length > 0 ? yearlyDetails[0].netAmount : 0

    return {
      firstYearWithdrawal: yearlyDetails.length > 0 ? yearlyDetails[0].withdrawal : 0,
      firstMonthlyNet: Math.round(firstYearNet / 12),
      totalWithdrawn: Math.round(totalWithdrawn),
      totalTax: Math.round(totalTax),
      finalBalance: yearlyDetails.length > 0 ? yearlyDetails[yearlyDetails.length - 1].endBalance : 0,
      yearlyDetails,
    }
  }

  const pensionResult = calculatePensionWithdrawal()
  const investResult = calculateInvestment()
  const futureResult = calculateFutureAsset()
  const dcResult = calculateDC()
  const withdrawalResult = calculateWithdrawal()

  // 금액 포맷
  const formatMoney = (amount: number) => {
    if (amount >= 100000000) {
      const billions = Math.floor(amount / 100000000)
      const remainder = Math.floor((amount % 100000000) / 10000)
      return remainder > 0 ? `${billions}억 ${remainder.toLocaleString()}만원` : `${billions}억원`
    }
    if (amount >= 10000) {
      return `${Math.floor(amount / 10000).toLocaleString()}만원`
    }
    return `${amount.toLocaleString()}원`
  }

  return (
    <div className="calculator-container">
      <header className="calc-header">
        <h1 className="calc-title">Lycon Planning Tool</h1>
        <p className="calc-subtitle">퇴직연금 설계 및 투자 시뮬레이션</p>
      </header>

      {/* 탭 네비게이션 */}
      <div className="calc-tabs">
        <button
          className={`calc-tab ${activeTab === 'pension' ? 'active' : ''}`}
          onClick={() => setActiveTab('pension')}
        >
          퇴직연금 인출
        </button>
        <button
          className={`calc-tab ${activeTab === 'investment' ? 'active' : ''}`}
          onClick={() => setActiveTab('investment')}
        >
          적립식 투자
        </button>
        <button
          className={`calc-tab ${activeTab === 'dc' ? 'active' : ''}`}
          onClick={() => setActiveTab('dc')}
        >
          DC 적립금
        </button>
        <button
          className={`calc-tab ${activeTab === 'withdrawal' ? 'active' : ''}`}
          onClick={() => setActiveTab('withdrawal')}
        >
          인출률 계산
        </button>
      </div>


      {/* 1. 퇴직연금 인출 계산기 */}
      {activeTab === 'pension' && (
        <div className="calc-section">
          <h2 className="calc-section-title">퇴직연금 인출 계산기</h2>
          <p className="calc-section-desc">연금 수령 시 매년 인출 금액과 세금을 계산합니다</p>

          <div className="calc-inputs">
            <div className="calc-input-group">
              <label>인출 시작 시점 평가금액</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  min={0}
                  value={pensionBalance / 10000}
                  onChange={(e) => setPensionBalance((parseInt(e.target.value) || 0) * 10000)}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">만원</span>
              </div>
            </div>

            <div className="calc-input-group">
              <label>예상 수익률 (연)</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={pensionReturn}
                  onChange={(e) => {
                    const val = e.target.value
                    setPensionReturn(val === '' ? 0 : parseFloat(val))
                  }}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && Number.isInteger(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">%</span>
              </div>
            </div>

            <div className="calc-input-group">
              <label>인출 기간</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  min={0}
                  value={pensionPeriod}
                  onChange={(e) => {
                    const val = e.target.value
                    setPensionPeriod(val === '' ? 0 : parseInt(val))
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">년</span>
              </div>
            </div>

            <div className="calc-input-group">
              <label>인출 시작 나이</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  min={0}
                  value={pensionStartAge}
                  onChange={(e) => {
                    const val = e.target.value
                    setPensionStartAge(val === '' ? 0 : parseInt(val))
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">세</span>
              </div>
            </div>
          </div>

          <div className="calc-result-summary">
            <div className="calc-result-item">
              <span className="calc-result-label">연간 인출 금액</span>
              <span className="calc-result-value">{formatMoney(pensionResult.annualWithdrawal)}</span>
            </div>
            <div className="calc-result-item highlight">
              <span className="calc-result-label">세후 월수령액</span>
              <span className="calc-result-value">{formatMoney(pensionResult.monthlyNetAmount)}</span>
            </div>
          </div>

          <div className="calc-table-wrapper">
            <table className="calc-table">
              <thead>
                <tr>
                  <th>연차</th>
                  <th>나이</th>
                  <th>기초잔액</th>
                  <th>이자수익</th>
                  <th>인출금액</th>
                  <th>연금소득세</th>
                  <th>세후수령</th>
                  <th>기말잔액</th>
                </tr>
              </thead>
              <tbody>
                {pensionResult.yearlyDetails.slice(0, 10).map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}년</td>
                    <td>{row.age}세</td>
                    <td>{formatMoney(row.startBalance)}</td>
                    <td>{formatMoney(row.interest)}</td>
                    <td>{formatMoney(row.withdrawal)}</td>
                    <td className="tax">{formatMoney(row.tax)}</td>
                    <td className="highlight">{formatMoney(row.netAmount)}</td>
                    <td>{formatMoney(row.endBalance)}</td>
                  </tr>
                ))}
                {pensionResult.yearlyDetails.length > 10 && (
                  <tr className="calc-table-more">
                    <td colSpan={8}>... 외 {pensionResult.yearlyDetails.length - 10}년</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. 적립식 투자 계산기 */}

      {activeTab === 'investment' && (
        <div className="calc-section">
          <h2 className="calc-section-title">적립식 투자 계산기</h2>

          {/* 서브 탭 */}
          <div className="calc-sub-tabs">
            <button
              className={`calc-sub-tab ${investCalcMode === 'target' ? 'active' : ''}`}
              onClick={() => setInvestCalcMode('target')}
            >
              목표금액 달성
            </button>
            <button
              className={`calc-sub-tab ${investCalcMode === 'future' ? 'active' : ''}`}
              onClick={() => setInvestCalcMode('future')}
            >
              미래 자산 예측
            </button>
          </div>

          {/* 목표금액 달성 계산기 */}
          {investCalcMode === 'target' && (
            <>
              <p className="calc-section-desc">목표 금액 달성을 위한 월 적립금을 계산합니다</p>

              <div className="calc-inputs">
                <div className="calc-input-group">
                  <label>목표 금액</label>
                  <div className="calc-input-row">
                    <input
                      type="number"
                      min={0}
                      value={targetAmount / 10000}
                      onChange={(e) => setTargetAmount((parseInt(e.target.value) || 0) * 10000)}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) e.target.value = String(val)
                      }}
                    />
                    <span className="calc-unit">만원</span>
                  </div>
                </div>

                <div className="calc-input-group">
                  <label>예상 연평균 수익률</label>
                  <div className="calc-input-row">
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={investReturn}
                      onChange={(e) => {
                        const val = e.target.value
                        setInvestReturn(val === '' ? 0 : parseFloat(val))
                      }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val) && Number.isInteger(val)) e.target.value = String(val)
                      }}
                    />
                    <span className="calc-unit">%</span>
                  </div>
                </div>

                <div className="calc-input-group">
                  <label>투자 기간</label>
                  <div className="calc-input-row">
                    <input
                      type="number"
                      min={0}
                      value={investPeriod}
                      onChange={(e) => {
                        const val = e.target.value
                        setInvestPeriod(val === '' ? 0 : parseInt(val))
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) e.target.value = String(val)
                      }}
                    />
                    <select
                      className="calc-unit-select"
                      value={investPeriodUnit}
                      onChange={(e) => setInvestPeriodUnit(e.target.value as 'year' | 'month')}
                    >
                      <option value="year">년</option>
                      <option value="month">개월</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="calc-result-summary">
                <div className="calc-result-item highlight">
                  <span className="calc-result-label">필요 월 적립금</span>
                  <span className="calc-result-value">{formatMoney(investResult.monthlyPayment)}</span>
                </div>
                <div className="calc-result-item">
                  <span className="calc-result-label">총 투자 원금</span>
                  <span className="calc-result-value">{formatMoney(investResult.totalInvested)}</span>
                </div>
                <div className="calc-result-item">
                  <span className="calc-result-label">예상 수익</span>
                  <span className="calc-result-value">{formatMoney(investResult.totalReturn)}</span>
                </div>
              </div>

              <div className="calc-etf-section">
                <h3 className="calc-etf-title">유사 수익률 ETF 추천</h3>
                <p className="calc-etf-desc">입력한 수익률({investReturn}%)과 유사한 과거 수익률을 보인 ETF</p>
                <div className="calc-etf-list">
                  {investResult.recommendedETFs.map((etf) => (
                    <div key={etf.ticker} className="calc-etf-item">
                      <div className="calc-etf-header">
                        <span className="calc-etf-name">{etf.name}</span>
                        <span className="calc-etf-return">연 {etf.avgReturn}%</span>
                      </div>
                      <div className="calc-etf-info">
                        <span className="calc-etf-ticker">{etf.ticker}</span>
                        <span className="calc-etf-desc">{etf.description}</span>
                      </div>
                    </div>
                  ))}
                  {investResult.recommendedETFs.length === 0 && (
                    <p className="calc-etf-empty">해당 수익률에 맞는 ETF가 없습니다</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 미래 자산 예측 계산기 */}
          {investCalcMode === 'future' && (
            <>
              <p className="calc-section-desc">매월 일정 금액을 투자했을 때 미래 자산을 예측합니다</p>

              <div className="calc-inputs">
                <div className="calc-input-group">
                  <label>월 적립금</label>
                  <div className="calc-input-row">
                    <input
                      type="number"
                      min={0}
                      value={futureMonthlyAmount / 10000}
                      onChange={(e) => setFutureMonthlyAmount((parseInt(e.target.value) || 0) * 10000)}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) e.target.value = String(val)
                      }}
                    />
                    <span className="calc-unit">만원</span>
                  </div>
                </div>

                <div className="calc-input-group">
                  <label>예상 연평균 수익률</label>
                  <div className="calc-input-row">
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={futureReturn}
                      onChange={(e) => {
                        const val = e.target.value
                        setFutureReturn(val === '' ? 0 : parseFloat(val))
                      }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val) && Number.isInteger(val)) e.target.value = String(val)
                      }}
                    />
                    <span className="calc-unit">%</span>
                  </div>
                </div>

                <div className="calc-input-group">
                  <label>투자 기간</label>
                  <div className="calc-input-row">
                    <input
                      type="number"
                      min={0}
                      value={futurePeriod}
                      onChange={(e) => {
                        const val = e.target.value
                        setFuturePeriod(val === '' ? 0 : parseInt(val))
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) e.target.value = String(val)
                      }}
                    />
                    <select
                      className="calc-unit-select"
                      value={futurePeriodUnit}
                      onChange={(e) => setFuturePeriodUnit(e.target.value as 'year' | 'month')}
                    >
                      <option value="year">년</option>
                      <option value="month">개월</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="calc-result-summary">
                <div className="calc-result-item highlight">
                  <span className="calc-result-label">예상 총 자산</span>
                  <span className="calc-result-value">{formatMoney(futureResult.futureValue)}</span>
                </div>
                <div className="calc-result-item">
                  <span className="calc-result-label">총 투자 원금</span>
                  <span className="calc-result-value">{formatMoney(futureResult.totalInvested)}</span>
                </div>
                <div className="calc-result-item">
                  <span className="calc-result-label">예상 수익</span>
                  <span className="calc-result-value">{formatMoney(futureResult.totalReturn)}</span>
                </div>
              </div>

              <div className="calc-etf-section">
                <h3 className="calc-etf-title">유사 수익률 ETF 추천</h3>
                <p className="calc-etf-desc">입력한 수익률({futureReturn}%)과 유사한 과거 수익률을 보인 ETF</p>
                <div className="calc-etf-list">
                  {futureResult.recommendedETFs.map((etf) => (
                    <div key={etf.ticker} className="calc-etf-item">
                      <div className="calc-etf-header">
                        <span className="calc-etf-name">{etf.name}</span>
                        <span className="calc-etf-return">연 {etf.avgReturn}%</span>
                      </div>
                      <div className="calc-etf-info">
                        <span className="calc-etf-ticker">{etf.ticker}</span>
                        <span className="calc-etf-desc">{etf.description}</span>
                      </div>
                    </div>
                  ))}
                  {futureResult.recommendedETFs.length === 0 && (
                    <p className="calc-etf-empty">해당 수익률에 맞는 ETF가 없습니다</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. DC형 퇴직연금 계산기 */}

      {activeTab === 'dc' && (
        <div className="calc-section">
          <h2 className="calc-section-title">DC형 퇴직연금 적립금 계산기</h2>
          <p className="calc-section-desc">세후 월급에서 세전 월급과 DC 적립금을 역산합니다</p>

          <div className="calc-inputs">
            <div className="calc-input-group">
              <label>세후 월급 (실수령액)</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  min={0}
                  value={netSalary / 10000}
                  onChange={(e) => setNetSalary((parseInt(e.target.value) || 0) * 10000)}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">만원</span>
              </div>
            </div>
          </div>

          <div className="calc-result-summary">
            <div className="calc-result-item">
              <span className="calc-result-label">추정 세전 월급</span>
              <span className="calc-result-value">{formatMoney(dcResult.grossSalary)}</span>
            </div>
            <div className="calc-result-item">
              <span className="calc-result-label">추정 연봉</span>
              <span className="calc-result-value">{formatMoney(dcResult.annualGross)}</span>
            </div>
            <div className="calc-result-item highlight">
              <span className="calc-result-label">연간 DC 적립금</span>
              <span className="calc-result-value">{formatMoney(dcResult.annualDC)}</span>
            </div>
          </div>

          <div className="calc-deduction-section">
            <h3 className="calc-deduction-title">월 공제 내역</h3>
            <div className="calc-deduction-list">
              <div className="calc-deduction-item">
                <span className="calc-deduction-label">국민연금 (4.5%)</span>
                <span className="calc-deduction-value">{formatMoney(dcResult.deductions.nationalPension)}</span>
              </div>
              <div className="calc-deduction-item">
                <span className="calc-deduction-label">건강보험 (3.545%)</span>
                <span className="calc-deduction-value">{formatMoney(dcResult.deductions.healthInsurance)}</span>
              </div>
              <div className="calc-deduction-item">
                <span className="calc-deduction-label">장기요양보험 (건보의 12.95%)</span>
                <span className="calc-deduction-value">{formatMoney(dcResult.deductions.longTermCare)}</span>
              </div>
              <div className="calc-deduction-item">
                <span className="calc-deduction-label">고용보험 (0.9%)</span>
                <span className="calc-deduction-value">{formatMoney(dcResult.deductions.employmentInsurance)}</span>
              </div>
              <div className="calc-deduction-item">
                <span className="calc-deduction-label">소득세</span>
                <span className="calc-deduction-value">{formatMoney(dcResult.deductions.incomeTax)}</span>
              </div>
              <div className="calc-deduction-item">
                <span className="calc-deduction-label">지방소득세 (소득세의 10%)</span>
                <span className="calc-deduction-value">{formatMoney(dcResult.deductions.localTax)}</span>
              </div>
              <div className="calc-deduction-item total">
                <span className="calc-deduction-label">총 공제액</span>
                <span className="calc-deduction-value">{formatMoney(dcResult.totalDeduction)}</span>
              </div>
            </div>
          </div>

          <div className="calc-dc-note">
            <p>* DC형 퇴직연금 적립금은 연봉의 1/12 (= 세전 월급)이 매년 적립됩니다</p>
            <p>* 실제 공제액은 부양가족 수, 비과세 항목 등에 따라 달라질 수 있습니다</p>
          </div>
        </div>
      )}

      {/* 4. 인출률 계산기 */}
      {activeTab === 'withdrawal' && (
        <div className="calc-section">
          <h2 className="calc-section-title">인출률 기반 연금 계산기</h2>
          <p className="calc-section-desc">매년 잔액의 일정 비율을 인출할 때 월 수령액을 계산합니다</p>

          <div className="calc-inputs">
            <div className="calc-input-group">
              <label>총 적립금</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  min={0}
                  value={withdrawalBalance / 10000}
                  onChange={(e) => setWithdrawalBalance((parseInt(e.target.value) || 0) * 10000)}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">만원</span>
              </div>
            </div>

            <div className="calc-input-group">
              <label>연 인출률</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={withdrawalRate}
                  onChange={(e) => {
                    const val = e.target.value
                    setWithdrawalRate(val === '' ? 0 : parseFloat(val))
                  }}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && Number.isInteger(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">%</span>
              </div>
            </div>

            <div className="calc-input-group">
              <label>예상 수익률 (연)</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={withdrawalReturn}
                  onChange={(e) => {
                    const val = e.target.value
                    setWithdrawalReturn(val === '' ? 0 : parseFloat(val))
                  }}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && Number.isInteger(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">%</span>
              </div>
            </div>

            <div className="calc-input-group">
              <label>인출 기간</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  min={1}
                  value={withdrawalPeriod}
                  onChange={(e) => {
                    const val = e.target.value
                    setWithdrawalPeriod(val === '' ? 0 : parseInt(val))
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">년</span>
              </div>
            </div>

            <div className="calc-input-group">
              <label>인출 시작 나이</label>
              <div className="calc-input-row">
                <input
                  type="number"
                  min={0}
                  value={withdrawalStartAge}
                  onChange={(e) => {
                    const val = e.target.value
                    setWithdrawalStartAge(val === '' ? 0 : parseInt(val))
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) e.target.value = String(val)
                  }}
                />
                <span className="calc-unit">세</span>
              </div>
            </div>
          </div>

          <div className="calc-result-summary">
            <div className="calc-result-item highlight">
              <span className="calc-result-label">첫해 세후 월수령액</span>
              <span className="calc-result-value">{formatMoney(withdrawalResult.firstMonthlyNet)}</span>
            </div>
            <div className="calc-result-item">
              <span className="calc-result-label">첫해 연 인출액</span>
              <span className="calc-result-value">{formatMoney(withdrawalResult.firstYearWithdrawal)}</span>
            </div>
            <div className="calc-result-item">
              <span className="calc-result-label">총 인출 합계</span>
              <span className="calc-result-value">{formatMoney(withdrawalResult.totalWithdrawn)}</span>
            </div>
            <div className="calc-result-item">
              <span className="calc-result-label">{withdrawalPeriod}년 후 잔액</span>
              <span className="calc-result-value">{formatMoney(withdrawalResult.finalBalance)}</span>
            </div>
          </div>

          {/* 잔액 추이 차트 */}
          <div className="calc-chart-section">
            <h3 className="calc-chart-title">잔액 추이</h3>
            <div className="calc-chart-wrapper">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={withdrawalResult.yearlyDetails.map((row) => ({
                    name: `${row.age}세`,
                    balance: row.endBalance,
                    withdrawal: row.netAmount,
                  }))}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    interval={Math.max(0, Math.floor(withdrawalResult.yearlyDetails.length / 8) - 1)}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(v) => v >= 100000000 ? `${(v / 100000000).toFixed(1)}억` : `${Math.round(v / 10000)}만`}
                    width={55}
                  />
                  <Tooltip
                    formatter={(value) => [formatMoney(Number(value))]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="잔액"
                    stroke="#3b82f6"
                    fill="#dbeafe"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="withdrawal"
                    name="세후 수령"
                    stroke="#10b981"
                    fill="#d1fae5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 연도별 테이블 */}
          <div className="calc-table-wrapper">
            <table className="calc-table">
              <thead>
                <tr>
                  <th>연차</th>
                  <th>나이</th>
                  <th>기초잔액</th>
                  <th>인출금액</th>
                  <th>연금소득세</th>
                  <th>세후수령</th>
                  <th>이자수익</th>
                  <th>기말잔액</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalResult.yearlyDetails.slice(0, 10).map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}년</td>
                    <td>{row.age}세</td>
                    <td>{formatMoney(row.startBalance)}</td>
                    <td>{formatMoney(row.withdrawal)}</td>
                    <td className="tax">{formatMoney(row.tax)}</td>
                    <td className="highlight">{formatMoney(row.netAmount)}</td>
                    <td>{formatMoney(row.interest)}</td>
                    <td>{formatMoney(row.endBalance)}</td>
                  </tr>
                ))}
                {withdrawalResult.yearlyDetails.length > 10 && (
                  <tr className="calc-table-more">
                    <td colSpan={8}>... 외 {withdrawalResult.yearlyDetails.length - 10}년</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="calc-dc-note">
            <p>* 정률 인출 방식: 매년 잔액의 {withdrawalRate}%를 인출하므로, 인출 금액이 해마다 변동합니다</p>
            <p>* 수익률이 인출률보다 높으면 잔액이 유지되거나 증가할 수 있습니다</p>
          </div>
        </div>
      )}

    </div>
  )
}

export default Calculator
