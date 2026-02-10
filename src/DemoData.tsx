import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './DemoData.css'

const STORAGE_KEY = 'professionalDiagnosisData'

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
  expenseFood: number
  expenseTransport: number
  expenseShopping: number
  expenseLeisure: number
  expenseOther: number
  diagnosisSummary: string
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
  expenseFood: 80,
  expenseTransport: 30,
  expenseShopping: 40,
  expenseLeisure: 50,
  expenseOther: 30,
  diagnosisSummary: '',
}

const DemoData = () => {
  const navigate = useNavigate()
  const [globalData, setGlobalData] = useState<GlobalData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
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

  const [isDataSaved, setIsDataSaved] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  // 자동 계산 값들
  const calculatedTotalAsset = globalData.realEstateAsset + globalData.financialAsset + globalData.pensionAsset
  const calculatedTotalDebt = globalData.mortgageAmount + globalData.creditLoanAmount + globalData.otherDebtAmount
  const calculatedNetWorth = Math.round((calculatedTotalAsset - calculatedTotalDebt / 10000) * 100) / 100
  const calculatedMonthlyInterest = Math.round(
    (globalData.mortgageAmount * globalData.mortgageRate / 100 / 12) +
    (globalData.creditLoanAmount * globalData.creditLoanRate / 100 / 12) +
    (globalData.otherDebtAmount * globalData.otherDebtRate / 100 / 12)
  )
  const calculatedLivingExpense = globalData.expenseFood + globalData.expenseTransport + globalData.expenseShopping + globalData.expenseLeisure + globalData.expenseOther
  const calculatedMonthlySavings = globalData.monthlyIncome - globalData.monthlyFixedExpense - calculatedLivingExpense - calculatedMonthlyInterest
  const calculatedMonthlyPensionIncome =
    globalData.nationalPensionPersonal + globalData.nationalPensionSpouse +
    globalData.retirementPensionPersonal + globalData.retirementPensionSpouse +
    globalData.privatePensionPersonal + globalData.privatePensionSpouse +
    globalData.otherIncomePersonal + globalData.otherIncomeSpouse

  // 마지막 저장 시간 로드
  useEffect(() => {
    const savedTime = localStorage.getItem(`${STORAGE_KEY}_lastSaved`)
    if (savedTime) {
      setLastSaved(savedTime)
    }
  }, [])

  const handleGlobalDataChange = (key: string, value: number | string) => {
    setGlobalData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveGlobalData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalData))
    const now = new Date().toLocaleString('ko-KR')
    localStorage.setItem(`${STORAGE_KEY}_lastSaved`, now)
    setLastSaved(now)
    setIsDataSaved(true)
    setTimeout(() => setIsDataSaved(false), 2000)
  }

  const handleResetData = () => {
    if (confirm('모든 데이터를 초기값으로 되돌리시겠습니까?')) {
      setGlobalData(defaultGlobalData)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(`${STORAGE_KEY}_lastSaved`)
      setLastSaved(null)
    }
  }

  type DataItem = {
    key: string
    label: string
    value: string | number
    unit: string
    isText?: boolean
    isTextarea?: boolean
    readonly?: boolean
  }

  const dataCategories: { title: string; items: DataItem[] }[] = [
    {
      title: '고객 정보',
      items: [
        { key: 'customerName', label: '고객명', value: globalData.customerName, unit: '', isText: true },
        { key: 'currentAge', label: '본인 현재 나이', value: globalData.currentAge, unit: '세' },
        { key: 'spouseAge', label: '배우자 현재 나이', value: globalData.spouseAge, unit: '세' },
        { key: 'lifeExpectancy', label: '기대수명', value: globalData.lifeExpectancy, unit: '세' },
      ]
    },
    {
      title: '은퇴 목표',
      items: [
        { key: 'targetRetirementAge', label: '목표 은퇴 나이', value: globalData.targetRetirementAge, unit: '세' },
        { key: 'targetMonthlyCashflow', label: '은퇴 후 목표 월현금흐름', value: globalData.targetMonthlyCashflow, unit: '만원' },
        { key: 'targetAsset', label: '은퇴 시점 목표 자산', value: globalData.targetAsset, unit: '억원' },
      ]
    },
    {
      title: '월 연금 수령액 (은퇴 후)',
      items: [
        { key: 'nationalPensionPersonal', label: '국민연금 (본인)', value: globalData.nationalPensionPersonal, unit: '만원' },
        { key: 'nationalPensionSpouse', label: '국민연금 (배우자)', value: globalData.nationalPensionSpouse, unit: '만원' },
        { key: 'retirementPensionPersonal', label: '퇴직연금 (본인)', value: globalData.retirementPensionPersonal, unit: '만원' },
        { key: 'retirementPensionSpouse', label: '퇴직연금 (배우자)', value: globalData.retirementPensionSpouse, unit: '만원' },
        { key: 'privatePensionPersonal', label: '개인연금 (본인)', value: globalData.privatePensionPersonal, unit: '만원' },
        { key: 'privatePensionSpouse', label: '개인연금 (배우자)', value: globalData.privatePensionSpouse, unit: '만원' },
        { key: 'otherIncomePersonal', label: '기타소득 (본인)', value: globalData.otherIncomePersonal, unit: '만원' },
        { key: 'otherIncomeSpouse', label: '기타소득 (배우자)', value: globalData.otherIncomeSpouse, unit: '만원' },
      ]
    },
    {
      title: '자산 현황',
      items: [
        { key: 'realEstateAsset', label: '부동산', value: globalData.realEstateAsset, unit: '억원' },
        { key: 'financialAsset', label: '금융자산', value: globalData.financialAsset, unit: '억원' },
        { key: 'cashAsset', label: '현금성 자산', value: globalData.cashAsset, unit: '억원' },
        { key: 'investmentAsset', label: '투자 자산', value: globalData.investmentAsset, unit: '억원' },
        { key: 'pensionAsset', label: '연금자산', value: globalData.pensionAsset, unit: '억원' },
      ]
    },
    {
      title: '부채 현황',
      items: [
        { key: 'mortgageAmount', label: '주택담보대출', value: globalData.mortgageAmount, unit: '만원' },
        { key: 'mortgageRate', label: '주담대 금리', value: globalData.mortgageRate, unit: '%' },
        { key: 'creditLoanAmount', label: '신용대출', value: globalData.creditLoanAmount, unit: '만원' },
        { key: 'creditLoanRate', label: '신용대출 금리', value: globalData.creditLoanRate, unit: '%' },
        { key: 'otherDebtAmount', label: '기타부채', value: globalData.otherDebtAmount, unit: '만원' },
        { key: 'otherDebtRate', label: '기타부채 금리', value: globalData.otherDebtRate, unit: '%' },
      ]
    },
    {
      title: '월 현금흐름',
      items: [
        { key: 'monthlyIncome', label: '월 총소득', value: globalData.monthlyIncome, unit: '만원' },
        { key: 'monthlyFixedExpense', label: '고정지출', value: globalData.monthlyFixedExpense, unit: '만원' },
      ]
    },
    {
      title: '지출 세부 항목',
      items: [
        { key: 'expenseFood', label: '식비', value: globalData.expenseFood, unit: '만원' },
        { key: 'expenseTransport', label: '교통비', value: globalData.expenseTransport, unit: '만원' },
        { key: 'expenseShopping', label: '쇼핑/미용비', value: globalData.expenseShopping, unit: '만원' },
        { key: 'expenseLeisure', label: '유흥/여가비', value: globalData.expenseLeisure, unit: '만원' },
        { key: 'expenseOther', label: '기타 비용', value: globalData.expenseOther, unit: '만원' },
      ]
    },
    {
      title: '진단 결과 요약',
      items: [
        { key: 'diagnosisSummary', label: '진단 결과 요약', value: globalData.diagnosisSummary, unit: '', isTextarea: true },
      ]
    },
    {
      title: '자동 계산 (참고용)',
      items: [
        { key: '_totalAsset', label: '총자산', value: calculatedTotalAsset.toFixed(1), unit: '억원', readonly: true },
        { key: '_totalDebt', label: '총부채', value: calculatedTotalDebt, unit: '만원', readonly: true },
        { key: '_netWorth', label: '순자산', value: calculatedNetWorth, unit: '억원', readonly: true },
        { key: '_livingExpense', label: '생활비 (지출합계)', value: calculatedLivingExpense, unit: '만원', readonly: true },
        { key: '_monthlyInterest', label: '월 이자', value: calculatedMonthlyInterest, unit: '만원', readonly: true },
        { key: '_monthlySavings', label: '월 저축가능액', value: calculatedMonthlySavings, unit: '만원', readonly: true },
        { key: '_monthlyPensionIncome', label: '은퇴 후 월수입', value: calculatedMonthlyPensionIncome, unit: '만원', readonly: true },
      ]
    },
  ]

  return (
    <div className="demo-data-container">
      <div className="demo-data-header">
        <h1 className="demo-data-title">데모 데이터 설정</h1>
        <p className="demo-data-subtitle">진단에 사용할 고객 데이터를 입력하고 저장합니다.</p>
        {lastSaved && (
          <p className="demo-data-last-saved">마지막 저장: {lastSaved}</p>
        )}
      </div>

      <div className="demo-data-categories">
        {dataCategories.map((category, catIdx) => (
          <div key={catIdx} className="demo-data-category">
            <div className="demo-data-category-title">{category.title}</div>
            <div className="demo-data-items">
              {category.items.map((item) => {
                const isReadonly = item.readonly
                const isText = item.isText
                const isTextarea = item.isTextarea
                return (
                  <div key={item.key} className={`demo-data-item ${isReadonly ? 'readonly' : ''} ${isTextarea ? 'textarea-item' : ''}`}>
                    <span className="demo-data-item-label">{item.label}</span>
                    <div className="demo-data-item-value-wrapper">
                      {isReadonly ? (
                        <span className="demo-data-item-readonly-value">{item.value}</span>
                      ) : isTextarea ? (
                        <textarea
                          className="demo-data-item-textarea"
                          value={item.value}
                          onChange={(e) => handleGlobalDataChange(item.key, e.target.value)}
                          placeholder="비워두면 자동으로 생성됩니다"
                          rows={3}
                        />
                      ) : isText ? (
                        <input
                          type="text"
                          className="demo-data-item-input text-input"
                          value={item.value}
                          onChange={(e) => handleGlobalDataChange(item.key, e.target.value)}
                        />
                      ) : (
                        <input
                          type="number"
                          className="demo-data-item-input"
                          value={item.value}
                          onChange={(e) => handleGlobalDataChange(item.key, parseFloat(e.target.value) || 0)}
                          step={item.unit === '%' || item.unit === '억원' ? 0.1 : 1}
                        />
                      )}
                      <span className="demo-data-item-unit">{item.unit}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="demo-data-actions">
        <button
          className="demo-data-reset-button"
          onClick={handleResetData}
        >
          초기화
        </button>
        <button
          className={`demo-data-save-button ${isDataSaved ? 'saved' : ''}`}
          onClick={handleSaveGlobalData}
        >
          {isDataSaved ? '저장 완료' : '저장하기'}
        </button>
      </div>

      <div className="demo-data-navigation">
        <h3 className="demo-data-nav-title">저장 후 이동</h3>
        <div className="demo-data-nav-links">
          <button onClick={() => navigate('/professional/diagnosis')}>
            Professional 진단
          </button>
          <button onClick={() => navigate('/professional/report-v2')}>
            진단 리포트 V2
          </button>
          <button onClick={() => navigate('/professional/report')}>
            진단 리포트
          </button>
          <button onClick={() => navigate('/scenario-planning')}>
            시나리오 플래닝
          </button>
        </div>
      </div>
    </div>
  )
}

export default DemoData
