import { useState, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import annotationPlugin from 'chartjs-plugin-annotation'
import { createClient } from '@supabase/supabase-js'
import './App.css'
import { householdFinance2025, estimatePercentiles, type AgeGroup } from './data/householdFinance2025'

// Supabase 클라이언트 설정
const supabaseUrl = 'https://xikizeymdabgwmwfifff.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa2l6ZXltZGFiZ3dtd2ZpZmZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNDk5MDUsImV4cCI6MjA4MjcyNTkwNX0.uCqIK7X5ahvQ2YisEBG1O5wVcgoYv5WGPGAl_eLryP4'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 댓글 인터페이스
interface Comment {
  id: string
  content: string
  likes: number
  created_at: string
}

// 세션 ID 생성 (브라우저 세션 단위)
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('comment_session_id')
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2, 15)
    sessionStorage.setItem('comment_session_id', sessionId)
  }
  return sessionId
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  annotationPlugin
)

interface FamilyMember {
  relation: string
  age: string
}

interface FinancialData {
  // 가족 정보
  family: FamilyMember[]
  isMarried: boolean  // 결혼 여부

  // 은퇴 목표
  currentAge: string
  targetRetirementAge: string
  targetRetirementAsset: string

  // 소득/지출
  income: string           // 본인 월 소득
  spouseIncome: string     // 배우자 월 소득
  expense: string

  // 부동산
  housingType: 'own' | 'jeonse' | 'rent'  // 자가/전세/월세
  realEstate: string           // 자가: 부동산 시세
  hasMortgage: boolean
  mortgageAmount: string
  jeonseDeposit: string        // 전세 보증금
  hasJeonseDebt: boolean
  jeonseDebtAmount: string
  monthlyRent: string          // 월세
  rentDeposit: string          // 월세 보증금

  // 금융자산
  savings: string          // 예적금
  stocks: string           // 주식/펀드
  otherFinancialAsset: string  // 기타 금융자산

  // 부채 (부동산 외)
  otherDebt: string

  // 연금
  nationalPension: string    // 국민연금
  retirementPension: string  // 퇴직연금
  privatePension: string     // 개인연금
}

const initialData: FinancialData = {
  family: [{ relation: '본인', age: '' }],
  isMarried: false,
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

type InvestmentStyle = 'conservative' | 'balanced' | 'aggressive'

function App() {
  const [data, setData] = useState<FinancialData>(initialData)
  const [investmentStyle, setInvestmentStyle] = useState<InvestmentStyle>('balanced')
  const [isInputExpanded, setIsInputExpanded] = useState(true)
  const [isTaxReferenceExpanded, setIsTaxReferenceExpanded] = useState(false)
  const [useFinancialAssetOnly, setUseFinancialAssetOnly] = useState(false)
  const [pensionWithdrawalYears, setPensionWithdrawalYears] = useState(20) // 연금 인출 기간 (년)
  const [showEtfDetails, setShowEtfDetails] = useState(false) // ETF 상세 설명 토글
  const [showFloatingButton, setShowFloatingButton] = useState(false) // 플로팅 버튼 표시
  const [applyInflation, setApplyInflation] = useState(false) // 물가상승률 반영 여부
  const [useMedianData, setUseMedianData] = useState(true) // true: 중앙값, false: 평균값

  // 댓글 관련 상태
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [showCommentSection, setShowCommentSection] = useState(false)
  const [showAllComments, setShowAllComments] = useState(false)
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsLoaded, setCommentsLoaded] = useState(false)

  // 세션에서 좋아요한 댓글 목록 불러오기
  useEffect(() => {
    const savedLikes = sessionStorage.getItem('liked_comments')
    if (savedLikes) {
      setLikedComments(new Set(JSON.parse(savedLikes)))
    }
  }, [])

  // 댓글 불러오기
  const fetchComments = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingComments(true)
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .order('likes', { ascending: false })

    if (!error && data) {
      setComments(data)
      setCommentsLoaded(true)
    }
    if (showLoading) setIsLoadingComments(false)
  }, [])

  // 앱 로드 시 댓글 미리 불러오기 (백그라운드)
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  // 댓글 섹션 열릴 때 배경 스크롤 방지 + 캐시 없으면 로딩
  useEffect(() => {
    if (showCommentSection) {
      if (!commentsLoaded) {
        fetchComments(true)
      }
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showCommentSection, commentsLoaded, fetchComments])

  // 댓글 작성
  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    const { error } = await supabase
      .from('comments')
      .insert([{ content: newComment.trim(), likes: 0 }])

    if (!error) {
      setNewComment('')
      fetchComments()
    }
    setIsSubmitting(false)
  }

  // 공감 버튼 클릭 (토글)
  const handleLike = async (commentId: string) => {
    const sessionId = getSessionId()
    const likeKey = `${sessionId}_${commentId}`

    const comment = comments.find(c => c.id === commentId)
    if (!comment) return

    const hasLiked = likedComments.has(likeKey)
    const newLikes = hasLiked ? comment.likes - 1 : comment.likes + 1

    const { error } = await supabase
      .from('comments')
      .update({ likes: Math.max(0, newLikes) })
      .eq('id', commentId)

    if (!error) {
      const newLikedComments = new Set(likedComments)
      if (hasLiked) {
        // 공감 취소
        newLikedComments.delete(likeKey)
      } else {
        // 공감 추가
        newLikedComments.add(likeKey)
      }
      setLikedComments(newLikedComments)
      sessionStorage.setItem('liked_comments', JSON.stringify([...newLikedComments]))

      fetchComments()
    }
  }

  // 표시할 댓글 (최대 15개 또는 전체)
  const displayedComments = showAllComments ? comments : comments.slice(0, 15)

  // 스크롤 감지하여 플로팅 버튼 표시
  useEffect(() => {
    const handleScroll = () => {
      // 예시 보기 섹션이 화면에서 벗어나면 플로팅 버튼 표시
      setShowFloatingButton(window.scrollY > 200)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleChange = (field: keyof FinancialData, value: string | boolean) => {
    if (typeof value === 'string') {
      // housingType은 그대로 저장
      if (field === 'housingType') {
        setData(prev => ({ ...prev, [field]: value as 'own' | 'jeonse' | 'rent' }))
      } else {
        const numericValue = value.replace(/[^0-9]/g, '')
        setData(prev => ({ ...prev, [field]: numericValue }))
      }
    } else {
      setData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleFamilyChange = (index: number, field: keyof FamilyMember, value: string) => {
    const newFamily = [...data.family]
    if (field === 'age') {
      const numericValue = value.replace(/[^0-9]/g, '')
      newFamily[index][field] = numericValue
      // 본인(index 0)의 나이가 변경되면 currentAge도 업데이트
      if (index === 0) {
        setData(prev => ({ ...prev, family: newFamily, currentAge: numericValue }))
        return
      }
    } else {
      newFamily[index][field] = value
    }
    setData(prev => ({ ...prev, family: newFamily }))
  }

  const addFamilyMember = () => {
    setData(prev => ({
      ...prev,
      family: [...prev.family, { relation: '', age: '' }]
    }))
  }

  const removeFamilyMember = (index: number) => {
    if (data.family.length > 1) {
      // 배우자(index 1) 삭제 시 결혼여부도 해제
      const isSpouse = data.family[index].relation === '배우자'
      setData(prev => ({
        ...prev,
        family: prev.family.filter((_, i) => i !== index),
        isMarried: isSpouse ? false : prev.isMarried,
        spouseIncome: isSpouse ? '' : prev.spouseIncome
      }))
    }
  }

  // 결혼여부 변경 핸들러
  const handleMarriageChange = (isMarried: boolean) => {
    if (isMarried) {
      // 결혼 체크 시 배우자 자동 추가 (이미 없는 경우에만)
      const hasSpouse = data.family.some(m => m.relation === '배우자')
      if (!hasSpouse) {
        setData(prev => ({
          ...prev,
          isMarried: true,
          family: [prev.family[0], { relation: '배우자', age: '' }, ...prev.family.slice(1)]
        }))
      } else {
        setData(prev => ({ ...prev, isMarried: true }))
      }
    } else {
      // 결혼 체크 해제 시 배우자 제거 및 배우자 소득 초기화
      setData(prev => ({
        ...prev,
        isMarried: false,
        spouseIncome: '',
        family: prev.family.filter(m => m.relation !== '배우자')
      }))
    }
  }

  const formatNumber = (value: string) => {
    if (!value) return ''
    return Number(value).toLocaleString()
  }

  // 억원 보조 텍스트 (1억 이상일 때만 표시)
  const formatEokHelper = (value: string): string | null => {
    const num = Number(value) || 0
    if (num < 10000) return null
    const eok = num / 10000
    return `${eok.toFixed(2).replace(/\.?0+$/, '')}억원`
  }

  // 만원 단위를 억원 단위로 변환하여 표시 (10000만원 이상일 때)
  const formatCurrency = (value: number): string => {
    if (value === 0) return '0 만원'

    const absValue = Math.abs(value)
    const sign = value < 0 ? '-' : ''

    if (absValue >= 10000) {
      const eok = Math.floor(absValue / 10000)
      const remainder = absValue % 10000
      if (remainder === 0) {
        return `${sign}${eok.toLocaleString()}억원`
      } else {
        return `${sign}${eok.toLocaleString()}억 ${remainder.toLocaleString()}만원`
      }
    }
    return `${sign}${absValue.toLocaleString()} 만원`
  }

  // 억원 단위로 소수점 2자리까지 표시 (예: 5억8239만원 → 5.82억원)
  const formatEokCompact = (value: number): string => {
    if (value === 0) return '0원'
    const absValue = Math.abs(value)
    const sign = value < 0 ? '-' : ''

    if (absValue >= 10000) {
      const eok = absValue / 10000
      return `${sign}${eok.toFixed(2)}억원`
    }
    return `${sign}${absValue.toLocaleString()}만원`
  }

  const getNum = (field: keyof FinancialData) => {
    const val = data[field]
    return typeof val === 'string' ? Number(val) || 0 : 0
  }

  // 주거 형태에 따른 부동산 자산/부채 계산
  const housingAsset = data.housingType === 'own'
    ? getNum('realEstate')  // 자가: 부동산 시세
    : data.housingType === 'jeonse'
      ? getNum('jeonseDeposit')  // 전세: 전세 보증금
      : getNum('rentDeposit')    // 전월세: 보증금

  const housingDebt = data.housingType === 'own'
    ? getNum('mortgageAmount')  // 자가: 주택담보대출
    : getNum('jeonseDebtAmount')  // 전세/전월세: 전세자금대출

  const totalFinancialAsset = getNum('savings') + getNum('stocks') + getNum('otherFinancialAsset')
  const totalPensionAsset = getNum('retirementPension') + getNum('privatePension') // 연금 적립액 (자산) - 국민연금 제외
  const totalAsset = housingAsset + totalFinancialAsset + totalPensionAsset // 총 자산
  const totalDebt = housingDebt + getNum('otherDebt')
  const netWorth = totalAsset - totalDebt

  // 사용자 연령대 결정 (통계청 2025 가계금융복지조사 기준)
  const getAgeGroup = (age: number): AgeGroup => {
    if (age < 30) return '29세이하'
    if (age < 40) return '30대'
    if (age < 50) return '40대'
    if (age < 60) return '50대'
    if (age < 65) return '60대'
    return '65세이상'
  }

  const currentAge = getNum('currentAge')
  const userAgeGroup = currentAge > 0 ? getAgeGroup(currentAge) : '40대'
  const ageGroupData = householdFinance2025[userAgeGroup]

  // 분위 데이터 추정 (평균/중앙값 기반)
  const ageGroupPercentiles = estimatePercentiles(
    ageGroupData.netWorth.mean,
    ageGroupData.netWorth.median
  )

  // 백분위 계산 (분위 데이터 기반으로 선형 보간)
  const calculatePercentile = (value: number): number => {
    const { p20, p40, p60, p80 } = ageGroupPercentiles
    const median = ageGroupData.netWorth.median

    if (value <= p20) {
      return Math.max(1, Math.round((value / p20) * 20))
    } else if (value <= p40) {
      return 20 + Math.round(((value - p20) / (p40 - p20)) * 20)
    } else if (value <= median) {
      return 40 + Math.round(((value - p40) / (median - p40)) * 10)
    } else if (value <= p60) {
      return 50 + Math.round(((value - median) / (p60 - median)) * 10)
    } else if (value <= p80) {
      return 60 + Math.round(((value - p60) / (p80 - p60)) * 20)
    } else {
      // 80분위 이상
      const extraRatio = Math.min((value - p80) / p80, 1)
      return Math.min(99, 80 + Math.round(extraRatio * 19))
    }
  }

  const userPercentile = netWorth > 0 ? calculatePercentile(netWorth) : 0

  // 투자 배분 계산
  // 가계 총 월 소득 (본인 + 배우자)
  const totalMonthlyIncome = getNum('income') + getNum('spouseIncome')
  const monthlySavings = totalMonthlyIncome - getNum('expense')
  const yearlySavings = monthlySavings * 12

  // 개인별 연소득
  const yearlyIncome = getNum('income') * 12           // 본인 연소득
  const spouseYearlyIncome = getNum('spouseIncome') * 12  // 배우자 연소득
  const totalYearlyIncome = totalMonthlyIncome * 12   // 가계 총 연소득

  // 세액공제율 (연소득 5,500만원 기준) - 본인/배우자 각각 적용
  const TAX_DEDUCTION_RATE = yearlyIncome <= 5500 ? 16.5 : 13.2
  const SPOUSE_TAX_DEDUCTION_RATE = spouseYearlyIncome <= 5500 ? 16.5 : 13.2

  // 절세 계좌 한도 (만원 단위)
  const PENSION_FUND_INITIAL = 600    // 연금저축펀드 초기 600만원
  const IRP_MAX = 300                 // IRP 최대 300만원
  const TAX_DEDUCTION_LIMIT = 900     // 세액공제 한도 (연금저축+IRP 합산)
  const PENSION_IRP_COMBINED_MAX = 1800 // 연금저축+IRP 납입 한도
  const ISA_LIMIT = 2000              // ISA 연 2000만원

  // 개인별 투자 배분 계산 함수
  const calculatePersonalAllocation = (yearlyAmount: number) => {
    let remaining = yearlyAmount
    const allocation = {
      pensionFund: 0,      // 연금저축펀드
      irp: 0,              // IRP
      isa: 0,              // ISA
      general: 0,          // 일반 주식계좌
    }

    if (remaining <= 0) return allocation

    // 1단계: 연금저축 600 + IRP 300 = 900만원 (세액공제 최대)
    allocation.pensionFund = Math.min(remaining, PENSION_FUND_INITIAL)
    remaining -= allocation.pensionFund

    if (remaining > 0) {
      allocation.irp = Math.min(remaining, IRP_MAX)
      remaining -= allocation.irp
    }

    // 2단계: 900만원 초과 ~ 1800만원까지는 연금저축으로 추가
    if (remaining > 0) {
      const pensionOnlyMax = PENSION_IRP_COMBINED_MAX - IRP_MAX
      const additionalPension = Math.min(remaining, pensionOnlyMax - PENSION_FUND_INITIAL)
      allocation.pensionFund += additionalPension
      remaining -= additionalPension
    }

    // 3단계: ISA
    if (remaining > 0) {
      allocation.isa = Math.min(remaining, ISA_LIMIT)
      remaining -= allocation.isa
    }

    // 4단계: 일반 주식계좌
    if (remaining > 0) {
      allocation.general = remaining
    }

    return allocation
  }

  // 배우자가 있는 경우 소득 비율에 따라 배분
  const calculateCoupleAllocation = () => {
    if (!data.isMarried || spouseYearlyIncome === 0) {
      // 미혼이거나 배우자 소득이 없으면 본인에게 전액 배분
      return {
        personal: calculatePersonalAllocation(yearlySavings),
        spouse: calculatePersonalAllocation(0)
      }
    }

    // 소득 비율에 따른 저축액 배분
    const totalIncome = yearlyIncome + spouseYearlyIncome
    const personalRatio = yearlyIncome / totalIncome

    const personalSavings = Math.round(yearlySavings * personalRatio)
    const spouseSavings = yearlySavings - personalSavings // 반올림 오차 보정

    return {
      personal: calculatePersonalAllocation(personalSavings),
      spouse: calculatePersonalAllocation(spouseSavings)
    }
  }

  const coupleAllocation = calculateCoupleAllocation()
  const investmentAllocation = data.isMarried
    ? {
        pensionFund: coupleAllocation.personal.pensionFund + coupleAllocation.spouse.pensionFund,
        irp: coupleAllocation.personal.irp + coupleAllocation.spouse.irp,
        isa: coupleAllocation.personal.isa + coupleAllocation.spouse.isa,
        general: coupleAllocation.personal.general + coupleAllocation.spouse.general,
      }
    : coupleAllocation.personal

  // 세액공제 금액 계산 (연금저축 + IRP 합산 900만원까지만 세액공제)
  // 본인 세액공제 계산
  const personalPensionDeductible = Math.min(coupleAllocation.personal.pensionFund, PENSION_FUND_INITIAL)
  const personalIrpDeductible = Math.min(coupleAllocation.personal.irp, TAX_DEDUCTION_LIMIT - personalPensionDeductible)
  const personalPensionRefund = Math.round(personalPensionDeductible * (TAX_DEDUCTION_RATE / 100))
  const personalIrpRefund = Math.round(personalIrpDeductible * (TAX_DEDUCTION_RATE / 100))
  const personalTotalRefund = personalPensionRefund + personalIrpRefund

  // 배우자 세액공제 계산
  const spousePensionDeductible = Math.min(coupleAllocation.spouse.pensionFund, PENSION_FUND_INITIAL)
  const spouseIrpDeductible = Math.min(coupleAllocation.spouse.irp, TAX_DEDUCTION_LIMIT - spousePensionDeductible)
  const spousePensionRefund = Math.round(spousePensionDeductible * (SPOUSE_TAX_DEDUCTION_RATE / 100))
  const spouseIrpRefund = Math.round(spouseIrpDeductible * (SPOUSE_TAX_DEDUCTION_RATE / 100))
  const spouseTotalRefund = spousePensionRefund + spouseIrpRefund

  // 가계 합산
  const pensionTaxDeductible = personalPensionDeductible + spousePensionDeductible
  const irpTaxDeductible = personalIrpDeductible + spouseIrpDeductible
  const pensionTaxRefund = personalPensionRefund + spousePensionRefund
  const irpTaxRefund = personalIrpRefund + spouseIrpRefund
  const totalTaxRefund = personalTotalRefund + spouseTotalRefund

  // 은퇴 목표 달성 필요 수익률 계산
  const yearsToRetirement = getNum('targetRetirementAge') - getNum('currentAge')
  const targetAsset = getNum('targetRetirementAsset')

  // 은퇴 분석용 자산 계산 (금융자산만 or 순자산)
  // 금융자산만 옵션: 부동산만 제외, 부채는 차감 (기타부채만, 부동산담보대출/전세대출은 부동산과 함께 제외)
  const analysisAsset = useFinancialAssetOnly
    ? totalFinancialAsset + totalPensionAsset - getNum('otherDebt')  // 금융자산 + 연금 - 기타부채
    : netWorth                                  // 순자산 (총자산 - 총부채)
  const assetGap = targetAsset - analysisAsset

  // 필요 수익률 계산 (뉴턴-랩슨 방법으로 IRR 근사)
  const calculateRequiredReturn = (): number | null => {
    if (yearsToRetirement <= 0 || targetAsset <= 0) return null
    if (analysisAsset >= targetAsset) return 0 // 이미 목표 달성

    // 현재 자산 + 매년 저축액을 복리로 n년 후 목표 자산 달성
    // FV = PV * (1+r)^n + PMT * ((1+r)^n - 1) / r
    // 이 방정식을 r에 대해 풀어야 함 (수치적 방법 사용)

    const pv = analysisAsset
    const pmt = yearlySavings
    const fv = targetAsset
    const n = yearsToRetirement

    // 뉴턴-랩슨 방법으로 수익률 찾기
    let r = 0.07 // 초기 추정값 7%
    for (let i = 0; i < 100; i++) {
      const factor = Math.pow(1 + r, n)
      let fvCalc: number
      let fvDerivative: number

      if (Math.abs(r) < 0.0001) {
        // r이 0에 가까우면 단순 합산
        fvCalc = pv + pmt * n
        fvDerivative = pv * n + pmt * n * (n - 1) / 2
      } else {
        fvCalc = pv * factor + pmt * (factor - 1) / r
        // f(r)의 미분
        fvDerivative = pv * n * Math.pow(1 + r, n - 1) +
          pmt * (n * Math.pow(1 + r, n - 1) * r - (factor - 1)) / (r * r)
      }

      const diff = fvCalc - fv
      if (Math.abs(diff) < 0.01) break

      r = r - diff / fvDerivative

      // 수렴 실패 방지
      if (r < -0.5) r = -0.5
      if (r > 1) r = 1
    }

    return r * 100 // 퍼센트로 반환
  }

  const requiredReturn = calculateRequiredReturn()

  // ETF 상품 정보 (역사적 수익률 기반)
  const etfProducts = {
    spy: { name: 'S&P500 ETF', ticker: 'SPY/VOO', avgReturn: 10.5, volatility: 15, color: '#4361ee', description: '미국 대형주 500개 추종' },
    qqq: { name: 'NASDAQ100 ETF', ticker: 'QQQ', avgReturn: 14.5, volatility: 22, color: '#7c3aed', description: '미국 기술주 중심' },
    gld: { name: '금 현물 ETF', ticker: 'GLD/IAU', avgReturn: 7.5, volatility: 15, color: '#f59e0b', description: '인플레이션 헤지, 안전자산' },
    shy: { name: '미국 단기채 ETF', ticker: 'SHY/BIL', avgReturn: 2.5, volatility: 2, color: '#10b981', description: '1-3년 만기 미국 국채' },
    ief: { name: '미국 중기채 ETF', ticker: 'IEF/GOVT', avgReturn: 4.0, volatility: 7, color: '#06b6d4', description: '7-10년 만기 미국 국채' },
  }

  // 포트폴리오 구성 데이터 (역사적 수익률 기반)
  const portfolios = {
    conservative: {
      name: '보수적',
      expectedReturn: { min: 4, max: 6 },
      allocation: [
        { ...etfProducts.shy, ratio: 40 },
        { ...etfProducts.ief, ratio: 25 },
        { ...etfProducts.gld, ratio: 15 },
        { ...etfProducts.spy, ratio: 20 },
      ],
      description: '원금 보존을 최우선으로, 안정적인 수익 추구',
      risk: '낮음',
      historicalReturn: 5.2,
      maxDrawdown: -12,
    },
    balanced: {
      name: '균형',
      expectedReturn: { min: 7, max: 10 },
      allocation: [
        { ...etfProducts.spy, ratio: 40 },
        { ...etfProducts.qqq, ratio: 15 },
        { ...etfProducts.ief, ratio: 20 },
        { ...etfProducts.gld, ratio: 15 },
        { ...etfProducts.shy, ratio: 10 },
      ],
      description: '안정성과 수익성의 균형을 추구',
      risk: '중간',
      historicalReturn: 8.3,
      maxDrawdown: -25,
    },
    aggressive: {
      name: '공격적',
      expectedReturn: { min: 10, max: 15 },
      allocation: [
        { ...etfProducts.spy, ratio: 45 },
        { ...etfProducts.qqq, ratio: 35 },
        { ...etfProducts.gld, ratio: 10 },
        { ...etfProducts.ief, ratio: 10 },
      ],
      description: '높은 변동성을 감수하고 최대 수익 추구',
      risk: '높음',
      historicalReturn: 12.1,
      maxDrawdown: -35,
    },
  }

  const currentPortfolio = portfolios[investmentStyle]

  // 선택한 포트폴리오가 목표 수익률을 달성할 수 있는지 확인
  const canAchieveGoal = requiredReturn !== null && requiredReturn <= currentPortfolio.expectedReturn.max

  // 예시 데이터 로드 함수
  const loadExampleData = (ageGroup: AgeGroup) => {
    const stats = householdFinance2025[ageGroup]
    // 평균/중앙값 선택에 따라 데이터 선택
    const getValue = (stat: { mean: number; median: number }) => useMedianData ? stat.median : stat.mean

    // 나이, 가구원수, 목표 은퇴 연령 설정 (통계청 2025 기준)
    const ageDataMap: Record<AgeGroup, { age: number; members: number; retireAge: number }> = {
      '29세이하': { age: 27, members: 1.31, retireAge: 60 },
      '30대': { age: 35, members: 2.13, retireAge: 60 },
      '40대': { age: 45, members: 2.91, retireAge: 60 },
      '50대': { age: 55, members: 2.70, retireAge: 65 },
      '60대': { age: 62, members: 1.98, retireAge: 70 },
      '65세이상': { age: 68, members: 1.82, retireAge: 75 },
    }
    const { age, members, retireAge } = ageDataMap[ageGroup]

    // 가족 구성 생성
    const familyMembers: FamilyMember[] = [{ relation: '본인', age: String(age) }]
    const roundedMembers = Math.round(members)

    // 2인 이상이면 배우자 추가
    const hasSpouse = roundedMembers >= 2
    if (hasSpouse) {
      familyMembers.push({ relation: '배우자', age: String(age - 2) }) // 배우자는 2살 적게
    }

    // 3인 이상이면 자녀 추가
    if (roundedMembers >= 3) {
      // 연령대별 자녀 나이 추정
      const childAge = ageGroup === '30대' ? 5 : ageGroup === '40대' ? 15 : ageGroup === '50대' ? 25 : 30
      familyMembers.push({ relation: '자녀', age: String(childAge) })
    }

    // 순자산 = 자산 - 부채가 통계청 데이터와 일치하도록 조정
    // 통계청 순자산 데이터를 기준으로 역산
    const netWorthValue = getValue(stats.netWorth)
    const realAssetValue = getValue(stats.realAsset)
    const financialAssetValue = getValue(stats.financialAsset)

    // 총자산 = 실물자산 + 금융자산
    const totalAsset = realAssetValue + financialAssetValue
    // 부채 = 총자산 - 순자산 (이렇게 해야 순자산이 맞음)
    const debtValue = totalAsset - netWorthValue

    // 금융자산을 예적금/주식/연금으로 배분
    // 연령대별 연금 비중 추정 (나이가 많을수록 연금 적립 비중 증가)
    const pensionRatio = ageGroup === '29세이하' ? 0.15
      : ageGroup === '30대' ? 0.25
      : ageGroup === '40대' ? 0.35
      : ageGroup === '50대' ? 0.40
      : 0.45 // 60대 이상

    // 연금 자산 (금융자산의 일부)
    const totalPension = Math.round(financialAssetValue * pensionRatio)
    const retirementPension = Math.round(totalPension * 0.6) // 퇴직연금 60%
    const privatePension = Math.round(totalPension * 0.4) // 개인연금 40%

    // 나머지 금융자산을 예적금과 주식으로 배분 (6:4 비율)
    const remainingFinancial = financialAssetValue - totalPension
    const savings = Math.round(remainingFinancial * 0.6)
    const stocks = Math.round(remainingFinancial * 0.4)

    // 부채의 70%를 주택담보대출로, 30%를 기타부채로 가정
    const mortgage = Math.round(Math.max(0, debtValue) * 0.7)
    const otherDebt = Math.round(Math.max(0, debtValue) * 0.3)

    // 월 소득 = 연소득 / 12 (배우자가 있으면 6:4로 분배)
    const totalMonthlyIncome = Math.round(getValue(stats.income) / 12)
    const personalIncome = hasSpouse ? Math.round(totalMonthlyIncome * 0.6) : totalMonthlyIncome
    const spouseIncome = hasSpouse ? Math.round(totalMonthlyIncome * 0.4) : 0

    // 월 지출 = 처분가능소득의 80% / 12
    const monthlyExpense = Math.round((getValue(stats.disposableIncome) * 0.8) / 12)

    // 국민연금 예상 수령액 (월, 1인당 100만원 예시)
    const nationalPension = hasSpouse ? 200 : 100

    // 은퇴 목표 자산 계산 (월 지출 × 12개월 × 25년 기준, 최소 10억)
    const targetAsset = Math.max(100000, Math.round(monthlyExpense * 12 * 25))

    setData({
      family: familyMembers,
      isMarried: hasSpouse,
      currentAge: String(age),
      targetRetirementAge: String(retireAge),
      targetRetirementAsset: String(targetAsset),
      income: String(personalIncome),
      spouseIncome: hasSpouse ? String(spouseIncome) : '',
      expense: String(monthlyExpense),
      housingType: 'own',
      realEstate: String(getValue(stats.realAsset)),
      hasMortgage: mortgage > 0,
      mortgageAmount: String(mortgage),
      jeonseDeposit: '',
      hasJeonseDebt: false,
      jeonseDebtAmount: '',
      monthlyRent: '',
      rentDeposit: '',
      savings: String(savings),
      stocks: String(stocks),
      otherFinancialAsset: '0',
      otherDebt: String(otherDebt),
      nationalPension: String(nationalPension),
      retirementPension: String(retirementPension),
      privatePension: String(privatePension),
    })

    // 입력창 닫기
    setIsInputExpanded(false)
  }

  return (
    <div className="app">
      <h1>은퇴 준비 진단 & 가이드</h1>
      <p className="app-disclaimer">
        통계청 2025 가계금융복지조사 데이터를 기반으로 만든 은퇴 진단 도구입니다.
        <strong>참고용</strong>으로만 활용해 주세요.
        틀린 내용이나 의견이 있다면 <button className="disclaimer-feedback-btn" onClick={() => setShowCommentSection(true)}>의견 남기기</button>를 이용해주세요.
      </p>

      {/* 예시 보기 */}
      <div className="example-section">
        <div className="example-header">
          <span className="example-label">예시 보기</span>
          <span className="example-desc">연령대별 통계청 2025 가계금융복지조사 데이터</span>
        </div>
        <div className="data-type-tabs">
          <button
            className={`data-type-tab ${useMedianData ? 'active' : ''}`}
            onClick={() => setUseMedianData(true)}
          >
            중앙값
          </button>
          <button
            className={`data-type-tab ${!useMedianData ? 'active' : ''}`}
            onClick={() => setUseMedianData(false)}
          >
            평균값
          </button>
        </div>
        <div className="data-type-desc">
          {useMedianData ? (
            <span>중앙값: 전체 가구를 순서대로 나열했을 때 정중앙에 있는 값 (상위 50%)</span>
          ) : (
            <span className="mean-warning">
              평균값: 모든 가구의 합계를 가구 수로 나눈 값.
              <strong> 주의:</strong> 소수의 고자산층이 평균을 크게 끌어올려 실제 체감과 차이가 클 수 있습니다.
            </span>
          )}
        </div>
        <div className="example-buttons">
          <button onClick={() => loadExampleData('29세이하')}>20대</button>
          <button onClick={() => loadExampleData('30대')}>30대</button>
          <button onClick={() => loadExampleData('40대')}>40대</button>
          <button onClick={() => loadExampleData('50대')}>50대</button>
          <button onClick={() => loadExampleData('60대')}>60대</button>
          <button
            className="my-data-btn"
            onClick={() => {
              setData(initialData)
              setIsInputExpanded(true)
              setTimeout(() => {
                document.getElementById('data-input-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 100)
            }}
          >
            내 재무데이터 입력해보기
          </button>
        </div>
      </div>

      {/* 데이터 입력 토글 헤더 */}
      <div id="data-input-section" className="input-toggle-header" onClick={() => setIsInputExpanded(!isInputExpanded)}>
        <h2>데이터 입력</h2>
        <span className={`toggle-icon ${isInputExpanded ? 'expanded' : ''}`}>▼</span>
      </div>

      {/* 입력 섹션들 */}
      <div className={`input-sections ${isInputExpanded ? 'expanded' : 'collapsed'}`}>
        {/* 개인정보 보호 안내 */}
        <div className="privacy-notice">
          <span className="privacy-icon">🔒</span>
          <span>입력하신 모든 데이터는 <strong>서버에 전송되거나 저장되지 않습니다.</strong> 브라우저에서만 계산되며, 페이지를 새로고침하면 초기화됩니다.</span>
        </div>

        {/* 가족 정보 */}
        <section className="input-section">
          <h2>가족 정보</h2>
          <div className="marriage-checkbox">
            <label>
              <input
                type="checkbox"
                checked={data.isMarried}
                onChange={(e) => handleMarriageChange(e.target.checked)}
              />
              기혼
            </label>
          </div>
        <div className="family-list">
          {data.family.map((member, index) => (
            <div key={index} className="family-row">
              <div className="input-group">
                <label>관계</label>
                <input
                  type="text"
                  value={member.relation}
                  onChange={(e) => handleFamilyChange(index, 'relation', e.target.value)}
                  placeholder="예: 배우자, 자녀"
                  disabled={index === 0 || member.relation === '배우자'}
                />
              </div>
              <div className="input-group">
                <label>나이</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={member.age}
                    onChange={(e) => handleFamilyChange(index, 'age', e.target.value)}
                    placeholder="0"
                  />
                  <span className="currency">세</span>
                </div>
              </div>
              {index > 0 && (
                <button className="remove-btn" onClick={() => removeFamilyMember(index)}>
                  삭제
                </button>
              )}
            </div>
          ))}
          <button className="add-btn" onClick={addFamilyMember}>
            + 가족 추가
          </button>
        </div>
      </section>

      {/* 은퇴 목표 */}
      <section className="input-section">
        <h2>은퇴 목표</h2>
        <div className="input-grid">
          <div className="input-group">
            <label>현재 나이 (본인)</label>
            <div className="input-wrapper readonly">
              <input
                type="text"
                value={data.currentAge || '-'}
                readOnly
                placeholder="가족정보에서 입력"
              />
              <span className="currency">세</span>
            </div>
          </div>
          <div className="input-group">
            <label>목표 은퇴 연령</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={data.targetRetirementAge}
                onChange={(e) => handleChange('targetRetirementAge', e.target.value)}
                placeholder="0"
              />
              <span className="currency">세</span>
            </div>
          </div>
          <div className="input-group">
            <label>은퇴시점 목표 자산</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.targetRetirementAsset)}
                onChange={(e) => handleChange('targetRetirementAsset', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            {formatEokHelper(data.targetRetirementAsset) && (
              <span className="eok-helper">{formatEokHelper(data.targetRetirementAsset)}</span>
            )}
          </div>
        </div>
      </section>

      {/* 소득/지출 */}
      <section className="input-section">
        <h2>가계 소득 / 지출</h2>
        <div className="input-grid">
          <div className="input-group">
            <label>{data.isMarried ? '본인 월 소득' : '월 소득'}</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.income)}
                onChange={(e) => handleChange('income', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
          </div>
          {data.isMarried && (
            <div className="input-group">
              <label>배우자 월 소득</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  value={formatNumber(data.spouseIncome)}
                  onChange={(e) => handleChange('spouseIncome', e.target.value)}
                  placeholder="0"
                />
                <span className="currency">만원</span>
              </div>
            </div>
          )}
          <div className="input-group">
            <label>월 지출</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.expense)}
                onChange={(e) => handleChange('expense', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
          </div>
        </div>
        {data.isMarried && (
          <div className="income-summary">
            <span className="income-summary-label">가계 총 월 소득</span>
            <span className="income-summary-value">{formatNumber(String(getNum('income') + getNum('spouseIncome')))} 만원</span>
          </div>
        )}
        <div className="income-summary">
          <span className="income-summary-label">가계 월 현금흐름</span>
          <span className={`income-summary-value ${monthlySavings >= 0 ? 'positive' : 'negative'}`}>
            {monthlySavings >= 0 ? '+' : ''}{formatNumber(String(monthlySavings))} 만원
          </span>
        </div>
      </section>

      {/* 부동산 */}
      <section className="input-section">
        <h2>주거</h2>
        <div className="input-group">
          <label>주거 형태</label>
          <div className="housing-type-selector">
            <button
              type="button"
              className={`housing-type-btn ${data.housingType === 'own' ? 'active' : ''}`}
              onClick={() => handleChange('housingType', 'own')}
            >
              자가
            </button>
            <button
              type="button"
              className={`housing-type-btn ${data.housingType === 'jeonse' ? 'active' : ''}`}
              onClick={() => handleChange('housingType', 'jeonse')}
            >
              전세
            </button>
            <button
              type="button"
              className={`housing-type-btn ${data.housingType === 'rent' ? 'active' : ''}`}
              onClick={() => handleChange('housingType', 'rent')}
            >
              전월세
            </button>
          </div>
        </div>

        {/* 자가 */}
        {data.housingType === 'own' && (
          <>
            <div className="input-grid">
              <div className="input-group">
                <label>부동산 시세</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={formatNumber(data.realEstate)}
                    onChange={(e) => handleChange('realEstate', e.target.value)}
                    placeholder="0"
                  />
                  <span className="currency">만원</span>
                </div>
                {formatEokHelper(data.realEstate) && (
                  <span className="eok-helper">{formatEokHelper(data.realEstate)}</span>
                )}
              </div>
            </div>
            <div className="debt-section">
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={data.hasMortgage}
                    onChange={(e) => handleChange('hasMortgage', e.target.checked)}
                  />
                  주택담보대출 있음
                </label>
                {data.hasMortgage && (
                  <>
                    <div className="input-wrapper inline">
                      <input
                        type="text"
                        value={formatNumber(data.mortgageAmount)}
                        onChange={(e) => handleChange('mortgageAmount', e.target.value)}
                        placeholder="0"
                      />
                      <span className="currency">만원</span>
                    </div>
                    {formatEokHelper(data.mortgageAmount) && (
                      <span className="eok-helper">{formatEokHelper(data.mortgageAmount)}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* 전세 */}
        {data.housingType === 'jeonse' && (
          <>
            <div className="input-grid">
              <div className="input-group">
                <label>전세 보증금</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={formatNumber(data.jeonseDeposit)}
                    onChange={(e) => handleChange('jeonseDeposit', e.target.value)}
                    placeholder="0"
                  />
                  <span className="currency">만원</span>
                </div>
                {formatEokHelper(data.jeonseDeposit) && (
                  <span className="eok-helper">{formatEokHelper(data.jeonseDeposit)}</span>
                )}
              </div>
            </div>
            <div className="debt-section">
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={data.hasJeonseDebt}
                    onChange={(e) => handleChange('hasJeonseDebt', e.target.checked)}
                  />
                  전세자금대출 있음
                </label>
                {data.hasJeonseDebt && (
                  <>
                    <div className="input-wrapper inline">
                      <input
                        type="text"
                        value={formatNumber(data.jeonseDebtAmount)}
                        onChange={(e) => handleChange('jeonseDebtAmount', e.target.value)}
                        placeholder="0"
                      />
                      <span className="currency">만원</span>
                    </div>
                    {formatEokHelper(data.jeonseDebtAmount) && (
                      <span className="eok-helper">{formatEokHelper(data.jeonseDebtAmount)}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* 전월세 */}
        {data.housingType === 'rent' && (
          <>
            <div className="input-grid">
              <div className="input-group">
                <label>보증금</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={formatNumber(data.rentDeposit)}
                    onChange={(e) => handleChange('rentDeposit', e.target.value)}
                    placeholder="0"
                  />
                  <span className="currency">만원</span>
                </div>
                {formatEokHelper(data.rentDeposit) && (
                  <span className="eok-helper">{formatEokHelper(data.rentDeposit)}</span>
                )}
              </div>
              <div className="input-group">
                <label>월세</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={formatNumber(data.monthlyRent)}
                    onChange={(e) => handleChange('monthlyRent', e.target.value)}
                    placeholder="0"
                  />
                  <span className="currency">만원</span>
                </div>
              </div>
            </div>
            <div className="debt-section">
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={data.hasJeonseDebt}
                    onChange={(e) => handleChange('hasJeonseDebt', e.target.checked)}
                  />
                  전세자금대출 있음
                </label>
                {data.hasJeonseDebt && (
                  <>
                    <div className="input-wrapper inline">
                      <input
                        type="text"
                        value={formatNumber(data.jeonseDebtAmount)}
                        onChange={(e) => handleChange('jeonseDebtAmount', e.target.value)}
                        placeholder="0"
                      />
                      <span className="currency">만원</span>
                    </div>
                    {formatEokHelper(data.jeonseDebtAmount) && (
                      <span className="eok-helper">{formatEokHelper(data.jeonseDebtAmount)}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* 금융자산 */}
      <section className="input-section">
        <h2>금융자산</h2>
        <div className="input-grid">
          <div className="input-group">
            <label>예적금</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.savings)}
                onChange={(e) => handleChange('savings', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            {formatEokHelper(data.savings) && (
              <span className="eok-helper">{formatEokHelper(data.savings)}</span>
            )}
          </div>
          <div className="input-group">
            <label>주식/펀드</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.stocks)}
                onChange={(e) => handleChange('stocks', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            {formatEokHelper(data.stocks) && (
              <span className="eok-helper">{formatEokHelper(data.stocks)}</span>
            )}
          </div>
          <div className="input-group">
            <label>기타 금융자산(암호화폐 등)</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.otherFinancialAsset)}
                onChange={(e) => handleChange('otherFinancialAsset', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            {formatEokHelper(data.otherFinancialAsset) && (
              <span className="eok-helper">{formatEokHelper(data.otherFinancialAsset)}</span>
            )}
          </div>
        </div>
      </section>

      {/* 부채 (부동산 외) */}
      <section className="input-section">
        <h2>기타 부채</h2>
        <div className="input-grid">
          <div className="input-group">
            <label>기타 부채 (신용대출 등)</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.otherDebt)}
                onChange={(e) => handleChange('otherDebt', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            {formatEokHelper(data.otherDebt) && (
              <span className="eok-helper">{formatEokHelper(data.otherDebt)}</span>
            )}
          </div>
        </div>
      </section>

      {/* 연금 */}
      <section className="input-section">
        <h2>연금</h2>
        <div className="input-grid">
          <div className="input-group">
            <label>국민연금 (예상 월 수령액)</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.nationalPension)}
                onChange={(e) => handleChange('nationalPension', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            <span className="input-hint">예시: 1인 100만원 기준 입력됨</span>
          </div>
          <div className="input-group">
            <label>퇴직연금 (적립액)</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.retirementPension)}
                onChange={(e) => handleChange('retirementPension', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            {formatEokHelper(data.retirementPension) && (
              <span className="eok-helper">{formatEokHelper(data.retirementPension)}</span>
            )}
          </div>
          <div className="input-group">
            <label>개인연금 - 연금저축펀드, IRP 등 (적립액)</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={formatNumber(data.privatePension)}
                onChange={(e) => handleChange('privatePension', e.target.value)}
                placeholder="0"
              />
              <span className="currency">만원</span>
            </div>
            {formatEokHelper(data.privatePension) && (
              <span className="eok-helper">{formatEokHelper(data.privatePension)}</span>
            )}
          </div>
        </div>
      </section>
      </div>

      {/* 인사이트 */}
      <section className="insight-section">
        <h2>재무정보 요약</h2>
        <div className="insight-grid">
          <div className="insight-card">
            <span className="insight-label">총 자산</span>
            <span className="insight-value">{formatCurrency(totalAsset)}</span>
          </div>
          <div className="insight-card">
            <span className="insight-label">총 부채</span>
            <span className="insight-value negative">{formatCurrency(totalDebt)}</span>
          </div>
          <div className="insight-card highlight">
            <span className="insight-label">순자산</span>
            <span className="insight-value">{formatCurrency(netWorth)}</span>
          </div>
          <div className="insight-card">
            <span className="insight-label">월 저축 가능액</span>
            <span className="insight-value">{formatCurrency(monthlySavings)}</span>
          </div>
          <div className="insight-card">
            <span className="insight-label">저축률</span>
            <span className="insight-value">
              {totalMonthlyIncome > 0 ? Math.round((totalMonthlyIncome - getNum('expense')) / totalMonthlyIncome * 100) : 0}%
            </span>
          </div>
          <div className="insight-card">
            <span className="insight-label">연금 적립 총액</span>
            <span className="insight-value">{formatCurrency(totalPensionAsset)}</span>
          </div>
          <div className="insight-card">
            <span className="insight-label">은퇴까지</span>
            <span className="insight-value">
              {getNum('currentAge') > 0 && getNum('targetRetirementAge') > 0
                ? `${getNum('targetRetirementAge') - getNum('currentAge')}년`
                : '-'}
            </span>
          </div>
          <div className="insight-card">
            <span className="insight-label">목표 자산 달성률</span>
            <span className="insight-value">
              {getNum('targetRetirementAsset') > 0
                ? `${Math.round(netWorth / getNum('targetRetirementAsset') * 100)}%`
                : '-'}
            </span>
          </div>
        </div>

        {/* 순자산 분포 위치 */}
        {currentAge > 0 && netWorth > 0 && (() => {
          // 백분위에 해당하는 순자산 값 계산 (역산)
          const percentileToNetWorth = (percentile: number): number => {
            const { p20, p40, p60, p80 } = ageGroupPercentiles
            const median = ageGroupData.netWorth.median
            if (percentile <= 20) {
              return Math.round((percentile / 20) * p20)
            } else if (percentile <= 40) {
              return Math.round(p20 + ((percentile - 20) / 20) * (p40 - p20))
            } else if (percentile <= 50) {
              return Math.round(p40 + ((percentile - 40) / 10) * (median - p40))
            } else if (percentile <= 60) {
              return Math.round(median + ((percentile - 50) / 10) * (p60 - median))
            } else if (percentile <= 80) {
              return Math.round(p60 + ((percentile - 60) / 20) * (p80 - p60))
            } else {
              return Math.round(p80 + ((percentile - 80) / 20) * p80)
            }
          }

          // 정규분포 곡선 데이터 생성
          const generateBellCurve = () => {
            const points = 100
            const data = []
            const mean = 50 // 중앙
            const std = 18 // 표준편차

            for (let i = 0; i <= points; i++) {
              const x = i
              const y = Math.exp(-0.5 * Math.pow((x - mean) / std, 2)) / (std * Math.sqrt(2 * Math.PI))
              data.push(y * 1000) // 스케일 조정
            }
            return data
          }

          const bellData = generateBellCurve()
          const labels = Array.from({ length: 101 }, (_, i) => i)

          const chartData = {
            labels,
            datasets: [
              {
                data: bellData,
                fill: true,
                backgroundColor: 'rgba(67, 97, 238, 0.15)',
                borderColor: 'rgba(67, 97, 238, 0.8)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#4361ee',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
              },
            ],
          }

          const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              intersect: false,
              mode: 'index' as const,
            },
            scales: {
              x: {
                display: false,
              },
              y: {
                display: false,
              },
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                enabled: true,
                backgroundColor: 'rgba(26, 26, 46, 0.95)',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                titleFont: {
                  size: 12,
                  weight: 'normal' as const,
                },
                bodyFont: {
                  size: 14,
                  weight: 'bold' as const,
                },
                callbacks: {
                  title: (context: { label: string }[]) => {
                    const percentile = parseInt(context[0].label)
                    return `상위 ${100 - percentile}%`
                  },
                  label: (context: { label: string }) => {
                    const percentile = parseInt(context.label)
                    const netWorthAtPercentile = percentileToNetWorth(percentile)
                    // 상위 1% 이상(percentile >= 99)은 "~이상"으로 표시
                    if (percentile >= 99) {
                      return `순자산: ${formatCurrency(netWorthAtPercentile)} 이상`
                    }
                    return `순자산: ${formatCurrency(netWorthAtPercentile)}`
                  },
                },
              },
              annotation: {
                annotations: {
                  userLine: {
                    type: 'line' as const,
                    xMin: userPercentile,
                    xMax: userPercentile,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [6, 4],
                  },
                  userPoint: {
                    type: 'point' as const,
                    xValue: userPercentile,
                    yValue: bellData[userPercentile] || 0,
                    backgroundColor: '#ef4444',
                    borderColor: '#fff',
                    borderWidth: 2,
                    radius: 8,
                  },
                  medianLine: {
                    type: 'line' as const,
                    xMin: 50,
                    xMax: 50,
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    borderWidth: 1,
                    borderDash: [4, 4],
                  },
                },
              },
            },
          }

          return (
            <div className="net-worth-distribution">
              <h4>{userAgeGroup} 순자산 분포에서 나의 위치</h4>
              <div className="distribution-chart">
                <div className="bell-curve-chart">
                  <Line data={chartData} options={chartOptions} />
                </div>
                <div className="distribution-labels">
                  <span>하위</span>
                  <span>중위</span>
                  <span>상위</span>
                </div>
                <div className="distribution-result">
                  <div className="percentile-badge">
                    상위 <strong>{100 - userPercentile}%</strong>
                  </div>
                  <div className="percentile-detail">
                    <p>
                      {userAgeGroup} 가구 중 상위 {100 - userPercentile}% 수준입니다.
                      {userPercentile >= 50 ? (
                        <span className="good"> 동 연령대 중위({formatCurrency(ageGroupData.netWorth.median)}) 이상입니다.</span>
                      ) : (
                        <span className="moderate"> 동 연령대 중위({formatCurrency(ageGroupData.netWorth.median)}) 미만입니다.</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="distribution-reference">
                  <div className="ref-item">
                    <span className="ref-label">동 연령대 평균</span>
                    <span className="ref-value">{formatCurrency(ageGroupData.netWorth.mean)}</span>
                  </div>
                  <div className="ref-item">
                    <span className="ref-label">동 연령대 중위</span>
                    <span className="ref-value">{formatCurrency(ageGroupData.netWorth.median)}</span>
                  </div>
                  <div className="ref-item">
                    <span className="ref-label">나의 순자산</span>
                    <span className="ref-value highlight">{formatCurrency(netWorth)}</span>
                  </div>
                </div>
              </div>
              <p className="distribution-note">
                * <a href="https://mods.go.kr/board.es?mid=a10301010000&bid=215&list_no=439535&act=view&mainXml=Y" target="_blank" rel="noopener noreferrer">통계청 2025 가계금융복지조사</a> 기준
              </p>
            </div>
          )
        })()}

        {/* 자산 배분 현황 */}
        {totalAsset > 0 && (
          <div className="asset-allocation-section">
            <h4>자산 배분 현황</h4>
            {(() => {
              const housingAmount = housingAsset
              const financialAmount = totalFinancialAsset
              const pensionAmount = totalPensionAsset

              const housingRatio = Math.round((housingAmount / totalAsset) * 100)
              const financialRatio = Math.round((financialAmount / totalAsset) * 100)
              const pensionRatio = 100 - housingRatio - financialRatio // 반올림 오차 보정

              // 주거 자산 레이블
              const housingLabel = data.housingType === 'own' ? '부동산' : '보증금'

              // 나이 기반 평가용
              const age = getNum('currentAge') || 35

              // 자산 배분 평가
              const getAssetAllocationAssessment = () => {
                // 자가인 경우만 부동산 편중 경고
                if (data.housingType === 'own' && housingRatio > 70) {
                  return {
                    status: 'warning',
                    title: '부동산 편중',
                    message: `부동산 비중이 ${housingRatio}%로 높습니다. 유동성 확보를 위해 금융자산 비중을 높이는 것을 권장합니다.`
                  }
                }
                // 금융자산이 거의 없는 경우 (10% 미만)
                if (financialRatio < 10 && totalAsset > 10000) {
                  return {
                    status: 'warning',
                    title: '금융자산 부족',
                    message: '금융자산 비중이 낮아 유동성이 부족할 수 있습니다. 비상금 및 투자자산 확보를 권장합니다.'
                  }
                }
                // 연금자산이 부족한 경우 (5% 미만, 40세 이상)
                if (pensionRatio < 5 && age >= 40) {
                  return {
                    status: 'moderate',
                    title: '연금자산 보강 필요',
                    message: '은퇴 대비 연금자산 비중이 낮습니다. 연금저축/IRP 납입을 늘리는 것을 권장합니다.'
                  }
                }
                // 균형 잡힌 경우
                if ((data.housingType !== 'own' || housingRatio <= 60) && financialRatio >= 20 && pensionRatio >= 5) {
                  return {
                    status: 'good',
                    title: '균형 잡힌 자산 배분',
                    message: data.housingType === 'own'
                      ? '부동산, 금융자산, 연금자산이 적절하게 분배되어 있습니다.'
                      : '금융자산과 연금자산이 적절하게 분배되어 있습니다.'
                  }
                }
                // 기본
                return {
                  status: 'neutral',
                  title: '자산 배분 검토',
                  message: '현재 자산 배분을 검토하고 목표에 맞게 조정해 보세요.'
                }
              }

              const assessment = getAssetAllocationAssessment()

              // 파이 차트용 conic-gradient 계산
              const housingEnd = housingRatio
              const financialEnd = housingEnd + financialRatio
              const pensionEnd = 100

              return (
                <div className="asset-allocation-content">
                  <div className="asset-pie-container">
                    <div
                      className="asset-pie-chart"
                      style={{
                        background: `conic-gradient(
                          #f59e0b 0% ${housingEnd}%,
                          #4361ee ${housingEnd}% ${financialEnd}%,
                          #10b981 ${financialEnd}% ${pensionEnd}%
                        )`
                      }}
                    >
                      <div className="asset-pie-inner">
                        <span className="pie-total-label">총 자산</span>
                        <span className="pie-total-value">{formatEokCompact(totalAsset)}</span>
                      </div>
                    </div>
                    <div className="asset-legend">
                      <div className="legend-item">
                        <span className="legend-color" style={{ background: '#f59e0b' }}></span>
                        <span className="legend-label">{housingLabel}</span>
                        <span className="legend-value">{formatCurrency(housingAmount)}</span>
                        <span className="legend-ratio">{housingRatio}%</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{ background: '#4361ee' }}></span>
                        <span className="legend-label">금융자산</span>
                        <span className="legend-value">{formatCurrency(financialAmount)}</span>
                        <span className="legend-ratio">{financialRatio}%</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{ background: '#10b981' }}></span>
                        <span className="legend-label">연금자산</span>
                        <span className="legend-value">{formatCurrency(pensionAmount)}</span>
                        <span className="legend-ratio">{pensionRatio}%</span>
                      </div>
                    </div>
                  </div>

                  <div className={`asset-allocation-assessment ${assessment.status}`}>
                    <div className="assessment-header">
                      <span className={`assessment-badge ${assessment.status}`}>
                        {assessment.status === 'good' && '✓'}
                        {assessment.status === 'moderate' && '△'}
                        {assessment.status === 'warning' && '⚠'}
                        {assessment.status === 'neutral' && 'ℹ'}
                      </span>
                      <span className="assessment-title">{assessment.title}</span>
                    </div>
                    <p className="assessment-message">{assessment.message}</p>
                  </div>

                  <div className="asset-allocation-guide">
                    <h5>자산 배분 가이드</h5>
                    <ul>
                      <li><strong>부동산:</strong> 전체 자산의 40~60% 권장. 유동성이 낮으므로 과도한 집중 주의</li>
                      <li><strong>금융자산:</strong> 최소 20% 이상 권장. 비상금(6개월 생활비) + 투자자산 확보</li>
                      <li><strong>연금자산:</strong> 나이/10% 이상 권장 (40세 → 4% 이상). 세액공제 혜택 활용</li>
                    </ul>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </section>

      {/* 현금흐름 분석 */}
      <section className="insight-section">
        <h2>현금흐름 분석</h2>
        <div className="cashflow-analysis">
          <div className="cashflow-summary">
            <div className="cashflow-item">
              <span className="cashflow-label">월 소득</span>
              <span className="cashflow-value">{formatCurrency(totalMonthlyIncome)}</span>
            </div>
            <div className="cashflow-item">
              <span className="cashflow-label">월 지출</span>
              <span className="cashflow-value negative">-{formatCurrency(getNum('expense'))}</span>
            </div>
            <div className="cashflow-item highlight">
              <span className="cashflow-label">월 저축 가능액</span>
              <span className={`cashflow-value ${monthlySavings >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(monthlySavings)}
              </span>
            </div>
            <div className="cashflow-item">
              <span className="cashflow-label">연간 저축 가능액</span>
              <span className={`cashflow-value ${yearlySavings >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(yearlySavings)}
              </span>
            </div>
          </div>

          {totalMonthlyIncome > 0 && (
            <>
              <div className="savings-rate-section">
                <div className="savings-rate-header">
                  <span className="savings-rate-label">저축률</span>
                  <span className={`savings-rate-value ${
                    monthlySavings / totalMonthlyIncome >= 0.3 ? 'excellent' :
                    monthlySavings / totalMonthlyIncome >= 0.2 ? 'good' :
                    monthlySavings / totalMonthlyIncome >= 0.1 ? 'moderate' : 'low'
                  }`}>
                    {Math.round(monthlySavings / totalMonthlyIncome * 100)}%
                  </span>
                </div>
                <div className="savings-rate-bar">
                  <div
                    className={`savings-rate-fill ${
                      monthlySavings / totalMonthlyIncome >= 0.3 ? 'excellent' :
                      monthlySavings / totalMonthlyIncome >= 0.2 ? 'good' :
                      monthlySavings / totalMonthlyIncome >= 0.1 ? 'moderate' : 'low'
                    }`}
                    style={{ width: `${Math.min(Math.max(monthlySavings / totalMonthlyIncome * 100, 0), 100)}%` }}
                  />
                  <div className="savings-rate-markers">
                    <span className="marker" style={{ left: '10%' }}>10%</span>
                    <span className="marker" style={{ left: '20%' }}>20%</span>
                    <span className="marker" style={{ left: '30%' }}>30%</span>
                    <span className="marker" style={{ left: '50%' }}>50%</span>
                  </div>
                </div>
              </div>

              <div className="cashflow-assessment">
                <h4>적정성 평가</h4>
                {monthlySavings / totalMonthlyIncome >= 0.3 ? (
                  <div className="assessment-result excellent">
                    <span className="assessment-icon">🌟</span>
                    <div className="assessment-content">
                      <span className="assessment-title">우수</span>
                      <span className="assessment-desc">
                        소득의 30% 이상을 저축하고 있습니다. 매우 훌륭한 저축 습관입니다!
                        재무 목표 달성을 위한 좋은 기반을 갖추고 있습니다.
                      </span>
                    </div>
                  </div>
                ) : monthlySavings / totalMonthlyIncome >= 0.2 ? (
                  <div className="assessment-result good">
                    <span className="assessment-icon">✓</span>
                    <div className="assessment-content">
                      <span className="assessment-title">양호</span>
                      <span className="assessment-desc">
                        소득의 20~30%를 저축하고 있습니다. 일반적으로 권장되는 저축률입니다.
                        지속적으로 유지하면 안정적인 자산 형성이 가능합니다.
                      </span>
                    </div>
                  </div>
                ) : monthlySavings / totalMonthlyIncome >= 0.1 ? (
                  <div className="assessment-result moderate">
                    <span className="assessment-icon">△</span>
                    <div className="assessment-content">
                      <span className="assessment-title">개선 필요</span>
                      <span className="assessment-desc">
                        소득의 10~20%를 저축하고 있습니다.
                        재무 목표 달성을 위해 저축률을 20% 이상으로 높이는 것을 권장합니다.
                        불필요한 지출 항목을 점검해 보세요.
                      </span>
                    </div>
                  </div>
                ) : monthlySavings > 0 ? (
                  <div className="assessment-result low">
                    <span className="assessment-icon">⚠</span>
                    <div className="assessment-content">
                      <span className="assessment-title">주의 필요</span>
                      <span className="assessment-desc">
                        소득의 10% 미만을 저축하고 있습니다.
                        지출 구조를 재점검하고, 고정비용 절감을 고려해 보세요.
                        장기적인 재무 안정을 위해 저축률을 높이는 것이 중요합니다.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="assessment-result negative">
                    <span className="assessment-icon">✗</span>
                    <div className="assessment-content">
                      <span className="assessment-title">적자 상태</span>
                      <span className="assessment-desc">
                        지출이 소득을 초과하고 있습니다. 즉각적인 지출 조정이 필요합니다.
                        필수 지출 외의 항목을 줄이고, 수입 증대 방안을 모색해 보세요.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="cashflow-tips">
                <h4>저축률 향상 가이드</h4>
                <ul>
                  <li><strong>50/30/20 원칙:</strong> 소득의 50%는 필수지출, 30%는 여유지출, 20%는 저축/투자</li>
                  <li><strong>저축 먼저:</strong> 급여 수령 시 저축액을 먼저 분리하는 습관</li>
                  <li><strong>고정비 점검:</strong> 구독서비스, 보험료 등 정기 지출 최적화</li>
                  <li><strong>목표 설정:</strong> 구체적인 저축 목표와 기간 설정</li>
                </ul>
              </div>
            </>
          )}

          {getNum('income') === 0 && (
            <div className="no-data">
              <p>월 소득과 지출을 입력하면 현금흐름 분석을 확인할 수 있습니다.</p>
            </div>
          )}
        </div>
      </section>

      {/* 지출 분석 */}
      <section className="insight-section">
        <h2>지출 분석</h2>
        <div className="expense-analysis">
          {(() => {
            // 2024년 가계동향조사 기준 소득분위별 월평균 소비지출 (만원)
            // 출처: 통계청 가계동향조사 2024년 연간
            const expenseByQuintile: { [key: number]: number } = {
              1: 139,  // 1분위: 약 139만원
              2: 195,  // 2분위: 약 195만원
              3: 255,  // 3분위: 약 255만원
              4: 330,  // 4분위: 약 330만원
              5: 490,  // 5분위: 약 490만원
            }

            // 가구원수별 보정계수 (2인가구 기준 = 1.0)
            // OECD 균등화 지수 기반 보정
            const memberMultiplier: { [key: number]: number } = {
              1: 0.73,   // 1인가구: 2인가구 대비 약 73%
              2: 1.0,    // 2인가구: 기준
              3: 1.26,   // 3인가구: 2인가구 대비 약 126%
              4: 1.52,   // 4인가구: 2인가구 대비 약 152%
              5: 1.74,   // 5인가구 이상: 2인가구 대비 약 174%
            }

            // 소득분위 경계 (연소득 기준, 만원)
            // 2024년 기준 추정치
            const quintileBoundaries: { [key: number]: { min: number; max: number; label: string } } = {
              1: { min: 0, max: 2400, label: '1분위 (하위 20%)' },
              2: { min: 2400, max: 4200, label: '2분위 (20~40%)' },
              3: { min: 4200, max: 6000, label: '3분위 (40~60%)' },
              4: { min: 6000, max: 8400, label: '4분위 (60~80%)' },
              5: { min: 8400, max: Infinity, label: '5분위 (상위 20%)' },
            }

            // 사용자 소득분위 계산
            const calculateQuintile = (income: number): number => {
              if (income < 2400) return 1
              if (income < 4200) return 2
              if (income < 6000) return 3
              if (income < 8400) return 4
              return 5
            }

            const familyCount = data.family.length
            const memberKey = Math.min(familyCount, 5)
            const userExpense = getNum('expense')
            const userQuintile = calculateQuintile(totalYearlyIncome)

            // 소득분위별 기준 지출에 가구원수 보정 적용
            const baseExpenseByQuintile = expenseByQuintile[userQuintile]
            const adjustedAverageExpense = Math.round(baseExpenseByQuintile * memberMultiplier[memberKey])

            const expenseRatio = adjustedAverageExpense > 0 ? (userExpense / adjustedAverageExpense) * 100 : 0
            const expenseDiff = userExpense - adjustedAverageExpense

            return (
              <>
                {userExpense > 0 && totalYearlyIncome > 0 ? (
                  <>
                    <div className="expense-comparison-summary">
                      <div className="expense-item">
                        <span className="expense-label">가구원 수</span>
                        <span className="expense-value">{familyCount}인 가구</span>
                      </div>
                      <div className="expense-item">
                        <span className="expense-label">소득분위</span>
                        <span className="expense-value">{quintileBoundaries[userQuintile].label}</span>
                      </div>
                      <div className="expense-item">
                        <span className="expense-label">입력한 월 지출</span>
                        <span className="expense-value">{formatCurrency(userExpense)}</span>
                      </div>
                      <div className="expense-item">
                        <span className="expense-label">비교 기준 평균 지출</span>
                        <span className="expense-value">{formatCurrency(adjustedAverageExpense)}</span>
                      </div>
                      <div className="expense-item highlight">
                        <span className="expense-label">평균 대비</span>
                        <span className="expense-value">{expenseRatio.toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="expense-assessment">
                      <h4>지출 적정성 평가</h4>
                      <p className="assessment-basis">
                        ({userQuintile}분위 {familyCount}인가구 평균 지출 {formatCurrency(adjustedAverageExpense)} 기준)
                      </p>
                      {expenseRatio <= 80 ? (
                        <div className="assessment-result excellent">
                          <span className="assessment-icon">🌟</span>
                          <div className="assessment-content">
                            <span className="assessment-title">절약형</span>
                            <span className="assessment-desc">
                              동일 소득분위 {familyCount}인가구 평균보다 {formatCurrency(Math.abs(expenseDiff))} 적게 지출하고 있습니다.
                              효율적인 지출 관리를 하고 있으며, 여유 자금을 저축/투자에 활용할 수 있습니다.
                            </span>
                          </div>
                        </div>
                      ) : expenseRatio <= 100 ? (
                        <div className="assessment-result good">
                          <span className="assessment-icon">✓</span>
                          <div className="assessment-content">
                            <span className="assessment-title">적정 수준</span>
                            <span className="assessment-desc">
                              동일 소득분위 {familyCount}인가구 평균과 비슷한 수준으로 지출하고 있습니다.
                              전반적으로 적정한 지출 수준이며, 지속적인 관리가 중요합니다.
                            </span>
                          </div>
                        </div>
                      ) : expenseRatio <= 120 ? (
                        <div className="assessment-result moderate">
                          <span className="assessment-icon">△</span>
                          <div className="assessment-content">
                            <span className="assessment-title">다소 높음</span>
                            <span className="assessment-desc">
                              동일 소득분위 {familyCount}인가구 평균보다 {formatCurrency(expenseDiff)} 많이 지출하고 있습니다.
                              지출 항목을 점검하고 불필요한 지출을 줄여보세요.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="assessment-result low">
                          <span className="assessment-icon">⚠</span>
                          <div className="assessment-content">
                            <span className="assessment-title">과다 지출</span>
                            <span className="assessment-desc">
                              동일 소득분위 {familyCount}인가구 평균보다 {formatCurrency(expenseDiff)} ({(expenseRatio - 100).toFixed(0)}%) 많이 지출하고 있습니다.
                              지출 구조를 재점검하고, 고정비용 절감 방안을 모색해 보세요.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="quintile-info">
                      <h4>소득분위 기준 (연소득)</h4>
                      <div className="quintile-table">
                        <div className={`quintile-row ${userQuintile === 1 ? 'current' : ''}`}>
                          <span className="quintile-label">1분위</span>
                          <span className="quintile-value">~2,400만원</span>
                        </div>
                        <div className={`quintile-row ${userQuintile === 2 ? 'current' : ''}`}>
                          <span className="quintile-label">2분위</span>
                          <span className="quintile-value">2,400~4,200만원</span>
                        </div>
                        <div className={`quintile-row ${userQuintile === 3 ? 'current' : ''}`}>
                          <span className="quintile-label">3분위</span>
                          <span className="quintile-value">4,200~6,000만원</span>
                        </div>
                        <div className={`quintile-row ${userQuintile === 4 ? 'current' : ''}`}>
                          <span className="quintile-label">4분위</span>
                          <span className="quintile-value">6,000~8,400만원</span>
                        </div>
                        <div className={`quintile-row ${userQuintile === 5 ? 'current' : ''}`}>
                          <span className="quintile-label">5분위</span>
                          <span className="quintile-value">8,400만원~</span>
                        </div>
                      </div>
                      <p className="quintile-note">가계 연소득: {formatCurrency(totalYearlyIncome)} → {userQuintile}분위</p>
                    </div>

                    <div className="expense-reference">
                      <h4>소득분위별 평균 소비지출 (2024년 기준, {familyCount}인가구 보정)</h4>
                      <div className="reference-table">
                        <div className={`reference-row ${userQuintile === 1 ? 'current' : ''}`}>
                          <span className="reference-label">1분위 (하위 20%)</span>
                          <span className="reference-value">약 {Math.round(expenseByQuintile[1] * memberMultiplier[memberKey])}만원/월</span>
                        </div>
                        <div className={`reference-row ${userQuintile === 2 ? 'current' : ''}`}>
                          <span className="reference-label">2분위 (20~40%)</span>
                          <span className="reference-value">약 {Math.round(expenseByQuintile[2] * memberMultiplier[memberKey])}만원/월</span>
                        </div>
                        <div className={`reference-row ${userQuintile === 3 ? 'current' : ''}`}>
                          <span className="reference-label">3분위 (40~60%)</span>
                          <span className="reference-value">약 {Math.round(expenseByQuintile[3] * memberMultiplier[memberKey])}만원/월</span>
                        </div>
                        <div className={`reference-row ${userQuintile === 4 ? 'current' : ''}`}>
                          <span className="reference-label">4분위 (60~80%)</span>
                          <span className="reference-value">약 {Math.round(expenseByQuintile[4] * memberMultiplier[memberKey])}만원/월</span>
                        </div>
                        <div className={`reference-row ${userQuintile === 5 ? 'current' : ''}`}>
                          <span className="reference-label">5분위 (상위 20%)</span>
                          <span className="reference-value">약 {Math.round(expenseByQuintile[5] * memberMultiplier[memberKey])}만원/월</span>
                        </div>
                      </div>
                      <p className="reference-source">* 출처: 통계청 2024년 가계동향조사</p>
                      <p className="reference-source">* 2인가구 기준 데이터를 OECD 균등화 지수로 {familyCount}인가구에 맞게 보정</p>
                    </div>

                    
                  </>
                ) : userExpense > 0 && totalYearlyIncome === 0 ? (
                  <div className="no-data">
                    <p>월 소득을 입력하면 소득분위를 고려한 더 정확한 지출 분석을 확인할 수 있습니다.</p>
                  </div>
                ) : (
                  <div className="no-data">
                    <p>월 지출을 입력하면 지출 분석을 확인할 수 있습니다.</p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </section>

      {/* 투자 배분 추천 */}
      <section className="insight-section">
        <h2>연간 투자 배분 추천</h2>
        <p className="section-description">
          세액공제 혜택을 최대화하면서 자산을 효율적으로 배분하는 방법을 안내합니다.
          연금저축과 IRP 한도를 우선 채운 후 나머지를 일반 투자계좌에 배분합니다.
        </p>
        <div className="investment-summary">
          <div className="investment-header">
            <div className="yearly-amount">
              <span className="label">연간 저축 가능액</span>
              <span className="amount">{formatCurrency(yearlySavings)}</span>
            </div>
            <div className="monthly-equiv">
              월 {formatCurrency(monthlySavings)} × 12개월
            </div>
            {totalTaxRefund > 0 && (
              <div className="tax-benefit-summary">
                예상 세액공제 <strong>{formatCurrency(totalTaxRefund)}</strong> 환급
              </div>
            )}
          </div>

          {yearlySavings > 0 ? (
            <div className="allocation-list">
              <div className={`allocation-item ${investmentAllocation.pensionFund > 0 ? 'active' : 'inactive'}`}>
                <div className="allocation-info">
                  <span className="allocation-rank">1순위</span>
                  <span className="allocation-name">연금저축펀드</span>
                  <span className="allocation-benefit">세액공제 {TAX_DEDUCTION_RATE}%</span>
                </div>
                <div className="allocation-amount">
                  <span className="yearly">{investmentAllocation.pensionFund.toLocaleString()} 만원/년</span>
                  <span className="monthly">월 {Math.round(investmentAllocation.pensionFund / 12).toLocaleString()} 만원</span>
                </div>
                {pensionTaxRefund > 0 && (
                  <div className="tax-refund-detail">
                    세액공제: {pensionTaxDeductible.toLocaleString()}만원 × {TAX_DEDUCTION_RATE}% = <strong>{pensionTaxRefund.toLocaleString()}만원</strong> 환급
                  </div>
                )}
                <div className="account-details">
                  <span>연금 수령 시 3.3~5.5%</span>
                  <span>55세 이후 인출</span>
                  <span>과세이연</span>
                </div>
                <div className="allocation-bar">
                  <div
                    className="allocation-fill pension"
                    style={{ width: `${Math.min((investmentAllocation.pensionFund / 1500) * 100, 100)}%` }}
                  />
                </div>
                <div className="allocation-bar-label">
                  {investmentAllocation.pensionFund.toLocaleString()} / 1,500 만원
                </div>
              </div>

              <div className={`allocation-item ${investmentAllocation.irp > 0 ? 'active' : 'inactive'}`}>
                <div className="allocation-info">
                  <span className="allocation-rank">2순위</span>
                  <span className="allocation-name">IRP</span>
                  <span className="allocation-benefit">세액공제 {TAX_DEDUCTION_RATE}%</span>
                </div>
                <div className="allocation-amount">
                  <span className="yearly">{investmentAllocation.irp.toLocaleString()} 만원/년</span>
                  <span className="monthly">월 {Math.round(investmentAllocation.irp / 12).toLocaleString()} 만원</span>
                </div>
                {irpTaxRefund > 0 && (
                  <div className="tax-refund-detail">
                    세액공제: {irpTaxDeductible.toLocaleString()}만원 × {TAX_DEDUCTION_RATE}% = <strong>{irpTaxRefund.toLocaleString()}만원</strong> 환급
                  </div>
                )}
                <div className="account-details">
                  <span>연금 수령 시 3.3~5.5%</span>
                  <span>55세 이후 인출</span>
                  <span>퇴직금 이전 가능</span>
                </div>
                <div className="allocation-bar">
                  <div
                    className="allocation-fill irp"
                    style={{ width: `${Math.min((investmentAllocation.irp / 300) * 100, 100)}%` }}
                  />
                </div>
                <div className="allocation-bar-label">
                  {investmentAllocation.irp.toLocaleString()} / 300 만원
                </div>
              </div>

              <div className={`allocation-item ${investmentAllocation.isa > 0 ? 'active' : 'inactive'}`}>
                <div className="allocation-info">
                  <span className="allocation-rank">3순위</span>
                  <span className="allocation-name">ISA</span>
                  <span className="allocation-benefit">비과세 200만원 + 9.9% 분리과세</span>
                </div>
                <div className="allocation-amount">
                  <span className="yearly">{investmentAllocation.isa.toLocaleString()} 만원/년</span>
                  <span className="monthly">월 {Math.round(investmentAllocation.isa / 12).toLocaleString()} 만원</span>
                </div>
                <div className="account-details">
                  <span>3~5년 만기</span>
                  <span>연금계좌 전환 시 추가 세액공제</span>
                  <span>과세이연</span>
                </div>
                <div className="allocation-bar">
                  <div
                    className="allocation-fill isa"
                    style={{ width: `${Math.min((investmentAllocation.isa / 2000) * 100, 100)}%` }}
                  />
                </div>
                <div className="allocation-bar-label">
                  {investmentAllocation.isa.toLocaleString()} / 2,000 만원
                </div>
              </div>

              <div className={`allocation-item ${investmentAllocation.general > 0 ? 'active' : 'inactive'}`}>
                <div className="allocation-info">
                  <span className="allocation-rank">4순위</span>
                  <span className="allocation-name">일반 해외주식계좌</span>
                  <span className="allocation-benefit">양도세 22% (250만원 비과세)</span>
                </div>
                <div className="allocation-amount">
                  <span className="yearly">{investmentAllocation.general.toLocaleString()} 만원/년</span>
                  <span className="monthly">월 {Math.round(investmentAllocation.general / 12).toLocaleString()} 만원</span>
                </div>
                <div className="account-details">
                  <span>한도 없음</span>
                  <span>미국 ETF 직접 투자</span>
                  <span>자유로운 인출</span>
                </div>
                <div className="allocation-bar-label no-limit">
                  한도 없음 (초과분 배분)
                </div>
              </div>
            </div>
          ) : (
            <div className="no-savings">
              <p>월 소득과 지출을 입력하면 투자 배분 추천을 확인할 수 있습니다.</p>
            </div>
          )}

          {/* 배우자 있는 경우 개인별 배분 표시 */}
          {data.isMarried && spouseYearlyIncome > 0 && yearlySavings > 0 && (
            <div className="couple-allocation-detail">
              <h4>본인/배우자 배분 상세</h4>
              <div className="couple-allocation-grid">
                <div className="person-allocation">
                  <div className="person-header">
                    <span className="person-label">본인</span>
                    <span className="person-income">연소득 {yearlyIncome.toLocaleString()}만원</span>
                    <span className="person-rate">세액공제율 {TAX_DEDUCTION_RATE}%</span>
                  </div>
                  <div className="person-items">
                    <div className="person-item">
                      <span>연금저축</span>
                      <span>{coupleAllocation.personal.pensionFund.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item">
                      <span>IRP</span>
                      <span>{coupleAllocation.personal.irp.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item">
                      <span>ISA</span>
                      <span>{coupleAllocation.personal.isa.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item">
                      <span>일반계좌</span>
                      <span>{coupleAllocation.personal.general.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item total">
                      <span>세액공제 환급</span>
                      <span className="refund">{personalTotalRefund.toLocaleString()}만원</span>
                    </div>
                  </div>
                </div>
                <div className="person-allocation spouse">
                  <div className="person-header">
                    <span className="person-label">배우자</span>
                    <span className="person-income">연소득 {spouseYearlyIncome.toLocaleString()}만원</span>
                    <span className="person-rate">세액공제율 {SPOUSE_TAX_DEDUCTION_RATE}%</span>
                  </div>
                  <div className="person-items">
                    <div className="person-item">
                      <span>연금저축</span>
                      <span>{coupleAllocation.spouse.pensionFund.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item">
                      <span>IRP</span>
                      <span>{coupleAllocation.spouse.irp.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item">
                      <span>ISA</span>
                      <span>{coupleAllocation.spouse.isa.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item">
                      <span>일반계좌</span>
                      <span>{coupleAllocation.spouse.general.toLocaleString()}만원</span>
                    </div>
                    <div className="person-item total">
                      <span>세액공제 환급</span>
                      <span className="refund">{spouseTotalRefund.toLocaleString()}만원</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="couple-total-refund">
                가계 총 세액공제 환급: <strong>{totalTaxRefund.toLocaleString()}만원</strong>
              </div>
            </div>
          )}

          <div className="allocation-note">
            <h4>배분 원칙</h4>
            <div className="tax-rate-info">
              {data.isMarried && spouseYearlyIncome > 0 ? (
                <>
                  본인 연소득 {yearlyIncome.toLocaleString()}만원 (세액공제율 <strong>{TAX_DEDUCTION_RATE}%</strong>)
                  {' / '}
                  배우자 연소득 {spouseYearlyIncome.toLocaleString()}만원 (세액공제율 <strong>{SPOUSE_TAX_DEDUCTION_RATE}%</strong>)
                </>
              ) : (
                <>
                  연소득 {yearlyIncome.toLocaleString()}만원 → 세액공제율 <strong>{TAX_DEDUCTION_RATE}%</strong> 적용
                  {yearlyIncome > 5500 && <span className="tax-note">(5,500만원 초과)</span>}
                </>
              )}
            </div>
            <ul>
              <li><strong>1단계 (0~900만원):</strong> 연금저축 600만원 + IRP 300만원으로 세액공제 혜택 최대화 (세액공제 한도 900만원)</li>
              <li><strong>2단계 (900~1,800만원):</strong> 연금저축으로 추가 납입. 세액공제는 없지만 과세이연 혜택, IRP보다 유동성이 좋음</li>
              <li><strong>3단계 (1,800~3,800만원):</strong> ISA로 배분. 비과세 200만원 + 초과분 9.9% 분리과세</li>
              <li><strong>4단계 (3,800만원 초과):</strong> 일반 주식계좌로 투자</li>
            </ul>
            <p className="limit-note">* 세액공제 한도: 연금저축 + IRP 합산 연 900만원 / 납입 한도: 합산 연 1,800만원 (1인 기준)</p>
            {data.isMarried && spouseYearlyIncome > 0 && (
              <p className="limit-note couple-note">* 맞벌이 부부는 각자 한도가 별도 적용되어 세액공제 한도 합계 1,800만원까지 가능</p>
            )}
          </div>
        </div>
      </section>

      {/* 은퇴 목표 달성 분석 */}
      <section className="insight-section">
        <h2>은퇴 목표 달성 분석</h2>
        <div className="retirement-analysis">
          <div className="analysis-option">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useFinancialAssetOnly}
                onChange={(e) => setUseFinancialAssetOnly(e.target.checked)}
              />
              금융자산만으로 계산 (주거 자산 제외)
            </label>
            {useFinancialAssetOnly && (
              <p className="option-detail">
                포함: 예적금 + 주식/펀드 + 기타금융 + 퇴직연금 + 개인연금 - 기타부채
              </p>
            )}
          </div>
          {yearsToRetirement > 0 && targetAsset > 0 ? (
            <>
              <div className="analysis-summary">
                <div className="analysis-item">
                  <span className="analysis-label">
                    {useFinancialAssetOnly ? '현재 금융자산' : '현재 순자산'}
                  </span>
                  <span className="analysis-value">{formatCurrency(analysisAsset)}</span>
                </div>
                <div className="analysis-item">
                  <span className="analysis-label">은퇴 목표 자산</span>
                  <span className="analysis-value">{formatCurrency(targetAsset)}</span>
                </div>
                <div className="analysis-item">
                  <span className="analysis-label">자산 갭</span>
                  <span className={`analysis-value ${assetGap > 0 ? 'negative' : 'positive'}`}>
                    {assetGap > 0 ? '+' : ''}{formatCurrency(Math.abs(assetGap))}
                  </span>
                </div>
                <div className="analysis-item">
                  <span className="analysis-label">은퇴까지 남은 기간</span>
                  <span className="analysis-value">{yearsToRetirement}년</span>
                </div>
              </div>

              <div className="required-return-section">
                <div className="required-return-header">
                  <span className="required-return-label">목표 달성에 필요한 연평균 수익률</span>
                </div>
                {requiredReturn !== null ? (
                  <div className="required-return-display">
                    <span className={`required-return-value ${requiredReturn <= 0 ? 'achieved' : requiredReturn <= 7 ? 'easy' : requiredReturn <= 12 ? 'moderate' : 'hard'}`}>
                      {requiredReturn <= 0 ? '달성 완료!' : `${requiredReturn.toFixed(1)}%`}
                    </span>
                    {requiredReturn > 0 && (
                      <span className="required-return-assessment">
                        {requiredReturn <= 5 && '(보수적 투자로 달성 가능)'}
                        {requiredReturn > 5 && requiredReturn <= 7 && '(균형잡힌 투자로 달성 가능)'}
                        {requiredReturn > 7 && requiredReturn <= 10 && '(적극적 투자 필요)'}
                        {requiredReturn > 10 && requiredReturn <= 15 && '(공격적 투자 필요, 높은 위험)'}
                        {requiredReturn > 15 && '(달성 어려움, 목표 재검토 권장)'}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="required-return-display">
                    <span className="required-return-value empty">-</span>
                  </div>
                )}
                <div className="return-calculation-note">
                  <p>* 현재 자산 {formatCurrency(analysisAsset)}에서 시작하여</p>
                  <p>* 매년 {formatCurrency(yearlySavings)}씩 저축하면서</p>
                  <p>* {yearsToRetirement}년 후 {formatCurrency(targetAsset)} 달성 기준</p>
                </div>
              </div>

              <div className="return-reference-container">
                <div className="return-reference">
                  <h4>자산별 기대 수익률</h4>
                  <ul>
                    <li><strong>예금:</strong> 연 2~3%</li>
                    <li><strong>채권:</strong> 연 3~5%</li>
                    <li><strong>국내 주식 (KOSPI):</strong> 연 4~6%</li>
                    <li><strong>글로벌 분산 투자:</strong> 연 6~8%</li>
                    <li><strong>미국 S&P500:</strong> 연 8~10%</li>
                  </ul>
                </div>
                <div className="return-reference investors">
                  <h4>전설적 투자자 연평균 수익률</h4>
                  <ul>
                    <li><strong>워렌 버핏:</strong> 연 ~20% (1965~)</li>
                    <li><strong>피터 린치:</strong> 연 ~29% (1977~1990)</li>
                    <li><strong>조지 소로스:</strong> 연 ~30% (1969~2000)</li>
                    <li><strong>레이 달리오:</strong> 연 ~12% (1991~)</li>
                    <li><strong>짐 사이먼스:</strong> 연 ~66% (1988~2018)</li>
                  </ul>
                  <p className="investor-note">* 일반 투자자가 달성하기 어려운 수치입니다</p>
                </div>
              </div>
            </>
          ) : (
            <div className="no-data">
              <p>현재 나이, 목표 은퇴 연령, 은퇴시점 목표 자산을 입력하면 분석 결과를 확인할 수 있습니다.</p>
            </div>
          )}
        </div>
      </section>

      {/* 포트폴리오 추천 */}
      <section className="insight-section">
        <h2>포트폴리오 추천</h2>
        <div className="portfolio-section">
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

          <div className="portfolio-content">
            <div className="portfolio-header">
              <div className="portfolio-title">
                <span className="portfolio-name">{currentPortfolio.name} 포트폴리오</span>
                <span className="portfolio-risk">위험도: {currentPortfolio.risk}</span>
              </div>
              <p className="portfolio-description">{currentPortfolio.description}</p>
            </div>

            <div className="portfolio-stats">
              <div className="stat-item">
                <span className="stat-label">기대 수익률</span>
                <span className="stat-value primary">
                  연 {currentPortfolio.expectedReturn.min}% ~ {currentPortfolio.expectedReturn.max}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">역사적 평균 수익률</span>
                <span className="stat-value">{currentPortfolio.historicalReturn}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">최대 낙폭 (MDD)</span>
                <span className="stat-value negative">{currentPortfolio.maxDrawdown}%</span>
              </div>
            </div>

            {requiredReturn !== null && requiredReturn > 0 && (
              <div className={`goal-match ${canAchieveGoal ? 'achievable' : 'difficult'}`}>
                {canAchieveGoal
                  ? `✓ 목표 수익률 ${requiredReturn.toFixed(1)}% 달성 가능`
                  : `✗ 목표 수익률 ${requiredReturn.toFixed(1)}% 달성 어려움`}
              </div>
            )}

            <div className="allocation-chart">
              <div className="allocation-bars">
                {currentPortfolio.allocation.map((item, index) => (
                  <div
                    key={index}
                    className="allocation-segment"
                    style={{ width: `${item.ratio}%`, backgroundColor: item.color }}
                  />
                ))}
              </div>
            </div>

            <div className="etf-list">
              <div
                className="etf-list-header"
                onClick={() => setShowEtfDetails(!showEtfDetails)}
              >
                <h4>ETF 구성</h4>
                <span className={`etf-toggle-icon ${showEtfDetails ? 'open' : ''}`}>▼</span>
              </div>

              <div className="etf-summary">
                {currentPortfolio.allocation.map((item, index) => (
                  <div key={index} className="etf-summary-item">
                    <span className="etf-color" style={{ backgroundColor: item.color }} />
                    <span className="etf-ticker">{item.ticker}</span>
                    <span className="etf-ratio">{item.ratio}%</span>
                  </div>
                ))}
              </div>

              {showEtfDetails && (
                <div className="etf-details-list">
                  {currentPortfolio.allocation.map((item, index) => (
                    <div key={index} className="etf-item">
                      <div className="etf-header">
                        <span className="etf-color" style={{ backgroundColor: item.color }} />
                        <div className="etf-info">
                          <span className="etf-name">{item.name}</span>
                          <span className="etf-ticker">{item.ticker}</span>
                        </div>
                        <span className="etf-ratio">{item.ratio}%</span>
                      </div>
                      <div className="etf-details">
                        <span className="etf-description">{item.description}</span>
                        <div className="etf-metrics">
                          <span className="etf-metric">평균 수익률: {item.avgReturn}%</span>
                          <span className="etf-metric">변동성: {item.volatility}%</span>
                        </div>
                      </div>
                      {yearlySavings > 0 && (
                        <div className="etf-amount">
                          연간 배분: <strong>{formatCurrency(Math.round(yearlySavings * item.ratio / 100))}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="portfolio-note">
              <p>* ETF 구성은 예시이며, 실제 투자 결정 시 참고용으로만 활용하세요</p>
              <p>* 수익률은 과거 10년 평균 기준이며, 미래 수익을 보장하지 않습니다</p>
              <p>* 실제 투자 시 환율 변동, 수수료 등을 고려해야 합니다</p>
            </div>
          </div>
        </div>
      </section>

      {/* 은퇴 후 현금흐름 분석 */}
      <section className="insight-section">
        <h2>은퇴 후 현금흐름 분석</h2>
        <div className="retirement-cashflow">
          {getNum('targetRetirementAge') > 0 && getNum('currentAge') > 0 ? (
            (() => {
              // 선택한 포트폴리오의 역사적 평균 수익률
              const annualReturn = currentPortfolio.historicalReturn / 100

              // 은퇴까지 남은 기간
              const years = yearsToRetirement > 0 ? yearsToRetirement : 0

              // DC형 퇴직연금 연간 불입액: 연소득의 1/12 (회사 부담)
              const yearlyDCContribution = Math.round(yearlyIncome / 12)

              // 퇴직연금: 현재 적립액 + 매년 DC 불입 + 수익률 적용
              // FV = PV * (1+r)^n + PMT * ((1+r)^n - 1) / r
              const calculateFutureValue = (pv: number, pmt: number, r: number, n: number) => {
                if (n <= 0) return pv
                if (r === 0) return pv + pmt * n
                const factor = Math.pow(1 + r, n)
                return pv * factor + pmt * (factor - 1) / r
              }

              // 퇴직연금 은퇴시점 예상 적립액 (현재 + DC형 연간 불입 + 수익률)
              const retirementPensionFV = calculateFutureValue(
                getNum('retirementPension'),
                yearlyDCContribution,
                annualReturn,
                years
              )

              // 개인연금 은퇴시점 예상 적립액 (현재 + 연금저축펀드 연간 불입 + 수익률)
              const privatePensionFV = calculateFutureValue(
                getNum('privatePension'),
                investmentAllocation.pensionFund,
                annualReturn,
                years
              )

              // 월 인출액 (20년 기준)
              const retirementPensionMonthly = Math.round(retirementPensionFV / 240)
              const privatePensionMonthly = Math.round(privatePensionFV / 240)
              const totalMonthlyIncome = getNum('nationalPension') + retirementPensionMonthly + privatePensionMonthly

              return (
                <>
                  <div className="retirement-assumptions">
                    <h4>계산 가정</h4>
                    <div className="assumption-grid">
                      <div className="assumption-item">
                        <span className="assumption-label">적용 수익률</span>
                        <span className="assumption-value">{currentPortfolio.historicalReturn}% ({currentPortfolio.name} 포트폴리오)</span>
                      </div>
                      <div className="assumption-item">
                        <span className="assumption-label">은퇴까지 남은 기간</span>
                        <span className="assumption-value">{years}년</span>
                      </div>
                      <div className="assumption-item">
                        <span className="assumption-label">퇴직연금 연간 불입</span>
                        <span className="assumption-value">{formatCurrency(yearlyDCContribution)} (연봉의 1/12)</span>
                      </div>
                      <div className="assumption-item">
                        <span className="assumption-label">연간 연금저축 불입</span>
                        <span className="assumption-value">{formatCurrency(investmentAllocation.pensionFund)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pension-projection">
                    <h4>은퇴시점 연금 예상 적립액</h4>
                    <div className="projection-grid">
                      <div className="projection-item">
                        <div className="projection-header">
                          <span className="projection-label">퇴직연금 (DC형)</span>
                        </div>
                        <div className="projection-detail">
                          <span className="detail-row">현재 적립액: {formatCurrency(getNum('retirementPension'))}</span>
                          <span className="detail-row">+ 연간 불입: {formatCurrency(yearlyDCContribution)} × {years}년</span>
                          <span className="detail-row">+ 수익률 {currentPortfolio.historicalReturn}% 복리 적용</span>
                        </div>
                        <span className="projection-value">{formatCurrency(Math.round(retirementPensionFV))}</span>
                      </div>
                      <div className="projection-item">
                        <div className="projection-header">
                          <span className="projection-label">개인연금 (연금저축)</span>
                        </div>
                        <div className="projection-detail">
                          <span className="detail-row">현재 적립액: {formatCurrency(getNum('privatePension'))}</span>
                          <span className="detail-row">+ 연간 불입: {formatCurrency(investmentAllocation.pensionFund)} × {years}년</span>
                          <span className="detail-row">+ 수익률 {currentPortfolio.historicalReturn}% 복리 적용</span>
                        </div>
                        <span className="projection-value">{formatCurrency(Math.round(privatePensionFV))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="retirement-cashflow-summary">
                    <div className="cashflow-item">
                      <span className="cashflow-label">국민연금 <br></br>(예상 월 수령액)</span>
                      <span className="cashflow-value positive">{formatCurrency(getNum('nationalPension'))}</span>
                    </div>
                    <div className="cashflow-item">
                      <span className="cashflow-label">퇴직연금 월 인출액 <br></br>(20년 기준)</span>
                      <span className="cashflow-value positive">
                        {formatCurrency(retirementPensionMonthly)}
                      </span>
                    </div>
                    <div className="cashflow-item">
                      <span className="cashflow-label">개인연금 월 인출액 <br></br>(20년 기준)</span>
                      <span className="cashflow-value positive">
                        {formatCurrency(privatePensionMonthly)}
                      </span>
                    </div>
                    <div className="cashflow-item highlight">
                      <span className="cashflow-label">예상 월 수입 합계</span>
                      <span className="cashflow-value">
                        {formatCurrency(totalMonthlyIncome)}
                      </span>
                    </div>
                  </div>

                  <div className="retirement-cashflow-analysis">
                    <div className="analysis-header">
                      <h4>은퇴 후 생활비 충당 분석</h4>
                      <label className="inflation-toggle">
                        <input
                          type="checkbox"
                          checked={applyInflation}
                          onChange={(e) => setApplyInflation(e.target.checked)}
                        />
                        <span>물가상승률 반영 (연 3%)</span>
                      </label>
                    </div>
                    {(() => {
                      const yearsToRetirement = getNum('targetRetirementAge') - getNum('currentAge')
                      const inflationMultiplier = applyInflation ? Math.pow(1.03, yearsToRetirement) : 1
                      const adjustedExpense = Math.round(getNum('expense') * inflationMultiplier)
                      const adjustedRetirementExpense = Math.round(adjustedExpense * 0.7)

                      return (
                        <div className="expense-comparison">
                          <div className="comparison-row">
                            <span className="comparison-label">
                              {applyInflation ? `은퇴 시점 예상 월 지출 (${yearsToRetirement}년 후)` : '현재 월 지출'}
                            </span>
                            <span className="comparison-value">
                              {formatCurrency(adjustedExpense)}
                              {applyInflation && (
                                <span className="inflation-note"> (현재 {formatCurrency(getNum('expense'))})</span>
                              )}
                            </span>
                          </div>
                          <div className="comparison-row">
                            <span className="comparison-label">은퇴 후 예상 지출 (70%)</span>
                            <span className="comparison-value">{formatCurrency(adjustedRetirementExpense)}</span>
                          </div>
                          <div className="comparison-row">
                            <span className="comparison-label">연금 수입으로 충당률</span>
                            <span className={`comparison-value ${
                              adjustedRetirementExpense > 0 && (totalMonthlyIncome / adjustedRetirementExpense) >= 1 ? 'positive' : 'negative'
                            }`}>
                              {adjustedRetirementExpense > 0
                                ? `${Math.round((totalMonthlyIncome / adjustedRetirementExpense) * 100)}%`
                                : '-'}
                            </span>
                          </div>
                          {adjustedRetirementExpense > 0 && (
                            <div className="comparison-row gap">
                              <span className="comparison-label">월 부족/여유 금액</span>
                              <span className={`comparison-value ${
                                totalMonthlyIncome - adjustedRetirementExpense >= 0 ? 'positive' : 'negative'
                              }`}>
                                {formatCurrency(totalMonthlyIncome - adjustedRetirementExpense)}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  <div className="retirement-cashflow-note">
                    <p>* 퇴직연금: DC형 가정, 연봉의 1/12 (약 8.33%)를 매년 불입</p>
                    <p>* 개인연금: 투자 배분 추천에 따른 연금저축펀드 금액을 매년 불입</p>
                    <p>* 투자 수익률: {currentPortfolio.name} 포트폴리오 역사적 평균 {currentPortfolio.historicalReturn}% 적용</p>
                    <p>* 은퇴 후 20년(240개월) 균등 인출 가정</p>
                    <p>* 은퇴 후 생활비는 현재 지출의 70% 수준으로 가정</p>
                    {applyInflation
                      ? <p>* 물가상승률 연 3% 반영 (은퇴 시점 기준 화폐가치)</p>
                      : <p>* 물가상승률은 미반영, 실제 가치는 다를 수 있습니다</p>
                    }
                  </div>
                </>
              )
            })()
          ) : (
            <div className="no-data">
              <p>현재 나이와 목표 은퇴 연령을 입력하면 은퇴 후 현금흐름을 분석할 수 있습니다.</p>
            </div>
          )}
        </div>
      </section>

      {/* 은퇴 후 연금 인출 전략 */}
      <section className="insight-section">
        <h2>은퇴 후 연금 인출 전략</h2>
        <div className="pension-withdrawal-strategy">
          <div className="tax-strategy-grid">
            <div className="tax-strategy-item">
              <span className="strategy-title">연금소득세 구조</span>
              <div className="strategy-content">
                <div className="strategy-table">
                  <div className="strategy-row header">
                    <span>수령 나이</span>
                    <span>연금소득세율</span>
                  </div>
                  <div className="strategy-row">
                    <span>55~69세</span>
                    <span>5.5%</span>
                  </div>
                  <div className="strategy-row">
                    <span>70~79세</span>
                    <span>4.4%</span>
                  </div>
                  <div className="strategy-row">
                    <span>80세 이상</span>
                    <span>3.3%</span>
                  </div>
                </div>
                <p className="strategy-note">* 일시금 수령 시 기타소득세 16.5% 부과</p>
              </div>
            </div>

            <div className="tax-strategy-item">
              <span className="strategy-title">최적 인출 전략</span>
              <div className="strategy-content">
                <ul className="strategy-list">
                  <li><strong>연 1,500만원 이하:</strong> 분리과세 선택으로 종합소득세 회피</li>
                  <li><strong>연 1,500만원 초과:</strong> 종합과세 대상, 다른 소득과 합산</li>
                  <li><strong>국민연금:</strong> 연금소득으로 종합과세 대상 (연 350만원 초과분)</li>
                  <li><strong>퇴직연금 → 개인연금:</strong> 순서대로 인출 시 세금 최적화</li>
                </ul>
              </div>
            </div>

            <div className="tax-strategy-item full-width">
              <span className="strategy-title">맞춤 인출 시뮬레이션</span>
              <div className="strategy-content">
                {(() => {
                  const nationalPensionMonthly = getNum('nationalPension')
                  const nationalPensionYearly = nationalPensionMonthly * 12

                  // 은퇴시점 예상 적립액 계산 (은퇴 후 현금흐름 분석과 동일한 로직)
                  const annualReturn = currentPortfolio.historicalReturn / 100
                  const years = yearsToRetirement > 0 ? yearsToRetirement : 0
                  const yearlyDCContribution = Math.round(yearlyIncome / 12)

                  const calculateFutureValue = (pv: number, pmt: number, r: number, n: number) => {
                    if (n <= 0) return pv
                    if (r === 0) return pv + pmt * n
                    const factor = Math.pow(1 + r, n)
                    return pv * factor + pmt * (factor - 1) / r
                  }

                  // 퇴직연금 은퇴시점 예상 적립액
                  const retirementPensionFV = calculateFutureValue(
                    getNum('retirementPension'),
                    yearlyDCContribution,
                    annualReturn,
                    years
                  )

                  // 개인연금 은퇴시점 예상 적립액
                  const privatePensionFV = calculateFutureValue(
                    getNum('privatePension'),
                    investmentAllocation.pensionFund,
                    annualReturn,
                    years
                  )

                  // 사적연금 은퇴시점 총 예상 적립액 (퇴직연금 + 개인연금)
                  const privatePensionTotal = Math.round(retirementPensionFV + privatePensionFV)

                  // 인출 기간에 따른 연간/월간 인출액 계산
                  const yearlyWithdrawal = privatePensionTotal > 0 ? Math.round(privatePensionTotal / pensionWithdrawalYears) : 0
                  const monthlyWithdrawal = Math.round(yearlyWithdrawal / 12)

                  // 분리과세 한도 초과 여부
                  const isOverLimit = yearlyWithdrawal > 1500
                  const overLimitAmount = Math.max(0, yearlyWithdrawal - 1500)

                  // 권장 인출 기간 (분리과세 유지)
                  const recommendedYears = privatePensionTotal > 0 ? Math.ceil(privatePensionTotal / 1500) : 0

                  // 연금소득세 계산 (나이에 따른 세율)
                  const retirementAge = getNum('targetRetirementAge') || 60
                  // 55-69세: 5.5%, 70-79세: 4.4%, 80세 이상: 3.3%
                  const getPensionTaxRate = (age: number) => {
                    if (age >= 80) return 3.3
                    if (age >= 70) return 4.4
                    return 5.5
                  }

                  // 인출 기간 동안의 평균 세율 (은퇴 시점부터 시작)
                  const avgTaxRate = getPensionTaxRate(retirementAge + Math.floor(pensionWithdrawalYears / 2))

                  // 분리과세 시 세액 (한도 내)
                  const separateTaxableAmount = Math.min(yearlyWithdrawal, 1500)
                  const separateTax = Math.round(separateTaxableAmount * (avgTaxRate / 100))

                  // 종합과세 시 추가 세액 (한도 초과분, 가정: 15% 세율)
                  const comprehensiveTax = Math.round(overLimitAmount * 0.15)

                  // 연간 총 예상 세액
                  const totalAnnualTax = separateTax + comprehensiveTax

                  return (
                    <div className="simulation-result">
                      <div className="simulation-row">
                        <span className="sim-label">예상 국민연금 (연간)</span>
                        <span className="sim-value">{formatCurrency(nationalPensionYearly)}</span>
                      </div>
                      <div className="simulation-row">
                        <span className="sim-label">사적연금 은퇴시점 예상 적립액</span>
                        <span className="sim-value">{formatCurrency(privatePensionTotal)}</span>
                      </div>
                      <div className="simulation-row">
                        <span className="sim-label">권장 인출 기간 (분리과세 유지)</span>
                        <span className={`sim-value ${recommendedYears <= 25 ? 'positive' : 'negative'}`}>
                          최소 {recommendedYears}년
                        </span>
                      </div>

                      {privatePensionTotal > 0 && (
                        <>
                          <div className="withdrawal-slider-section">
                            <div className="slider-header">
                              <span className="slider-label">인출 기간 설정</span>
                              <span className="slider-value">{pensionWithdrawalYears}년</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="40"
                              value={pensionWithdrawalYears}
                              onChange={(e) => setPensionWithdrawalYears(Number(e.target.value))}
                              className="withdrawal-slider"
                            />
                            <div className="slider-range">
                              <span>10년</span>
                              <span>40년</span>
                            </div>
                          </div>

                          <div className="withdrawal-result">
                            <div className="result-row">
                              <span>사적연금 연간 인출액</span>
                              <span className={isOverLimit ? 'warning' : 'good'}>{formatCurrency(yearlyWithdrawal)}</span>
                            </div>
                            <div className="result-row">
                              <span>사적연금 월 인출액</span>
                              <span>{formatCurrency(monthlyWithdrawal)}</span>
                            </div>
                            <div className="result-row">
                              <span>분리과세 한도</span>
                              <span>연 1,500만원</span>
                            </div>
                            {isOverLimit && (
                              <div className="result-row warning-row">
                                <span>한도 초과액 (종합과세)</span>
                                <span className="warning">{formatCurrency(overLimitAmount)}</span>
                              </div>
                            )}
                          </div>

                          <div className="tax-estimate">
                            <div className="tax-estimate-header">
                              <span>예상 연간 세액</span>
                              <span className="tax-estimate-total">{formatCurrency(totalAnnualTax)}</span>
                            </div>
                            <div className="tax-breakdown">
                              <div className="tax-item">
                                <span>분리과세 ({avgTaxRate}%)</span>
                                <span>{formatCurrency(separateTax)}</span>
                              </div>
                              {comprehensiveTax > 0 && (
                                <div className="tax-item warning">
                                  <span>종합과세 추가 (약 15%)</span>
                                  <span>{formatCurrency(comprehensiveTax)}</span>
                                </div>
                              )}
                            </div>
                            <p className="tax-note-small">
                              * 분리과세 세율: 55-69세 5.5%, 70-79세 4.4%, 80세+ 3.3%
                            </p>
                          </div>
                        </>
                      )}

                      <div className="simulation-tip">
                        <p><strong>국민연금:</strong> 종합과세 대상으로 분리과세 한도(1,500만원)와 무관합니다.</p>
                        <p><strong>사적연금:</strong> 연 1,500만원 이하 인출 시 분리과세(3.3~5.5%) 선택 가능. 초과 시 종합과세됩니다.</p>
                        {isOverLimit && (
                          <p className="tip-warning"><strong>주의:</strong> 현재 설정({pensionWithdrawalYears}년)으로는 분리과세 한도를 초과합니다. 인출 기간을 {recommendedYears}년 이상으로 늘리면 분리과세 혜택을 유지할 수 있습니다.</p>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 절세 인사이트 */}
      <section className="insight-section">
        <h2>절세 인사이트</h2>
        <div className="tax-insight">
          {(() => {
            // 세액공제 관련 계산
            const pensionFundAmount = investmentAllocation.pensionFund
            const irpAmount = investmentAllocation.irp
            const totalPensionContribution = pensionFundAmount + irpAmount

            // 세액공제율 (총급여 5,500만원 이하 16.5%, 초과 13.2%)
            const taxCreditRate = yearlyIncome <= 5500 ? 0.165 : 0.132
            const taxCreditRatePercent = yearlyIncome <= 5500 ? '16.5%' : '13.2%'

            // 연금저축 세액공제 한도: 600만원 (IRP 포함 시 900만원)
            const pensionFundLimit = 600
            const totalLimit = 900

            // 실제 세액공제 금액 계산
            const pensionFundCredit = Math.min(pensionFundAmount, pensionFundLimit) * taxCreditRate
            const irpCredit = Math.min(irpAmount, totalLimit - Math.min(pensionFundAmount, pensionFundLimit)) * taxCreditRate
            const totalTaxCredit = Math.round(pensionFundCredit + irpCredit)

            // 추가 절세 가능 금액 계산
            const remainingPensionLimit = Math.max(0, pensionFundLimit - pensionFundAmount)
            const remainingIrpLimit = Math.max(0, totalLimit - totalPensionContribution)
            const potentialAdditionalCredit = Math.round(
              (remainingPensionLimit + remainingIrpLimit) * taxCreditRate
            )

            // 소득세율 구간 (2024년 기준)
            const getIncomeTaxBracket = (income: number) => {
              if (income <= 1400) return { rate: 6, bracket: '1,400만원 이하' }
              if (income <= 5000) return { rate: 15, bracket: '1,400~5,000만원' }
              if (income <= 8800) return { rate: 24, bracket: '5,000~8,800만원' }
              if (income <= 15000) return { rate: 35, bracket: '8,800~1.5억원' }
              if (income <= 30000) return { rate: 38, bracket: '1.5억~3억원' }
              if (income <= 50000) return { rate: 40, bracket: '3억~5억원' }
              if (income <= 100000) return { rate: 42, bracket: '5억~10억원' }
              return { rate: 45, bracket: '10억원 초과' }
            }

            const taxBracket = getIncomeTaxBracket(yearlyIncome)

            // 절세 팁 생성
            const taxTips: { priority: number; category: string; title: string; description: string; amount?: number }[] = []

            // 1. 연금저축 추가 납입 가능 여부
            if (remainingPensionLimit > 0) {
              taxTips.push({
                priority: 1,
                category: '연금저축',
                title: `연금저축 ${formatCurrency(remainingPensionLimit)} 추가 납입 가능`,
                description: `세액공제 한도(600만원)까지 ${formatCurrency(remainingPensionLimit)} 추가 납입 시 약 ${formatCurrency(Math.round(remainingPensionLimit * taxCreditRate))} 세액공제 가능`,
                amount: Math.round(remainingPensionLimit * taxCreditRate)
              })
            }

            // 2. IRP 추가 납입 가능 여부
            if (remainingIrpLimit > 0 && pensionFundAmount >= pensionFundLimit) {
              taxTips.push({
                priority: 2,
                category: 'IRP',
                title: `IRP ${formatCurrency(remainingIrpLimit)} 추가 납입 가능`,
                description: `연금저축+IRP 합산 한도(900만원)까지 ${formatCurrency(remainingIrpLimit)} 추가 납입 시 약 ${formatCurrency(Math.round(remainingIrpLimit * taxCreditRate))} 세액공제 가능`,
                amount: Math.round(remainingIrpLimit * taxCreditRate)
              })
            }

            // 3. ISA 활용 권장
            if (investmentAllocation.isa === 0 && monthlySavings > 0) {
              taxTips.push({
                priority: 3,
                category: 'ISA',
                title: 'ISA 계좌 활용 권장',
                description: '연 2,000만원 납입 한도 내 200만원까지 비과세, 초과분 9.9% 분리과세 혜택. 3년 유지 시 연금계좌 전환도 가능'
              })
            }

            // 4. 고소득자 추가 절세 전략
            if (yearlyIncome > 8800) {
              taxTips.push({
                priority: 4,
                category: '고소득자 전략',
                title: '배우자 연금저축 활용 검토',
                description: '배우자 명의 연금저축 개설 시 가구 전체 세액공제 한도 2배 활용 가능 (각 900만원)'
              })
            }

            // 5. 부동산 관련 절세 (대출 이자)
            if (getNum('mortgageAmount') > 0) {
              taxTips.push({
                priority: 5,
                category: '주택자금',
                title: '주택담보대출 이자 소득공제',
                description: '무주택 또는 1주택 세대주의 경우 주택담보대출 이자에 대해 연 300~1,800만원 소득공제 가능 (상환기간, 고정/변동금리에 따라 상이)'
              })
            }

            // 6. 저축률이 낮은 경우
            const currentSavingsRate = getNum('income') > 0 ? (monthlySavings / getNum('income')) * 100 : 0
            if (currentSavingsRate < 20 && monthlySavings > 0) {
              taxTips.push({
                priority: 6,
                category: '저축 최적화',
                title: '세제혜택 상품 우선 활용',
                description: '저축 여력이 한정적이므로 일반 저축보다 연금저축, IRP, ISA 등 세제혜택 상품을 우선 활용하세요'
              })
            }

            // 7. 연금 수령 전략 (은퇴 가까운 경우)
            if (yearsToRetirement <= 10 && yearsToRetirement > 0) {
              taxTips.push({
                priority: 7,
                category: '연금 수령',
                title: '연금 수령 전략 수립 필요',
                description: '은퇴 10년 이내입니다. 연금소득세(3.3~5.5%) vs 일시금 수령(기타소득세 16.5%) 비교 검토 필요. 연 1,500만원 이하 분리과세 활용 권장'
              })
            }

            // 우선순위 정렬
            taxTips.sort((a, b) => a.priority - b.priority)

            return (
              <>
                {/* 현재 절세 현황 요약 */}
                <div className="tax-summary">
                  <div className="tax-summary-grid">
                    <div className="tax-summary-item">
                      <span className="tax-summary-label">적용 세액공제율</span>
                      <span className="tax-summary-value">{taxCreditRatePercent}</span>
                      <span className="tax-summary-note">총급여 {yearlyIncome <= 5500 ? '5,500만원 이하' : '5,500만원 초과'}</span>
                    </div>
                    <div className="tax-summary-item">
                      <span className="tax-summary-label">소득세율 구간</span>
                      <span className="tax-summary-value">{taxBracket.rate}%</span>
                      <span className="tax-summary-note">{taxBracket.bracket}</span>
                    </div>
                    <div className="tax-summary-item highlight">
                      <span className="tax-summary-label">연간 예상 세액공제</span>
                      <span className="tax-summary-value">{formatCurrency(totalTaxCredit)}</span>
                      <span className="tax-summary-note">연금저축 + IRP</span>
                    </div>
                    <div className="tax-summary-item">
                      <span className="tax-summary-label">추가 절세 가능액</span>
                      <span className="tax-summary-value accent">{formatCurrency(potentialAdditionalCredit)}</span>
                      <span className="tax-summary-note">한도 미사용분</span>
                    </div>
                  </div>
                </div>

                {/* 세액공제 한도 활용 현황 */}
                <div className="tax-limit-status">
                  <h4>세액공제 한도 활용 현황</h4>
                  <div className="limit-bars">
                    <div className="limit-bar-item">
                      <div className="limit-bar-header">
                        <span className="limit-bar-label">연금저축</span>
                        <span className="limit-bar-value">{formatCurrency(pensionFundAmount)} / 600만원</span>
                      </div>
                      <div className="limit-bar">
                        <div
                          className="limit-bar-fill pension"
                          style={{ width: `${Math.min((pensionFundAmount / 600) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="limit-bar-percent">{Math.min(Math.round((pensionFundAmount / 600) * 100), 100)}% 활용</span>
                    </div>
                    <div className="limit-bar-item">
                      <div className="limit-bar-header">
                        <span className="limit-bar-label">IRP (추가분)</span>
                        <span className="limit-bar-value">{formatCurrency(irpAmount)} / 300만원</span>
                      </div>
                      <div className="limit-bar">
                        <div
                          className="limit-bar-fill irp"
                          style={{ width: `${Math.min((irpAmount / 300) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="limit-bar-percent">{Math.min(Math.round((irpAmount / 300) * 100), 100)}% 활용</span>
                    </div>
                    <div className="limit-bar-item">
                      <div className="limit-bar-header">
                        <span className="limit-bar-label">합산 (연금저축+IRP)</span>
                        <span className="limit-bar-value">{formatCurrency(totalPensionContribution)} / 900만원</span>
                      </div>
                      <div className="limit-bar">
                        <div
                          className="limit-bar-fill total"
                          style={{ width: `${Math.min((totalPensionContribution / 900) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="limit-bar-percent">{Math.min(Math.round((totalPensionContribution / 900) * 100), 100)}% 활용</span>
                    </div>
                  </div>
                </div>

                {/* 맞춤형 절세 팁 */}
                {taxTips.length > 0 && (
                  <div className="tax-tips">
                    <h4>맞춤형 절세 가이드</h4>
                    <div className="tax-tips-list">
                      {taxTips.slice(0, 5).map((tip, index) => (
                        <div key={index} className={`tax-tip-item ${tip.amount ? 'has-amount' : ''}`}>
                          <div className="tax-tip-header">
                            <span className="tax-tip-category">{tip.category}</span>
                            <span className="tax-tip-title">{tip.title}</span>
                          </div>
                          <p className="tax-tip-description">{tip.description}</p>
                          {tip.amount && (
                            <span className="tax-tip-amount">예상 절세 효과: {formatCurrency(tip.amount)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 세금 관련 참고사항 */}
                <div className="tax-reference">
                  <div
                    className="tax-reference-header"
                    onClick={() => setIsTaxReferenceExpanded(!isTaxReferenceExpanded)}
                  >
                    <h4>2024년 세제혜택 요약</h4>
                    <span className={`toggle-icon ${isTaxReferenceExpanded ? 'expanded' : ''}`}>▼</span>
                  </div>
                  <div className={`tax-reference-grid ${isTaxReferenceExpanded ? 'expanded' : 'collapsed'}`}>
                    <div className="tax-reference-item">
                      <span className="tax-ref-title">연금저축</span>
                      <ul>
                        <li>납입한도: 연 1,800만원</li>
                        <li>세액공제 한도: 연 600만원</li>
                        <li>공제율: 13.2~16.5%</li>
                        <li>수령 시: 연금소득세 3.3~5.5%</li>
                      </ul>
                    </div>
                    <div className="tax-reference-item">
                      <span className="tax-ref-title">IRP</span>
                      <ul>
                        <li>납입한도: 연 1,800만원</li>
                        <li>세액공제 한도: 연 900만원 (연금저축 포함)</li>
                        <li>공제율: 13.2~16.5%</li>
                        <li>퇴직금 이체 시 추가 세액공제 없음</li>
                      </ul>
                    </div>
                    <div className="tax-reference-item">
                      <span className="tax-ref-title">ISA</span>
                      <ul>
                        <li>납입한도: 연 2,000만원 (총 1억원)</li>
                        <li>비과세: 200만원 (서민형 400만원)</li>
                        <li>초과분: 9.9% 분리과세</li>
                        <li>의무보유: 3년</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="tax-note">
                  <p>* 세액공제율: 총급여 5,500만원 이하 16.5%, 초과 13.2%</p>
                  <p>* 50세 이상은 연금저축 세액공제 한도 200만원 추가 (연 600만원 → 800만원, 3년간)</p>
                  <p>* 개인별 상황에 따라 실제 세금 혜택은 다를 수 있으니, 전문가 상담을 권장합니다</p>
                </div>

                {/* 부동산 절세 인사이트 - 자가인 경우만 */}
                {data.housingType === 'own' && getNum('realEstate') > 0 && (
                  <div className="tax-section">
                    <h4>부동산 세금 가이드</h4>
                    {(() => {
                      const realEstateValue = getNum('realEstate')
                      const isHighValue = realEstateValue >= 90000 // 9억 이상
                      const estimatedPublicPrice = Math.round(realEstateValue * 0.7) // 시가의 약 70%가 공시가격
                      const isJonbuTarget = estimatedPublicPrice >= 90000 // 공시가격 9억 이상 (다주택) 또는 12억(1주택)

                      return (
                        <div className="tax-strategy-grid">
                          <div className="tax-strategy-item">
                            <span className="strategy-title">보유세 현황</span>
                            <div className="strategy-content">
                              <div className="property-tax-info">
                                <div className="tax-info-row">
                                  <span>부동산 시가</span>
                                  <span className="value">{formatCurrency(realEstateValue)}</span>
                                </div>
                                <div className="tax-info-row">
                                  <span>추정 공시가격 (70%)</span>
                                  <span className="value">{formatCurrency(estimatedPublicPrice)}</span>
                                </div>
                                <div className="tax-info-row">
                                  <span>재산세 (연간 추정)</span>
                                  <span className="value">
                                    {formatCurrency(Math.round(estimatedPublicPrice * 0.6 * 0.004))}
                                  </span>
                                </div>
                                <div className="tax-info-row highlight">
                                  <span>종부세 대상 여부</span>
                                  <span className={`value ${isJonbuTarget ? 'warning' : 'good'}`}>
                                    {isJonbuTarget ? '대상 가능성' : '비대상 추정'}
                                  </span>
                                </div>
                              </div>
                              <p className="strategy-note">* 재산세: 공시가격 × 공정시장가액비율(60%) × 세율(0.1~0.4%)</p>
                            </div>
                          </div>

                          <div className="tax-strategy-item">
                            <span className="strategy-title">종합부동산세 기준</span>
                            <div className="strategy-content">
                              <div className="strategy-table">
                                <div className="strategy-row header">
                                  <span>구분</span>
                                  <span>공제금액</span>
                                </div>
                                <div className="strategy-row">
                                  <span>1세대 1주택</span>
                                  <span>12억원</span>
                                </div>
                                <div className="strategy-row">
                                  <span>일반</span>
                                  <span>9억원</span>
                                </div>
                                <div className="strategy-row">
                                  <span>법인</span>
                                  <span>0원</span>
                                </div>
                              </div>
                              <p className="strategy-note">* 2024년 기준, 매년 변동 가능</p>
                            </div>
                          </div>

                          <div className="tax-strategy-item">
                            <span className="strategy-title">양도소득세 절세</span>
                            <div className="strategy-content">
                              <ul className="strategy-list">
                                <li><strong>1세대 1주택 비과세:</strong> 2년 보유+거주 시 12억까지 비과세</li>
                                <li><strong>장기보유특별공제:</strong> 3년↑ 보유 시 최대 80% 공제</li>
                                <li><strong>일시적 2주택:</strong> 신규 취득 후 3년 내 기존 주택 매도</li>
                                <li><strong>증여 후 양도:</strong> 배우자 증여 후 5년 이후 매도 검토</li>
                              </ul>
                            </div>
                          </div>

                          <div className="tax-strategy-item">
                            <span className="strategy-title">장기보유특별공제율</span>
                            <div className="strategy-content">
                              <div className="strategy-table">
                                <div className="strategy-row header">
                                  <span>보유기간</span>
                                  <span>공제율</span>
                                </div>
                                <div className="strategy-row">
                                  <span>3년</span>
                                  <span>24%</span>
                                </div>
                                <div className="strategy-row">
                                  <span>5년</span>
                                  <span>40%</span>
                                </div>
                                <div className="strategy-row">
                                  <span>10년 (1세대1주택)</span>
                                  <span>80%</span>
                                </div>
                              </div>
                              <p className="strategy-note">* 1세대 1주택 거주요건 충족 시</p>
                            </div>
                          </div>

                          {isHighValue && (
                            <div className="tax-strategy-item full-width">
                              <span className="strategy-title warning-badge">고가 부동산 절세 전략</span>
                              <div className="strategy-content">
                                <ul className="strategy-list highlight-list">
                                  <li><strong>부부 공동명의:</strong> 종부세 과세표준 분산, 각자 9억(또는 12억) 공제 활용</li>
                                  <li><strong>임대사업자 등록:</strong> 장기임대 시 종부세 합산배제 및 양도세 감면 (요건 엄격)</li>
                                  <li><strong>법인 전환 검토:</strong> 법인세율 적용, 단 종부세 중과 및 양도세 추가과세 주의</li>
                                  <li><strong>분할 매도:</strong> 연도별 분산 매도로 누진세율 구간 관리</li>
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* 자녀 증여 절세 */}
                {data.family.length > 1 && (
                  <div className="tax-section">
                    <h4>자녀 증여 절세 가이드</h4>
                    {(() => {
                      // 자녀 수 계산 (본인 제외, 자녀 관계만)
                      const children = data.family.filter(m =>
                        m.relation.includes('자녀') || m.relation.includes('아들') || m.relation.includes('딸')
                      )
                      const minorChildren = children.filter(c => Number(c.age) < 19)
                      const adultChildren = children.filter(c => Number(c.age) >= 19)

                      return (
                        <div className="tax-strategy-grid">
                          <div className="tax-strategy-item">
                            <span className="strategy-title">증여세 공제한도</span>
                            <div className="strategy-content">
                              <div className="strategy-table">
                                <div className="strategy-row header">
                                  <span>관계</span>
                                  <span>10년간 공제한도</span>
                                </div>
                                <div className="strategy-row">
                                  <span>배우자</span>
                                  <span>6억원</span>
                                </div>
                                <div className="strategy-row">
                                  <span>성인 자녀</span>
                                  <span>5,000만원</span>
                                </div>
                                <div className="strategy-row">
                                  <span>미성년 자녀</span>
                                  <span>2,000만원</span>
                                </div>
                                <div className="strategy-row">
                                  <span>손자녀</span>
                                  <span>5,000만원</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="tax-strategy-item">
                            <span className="strategy-title">증여세율 구조</span>
                            <div className="strategy-content">
                              <div className="strategy-table">
                                <div className="strategy-row header">
                                  <span>과세표준</span>
                                  <span>세율</span>
                                </div>
                                <div className="strategy-row">
                                  <span>1억원 이하</span>
                                  <span>10%</span>
                                </div>
                                <div className="strategy-row">
                                  <span>1~5억원</span>
                                  <span>20%</span>
                                </div>
                                <div className="strategy-row">
                                  <span>5~10억원</span>
                                  <span>30%</span>
                                </div>
                                <div className="strategy-row">
                                  <span>10~30억원</span>
                                  <span>40%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="tax-strategy-item">
                            <span className="strategy-title">효율적 증여 전략</span>
                            <div className="strategy-content">
                              <ul className="strategy-list">
                                <li><strong>조기 증여:</strong> 10년 주기로 공제한도 갱신, 조기 시작이 유리</li>
                                <li><strong>저평가 자산 증여:</strong> 상승 예상 주식/부동산을 미리 증여</li>
                                <li><strong>창업자금 증여:</strong> 30억까지 5% 세율 (30세↑, 10년 이상 경영)</li>
                                <li><strong>혼인·출산 증여:</strong> 추가 1억 한도 공제 (2024년~)</li>
                                <li><strong>분산 증여:</strong> 배우자+본인이 각각 증여 시 공제한도 2배</li>
                              </ul>
                            </div>
                          </div>

                          <div className="tax-strategy-item">
                            <span className="strategy-title">가족 현황 기반 시뮬레이션</span>
                            <div className="strategy-content">
                              <div className="family-gift-summary">
                                {data.isMarried && (
                                  <div className="gift-row highlight">
                                    <span>배우자 간 증여</span>
                                    <span>10년간 6억원 비과세</span>
                                  </div>
                                )}
                                {adultChildren.length > 0 && (
                                  <>
                                    <div className="gift-row">
                                      <span>본인 → 성인 자녀 {adultChildren.length}명</span>
                                      <span>10년간 {formatCurrency(adultChildren.length * 5000)}</span>
                                    </div>
                                    {data.isMarried && (
                                      <div className="gift-row spouse-gift">
                                        <span>배우자 → 성인 자녀 {adultChildren.length}명</span>
                                        <span>10년간 {formatCurrency(adultChildren.length * 5000)}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                {minorChildren.length > 0 && (
                                  <>
                                    <div className="gift-row">
                                      <span>본인 → 미성년 자녀 {minorChildren.length}명</span>
                                      <span>10년간 {formatCurrency(minorChildren.length * 2000)}</span>
                                    </div>
                                    {data.isMarried && (
                                      <div className="gift-row spouse-gift">
                                        <span>배우자 → 미성년 자녀 {minorChildren.length}명</span>
                                        <span>10년간 {formatCurrency(minorChildren.length * 2000)}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                <div className="gift-total">
                                  <span>총 비과세 증여 가능액 (10년)</span>
                                  <span className="total-value">
                                    {formatCurrency(
                                      // 배우자 간 증여
                                      (data.isMarried ? 60000 : 0) +
                                      // 자녀 증여 (부부 각각 가능하므로 x2)
                                      (adultChildren.length * 5000 * (data.isMarried ? 2 : 1)) +
                                      (minorChildren.length * 2000 * (data.isMarried ? 2 : 1))
                                    )}
                                  </span>
                                </div>
                                {data.isMarried && (children.length > 0) && (
                                  <p className="gift-note">* 부부 각각이 자녀에게 증여 가능하여 공제한도 2배 활용</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* 종합 절세 체크리스트 */}
                <div className="tax-section">
                  <h4>종합 절세 체크리스트</h4>
                  <div className="tax-checklist">
                    {(() => {
                      const checklist: Array<{category: string, status: string, message: string}> = []

                      // 맞벌이 여부 (배우자 소득 있음)
                      const isDualIncome = data.isMarried && spouseYearlyIncome > 0

                      // 본인 연금저축 체크
                      if (coupleAllocation.personal.pensionFund < 600) {
                        checklist.push({
                          category: isDualIncome ? '본인 연금저축' : '연금저축',
                          status: 'incomplete',
                          message: `세액공제 한도 ${formatCurrency(600 - coupleAllocation.personal.pensionFund)} 미활용`
                        })
                      } else {
                        checklist.push({
                          category: isDualIncome ? '본인 연금저축' : '연금저축',
                          status: 'complete',
                          message: '세액공제 한도 100% 활용 중'
                        })
                      }

                      // 배우자 연금저축 체크 (맞벌이인 경우)
                      if (isDualIncome) {
                        if (coupleAllocation.spouse.pensionFund < 600) {
                          checklist.push({
                            category: '배우자 연금저축',
                            status: 'incomplete',
                            message: `세액공제 한도 ${formatCurrency(600 - coupleAllocation.spouse.pensionFund)} 미활용`
                          })
                        } else {
                          checklist.push({
                            category: '배우자 연금저축',
                            status: 'complete',
                            message: '세액공제 한도 100% 활용 중'
                          })
                        }
                      }

                      // 본인 IRP 체크
                      const personalTotalPension = coupleAllocation.personal.pensionFund + coupleAllocation.personal.irp
                      if (personalTotalPension < 900) {
                        checklist.push({
                          category: isDualIncome ? '본인 IRP' : 'IRP',
                          status: 'incomplete',
                          message: `합산 한도 ${formatCurrency(900 - personalTotalPension)} 미활용`
                        })
                      } else {
                        checklist.push({
                          category: isDualIncome ? '본인 IRP' : 'IRP',
                          status: 'complete',
                          message: '연금저축+IRP 한도 100% 활용 중'
                        })
                      }

                      // 배우자 IRP 체크 (맞벌이인 경우)
                      if (isDualIncome) {
                        const spouseTotalPension = coupleAllocation.spouse.pensionFund + coupleAllocation.spouse.irp
                        if (spouseTotalPension < 900) {
                          checklist.push({
                            category: '배우자 IRP',
                            status: 'incomplete',
                            message: `합산 한도 ${formatCurrency(900 - spouseTotalPension)} 미활용`
                          })
                        } else {
                          checklist.push({
                            category: '배우자 IRP',
                            status: 'complete',
                            message: '연금저축+IRP 한도 100% 활용 중'
                          })
                        }
                      }

                      // ISA 체크
                      if (investmentAllocation.isa === 0 && monthlySavings > 0) {
                        checklist.push({
                          category: 'ISA',
                          status: 'incomplete',
                          message: isDualIncome ? '부부 ISA 계좌 미활용 (각각 연 2,000만원 가능)' : 'ISA 계좌 미활용 (비과세 혜택 가능)'
                        })
                      } else if (investmentAllocation.isa > 0) {
                        checklist.push({
                          category: 'ISA',
                          status: 'complete',
                          message: `ISA 연 ${formatCurrency(investmentAllocation.isa)} 활용 중`
                        })
                      }

                      // 주택담보대출 이자 공제 체크 (자가인 경우)
                      if (data.housingType === 'own' && getNum('mortgageAmount') > 0) {
                        checklist.push({
                          category: '주담대 이자공제',
                          status: 'check',
                          message: '연말정산 시 이자상환액 소득공제 확인 필요'
                        })
                      }

                      // 부동산 세금 체크 (자가인 경우)
                      if (data.housingType === 'own' && getNum('realEstate') >= 90000) {
                        checklist.push({
                          category: '종합부동산세',
                          status: 'warning',
                          message: '고가 부동산 보유 - 종부세 대상 여부 확인 필요'
                        })
                      }

                      // 맞벌이 부부 세액공제 최대화 팁
                      if (isDualIncome && totalTaxRefund < (personalTotalRefund + spouseTotalRefund)) {
                        checklist.push({
                          category: '맞벌이 절세',
                          status: 'check',
                          message: `부부 합산 세액공제 ${formatCurrency(totalTaxRefund)} (각자 한도 활용 시 최대 ${formatCurrency(900 * 0.165 * 2)}까지 가능)`
                        })
                      }

                      return (
                        <div className="checklist-items">
                          {checklist.map((item, index) => (
                            <div key={index} className={`checklist-item ${item.status}`}>
                              <span className="checklist-icon">
                                {item.status === 'complete' && '✓'}
                                {item.status === 'incomplete' && '○'}
                                {item.status === 'check' && '?'}
                                {item.status === 'warning' && '⚠'}
                              </span>
                              <span className="checklist-category">{item.category}</span>
                              <span className="checklist-message">{item.message}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </section>

      {/* 플로팅 버튼 */}
      {showFloatingButton && (
        <div className="floating-buttons">
          <button
            className="floating-my-data-btn"
            onClick={() => {
              setData(initialData)
              setIsInputExpanded(true)
              setTimeout(() => {
                document.getElementById('data-input-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 100)
            }}
          >
            내 재무데이터 입력해보기
          </button>
          <button
            className="floating-comment-btn"
            onClick={() => setShowCommentSection(!showCommentSection)}
          >
            의견 남기기
          </button>
        </div>
      )}

      {/* 댓글 섹션 */}
      {showCommentSection && (
        <div className="comment-section-overlay" onClick={() => setShowCommentSection(false)}>
          <div className="comment-section" onClick={(e) => e.stopPropagation()}>
            <div className="comment-header">
              <h3>의견 남기기</h3>
              <button className="close-btn" onClick={() => setShowCommentSection(false)}>×</button>
            </div>

            <div className="comment-input-area">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="서비스에 대한 의견을 남겨주세요..."
                maxLength={300}
              />
              <div className="comment-input-footer">
                <span className="char-count">{newComment.length}/300</span>
                <button
                  className="submit-comment-btn"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                >
                  {isSubmitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>

            <div className="comments-list">
              {isLoadingComments ? (
                <p className="no-comments">의견을 불러오는 중...</p>
              ) : displayedComments.length === 0 ? (
                <p className="no-comments">아직 의견이 없습니다. 첫 번째 의견을 남겨주세요!</p>
              ) : (
                displayedComments.map((comment) => {
                  const sessionId = getSessionId()
                  const likeKey = `${sessionId}_${comment.id}`
                  const hasLiked = likedComments.has(likeKey)

                  return (
                    <div key={comment.id} className="comment-item">
                      <p className="comment-content">{comment.content}</p>
                      <div className="comment-footer">
                        <span className="comment-date">
                          {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                        </span>
                        <button
                          className={`like-btn ${hasLiked ? 'liked' : ''}`}
                          onClick={() => handleLike(comment.id)}
                        >
                          👍 {comment.likes}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {comments.length > 15 && !showAllComments && (
              <button
                className="load-more-btn"
                onClick={() => setShowAllComments(true)}
              >
                더보기 ({comments.length - 15}개 더)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
