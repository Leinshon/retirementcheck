import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { UserCurrentState, Scenario, ThreeMonthRoadmap } from './types/professional'
import { householdFinance2025, estimatePercentiles, type AgeGroup } from './data/householdFinance2025'
import './ProfessionalDiagnosis.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, annotationPlugin)

// 결과값 뜸 들이기 효과를 위한 커스텀 훅
const useRevealNumber = (value: number, delay: number = 1500, duration: number = 800) => {
  const [isRevealed, setIsRevealed] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  useEffect(() => {
    // 분석 중 상태
    setIsAnalyzing(true)
    setIsRevealed(false)
    setDisplayValue(0)

    // 딜레이 후 reveal 시작
    const revealTimer = setTimeout(() => {
      setIsAnalyzing(false)
      setIsRevealed(true)

      // CountUp 애니메이션
      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        setDisplayValue(Math.round(value * eased * 10) / 10)

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }, delay)

    return () => clearTimeout(revealTimer)
  }, [value, delay, duration])

  return { isAnalyzing, isRevealed, displayValue }
}

interface DiagnosisPageProps {
  userState?: UserCurrentState
  scenarios?: Scenario[]
  roadmaps?: ThreeMonthRoadmap[]
  baselineProjection?: {
    years: number[]
    netWorth: number[]
    retirementAge: number
  }
}

// Slide별 Expert Insights 데이터 생성 함수
const getSlideInsightsData = (userName: string): Record<number, any> => ({
  // 슬라이드 0: 커버 페이지
  0: {
    slides: [
      {
        badge: { type: 'info', text: 'WELCOME' },
        title: `안녕하세요, ${userName}님!`,
        description: `${userName}님의 은퇴 준비 상태를 진단해드릴 자산관리사 손균우입니다. 만나뵙게 되어 반갑습니다.`,
      },
      {
        badge: { type: 'info', text: 'INTRODUCTION' },
        title: '진단 보고서 소개',
        description: `${userName}님께서 입력해주신 재무 데이터를 바탕으로 현재 은퇴 준비 상태를 종합적으로 분석했습니다. 지금부터 그 결과를 차근차근 설명해드리겠습니다.`,
      },
      {
        badge: { type: 'info', text: 'HOW TO USE' },
        title: '보고서 사용 방법',
        description: '화면 좌측에서 진단 내용을 확인하실 수 있고, 우측에서 제 설명을 따라가시면 됩니다. 하단 화살표를 눌러 다음 슬라이드로 이동하세요.',
      },
      {
        badge: { type: 'info', text: 'TIP' },
        title: '인사이트 확인 방법',
        description: '각 슬라이드마다 "다음 인사이트" 버튼을 눌러주시면 해당 페이지에 대한 제 분석과 조언을 순차적으로 확인하실 수 있습니다.',
      },
      {
        badge: { type: 'info', text: 'INTERACTION' },
        title: '궁금한 점이 있으신가요?',
        description: '설명을 듣다가 이해가 안 되거나 궁금한 부분이 있으시면 언제든 하단 채팅창에 남겨주세요. 나중에 다시 확인하고 답변드릴 수 있도록 기억해두겠습니다.',
      },
      {
        badge: { type: 'info', text: 'READY' },
        title: '그럼 시작하겠습니다',
        description: `${userName}님의 은퇴 준비 현황을 함께 살펴보시죠. 준비되셨으면 우측 하단 화살표를 눌러 다음 페이지로 이동해주세요.`,
      }
    ]
  },
  // Part 1: 은퇴 준비상태 진단 (슬라이드 1~5)
  // 슬라이드 1: 은퇴 자산 준비율
  1: {
    slides: [
      {
        badge: { type: 'info', text: 'OVERVIEW' },
        title: '은퇴 자산 준비율 진단',
        description: `${userName}님의 현재 은퇴 준비 상태를 분석했습니다. 좌측 화면에서 4가지 핵심 지표를 확인하실 수 있습니다.`,
      },
      {
        badge: { type: 'info', text: 'CURRENT' },
        title: '현재 총자산 6.92억원',
        description: '현재 보유하신 총자산은 6.92억원입니다. 부채 비중이 33.5%로 양호한 수준이며, 이는 자산 대비 건전한 비율입니다.',
      },
      {
        badge: { type: 'info', text: 'TARGET' },
        title: '목표 은퇴자산 50억원',
        description: `${userName}님께서 설정하신 50세 목표 은퇴자산은 50억원입니다. 현재 자산 대비 약 7배 이상의 성장이 필요합니다.`,
      },
      {
        badge: { type: 'danger', text: 'CRITICAL' },
        title: '목표 달성률 28.3%',
        description: '현재 추세대로라면 10년 후 14.13억원에 도달할 것으로 예상됩니다. 목표 50억원 대비 35.87억원이 부족한 상황입니다.',
        alert: {
          type: 'danger',
          label: 'Target Gap',
          value: '- 35.87억원',
          unit: '부족'
        }
      },
      {
        badge: { type: 'info', text: 'NEXT' },
        title: '다음 페이지에서 자세히',
        description: '다음 페이지에서 자산 성장 시뮬레이션 그래프와 연평균 성장률을 통해 현재 경로와 목표 간의 차이를 시각적으로 확인하실 수 있습니다.',
      }
    ]
  },
  // 슬라이드 2: 자산 성장 시뮬레이션
  2: {
    slides: [
      {
        badge: { type: 'info', text: 'SIMULATION' },
        title: '자산 성장 시뮬레이션',
        description: '좌측 그래프는 현재 투자 전략을 유지할 경우의 예상 자산 성장 경로입니다. 빨간색 선이 예상 경로, 금색 점선이 목표 자산(50억)을 나타냅니다.',
      },
      {
        badge: { type: 'warning', text: 'CAGR' },
        title: '연평균 성장률 7.4%',
        description: '현재 투자 포트폴리오 기준 연평균 복리 성장률(CAGR)은 7.4%로 예상됩니다. 이 성장률로는 목표 달성이 어렵습니다.',
      },
      {
        badge: { type: 'danger', text: 'GAP ANALYSIS' },
        title: '목표와의 격차',
        description: '현재 6.92억원에서 시작해 10년 후 14.13억원에 도달할 것으로 예상됩니다. 목표인 50억원과는 35.87억원의 큰 격차가 있습니다.',
        alert: {
          type: 'danger',
          label: '10년 후 예상 격차',
          value: '- 35.87억원',
          unit: ''
        }
      },
      {
        badge: { type: 'info', text: 'IMPLICATION' },
        title: '전략 변경 필요',
        description: '이 격차를 줄이기 위해서는 저축률 증가, 투자 수익률 개선, 또는 목표 자산 조정 중 하나 이상의 전략 변경이 필요합니다. 다음 페이지에서 구체적인 시나리오를 확인하세요.',
      }
    ]
  },
  // 슬라이드 3: 은퇴 현금흐름 준비도
  3: {
    slides: [
      {
        badge: { type: 'info', text: 'CASHFLOW' },
        title: '은퇴 현금흐름 진단',
        description: '이 페이지에서는 은퇴 후 40년간(2036-2075) 필요한 자금과 확보된 현금흐름을 분석합니다.',
      },
      {
        badge: { type: 'danger', text: 'CRITICAL' },
        title: '현금흐름 준비율 23.8%',
        description: '은퇴 후 필요한 총 자금 대비 현재 확보된 현금흐름이 23.8%에 불과합니다. 이는 매우 위험한 수준입니다.',
        alert: {
          type: 'danger',
          label: '준비율',
          value: '23.8%',
          unit: ''
        }
      },
      {
        badge: { type: 'danger', text: 'DEFICIT' },
        title: '부족 자금 24.24억원',
        description: '총 지출 수요 31.79억원 대비 확보된 현금흐름이 7.55억원으로, 24.24억원의 자금이 추가로 필요합니다.',
        alert: {
          type: 'danger',
          label: '부족 자금',
          value: '-24.24억원',
          unit: ''
        }
      },
      {
        badge: { type: 'warning', text: 'IMPLICATION' },
        title: '유동성 확보 시급',
        description: '은퇴 후 안정적인 생활을 위해 추가 저축, 연금 확대, 또는 지출 조정이 필요합니다. 다음 페이지에서 예상 월 수령액을 확인하세요.',
      }
    ]
  },
  // 슬라이드 4: 예상 월 수령액
  4: {
    slides: [
      {
        badge: { type: 'info', text: 'MONTHLY INCOME' },
        title: '예상 월 수령액 분석',
        description: '10년 단위로 은퇴 후 예상되는 월 수령액을 분석했습니다. 연금, 투자 수익, 기타 소득을 종합한 결과입니다.',
      },
      {
        badge: { type: 'warning', text: 'GAP ANALYSIS' },
        title: '목표 대비 부족',
        description: '현재 계획으로는 은퇴 초기(50-60세)에 목표 월 생활비 400만원 대비 약 211만원이 부족합니다. 추가적인 소득원 확보가 필요합니다.',
        alert: {
          type: 'warning',
          label: '월 부족액',
          value: '-211만원',
          unit: ''
        }
      },
      {
        badge: { type: 'info', text: 'TREND' },
        title: '시간에 따른 변화',
        description: '은퇴 후반으로 갈수록 국민연금 수령이 시작되어 월 수령액이 증가합니다. 다만 의료비 등 지출도 함께 증가할 수 있어 주의가 필요합니다.',
      }
    ]
  },
  // 슬라이드 5: 월 수령액 구성
  5: {
    slides: [
      {
        badge: { type: 'info', text: 'BREAKDOWN' },
        title: '수령액 구성 상세',
        description: '70세 이후에는 국민연금 수령액이 증가하여 전체 수령액이 개선됩니다. 하지만 여전히 목표 대비 부족한 상황입니다.',
      },
      {
        badge: { type: 'info', text: 'PENSION' },
        title: '국민연금 효과',
        description: '60세부터 월 120만원의 국민연금이 시작되어 수령액이 개선됩니다. 70세 이후에는 180만원까지 증가합니다.',
      },
      {
        badge: { type: 'warning', text: 'CAUTION' },
        title: '후반부 주의사항',
        description: '80세 이후에는 투자 자산이 감소하면서 수령액이 다시 줄어들 수 있습니다. 장수 리스크에 대한 대비가 필요합니다.',
      }
    ]
  },
  // 슬라이드 6: 지출 구조 (TODO)
  6: {
    slides: [
      {
        badge: { type: 'info', text: 'EXPENSE' },
        title: '지출 구조 분석',
        description: '좌측 화면에서 지출 구조를 확인하실 수 있습니다.',
      }
    ]
  },
  // 슬라이드 7: 전환 슬라이드
  7: {
    slides: [
      {
        badge: { type: 'info', text: 'PART 1 COMPLETE' },
        title: '은퇴 준비 진단 완료',
        description: '지금까지 은퇴 준비 상태를 진단했습니다. 자산 준비율, 현금흐름 준비도, 예상 월 수령액 등을 확인하셨습니다.',
      },
      {
        badge: { type: 'info', text: 'NEXT' },
        title: '왜 이런 결과가 나왔을까요?',
        description: '다음 페이지부터는 현재 재무현황을 상세히 분석해보겠습니다. 자산, 부채, 현금흐름을 분석하여 개선 포인트를 찾아보겠습니다.',
      }
    ]
  },
  // Part 2: 현재 재무현황 분석 (슬라이드 8~12)
  // 슬라이드 8: 순자산 분포
  8: {
    slides: [
      {
        badge: { type: 'info', text: 'PERCENTILE' },
        title: '순자산 분포 분석',
        description: '좌측 그래프는 동 연령대 가구와 비교한 순자산 위치를 보여드립니다. 통계청 2025 가계금융복지조사 데이터 기준입니다.',
      },
      {
        badge: { type: 'info', text: 'POSITION' },
        title: '나의 위치 확인',
        description: '정규분포 곡선에서 빨간 점이 현재 위치입니다. 곡선의 오른쪽으로 갈수록 상위권, 왼쪽으로 갈수록 하위권을 의미합니다.',
      },
      {
        badge: { type: 'info', text: 'COMPARISON' },
        title: '중위값과 비교',
        description: '동 연령대 중위값(가운데 50%)과 비교하여 현재 위치를 파악하실 수 있습니다. 중위값 이상이면 절반 이상의 가구보다 많은 순자산을 보유한 것입니다.',
      },
      {
        badge: { type: 'info', text: 'NEXT' },
        title: '다음 단계',
        description: '다음 페이지에서 자산현황을 상세히 분석해보겠습니다.',
      }
    ]
  },
  // 슬라이드 9: 자산 구성
  9: {
    slides: [
      {
        badge: { type: 'info', text: 'ASSET OVERVIEW' },
        title: '자산 구성 현황',
        description: '좌측 화면에서 현재 자산 구성을 대분류로 확인하실 수 있습니다. 부동산, 금융자산, 연금자산으로 나누어 보여드립니다.',
      },
      {
        badge: { type: 'info', text: 'RATIO' },
        title: '자산 비중 분석',
        description: '도넛 차트에서 각 자산 유형의 비중을 확인하실 수 있습니다. 부동산 비중이 높을수록 유동성이 낮고, 금융자산 비중이 높을수록 투자 효율성이 높습니다.',
      },
      {
        badge: { type: 'info', text: 'NEXT' },
        title: '부채 현황 확인',
        description: '다음 페이지에서 부채 현황과 DSR을 분석해보겠습니다.',
      }
    ]
  },
  // 슬라이드 10: 부채 현황
  10: {
    slides: [
      {
        badge: { type: 'info', text: 'DEBT OVERVIEW' },
        title: '부채 현황 분석',
        description: '좌측 화면에서 현재 보유 중인 부채의 구성과 월 이자 부담을 확인하실 수 있습니다.',
      },
      {
        badge: { type: 'info', text: 'INTEREST' },
        title: '월 이자 부담',
        description: '현재 월 이자로 약 103만원을 지출하고 계십니다. 연간으로 환산하면 1,236만원입니다.',
      },
      {
        badge: { type: 'warning', text: 'DSR' },
        title: 'DSR 분석',
        description: 'DSR(총부채원리금상환비율)은 연소득 대비 연간 원리금 상환액의 비율입니다. 40% 이하가 권장되며, 현재 수준을 확인해보세요.',
      },
      {
        badge: { type: 'info', text: 'NEXT' },
        title: '금리 변동 시뮬레이션',
        description: '다음 페이지에서 금리가 변동될 경우 이자 부담이 어떻게 변하는지 시뮬레이션해볼 수 있습니다.',
      }
    ]
  },
  // 슬라이드 11: 금리 충격 테스트
  11: {
    slides: [
      {
        badge: { type: 'info', text: 'RATE SHOCK' },
        title: '금리 변동 시뮬레이션',
        description: '금리가 1%p씩 변동할 때 월 이자 부담이 어떻게 달라지는지 확인해보세요. 버튼을 클릭하여 시나리오를 선택할 수 있습니다.',
      },
      {
        badge: { type: 'warning', text: 'STRESS TEST' },
        title: '금리 상승 리스크',
        description: '금리가 2%p 상승하면 월 이자가 약 47만원 증가합니다. 연간으로 환산하면 560만원의 추가 부담이 발생합니다.',
      },
      {
        badge: { type: 'success', text: 'OPPORTUNITY' },
        title: '금리 인하 시 이점',
        description: '반대로 금리가 2%p 하락하면 월 47만원을 절약할 수 있습니다. 대환 대출이나 금리 협상을 고려해보세요.',
      },
      {
        badge: { type: 'info', text: 'NEXT' },
        title: '다음 단계',
        description: '부채 분석을 완료했습니다. 다음 페이지에서 월별 현금흐름을 분석해보겠습니다.',
      }
    ]
  },
  // 슬라이드 12: 월간 현금흐름
  12: {
    slides: [
      {
        badge: { type: 'info', text: 'CASHFLOW' },
        title: '월간 현금흐름 분석',
        description: '좌측 워터폴 차트는 월 소득에서 지출과 부채상환을 거쳐 실제로 저축/투자에 활용할 수 있는 금액이 얼마인지 시각적으로 보여줍니다.',
      },
      {
        badge: { type: 'warning', text: 'SAVINGS RATE' },
        title: '저축률 진단',
        description: '40대는 자녀 양육으로 인한 지출이 많은 시기이지만, 동시에 은퇴 준비를 위한 마지막 골든타임입니다. 권장 저축률 20~25%를 목표로 하셔야 합니다.',
      },
      {
        badge: { type: 'info', text: 'ACTION' },
        title: '개선 방안',
        description: '저축률이 낮다면 먼저 고정비(부채상환, 보험료 등)를 점검하고, 변동비(식비, 여가비 등)에서 절감 가능한 부분을 찾아보시기 바랍니다.',
      }
    ]
  },
  // 슬라이드 13: 진단 완료
  13: {
    slides: [
      {
        badge: { type: 'success', text: 'COMPLETE' },
        title: '진단 완료',
        description: `${userName}님의 은퇴 준비 상태 진단이 완료되었습니다. 이제 맞춤 시나리오 페이지에서 구체적인 실행 계획을 확인하실 수 있습니다.`,
      },
      {
        badge: { type: 'info', text: 'NEXT STEP' },
        title: '맞춤 시나리오란?',
        description: '입력하신 재무 정보를 바탕으로 목표 달성을 위한 여러 가지 시나리오를 제안해드립니다. 각 시나리오별 장단점을 비교하고 최적의 전략을 선택하실 수 있습니다.',
      }
    ]
  }
})


function ProfessionalDiagnosis() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { userState, scenarios, roadmaps, baselineProjection } = (location.state || {}) as DiagnosisPageProps

  // 개발 모드 감지
  const isDevMode = searchParams.get('dev') === '1'

  // State management
  const [currentSlide, setCurrentSlide] = useState(0)
  const [reportDate] = useState(new Date())

  // Chat-style insights state
  const [messageProgress, setMessageProgress] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0
  })
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Unified chat history - stores all messages (expert + user + confirmation) in order
  type ChatMessage =
    | { type: 'expert'; expertIndex: number; timestamp: number }
    | { type: 'user'; text: string; timestamp: number }
    | { type: 'confirmation'; text: string; timestamp: number }

  const [chatHistory, setChatHistory] = useState<Record<number, ChatMessage[]>>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [], 13: [], 14: [], 15: [], 16: [], 17: []
  })
  const [currentInput, setCurrentInput] = useState<string>('')
  const lastSentMessageRef = useRef<string>('')

  const totalSlides = 18

  // 개발 모드용 슬라이드 개수는 하단 devSlides 배열에서 자동 계산됨 (getDevTotalSlides 함수 참조)

  // If no data, redirect back to input (개발 모드에서는 건너뜀)
  useEffect(() => {
    if (!isDevMode && (!userState || !scenarios || !roadmaps)) {
      navigate('/professional')
    }
  }, [userState, scenarios, roadmaps, navigate, isDevMode])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextSlide()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      }
      if (e.key === 'Home') {
        e.preventDefault()
        setCurrentSlide(0)
      }
      if (e.key === 'End') {
        e.preventDefault()
        setCurrentSlide(totalSlides - 1)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentSlide])

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messageProgress, currentSlide, chatHistory])

  // Auto-show first message when entering a slide
  useEffect(() => {
    const currentProgress = messageProgress[currentSlide]
    if (currentProgress === 0 && typingMessageIndex === null) {
      const timer = setTimeout(() => {
        handleNextMessage()
      }, 300) // Small delay for smooth transition
      return () => clearTimeout(timer)
    }
  }, [currentSlide])

  // 개발 모드에서는 미사용 슬라이드를 제외한 개수 사용
  // devSlides와 devTotalSlides는 하단에서 정의되므로, 여기서는 함수로 감싸서 참조
  const getEffectiveTotalSlides = () => isDevMode ? devTotalSlides : totalSlides

  const nextSlide = () => {
    if (currentSlide < getEffectiveTotalSlides() - 1) {
      setCurrentSlide(currentSlide + 1)
    }
  }

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const handleContinueToScenarios = () => {
    navigate('/professional/scenario', {
      state: { userState, scenarios, roadmaps, baselineProjection },
    })
  }

  // Get slide insights data with user name
  const slideInsightsData = getSlideInsightsData(userState?.name || '고객')


  // User message handlers
  const handleSendMessage = () => {
    const message = currentInput.trim()
    if (message === '') return

    // Prevent duplicate sends in StrictMode
    if (lastSentMessageRef.current === message) return
    lastSentMessageRef.current = message

    // Clear input
    setCurrentInput('')

    // Add user message to chat history
    setChatHistory(prev => ({
      ...prev,
      [currentSlide]: [
        ...prev[currentSlide],
        { type: 'user', text: message, timestamp: Date.now() }
      ]
    }))

    // Add expert confirmation message after a short delay (simulating typing)
    setTimeout(() => {
      setChatHistory(prev => ({
        ...prev,
        [currentSlide]: [
          ...prev[currentSlide],
          { type: 'confirmation', text: `기억해 뒀습니다. 향후 ${userState?.name || '고객'}님의 플랜에 반영할게요.`, timestamp: Date.now() } as any
        ]
      }))
    }, 800)

    // Reset duplicate check after a short delay
    setTimeout(() => {
      lastSentMessageRef.current = ''
    }, 100)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME 조합 중(한글 입력 등)에는 Enter 무시
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Chat-style insights handlers
  const calculateTypingDuration = (message: any): number => {
    const textLength = (message.title + message.description).length
    if (textLength < 100) return 1500
    if (textLength < 200) return 2500
    return 3500
  }

  const handleNextMessage = () => {
    const slideIndex = currentSlide
    const totalMessages = slideInsightsData[slideIndex].slides.length
    const currentProgress = messageProgress[slideIndex]

    if (currentProgress >= totalMessages) return

    // Start typing animation
    setTypingMessageIndex(currentProgress)

    // After typing duration, show message and reset typing
    const duration = calculateTypingDuration(slideInsightsData[slideIndex].slides[currentProgress])

    setTimeout(() => {
      // Add expert message to chat history
      setChatHistory(prev => ({
        ...prev,
        [slideIndex]: [
          ...prev[slideIndex],
          { type: 'expert', expertIndex: currentProgress, timestamp: Date.now() }
        ]
      }))
      setMessageProgress(prev => ({
        ...prev,
        [slideIndex]: currentProgress + 1
      }))
      setTypingMessageIndex(null)
    }, duration)
  }

  // 개발 모드가 아닐 때만 데이터 체크
  if (!isDevMode && (!userState || !scenarios || !roadmaps)) {
    return null
  }

  const formattedDate = reportDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  // Render Left Slide 1: Cover Page
  const renderLeftSlide1 = () => (
    <div className="slide-cover">
      <div className="cover-content">
        <div className="cover-brand">
          <div className="cover-brand-icon">LP</div>
          <span className="cover-brand-text">Lycon Planning</span>
        </div>

        <div className="cover-main">
          <h1 className="cover-title">은퇴 준비 상태 진단 보고서</h1>
          <p className="cover-subtitle">종합 재무 진단 및 은퇴 전략 제안</p>
        </div>

        <div className="cover-info">
          <div className="cover-info-item">
            <span className="cover-info-label">고객명</span>
            <span className="cover-info-value">{userState?.name || '테스트'}님 ({userState?.age || 40}세)</span>
          </div>
          <div className="cover-info-divider"></div>
          <div className="cover-info-item">
            <span className="cover-info-label">작성일</span>
            <span className="cover-info-value">{formattedDate}</span>
          </div>
        </div>
      </div>
    </div>
  )

  // Render Left Slide 2: Retirement Asset Readiness
  const renderLeftSlide2 = () => (
    <div className="left-slide">
      <div className="slide-asset">
        {/* Header */}
        <div className="asset-header">
          <h1 className="asset-title">순자산 관점 분석</h1>
          <div className="asset-divider"></div>
        </div>

        {/* KPI Grid */}
        <div className="asset-kpi-grid">
          {/* KPI 1: Current Asset */}
          <div className="asset-kpi-card">
            <div className="asset-kpi-label">현재 총자산</div>
            <div className="asset-kpi-value">
              <span className="asset-kpi-number">6.92</span>
              <span className="asset-kpi-unit">억원</span>
            </div>
            <div className="asset-kpi-status">
              부채 비중 33.5% (양호)
            </div>
          </div>

          {/* KPI 2: Target Asset */}
          <div className="asset-kpi-card">
            <div className="asset-kpi-label">목표 은퇴자산</div>
            <div className="asset-kpi-value">
              <span className="asset-kpi-number" style={{color: '#7c3aed'}}>50</span>
              <span className="asset-kpi-unit">억원</span>
            </div>
            <div className="asset-kpi-status">
              50세 달성 목표
            </div>
          </div>

          {/* KPI 3: Expected Asset */}
          <div className="asset-kpi-card">
            <div className="asset-kpi-label">예상 은퇴자산</div>
            <div className="asset-kpi-value">
              <span className="asset-kpi-number">14.13</span>
              <span className="asset-kpi-unit">억원</span>
            </div>
            <div className="asset-kpi-status asset-kpi-status-bad">
              목표 대비 35.87억 부족
            </div>
          </div>

          {/* KPI 4: Achievement Rate */}
          <div className="asset-kpi-card asset-kpi-card-danger">
            <div className="asset-kpi-label">목표 달성률</div>
            <div className="asset-kpi-value">
              <span className="asset-kpi-number asset-kpi-number-bad">28.3</span>
              <span className="asset-kpi-unit">%</span>
            </div>
            <div className="asset-kpi-status asset-kpi-status-danger">
              위험 단계
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Net Worth Distribution Chart Data (memoized to prevent re-renders)
  const netWorthChartData = useMemo(() => {
    const getAgeGroup = (age: number): AgeGroup => {
      if (age < 30) return '29세이하'
      if (age < 40) return '30대'
      if (age < 50) return '40대'
      if (age < 60) return '50대'
      if (age < 65) return '60대'
      return '65세이상'
    }

    const currentAge = userState?.age || 40
    const userAgeGroup = getAgeGroup(currentAge)
    const ageGroupData = householdFinance2025[userAgeGroup]
    const ageGroupPercentiles = estimatePercentiles(ageGroupData.netWorth.median)
    const netWorth = userState?.currentAsset ? userState.currentAsset / 10000 : 6.92

    // 백분위 계산
    const calculatePercentile = (value: number): number => {
      const valueInManwon = value * 10000
      const { p10, p20, p30, p40, p60, p70, p80, p90 } = ageGroupPercentiles
      const median = ageGroupData.netWorth.median

      if (valueInManwon <= p10) return Math.max(1, Math.round((valueInManwon / p10) * 10))
      if (valueInManwon <= p20) return 10 + Math.round(((valueInManwon - p10) / (p20 - p10)) * 10)
      if (valueInManwon <= p30) return 20 + Math.round(((valueInManwon - p20) / (p30 - p20)) * 10)
      if (valueInManwon <= p40) return 30 + Math.round(((valueInManwon - p30) / (p40 - p30)) * 10)
      if (valueInManwon <= median) return 40 + Math.round(((valueInManwon - p40) / (median - p40)) * 10)
      if (valueInManwon <= p60) return 50 + Math.round(((valueInManwon - median) / (p60 - median)) * 10)
      if (valueInManwon <= p70) return 60 + Math.round(((valueInManwon - p60) / (p70 - p60)) * 10)
      if (valueInManwon <= p80) return 70 + Math.round(((valueInManwon - p70) / (p80 - p70)) * 10)
      if (valueInManwon <= p90) return 80 + Math.round(((valueInManwon - p80) / (p90 - p80)) * 10)
      const extraRatio = Math.min((valueInManwon - p90) / p90, 1)
      return Math.min(99, 90 + Math.round(extraRatio * 9))
    }

    const userPercentile = calculatePercentile(netWorth)

    // 사용자 구간 계산
    const getUserPercentileRange = () => {
      const valueInManwon = netWorth * 10000
      const { p10, p20, p30, p40, p60, p70, p80, p90 } = ageGroupPercentiles
      const median = ageGroupData.netWorth.median

      if (valueInManwon <= p10) return { low: 0, high: 10, lowValue: 0, highValue: p10 }
      if (valueInManwon <= p20) return { low: 10, high: 20, lowValue: p10, highValue: p20 }
      if (valueInManwon <= p30) return { low: 20, high: 30, lowValue: p20, highValue: p30 }
      if (valueInManwon <= p40) return { low: 30, high: 40, lowValue: p30, highValue: p40 }
      if (valueInManwon <= median) return { low: 40, high: 50, lowValue: p40, highValue: median }
      if (valueInManwon <= p60) return { low: 50, high: 60, lowValue: median, highValue: p60 }
      if (valueInManwon <= p70) return { low: 60, high: 70, lowValue: p60, highValue: p70 }
      if (valueInManwon <= p80) return { low: 70, high: 80, lowValue: p70, highValue: p80 }
      if (valueInManwon <= p90) return { low: 80, high: 90, lowValue: p80, highValue: p90 }
      return { low: 90, high: 100, lowValue: p90, highValue: p90 * 2 }
    }

    const userRange = getUserPercentileRange()

    // 정규분포 곡선 생성
    const bellData: number[] = []
    const mean = 50
    const std = 18
    for (let i = 0; i <= 100; i++) {
      const y = Math.exp(-0.5 * Math.pow((i - mean) / std, 2)) / (std * Math.sqrt(2 * Math.PI))
      bellData.push(y * 1000)
    }

    const labels = Array.from({ length: 101 }, (_, i) => i)
    const highlightData = bellData.map((value, index) =>
      index >= userRange.low && index <= userRange.high ? value : null
    )

    const chartData = {
      labels,
      datasets: [
        {
          data: bellData,
          fill: true,
          backgroundColor: 'rgba(67, 97, 238, 0.2)',
          borderColor: 'rgba(67, 97, 238, 0.8)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
        {
          data: highlightData,
          fill: true,
          backgroundColor: 'rgba(239, 68, 68, 0.4)',
          borderColor: 'transparent',
          borderWidth: 0,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
      ],
    }

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { intersect: false, mode: 'index' as const },
      scales: { x: { display: false }, y: { display: false } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
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
          },
        },
      },
    }

    const formatCurrency = (value: number) => {
      if (value >= 10000) return `${(value / 10000).toFixed(1)}억원`
      return `${value.toLocaleString()}만원`
    }

    return {
      userAgeGroup,
      ageGroupData,
      netWorth,
      userPercentile,
      userRange,
      chartData,
      chartOptions,
      formatCurrency,
    }
  }, [userState?.age, userState?.currentAsset])

  // Render Left Slide: Net Worth Distribution
  const renderLeftSlideNetWorth = () => {
    const {
      userAgeGroup,
      ageGroupData,
      netWorth,
      userPercentile,
      userRange,
      chartData,
      chartOptions,
      formatCurrency,
    } = netWorthChartData

    return (
      <div className="left-slide">
        <div className="slide-networth">
          {/* Header - 인정 + 반전 */}
          <div className="asset-header">
            <h1 className="asset-title">자산은 잘 모으셨습니다. 하지만...</h1>
            <p className="asset-subtitle">모으는 건 잘하셨습니다. 불리는 건 별개입니다.</p>
            <div className="asset-divider"></div>
          </div>

          {/* Chart */}
          <div className="networth-chart">
            <Line data={chartData} options={chartOptions} />
          </div>

          {/* Distribution Labels */}
          <div className="networth-labels">
            <span>하위</span>
            <span>중위</span>
            <span>상위</span>
          </div>

          {/* Result Badge - 인정 */}
          <div className="networth-result">
            <div className="networth-badge">
              상위 <strong>{100 - userRange.high}~{100 - userRange.low}%</strong> 구간
            </div>
            <p className="networth-detail">
              {userAgeGroup} 가구 중 <strong>상위 {100 - userRange.high}~{100 - userRange.low}%</strong>입니다.
              <span className="networth-good"> 자산을 모으는 데는 성공하셨습니다.</span>
            </p>
          </div>

          {/* Reference Stats */}
          <div className="networth-reference">
            <div className="networth-ref-item">
              <span className="networth-ref-label">동 연령대 평균</span>
              <span className="networth-ref-value">{formatCurrency(ageGroupData.netWorth.mean)}</span>
            </div>
            <div className="networth-ref-item">
              <span className="networth-ref-label">동 연령대 중위</span>
              <span className="networth-ref-value">{formatCurrency(ageGroupData.netWorth.median)}</span>
            </div>
            <div className="networth-ref-item">
              <span className="networth-ref-label">나의 순자산</span>
              <span className="networth-ref-value networth-ref-highlight">{netWorth.toFixed(2)}억원</span>
            </div>
          </div>

          {/* 반전 메시지 */}
          <div className="networth-warning">
            <p className="warning-text">
              하지만 이 자산들이 노후를 위해<br />
              <strong>제대로 일하고 있는지</strong>는 별개의 문제입니다.
            </p>
          </div>

          {/* Source Note */}
          <p className="networth-note">
            * 통계청 2025 가계금융복지조사 기준
          </p>
        </div>
      </div>
    )
  }

  // 자산 데이터 계산 (memoized)
  const assetData = useMemo(() => {
    // userState에서 데이터 추출 (만원 단위)
    const realEstate = userState?.currentAsset ? userState.currentAsset * 0.6 : 41520 // 부동산 (임시 비율)
    const savings = userState?.currentAsset ? userState.currentAsset * 0.1 : 6920 // 예금/적금
    const stocks = userState?.currentAsset ? userState.currentAsset * 0.15 : 10380 // 주식
    const otherFinancial = userState?.currentAsset ? userState.currentAsset * 0.05 : 3460 // 기타 금융
    const retirementPension = userState?.currentAsset ? userState.currentAsset * 0.07 : 4844 // 퇴직연금
    const privatePension = userState?.currentAsset ? userState.currentAsset * 0.03 : 2076 // 개인연금

    // 대분류 합계
    const totalRealEstate = realEstate
    const totalFinancial = savings + stocks + otherFinancial
    const totalPension = retirementPension + privatePension
    const totalAsset = totalRealEstate + totalFinancial + totalPension

    // 비율 계산
    const realEstateRatio = Math.round((totalRealEstate / totalAsset) * 100)
    const financialRatio = Math.round((totalFinancial / totalAsset) * 100)
    const pensionRatio = 100 - realEstateRatio - financialRatio

    // 상세 항목
    const details = [
      { label: '부동산', amount: realEstate, color: '#4361ee', category: 'realEstate' },
      { label: '예금/적금', amount: savings, color: '#10b981', category: 'financial' },
      { label: '주식', amount: stocks, color: '#8b5cf6', category: 'financial' },
      { label: '기타 금융자산', amount: otherFinancial, color: '#06b6d4', category: 'financial' },
      { label: '퇴직연금', amount: retirementPension, color: '#f59e0b', category: 'pension' },
      { label: '개인연금', amount: privatePension, color: '#ec4899', category: 'pension' },
    ]

    // 대분류 데이터
    const categories = [
      { label: '부동산', amount: totalRealEstate, ratio: realEstateRatio, color: '#4361ee' },
      { label: '금융자산', amount: totalFinancial, ratio: financialRatio, color: '#10b981' },
      { label: '연금자산', amount: totalPension, ratio: pensionRatio, color: '#f59e0b' },
    ]

    return {
      totalAsset,
      totalRealEstate,
      totalFinancial,
      totalPension,
      realEstateRatio,
      financialRatio,
      pensionRatio,
      details,
      categories,
    }
  }, [userState])

  // 부채 데이터 계산 (memoized)
  const debtData = useMemo(() => {
    // 임시 데이터 (추후 userState에서 가져올 예정)
    const mortgageAmount = 25000 // 주담대 2.5억
    const mortgageRate = 4.2 // 연 4.2%
    const creditLoanAmount = 3000 // 신용대출 3천만원
    const creditLoanRate = 6.8 // 연 6.8%
    const otherDebtAmount = 0 // 기타 부채
    const otherDebtRate = 0

    const totalDebt = mortgageAmount + creditLoanAmount + otherDebtAmount

    // 월 이자 계산 (단리 기준)
    const mortgageMonthlyInterest = Math.round((mortgageAmount * mortgageRate / 100) / 12)
    const creditLoanMonthlyInterest = Math.round((creditLoanAmount * creditLoanRate / 100) / 12)
    const otherDebtMonthlyInterest = Math.round((otherDebtAmount * otherDebtRate / 100) / 12)
    const totalMonthlyInterest = mortgageMonthlyInterest + creditLoanMonthlyInterest + otherDebtMonthlyInterest

    // 원금 상환액 (가정: 주담대 30년, 신용대출 5년)
    const mortgageMonthlyPrincipal = Math.round(mortgageAmount / (30 * 12))
    const creditLoanMonthlyPrincipal = Math.round(creditLoanAmount / (5 * 12))
    const totalMonthlyPrincipal = mortgageMonthlyPrincipal + creditLoanMonthlyPrincipal

    const totalMonthlyPayment = totalMonthlyInterest + totalMonthlyPrincipal

    // 연소득 (월소득 * 12)
    const monthlyIncome = userState?.monthlySaving ? (userState.monthlySaving + (userState.monthlyExpense || 250)) : 600
    const annualIncome = monthlyIncome * 12

    // DSR 계산 (연간 원리금상환액 / 연소득)
    const annualPayment = totalMonthlyPayment * 12
    const dsr = Math.round((annualPayment / annualIncome) * 100)

    // 평균 이자율 계산
    const weightedRate = totalDebt > 0
      ? ((mortgageAmount * mortgageRate) + (creditLoanAmount * creditLoanRate) + (otherDebtAmount * otherDebtRate)) / totalDebt
      : 0

    // 부채 항목 상세
    const debts = [
      {
        label: '주택담보대출',
        amount: mortgageAmount,
        rate: mortgageRate,
        monthlyInterest: mortgageMonthlyInterest,
        monthlyPrincipal: mortgageMonthlyPrincipal,
        color: '#ef4444'
      },
      {
        label: '신용대출',
        amount: creditLoanAmount,
        rate: creditLoanRate,
        monthlyInterest: creditLoanMonthlyInterest,
        monthlyPrincipal: creditLoanMonthlyPrincipal,
        color: '#f97316'
      },
    ]

    // 기타 부채가 있으면 추가
    if (otherDebtAmount > 0) {
      debts.push({
        label: '기타 부채',
        amount: otherDebtAmount,
        rate: otherDebtRate,
        monthlyInterest: otherDebtMonthlyInterest,
        monthlyPrincipal: Math.round(otherDebtAmount / (3 * 12)),
        color: '#eab308'
      })
    }

    return {
      totalDebt,
      totalMonthlyInterest,
      totalMonthlyPrincipal,
      totalMonthlyPayment,
      dsr,
      annualIncome,
      weightedRate,
      debts,
      monthlyIncome,
    }
  }, [userState])

  // 금리충격 테스트 state
  const [rateShock, setRateShock] = useState(0) // -2, -1, 0, +1, +2

  // 금액 포맷팅 함수
  const formatAmount = (amount: number) => {
    if (amount >= 10000) {
      const billions = amount / 10000
      return `${billions.toFixed(2)}억원`
    }
    return `${amount.toLocaleString()}만원`
  }

  // 유동성 데이터 정의
  const liquidityInfo: Record<string, { level: 'high' | 'medium' | 'low', label: string, days: string }> = {
    '부동산': { level: 'low', label: '낮음', days: '3-6개월' },
    '예금/적금': { level: 'high', label: '높음', days: '즉시' },
    '주식': { level: 'high', label: '높음', days: '1-3일' },
    '기타 금융자산': { level: 'medium', label: '보통', days: '1-2주' },
    '퇴직연금': { level: 'low', label: '제한적', days: '퇴직 시' },
    '개인연금': { level: 'low', label: '제한적', days: '만기 후' },
    '금융자산': { level: 'high', label: '높음', days: '1-7일' },
    '연금자산': { level: 'low', label: '제한적', days: '만기 후' },
  }

  // Render Left Slide: 자산 구성 개요 (슬라이드 2)
  const renderLeftSlideAssetOverview = () => {
    const { totalAsset, categories } = assetData
    const { totalDebt, totalMonthlyInterest } = debtData

    // 부동산 비중 계산
    const realEstateCategory = categories.find(c => c.label === '부동산')
    const financialCategory = categories.find(c => c.label === '금융자산')
    const pensionCategory = categories.find(c => c.label === '연금자산')
    const realEstateRatio = realEstateCategory ? realEstateCategory.ratio : 0
    const financialRatio = financialCategory ? financialCategory.ratio : 0
    const pensionRatio = pensionCategory ? pensionCategory.ratio : 0

    // 수익형 vs 비수익형 계산
    // 비수익형: 거주용 부동산 (전체 부동산의 80%로 가정)
    // 수익형: 금융자산 + 연금자산 + 임대 부동산(20%)
    const nonproductiveRatio = Math.round(realEstateRatio * 0.8)
    const productiveRatio = 100 - nonproductiveRatio

    return (
      <div className="left-slide">
        <div className="slide-asset-debt-structure">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">구조가 문제입니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 메시지 - 비효율 강조 */}
          <p className="structure-message">
            자산의 {realEstateRatio}%가 부동산입니다.<br />
            <strong>깔고 앉은 돈</strong>이 너무 많습니다.
          </p>

          {/* 수익형 vs 비수익형 비율 */}
          <div className="productivity-ratio">
            <div className="productivity-header">
              <span className="productivity-title">자산 효율성</span>
            </div>
            <div className="productivity-bar">
              <div
                className="productivity-segment nonproductive"
                style={{ width: `${nonproductiveRatio}%` }}
              >
                <span className="segment-label">비수익형 {nonproductiveRatio}%</span>
              </div>
              <div
                className="productivity-segment productive"
                style={{ width: `${productiveRatio}%` }}
              >
                <span className="segment-label">수익형 {productiveRatio}%</span>
              </div>
            </div>
            <div className="productivity-legend">
              <div className="legend-item">
                <span className="legend-dot nonproductive"></span>
                <span className="legend-text">거주용 부동산 (노는 돈)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot productive"></span>
                <span className="legend-text">금융/연금/임대 (일하는 돈)</span>
              </div>
            </div>
          </div>

          {/* 자산 + 부채 컨테이너 */}
          <div className="structure-container">
            {/* 자산 섹션 */}
            <div className="structure-section asset-section">
              <div className="section-header">
                <span className="section-title">자산 구성</span>
                <span className="section-total">{formatAmount(totalAsset)}</span>
              </div>
              <div className="structure-items">
                {categories.map((cat, idx) => (
                  <div key={idx} className={`structure-item ${cat.label === '부동산' ? 'highlight' : ''}`}>
                    <div className="structure-item-dot" style={{ backgroundColor: cat.color }}></div>
                    <span className="structure-item-label">{cat.label}</span>
                    <span className="structure-item-value">{cat.ratio}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 부채 섹션 */}
            <div className="structure-section debt-section">
              <div className="section-header">
                <span className="section-title">부채 현황</span>
                <span className="section-total">{formatAmount(totalDebt)}</span>
              </div>
              <div className="debt-summary-items">
                <div className="debt-summary-item">
                  <span className="debt-summary-label">총 부채</span>
                  <span className="debt-summary-value">{formatAmount(totalDebt)}</span>
                </div>
                <div className="debt-summary-item">
                  <span className="debt-summary-label">월 이자</span>
                  <span className="debt-summary-value">{totalMonthlyInterest.toLocaleString()}만원</span>
                </div>
              </div>
            </div>
          </div>

          {/* 하단 코멘트 - 비효율 증명 */}
          <div className="structure-comment warning">
            <p>
              노후를 책임질 <strong>금융자산 비중이 {financialRatio + pensionRatio}%</strong>입니다.<br />
              이 구조로는 필요 수익률 달성이 어렵습니다.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render Left Slide: 부채 구성 + DSR 분석 (슬라이드 3)
  const renderLeftSlideDebtOverview = () => {
    const { totalDebt, totalMonthlyInterest, totalMonthlyPayment, dsr, debts } = debtData

    // DSR 상태 판단
    const getDsrStatus = (dsrValue: number) => {
      if (dsrValue <= 30) return { label: '안정', color: '#10b981', description: '부채 상환 부담이 적정 수준입니다' }
      if (dsrValue <= 40) return { label: '주의', color: '#f59e0b', description: '부채 상환 비중이 다소 높습니다' }
      return { label: '위험', color: '#ef4444', description: '부채 상환 부담이 과중합니다' }
    }

    const dsrStatus = getDsrStatus(dsr)

    return (
      <div className="left-slide">
        <div className="slide-debt-overview">
          {/* Header */}
          <div className="asset-header">
            <div className="asset-header-row">
              <h1 className="asset-title">부채 현황</h1>
              <div className="asset-header-value">
                <span className="asset-header-label">총부채</span>
                <span className="asset-header-amount">{formatAmount(totalDebt)}</span>
              </div>
            </div>
            <div className="asset-divider"></div>
          </div>

          {/* 부채 항목 리스트 */}
          <div className="debt-items">
            {debts.map((debt, idx) => (
              <div key={idx} className="debt-item">
                <div className="debt-item-header">
                  <div className="debt-item-dot" style={{ backgroundColor: debt.color }}></div>
                  <span className="debt-item-label">{debt.label}</span>
                  <span className="debt-item-rate">연 {debt.rate}%</span>
                </div>
                <div className="debt-item-details">
                  <div className="debt-item-amount">
                    <span className="debt-item-amount-label">원금</span>
                    <span className="debt-item-amount-value">{formatAmount(debt.amount)}</span>
                  </div>
                  <div className="debt-item-monthly">
                    <span className="debt-item-monthly-label">월 이자</span>
                    <span className="debt-item-monthly-value">{debt.monthlyInterest.toLocaleString()}만원</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DSR 및 월 상환 통합 섹션 */}
          <div className="debt-bottom-section">
            <div className="debt-monthly-compact">
              <div className="debt-monthly-item">
                <span className="debt-monthly-label">월 이자</span>
                <span className="debt-monthly-value">{totalMonthlyInterest.toLocaleString()}만원</span>
              </div>
              <div className="debt-monthly-divider"></div>
              <div className="debt-monthly-item">
                <span className="debt-monthly-label">월 상환액</span>
                <span className="debt-monthly-value highlight">{totalMonthlyPayment.toLocaleString()}만원</span>
              </div>
              <div className="debt-monthly-divider"></div>
              <div className="debt-monthly-item">
                <span className="debt-monthly-label">DSR</span>
                <div className="debt-dsr-inline">
                  <span className="debt-dsr-value-compact" style={{ color: dsrStatus.color }}>{dsr}%</span>
                  <span className="debt-dsr-badge-compact" style={{ backgroundColor: dsrStatus.color }}>{dsrStatus.label}</span>
                </div>
              </div>
            </div>
            <div className="debt-dsr-bar">
              <div className="debt-dsr-bar-fill" style={{ width: `${Math.min(dsr, 100)}%`, backgroundColor: dsrStatus.color }}></div>
              <div className="debt-dsr-bar-markers">
                <span className="debt-dsr-marker" style={{ left: '30%' }}>30%</span>
                <span className="debt-dsr-marker" style={{ left: '40%' }}>40%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Left Slide: 금리충격 테스트 (슬라이드 5)
  const renderLeftSlideRateShockTest = () => {
    const { debts, totalMonthlyInterest, monthlyIncome } = debtData

    // 금리 변동에 따른 이자 계산
    const calculateShockedInterest = (shock: number) => {
      return debts.reduce((sum, debt) => {
        const newRate = Math.max(0, debt.rate + shock)
        return sum + Math.round((debt.amount * newRate / 100) / 12)
      }, 0)
    }

    const shockedInterest = calculateShockedInterest(rateShock)
    const interestDiff = shockedInterest - totalMonthlyInterest
    const annualDiff = interestDiff * 12

    // 각 충격 시나리오별 이자
    const scenarios = [-2, -1, 0, 1, 2].map(shock => ({
      shock,
      interest: calculateShockedInterest(shock),
      diff: calculateShockedInterest(shock) - totalMonthlyInterest
    }))

    return (
      <div className="left-slide">
        <div className="slide-rate-shock">
          {/* Header */}
          <div className="asset-header">
            <div className="asset-header-row">
              <h1 className="asset-title">금리 충격 테스트</h1>
              <span className="asset-subtitle">금리 변동 시뮬레이션</span>
            </div>
            <div className="asset-divider"></div>
          </div>

          {/* 금리 조절 버튼 */}
          <div className="rate-shock-controls">
            <span className="rate-shock-label">금리 변동폭</span>
            <div className="rate-shock-buttons">
              {[-2, -1, 0, 1, 2].map(shock => (
                <button
                  key={shock}
                  className={`rate-shock-btn ${rateShock === shock ? 'active' : ''}`}
                  onClick={() => setRateShock(shock)}
                >
                  {shock > 0 ? `+${shock}%p` : shock === 0 ? '현재' : `${shock}%p`}
                </button>
              ))}
            </div>
          </div>

          {/* 현재 선택된 시나리오 결과 */}
          <div className="rate-shock-result">
            <div className="rate-shock-result-header">
              <span className="rate-shock-result-label">
                {rateShock === 0 ? '현재 금리 기준' : `금리 ${rateShock > 0 ? '+' : ''}${rateShock}%p 변동 시`}
              </span>
            </div>
            <div className="rate-shock-result-grid">
              <div className="rate-shock-result-item">
                <span className="rate-shock-result-item-label">월 이자</span>
                <span className="rate-shock-result-item-value">{shockedInterest.toLocaleString()}만원</span>
                {interestDiff !== 0 && (
                  <span className={`rate-shock-result-item-diff ${interestDiff > 0 ? 'negative' : 'positive'}`}>
                    {interestDiff > 0 ? '+' : ''}{interestDiff.toLocaleString()}만원
                  </span>
                )}
              </div>
              <div className="rate-shock-result-item">
                <span className="rate-shock-result-item-label">연간 이자 변동</span>
                <span className={`rate-shock-result-item-value ${annualDiff > 0 ? 'negative' : annualDiff < 0 ? 'positive' : ''}`}>
                  {annualDiff === 0 ? '-' : `${annualDiff > 0 ? '+' : ''}${annualDiff.toLocaleString()}만원`}
                </span>
              </div>
              <div className="rate-shock-result-item">
                <span className="rate-shock-result-item-label">소득 대비 이자</span>
                <span className="rate-shock-result-item-value">
                  {Math.round((shockedInterest / monthlyIncome) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* 시나리오 비교 차트 */}
          <div className="rate-shock-chart">
            <div className="rate-shock-chart-title">시나리오별 월 이자 비교</div>
            <div className="rate-shock-bars">
              {scenarios.map((s, idx) => {
                const maxInterest = Math.max(...scenarios.map(x => x.interest))
                const barHeight = (s.interest / maxInterest) * 100
                const isActive = s.shock === rateShock
                return (
                  <div key={idx} className={`rate-shock-bar-item ${isActive ? 'active' : ''}`}>
                    <div className="rate-shock-bar-value">{s.interest}만원</div>
                    <div className="rate-shock-bar-wrapper">
                      <div
                        className="rate-shock-bar"
                        style={{
                          height: `${barHeight}%`,
                          backgroundColor: s.shock < 0 ? '#10b981' : s.shock === 0 ? '#6366f1' : '#ef4444'
                        }}
                      ></div>
                    </div>
                    <div className="rate-shock-bar-label">
                      {s.shock > 0 ? `+${s.shock}%p` : s.shock === 0 ? '현재' : `${s.shock}%p`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 현금흐름 데이터 계산 (memoized)
  const cashflowData = useMemo(() => {
    // 월 소득 (userState에서 가져오거나 기본값)
    const monthlyIncome = userState?.monthlySaving
      ? (userState.monthlySaving + (userState.monthlyExpense || 250))
      : 600

    // 월 지출 (생활비 + 필수지출)
    const monthlyExpense = userState?.monthlyExpense || 420

    // 부채 상환액
    const { totalMonthlyPayment } = debtData

    // 부채 차감 전 가용액
    const beforeDebtPayment = monthlyIncome - monthlyExpense

    // 최종 저축/투자 가능액
    const availableSavings = beforeDebtPayment - totalMonthlyPayment

    // 저축률
    const savingsRate = monthlyIncome > 0 ? Math.round((availableSavings / monthlyIncome) * 100 * 10) / 10 : 0

    // 권장 저축률 (40대 기준)
    const recommendedRate = { min: 20, max: 25 }

    // 저축률 상태
    const savingsStatus = savingsRate < 10 ? 'danger' : savingsRate < 20 ? 'warning' : 'good'

    return {
      monthlyIncome,
      monthlyExpense,
      beforeDebtPayment,
      totalMonthlyPayment,
      availableSavings,
      savingsRate,
      recommendedRate,
      savingsStatus
    }
  }, [userState, debtData])

  // Render Left Slide: 월별 가용 현금흐름 분석 (Part 1)
  const renderLeftSlideMonthlyCashflow = () => {
    const {
      monthlyIncome,
      monthlyExpense,
      beforeDebtPayment,
      totalMonthlyPayment,
      availableSavings
    } = cashflowData

    // 워터폴 차트 옵션
    const waterfallOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(11, 24, 40, 0.95)',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontFamily: 'Pretendard' },
        formatter: (params: any) => {
          const item = params[1] || params[0]
          const name = item.name
          const value = item.value
          const isNegative = name === '생활비/필수지출' || name === '부채상환'
          return `<div style="font-weight:600;margin-bottom:4px">${name}</div>
                  <div>${isNegative ? '-' : ''}${value.toLocaleString()}만원</div>`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        splitLine: { show: false },
        axisLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.5)' } },
        axisLabel: {
          color: '#9CA3AF',
          interval: 0,
          fontFamily: 'Pretendard',
          fontSize: 11
        },
        data: ['월 총소득', '생활비/필수지출', '부채차감전 가용액', '부채상환', '최종 저축가능액']
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
        axisLabel: {
          color: '#6B7280',
          fontFamily: 'Pretendard',
          formatter: (value: number) => `${value}`
        }
      },
      series: [
        {
          name: 'Placeholder',
          type: 'bar',
          stack: 'Total',
          itemStyle: {
            borderColor: 'transparent',
            color: 'transparent'
          },
          emphasis: {
            itemStyle: {
              borderColor: 'transparent',
              color: 'transparent'
            }
          },
          data: [0, beforeDebtPayment, 0, availableSavings, 0]
        },
        {
          name: '금액',
          type: 'bar',
          stack: 'Total',
          barWidth: '50%',
          label: {
            show: true,
            position: 'top',
            color: '#fff',
            fontFamily: 'Pretendard',
            fontWeight: 'bold',
            fontSize: 12,
            formatter: (params: any) => {
              if (['생활비/필수지출', '부채상환'].includes(params.name)) {
                return '-' + params.value.toLocaleString()
              }
              return params.value.toLocaleString()
            }
          },
          data: [
            { value: monthlyIncome, itemStyle: { color: '#3B82F6' }, name: '월 총소득' },
            { value: monthlyExpense, itemStyle: { color: '#EF4444' }, name: '생활비/필수지출' },
            { value: beforeDebtPayment, itemStyle: { color: '#6B7280' }, name: '부채차감전 가용액' },
            { value: totalMonthlyPayment, itemStyle: { color: '#EF4444' }, name: '부채상환' },
            { value: availableSavings, itemStyle: { color: availableSavings > 0 ? '#10B981' : '#EF4444' }, name: '최종 저축가능액' }
          ]
        }
      ]
    }

    return (
      <div className="left-slide">
        <div className="slide-cashflow">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">투자 재원, 더 늘릴 수 있습니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* Waterfall Chart */}
          <div className="cashflow-chart-container">
            <div className="cashflow-chart-header">
              <span className="cashflow-chart-label">월 가용 현금흐름 구조 (Waterfall)</span>
              <span className="cashflow-chart-unit">단위: 만원</span>
            </div>
            <div className="cashflow-chart">
              <ReactECharts
                option={waterfallOption}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
            {/* Legend */}
            <div className="cashflow-legend">
              <div className="cashflow-legend-item">
                <span className="cashflow-legend-dot" style={{ background: '#3B82F6' }}></span>
                <span>소득(유입)</span>
              </div>
              <div className="cashflow-legend-item">
                <span className="cashflow-legend-dot" style={{ background: '#EF4444' }}></span>
                <span>지출(유출)</span>
              </div>
              <div className="cashflow-legend-item">
                <span className="cashflow-legend-dot" style={{ background: '#6B7280' }}></span>
                <span>중간잔액</span>
              </div>
              <div className="cashflow-legend-item">
                <span className="cashflow-legend-dot" style={{ background: '#10B981' }}></span>
                <span>최종가용재원</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // Render Left Slide: 저축률 분석 (슬라이드 26)
  const renderLeftSlideExpenseStructure = () => {
    const {
      savingsRate,
      recommendedRate,
      savingsStatus
    } = cashflowData

    return (
      <div className="left-slide">
        <div className="slide-cashflow">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">저축률 분석</h1>
            <div className="asset-divider"></div>
          </div>

          {/* Savings Rate Comparison */}
          <div className="savings-analysis-content">
            <div className="savings-rate-display">
              <span className="savings-rate-label">현재 저축률</span>
              <div className="savings-rate-value-wrapper">
                <span className={`savings-rate-value savings-${savingsStatus}`}>
                  {savingsRate}%
                </span>
                <span className={`savings-rate-badge badge-${savingsStatus}`}>
                  {savingsStatus === 'danger' ? '위험' : savingsStatus === 'warning' ? '주의' : '양호'}
                </span>
              </div>
            </div>

            <div className="savings-rate-bar-container">
              <div className="savings-rate-bar-bg">
                <div
                  className={`savings-rate-bar-fill savings-fill-${savingsStatus}`}
                  style={{ width: `${Math.min(savingsRate, 100)}%` }}
                ></div>
                <div
                  className="savings-rate-bar-target"
                  style={{ left: `${recommendedRate.min}%` }}
                >
                  <span className="target-line"></span>
                  <span className="target-label">권장 {recommendedRate.min}%</span>
                </div>
              </div>
            </div>

            <div className="savings-rate-guide">
              <div className="guide-header">
                <span className="guide-title">연령대별 권장 저축률</span>
                <span className="guide-age">{userState?.age || 40}세 기준</span>
              </div>
              <div className="guide-range">
                <span className="range-value">{recommendedRate.min}% ~ {recommendedRate.max}%</span>
                <span className={`range-gap ${savingsRate < recommendedRate.min ? 'gap-negative' : 'gap-positive'}`}>
                  목표 대비 {savingsRate >= recommendedRate.min ? '+' : ''}{(savingsRate - recommendedRate.min).toFixed(1)}%p
                </span>
              </div>
            </div>

            <div className="savings-insight-box">
              {savingsStatus === 'danger' ? (
                <p>현재 저축률이 권장 수준에 크게 미달합니다. 지출 구조 개선이 시급합니다.</p>
              ) : savingsStatus === 'warning' ? (
                <p>저축률이 권장 수준에 근접하지만, 추가 개선 여지가 있습니다.</p>
              ) : (
                <p>저축률이 권장 수준을 충족합니다. 현재 저축 습관을 유지하세요.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Left Slide: Part 1 -> Part 2 전환 슬라이드
  const renderLeftSlideTransition = () => (
    <div className="left-slide">
      <div className="slide-transition">
        <div className="transition-content">
          <p className="transition-label">PART 2 완료</p>
          <h1 className="transition-title">왜 이렇게 어려울까요?</h1>
          <div className="transition-divider"></div>
          <p className="transition-subtitle">
            고객님 잘못이 아닙니다.<br />
            <strong>'자산 배치'</strong>의 문제입니다.
          </p>
          <div className="transition-killer-quote">
            <p className="killer-text">
              "지금 자산 구조로는<br />
              워렌 버핏이 와도 어렵습니다"
            </p>
          </div>
          <div className="transition-next">
            <span className="transition-next-label">PART 3</span>
            <span className="transition-next-title">현재 자산 구조 분석</span>
          </div>
        </div>
      </div>
    </div>
  )

  // Render Left Slide 3: Asset Growth Simulation
  const renderLeftSlide3 = () => {
    // Chart data - 40세~50세 (2025~2035)
    const years = ['40세', '42세', '44세', '46세', '48세', '50세']
    const currentTrend = [6.92, 8.36, 9.80, 11.24, 12.68, 14.13]
    const targetTrend = [6.92, 15.53, 24.15, 32.76, 41.38, 50.00]

    const chartOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(11, 24, 40, 0.95)',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontFamily: 'Pretendard' },
        formatter: (params: any) => {
          const age = params[0].axisValue
          let result = `<div style="font-weight:600;margin-bottom:4px">${age}</div>`
          params.forEach((item: any) => {
            const color = item.seriesName === '목표 자산' ? '#D4AF37' : '#EF4444'
            result += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>
              <span>${item.seriesName}: ${item.value}억원</span>
            </div>`
          })
          return result
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: years,
        axisLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.5)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 11, fontFamily: 'Pretendard' },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '(억원)',
        min: 0,
        max: 60,
        nameTextStyle: { color: '#6B7280', fontSize: 10, fontFamily: 'Pretendard', padding: [0, 30, 0, 0] },
        splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)', type: 'dashed' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, fontFamily: 'Pretendard' },
        axisLine: { show: false }
      },
      series: [
        {
          name: '목표 자산',
          type: 'line',
          data: targetTrend,
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 2, color: '#D4AF37', type: 'dashed' },
          itemStyle: { color: '#D4AF37' },
          markPoint: {
            data: [
              {
                value: '50억',
                coord: [5, 50],
                itemStyle: { color: '#D4AF37' },
                label: {
                  show: true,
                  formatter: '목표 50억',
                  color: '#D4AF37',
                  fontFamily: 'Pretendard',
                  fontSize: 11,
                  fontWeight: 600,
                  position: 'left',
                  distance: 8
                }
              }
            ],
            symbol: 'circle',
            symbolSize: 8
          }
        },
        {
          name: '예상 경로',
          type: 'line',
          data: currentTrend,
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { width: 3, color: '#EF4444' },
          itemStyle: { color: '#EF4444', borderColor: '#fff', borderWidth: 1 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(239, 68, 68, 0.25)' },
                { offset: 1, color: 'rgba(239, 68, 68, 0)' }
              ]
            }
          },
          markPoint: {
            data: [
              {
                value: '14.13억',
                coord: [5, 14.13],
                itemStyle: { color: '#EF4444' },
                label: {
                  show: true,
                  formatter: '14.13억',
                  color: '#fff',
                  fontFamily: 'Pretendard',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: '#EF4444',
                  padding: [4, 8],
                  borderRadius: 4
                }
              }
            ],
            symbol: 'circle',
            symbolSize: 10
          }
        }
      ]
    }

    return (
      <div className="left-slide">
        <div className="slide-simulation">
          {/* Header */}
          <div className="simulation-header">
            <h1 className="simulation-title">순자산 고갈 시점 예측</h1>
            <div className="simulation-divider"></div>
          </div>

          {/* Chart Legend */}
          <div className="simulation-legend">
            <div className="simulation-legend-item">
              <span className="simulation-legend-dot simulation-legend-dot-current"></span>
              <span>예상 경로</span>
            </div>
            <div className="simulation-legend-item">
              <span className="simulation-legend-dot simulation-legend-dot-target"></span>
              <span>목표 자산 (50억)</span>
            </div>
          </div>

          {/* Chart Area */}
          <div className="simulation-chart">
            <ReactECharts
              option={chartOption}
              style={{ height: '280px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>

          {/* Summary Stats */}
          <div className="simulation-summary">
            <div className="simulation-summary-item">
              <span className="simulation-summary-label">현재 자산</span>
              <span className="simulation-summary-value">6.92억</span>
            </div>
            <div className="simulation-summary-arrow">→</div>
            <div className="simulation-summary-item">
              <span className="simulation-summary-label">10년 후 예상</span>
              <span className="simulation-summary-value">14.13억</span>
            </div>
            <div className="simulation-summary-divider"></div>
            <div className="simulation-summary-item">
              <span className="simulation-summary-label">연평균 성장률</span>
              <span className="simulation-summary-value simulation-summary-value-blue">7.4%</span>
            </div>
            <div className="simulation-summary-item">
              <span className="simulation-summary-label">목표 대비</span>
              <span className="simulation-summary-value simulation-summary-value-danger">-35.87억</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Left Slide 4: Retirement Cashflow Readiness
  const renderLeftSlide4 = () => (
    <div className="left-slide">
      <div className="slide-cashflow">
        {/* Header */}
        <div className="cashflow-header">
          <h1 className="cashflow-title">기대수명까지 필요 자금</h1>
          <div className="cashflow-divider"></div>
        </div>

        {/* KPI Grid - Simplified to 2 cards */}
        <div className="cashflow-kpi-grid">
          {/* KPI 1: Readiness Rate */}
          <div className="cashflow-kpi-card cashflow-kpi-card-danger">
            <div className="cashflow-kpi-label">현금흐름 준비율</div>
            <div className="cashflow-kpi-value">
              <span className="cashflow-kpi-number">23.8</span>
              <span className="cashflow-kpi-unit">%</span>
            </div>
            <div className="cashflow-kpi-status">위험 단계</div>
          </div>

          {/* KPI 2: Deficit */}
          <div className="cashflow-kpi-card cashflow-kpi-card-danger">
            <div className="cashflow-kpi-label">부족 자금 규모</div>
            <div className="cashflow-kpi-value">
              <span className="cashflow-kpi-number">-24.24</span>
              <span className="cashflow-kpi-unit">억원</span>
            </div>
            <div className="cashflow-kpi-status">유동성 확보 필요</div>
          </div>
        </div>

        {/* Chart Area - Expanded */}
        <div className="cashflow-chart-section-expanded">
          <div className="cashflow-chart-header">
            <h3 className="cashflow-chart-title">
              은퇴 후 40년간 자금 수요 vs 공급
            </h3>
            <span className="cashflow-chart-unit">단위: 억원</span>
          </div>

          {/* Horizontal Bar Chart */}
          <div className="cashflow-hbar-chart-expanded">
            {/* Demand bar */}
            <div className="cashflow-hbar-row">
              <span className="cashflow-hbar-label">총수요</span>
              <div className="cashflow-hbar-track">
                <div className="cashflow-hbar-demand" style={{width: '100%'}}>
                  <span className="cashflow-hbar-value">31.79</span>
                </div>
              </div>
            </div>

            {/* Supply bar (stacked) */}
            <div className="cashflow-hbar-row">
              <span className="cashflow-hbar-label">총공급</span>
              <div className="cashflow-hbar-track">
                <div className="cashflow-hbar-secured" style={{width: '23.8%'}}>
                  <span className="cashflow-hbar-value">7.55</span>
                </div>
                <div className="cashflow-hbar-deficit" style={{width: '76.2%'}}>
                  <span className="cashflow-hbar-value">24.24</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="cashflow-hbar-legend">
            <div className="cashflow-hbar-legend-item">
              <span className="cashflow-hbar-legend-box cashflow-hbar-legend-demand"></span>
              <span>총 지출 수요</span>
            </div>
            <div className="cashflow-hbar-legend-item">
              <span className="cashflow-hbar-legend-box cashflow-hbar-legend-secured"></span>
              <span>확보 현금흐름</span>
            </div>
            <div className="cashflow-hbar-legend-item">
              <span className="cashflow-hbar-legend-box cashflow-hbar-legend-deficit"></span>
              <span>부족분</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ========================================
  // Part 1: 신규 슬라이드
  // ========================================

  // ========== 전체 슬라이드 데이터 설정 ==========
  const STORAGE_KEY = 'professionalDiagnosisData'

  const defaultGlobalData = {
    // 고객 정보
    customerName: userState?.name || '고객',
    // 본인/배우자 정보
    currentAge: userState?.age || 40,
    spouseAge: 38,
    lifeExpectancy: 90, // 기대수명
    // 은퇴 목표
    targetRetirementAge: 55, // 목표 은퇴 나이
    targetMonthlyCashflow: 300, // 은퇴 후 목표 월현금흐름 (만원)
    targetAsset: 10, // 은퇴 시점 목표 자산규모 (억원)
    // 월 연금 수령액 (본인/배우자)
    nationalPensionPersonal: 85,
    nationalPensionSpouse: 65,
    retirementPensionPersonal: 55,
    retirementPensionSpouse: 35,
    privatePensionPersonal: 40,
    privatePensionSpouse: 20,
    otherIncomePersonal: 20,
    otherIncomeSpouse: 0,
    // 자산 (개별 입력 -> 총자산/순자산은 자동계산)
    realEstateAsset: 6.0, // 부동산 자산 (억원)
    financialAsset: 2.5, // 금융자산 (억원)
    pensionAsset: 1.0, // 연금자산 (억원)
    // 부채 (개별 입력 -> 총부채는 자동계산)
    mortgageAmount: 8000, // 주택담보대출 (만원)
    mortgageRate: 4.5, // 주택담보대출 금리 (%)
    creditLoanAmount: 3000, // 신용대출 (만원)
    creditLoanRate: 6.8, // 신용대출 금리 (%)
    otherDebtAmount: 1000, // 기타부채 (만원)
    otherDebtRate: 5.0, // 기타부채 금리 (%)
    // 월 현금흐름 (개별 입력 -> 저축가능액은 자동계산)
    monthlyIncome: 800, // 월 총소득 (만원)
    monthlyFixedExpense: 180, // 고정 지출 (만원)
    monthlyLivingExpense: 350, // 생활비 지출 (만원)
    // 지출 세부 항목 (5개 섹션)
    expenseFood: 80, // 식비 (만원)
    expenseTransport: 30, // 교통비 (만원)
    expenseShopping: 40, // 쇼핑/미용비 (만원)
    expenseLeisure: 50, // 유흥/여가비 (만원)
    expenseOther: 30, // 기타 비용 (만원)
    // 진단 결과 요약 (직접 입력)
    diagnosisSummary: '', // 진단 결과 요약 (빈 문자열이면 자동 생성)
  }

  const [globalData, setGlobalData] = useState(() => {
    // localStorage에서 저장된 데이터 불러오기
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

  // ========== 자동 계산 값들 ==========
  // 총자산 (억원)
  const calculatedTotalAsset = globalData.realEstateAsset + globalData.financialAsset + globalData.pensionAsset

  // 총부채 (만원)
  const calculatedTotalDebt = globalData.mortgageAmount + globalData.creditLoanAmount + globalData.otherDebtAmount

  // 순자산 (억원) = 총자산 - 총부채(억원으로 변환)
  const calculatedNetWorth = Math.round((calculatedTotalAsset - calculatedTotalDebt / 10000) * 100) / 100

  // 월 이자 (만원) - 연이자를 월단위로
  const calculatedMonthlyInterest = Math.round(
    (globalData.mortgageAmount * globalData.mortgageRate / 100 / 12) +
    (globalData.creditLoanAmount * globalData.creditLoanRate / 100 / 12) +
    (globalData.otherDebtAmount * globalData.otherDebtRate / 100 / 12)
  )

  // 생활비 (만원) = 지출 세부 항목 합계
  const calculatedLivingExpense = globalData.expenseFood + globalData.expenseTransport + globalData.expenseShopping + globalData.expenseLeisure + globalData.expenseOther

  // 월 저축가능액 (만원) = 소득 - 고정지출 - 생활비 - 월이자
  const calculatedMonthlySavings = globalData.monthlyIncome - globalData.monthlyFixedExpense - calculatedLivingExpense - calculatedMonthlyInterest

  // 월 예상 연금수입 합계 (만원) - 은퇴 후 월수입
  const calculatedMonthlyPensionIncome =
    globalData.nationalPensionPersonal + globalData.nationalPensionSpouse +
    globalData.retirementPensionPersonal + globalData.retirementPensionSpouse +
    globalData.privatePensionPersonal + globalData.privatePensionSpouse +
    globalData.otherIncomePersonal + globalData.otherIncomeSpouse

  const handleGlobalDataChange = (key: string, value: number | string) => {
    setGlobalData((prev: typeof defaultGlobalData) => ({ ...prev, [key]: value }))
  }

  // 저장 완료 상태
  const [isDataSaved, setIsDataSaved] = useState(false)

  // 저장 버튼 클릭 시 - localStorage에 저장 후 다음 슬라이드로 이동
  const handleSaveGlobalData = () => {
    // localStorage에 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalData))

    // 저장 완료 표시
    setIsDataSaved(true)
    setTimeout(() => setIsDataSaved(false), 2000)

    // 다음 슬라이드로 이동
    setCurrentSlide(1)
  }

  // 기본 정보 수정용 상태 (슬라이드 내에서 직접 수정 시 사용)
  const [editingBasicInfo, setEditingBasicInfo] = useState<string | null>(null)

  // basicInfoValues는 globalData를 참조하도록 변경
  const basicInfoValues = {
    currentAge: globalData.currentAge,
    targetRetirementAge: globalData.targetRetirementAge,
    targetMonthlyCashflow: globalData.targetMonthlyCashflow,
    targetAsset: globalData.targetAsset,
  }

  const handleBasicInfoChange = (key: string, value: number) => {
    handleGlobalDataChange(key, value)
    setEditingBasicInfo(null)
  }

  // 슬라이드 3: 가정 변경 시뮬레이션 상태
  const [assumptionRetirementOffset, setAssumptionRetirementOffset] = useState(0) // -5 ~ +5
  const [assumptionScenarios, setAssumptionScenarios] = useState({
    buyHouse: false,      // 집을 사게 된다면?
    parentSick: false,    // 부모님이 갑자기 아프시다면?
    earlyLeave: false,    // 갑자기 5년 뒤에 직장을 떠나게 된다면?
  })

  // 슬라이드 5: 은퇴 후 월 수입 토글 상태
  // 국민연금: 65세부터 수령 가능
  // 퇴직연금/개인연금: 55세부터 수령 가능
  // 본인/배우자 각각 은퇴 시점 나이 기준으로 판단
  const [incomeToggles, setIncomeToggles] = useState(() => {
    const spouseAgeAtRetirement = globalData.targetRetirementAge - (globalData.currentAge - globalData.spouseAge)
    return {
      nationalPension: globalData.targetRetirementAge >= 65 || spouseAgeAtRetirement >= 65, // 둘 중 하나라도 65세 이상이면 활성화
      retirementPension: globalData.targetRetirementAge >= 55 || spouseAgeAtRetirement >= 55, // 둘 중 하나라도 55세 이상이면 활성화
      privatePension: globalData.targetRetirementAge >= 55 || spouseAgeAtRetirement >= 55, // 둘 중 하나라도 55세 이상이면 활성화
      otherIncome: true,
    }
  })

  // 목표 은퇴연령 변경 시 토글 상태 업데이트
  useEffect(() => {
    const spouseAgeAtRetirement = globalData.targetRetirementAge - (globalData.currentAge - globalData.spouseAge)
    setIncomeToggles(prev => ({
      ...prev,
      nationalPension: globalData.targetRetirementAge >= 65 || spouseAgeAtRetirement >= 65,
      retirementPension: globalData.targetRetirementAge >= 55 || spouseAgeAtRetirement >= 55,
      privatePension: globalData.targetRetirementAge >= 55 || spouseAgeAtRetirement >= 55,
    }))
  }, [globalData.targetRetirementAge, globalData.currentAge, globalData.spouseAge])

  // 공통: 은퇴 후 예상 수입 계산 (본인/배우자 각각 수령 연령 체크)
  const calculateRetirementIncome = () => {
    const targetRetirementAge = globalData.targetRetirementAge
    const spouseAgeAtRetirement = targetRetirementAge - (globalData.currentAge - globalData.spouseAge)

    const personalCanReceiveNationalPension = targetRetirementAge >= 65
    const spouseCanReceiveNationalPension = spouseAgeAtRetirement >= 65
    const personalCanReceivePrivatePension = targetRetirementAge >= 55
    const spouseCanReceivePrivatePension = spouseAgeAtRetirement >= 55

    return (incomeToggles.nationalPension ?
        (personalCanReceiveNationalPension ? globalData.nationalPensionPersonal : 0) +
        (spouseCanReceiveNationalPension ? globalData.nationalPensionSpouse : 0) : 0) +
      (incomeToggles.retirementPension ?
        (personalCanReceivePrivatePension ? globalData.retirementPensionPersonal : 0) +
        (spouseCanReceivePrivatePension ? globalData.retirementPensionSpouse : 0) : 0) +
      (incomeToggles.privatePension ?
        (personalCanReceivePrivatePension ? globalData.privatePensionPersonal : 0) +
        (spouseCanReceivePrivatePension ? globalData.privatePensionSpouse : 0) : 0) +
      (incomeToggles.otherIncome ? globalData.otherIncomePersonal + globalData.otherIncomeSpouse : 0)
  }

  // 슬라이드 6: 생활비 기준선 선택
  const [livingStandardPercent, setLivingStandardPercent] = useState<100 | 70 | 50>(100)

  // 슬라이드 7: 물가 반영 토글
  const [inflationEnabled, setInflationEnabled] = useState(false)

  // 데이터 설정 슬라이드 (슬라이드 -1: 0번 앞)
  const renderSlideDataSetup = () => {
    const dataCategories = [
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
          { key: '_totalAsset', label: '총자산', value: calculatedTotalAsset, unit: '억원', readonly: true },
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
      <div className="left-slide">
        <div className="slide-data-setup">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">데이터 설정</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 설명 */}
          <div className="data-setup-description">
            진단에 사용할 데이터를 설정합니다. 각 항목을 클릭하여 수정할 수 있습니다.
          </div>

          {/* 데이터 카테고리 */}
          <div className="data-setup-categories">
            {dataCategories.map((category, catIdx) => (
              <div key={catIdx} className="data-setup-category">
                <div className="data-setup-category-title">{category.title}</div>
                <div className="data-setup-items">
                  {category.items.map((item) => {
                    const isReadonly = 'readonly' in item && item.readonly
                    const isText = 'isText' in item && item.isText
                    const isTextarea = 'isTextarea' in item && item.isTextarea
                    return (
                      <div key={item.key} className={`data-setup-item ${isReadonly ? 'readonly' : ''} ${isTextarea ? 'textarea-item' : ''}`}>
                        <span className="data-setup-item-label">{item.label}</span>
                        <div className="data-setup-item-value-wrapper">
                          {isReadonly ? (
                            <span className="data-setup-item-readonly-value">{item.value}</span>
                          ) : isTextarea ? (
                            <textarea
                              className="data-setup-item-textarea"
                              value={item.value}
                              onChange={(e) => handleGlobalDataChange(item.key, e.target.value)}
                              placeholder="비워두면 자동으로 생성됩니다"
                              rows={3}
                            />
                          ) : isText ? (
                            <input
                              type="text"
                              className="data-setup-item-input text-input"
                              value={item.value}
                              onChange={(e) => handleGlobalDataChange(item.key, e.target.value)}
                            />
                          ) : (
                            <input
                              type="number"
                              className="data-setup-item-input"
                              value={item.value}
                              onChange={(e) => handleGlobalDataChange(item.key, parseFloat(e.target.value) || 0)}
                              step={item.unit === '%' || item.unit === '억원' ? 0.1 : 1}
                            />
                          )}
                          <span className="data-setup-item-unit">{item.unit}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 저장 버튼 */}
          <div className="data-setup-actions">
            <button
              className={`data-setup-save-button ${isDataSaved ? 'saved' : ''}`}
              onClick={handleSaveGlobalData}
            >
              {isDataSaved ? '저장 완료' : '저장하고 진단 시작'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 오프닝 슬라이드: 오늘 무엇을 확인할까요?
  const renderSlideOpening = () => {
    const questions = [
      { num: 1, text: '은퇴 후, 매달 돈은 충분한가?' },
      { num: 2, text: '은퇴 시점 자산은 괜찮은가?' },
      { num: 3, text: '바꾸면 가장 효과 큰 건 무엇인가?' },
    ]

    return (
      <div className="left-slide">
        <div className="slide-opening">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">오늘 무엇을 확인할까요?</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="opening-message">
            오늘은 정답이 아니라, 선택지를 확인합니다.
          </div>

          {/* 3가지 질문 */}
          <div className="opening-questions">
            {questions.map((q) => (
              <div key={q.num} className="opening-question-item">
                <span className="opening-question-num">{q.num}</span>
                <span className="opening-question-text">{q.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 기본 정보 슬라이드: 오늘 분석에 사용한 기본 정보
  const renderSlideBasicInfo = () => {
    // 본인 정보
    const personalInfo = [
      { key: 'currentAge', label: '현재 나이', value: basicInfoValues.currentAge, unit: '세' },
      { key: 'targetRetirementAge', label: '목표 은퇴 나이', value: basicInfoValues.targetRetirementAge, unit: '세' },
    ]

    // 가계 목표
    const householdGoals = [
      { key: 'targetMonthlyCashflow', label: '은퇴 후 목표 월현금흐름', value: basicInfoValues.targetMonthlyCashflow, unit: '만원' },
      { key: 'targetAsset', label: '은퇴 시점 목표 자산규모', value: basicInfoValues.targetAsset, unit: '억원' },
    ]

    const renderInfoCard = (card: { key: string; label: string; value: number; unit: string }) => (
      <div
        key={card.key}
        className={`basic-info-card ${editingBasicInfo === card.key ? 'editing' : ''}`}
        onClick={() => setEditingBasicInfo(card.key)}
      >
        <span className="basic-info-card-label">{card.label}</span>
        {editingBasicInfo === card.key ? (
          <div className="basic-info-card-input-wrapper">
            <input
              type="number"
              className="basic-info-card-input"
              defaultValue={card.value}
              autoFocus
              onBlur={(e) => handleBasicInfoChange(card.key, Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBasicInfoChange(card.key, Number((e.target as HTMLInputElement).value))
                }
                if (e.key === 'Escape') {
                  setEditingBasicInfo(null)
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="basic-info-card-unit">{card.unit}</span>
          </div>
        ) : (
          <div className="basic-info-card-value-wrapper">
            <span className="basic-info-card-value">{card.value}</span>
            <span className="basic-info-card-unit">{card.unit}</span>
            <span className="basic-info-card-edit-hint">클릭하여 수정</span>
          </div>
        )}
      </div>
    )

    return (
      <div className="left-slide">
        <div className="slide-basic-info">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">오늘 분석에 사용한 기본 정보</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="basic-info-message">
            <span className="basic-info-household-badge">가계 기준</span>
            이 가정 위에서 모든 결과가 나옵니다.
          </div>

          {/* 본인 정보 */}
          <div className="basic-info-section">
            <div className="basic-info-section-header">본인</div>
            <div className="basic-info-cards-row horizontal">
              {personalInfo.map(renderInfoCard)}
            </div>
          </div>

          {/* 가계 목표 */}
          <div className="basic-info-section household-goals">
            <div className="basic-info-section-header">가계 목표</div>
            <div className="basic-info-cards-row">
              {householdGoals.map(renderInfoCard)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ========== 은퇴 본질 슬라이드 (A1~A5) ==========

  // 슬라이드 A1: 은퇴의 본질은 무엇일까요?
  const renderSlideRetirementEssence = () => {
    return (
      <div className="left-slide">
        <div className="slide-essence">
          <div className="essence-question">
            은퇴 준비, 무엇이 가장 중요할까요?
          </div>

          <div className="essence-answer-section">
            <div className="essence-wrong">
              <span className="essence-label">많은 분들이 생각하는 것</span>
              <span className="essence-text">"얼마를 모았는가"</span>
            </div>

            <div className="essence-divider-arrow">하지만</div>

            <div className="essence-correct">
              <span className="essence-label">진짜 중요한 것</span>
              <span className="essence-text">"매달 돈이 들어오는가"</span>
            </div>
          </div>

          <div className="essence-bottom-message">
            은퇴는 <strong>자산</strong>의 문제가 아니라 <strong>현금흐름</strong>의 문제입니다.
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 A2: 자산이 많아도 실패하는 이유
  const renderSlideWhyAssetsFail = () => {
    return (
      <div className="left-slide">
        <div className="slide-why-fail">
          <div className="asset-header">
            <h1 className="asset-title">자산이 많아도 실패하는 이유</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 두 시나리오 비교 */}
          <div className="why-fail-comparison">
            <div className="fail-scenario wrong">
              <div className="scenario-label">자산만 있는 은퇴</div>
              <div className="scenario-visual">
                <div className="scenario-item">
                  <span className="item-amount">10억</span>
                  <span className="item-label">총 자산</span>
                </div>
                <div className="scenario-connector">but</div>
                <div className="scenario-item">
                  <span className="item-amount zero">50만원</span>
                  <span className="item-label">매달 수입</span>
                </div>
              </div>
              <div className="scenario-result">원치 않는 순간에 자산을 매각해야함</div>
            </div>

            <div className="fail-scenario correct">
              <div className="scenario-label">현금흐름이 있는 은퇴</div>
              <div className="scenario-visual">
                <div className="scenario-item">
                  <span className="item-amount">5억</span>
                  <span className="item-label">총 자산</span>
                </div>
                <div className="scenario-connector">+</div>
                <div className="scenario-item">
                  <span className="item-amount positive">300만</span>
                  <span className="item-label">매달 수입</span>
                </div>
              </div>
              <div className="scenario-result">자산을 유지하며 생활 가능</div>
            </div>
          </div>

          <div className="why-fail-conclusion">
            자산이 절반이어도, 현금흐름이 있으면 더 안정적입니다.
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 A3: 은퇴는 '한 번에 쓰는 돈'이 아닙니다
  const renderSlideNotLumpSum = () => {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

    return (
      <div className="left-slide">
        <div className="slide-not-lumpsum">
          <div className="asset-header">
            <h1 className="asset-title">은퇴는 '한 번에 쓰는 돈'이 아닙니다</h1>
            <div className="asset-divider"></div>
          </div>
          <div className="lumpsum-message">
            은퇴는 1억, 5억을 한 번에 쓰는 문제가 아닙니다.
          </div>

          {/* 반복되는 월별 지출 시각화 */}
          <div className="lumpsum-visual">
            <div className="lumpsum-year-label">매년</div>
            <div className="lumpsum-months-grid">
              {months.map((month, i) => (
                <div key={i} className="lumpsum-month-card">
                  <div className="lumpsum-month-name">{month}</div>
                  <div className="lumpsum-month-expense">-300만</div>
                </div>
              ))}
            </div>
            <div className="lumpsum-repeat-indicator">
              <span className="lumpsum-repeat-text">x 30년</span>
              <span className="lumpsum-repeat-total">= 360번</span>
            </div>
          </div>

          <div className="lumpsum-conclusion">
            <p className="highlight">매달 끊기지 않아야 하는 문제입니다.</p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 A4: 그래서 은퇴 준비의 첫 질문은 이것입니다
  const renderSlideFirstQuestion = () => {
    return (
      <div className="left-slide">
        <div className="slide-first-question">
          <div className="asset-header">
            <h1 className="asset-title">그래서 은퇴 준비의 첫 질문은 이것입니다</h1>
            <div className="asset-divider"></div>
          </div>
          <div className="first-question-main">
            은퇴 후, 매달 얼마가 들어와야 할까요?
          </div>
          <div className="first-question-sub">
            <p>그리고 그 돈은</p>
            <p>언제부터, 얼마나 오래, 얼마나 안정적으로 들어올까요?</p>
          </div>
          <div className="first-question-visual">
            <div className="cashflow-box">
              <div className="cashflow-box-label">월 현금흐름</div>
              <div className="cashflow-box-value">?</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 A4-1: 은퇴 후 현금흐름의 핵심은 3층 연금입니다
  const renderSlidePensionCoreConcept = () => {
    return (
      <div className="left-slide">
        <div className="slide-pension-core">
          <div className="asset-header">
            <h1 className="asset-title">은퇴 후 현금흐름의 핵심은 3층 연금입니다</h1>
            <div className="asset-divider"></div>
          </div>
          <div className="pension-core-message">
            은퇴 후 현금흐름의 대부분은 이 3가지에서 나옵니다.
          </div>

          {/* 3층 연금 구조 다이어그램 */}
          <div className="pension-tower">
            <div className="pension-floor floor-3">
              <div className="floor-number">3층</div>
              <div className="floor-content">
                <div className="floor-name">개인연금</div>
                <div className="floor-desc">연금저축, IRP 등 내가 직접 준비한 연금</div>
              </div>
            </div>
            <div className="pension-floor floor-2">
              <div className="floor-number">2층</div>
              <div className="floor-content">
                <div className="floor-name">퇴직연금</div>
                <div className="floor-desc">회사가 적립해준 퇴직금</div>
              </div>
            </div>
            <div className="pension-floor floor-1">
              <div className="floor-number">1층</div>
              <div className="floor-content">
                <div className="floor-name">국민연금</div>
                <div className="floor-desc">국가가 보장하는 기본 연금</div>
              </div>
            </div>
          </div>

          <div className="pension-core-note">
            <p>지금부터 {globalData.customerName}님의 3층 연금을 중심으로 은퇴 후 현금흐름을 살펴봅니다</p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 A4-2: 그래서 먼저 고객님의 3층 연금을 살펴봅니다
  const renderSlidePensionBridge = () => {
    return (
      <div className="left-slide">
        <div className="slide-pension-bridge">
          <div className="asset-header">
            <h1 className="asset-title">그래서 먼저 {globalData.customerName}님의 3층 연금을 살펴봅니다</h1>
            <div className="asset-divider"></div>
          </div>
          <div className="pension-bridge-message">
            지금부터 {globalData.customerName}님의 연금 현황을 확인하겠습니다.
          </div>

          {/* 체크리스트 */}
          <div className="pension-checklist">
            <div className="pension-checklist-item">
              <div className="checklist-icon">1</div>
              <div className="checklist-content">
                <div className="checklist-title">국민연금</div>
                <div className="checklist-desc">언제부터, 얼마나 받을 수 있는지</div>
              </div>
            </div>
            <div className="pension-checklist-item">
              <div className="checklist-icon">2</div>
              <div className="checklist-content">
                <div className="checklist-title">퇴직연금</div>
                <div className="checklist-desc">적립금 현황과 예상 수령액</div>
              </div>
            </div>
            <div className="pension-checklist-item">
              <div className="checklist-icon">3</div>
              <div className="checklist-content">
                <div className="checklist-title">개인연금</div>
                <div className="checklist-desc">연금저축, IRP 현황</div>
              </div>
            </div>
          </div>

          <div className="pension-bridge-cta">
            <p>이 3가지를 합치면 {globalData.customerName}님의 은퇴 후 월 수입이 나옵니다.</p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 A5: 오늘 우리는 이걸 먼저 확인합니다
  const renderSlideTodayAgenda = () => {
    return (
      <div className="left-slide">
        <div className="slide-today-agenda">
          <div className="asset-header">
            <h1 className="asset-title">오늘 우리는 이걸 먼저 확인합니다</h1>
            <div className="asset-divider"></div>
          </div>
          <div className="agenda-message">
            그래서 오늘은<br />
            <span className="agenda-highlight">은퇴 후 현금흐름</span>부터 확인합니다.
          </div>
          <div className="agenda-note">
            <p>자산 분석은 그 다음입니다.</p>
            <p>투자 전략은 더 나중입니다.</p>
          </div>
          <div className="agenda-flow">
            <div className="agenda-flow-item active">
              <div className="agenda-flow-number">1</div>
              <div className="agenda-flow-label">현금흐름</div>
            </div>
            <div className="agenda-flow-arrow"></div>
            <div className="agenda-flow-item">
              <div className="agenda-flow-number">2</div>
              <div className="agenda-flow-label">자산</div>
            </div>
            <div className="agenda-flow-arrow"></div>
            <div className="agenda-flow-item">
              <div className="agenda-flow-number">3</div>
              <div className="agenda-flow-label">전략</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 3: 가정 변경 시뮬레이션
  const renderSlideAssumptions = () => {
    const baseRetirementAge = basicInfoValues.targetRetirementAge
    const adjustedRetirementAge = baseRetirementAge + assumptionRetirementOffset
    const currentAge = basicInfoValues.currentAge

    // 시나리오 정의 (현금흐름 영향 기준)
    const scenarios = [
      {
        key: 'buyHouse',
        label: '집을 사게 된다면?',
        cashflowImpact: -80,  // 월 대출 원리금
        description: '월 대출 원리금 80만원 추가'
      },
      {
        key: 'parentSick',
        label: '부모님이 갑자기 아프시다면?',
        cashflowImpact: -50,  // 월 부양비/의료비
        description: '월 부양비 50만원 추가'
      },
      {
        key: 'earlyLeave',
        label: '갑자기 5년 뒤에 직장을 떠나게 된다면?',
        cashflowImpact: -200, // 소득 급감
        description: '근로소득 중단, 연금 수령 앞당김'
      },
    ]

    // 기본 월 현금흐름 시뮬레이션 생성 (시나리오 미적용)
    const generateBaselineCashflow = () => {
      const data = []
      const startAge = currentAge
      const endAge = 90

      for (let age = startAge; age <= endAge; age += 5) {
        let cashflow = 0
        if (age < adjustedRetirementAge) {
          // 은퇴 전: 근로소득 - 지출 = 양수
          cashflow = 150 + (adjustedRetirementAge - age) * 5  // 은퇴가 가까울수록 저축 줄어듦
        } else {
          // 은퇴 후: 연금 + 인출 - 생활비
          const yearsAfterRetirement = age - adjustedRetirementAge
          const pensionIncome = age >= 65 ? 120 : 70  // 국민연금 65세부터
          const expenses = 250 + yearsAfterRetirement * 3  // 나이 들수록 의료비 증가
          cashflow = pensionIncome - expenses + 100  // 자산 인출 포함
        }
        data.push({ age, cashflow: Math.round(cashflow) })
      }
      return data
    }

    // 시나리오 적용된 현금흐름 생성
    const generateSimulationData = () => {
      const baseline = generateBaselineCashflow()
      const data = []

      // 활성화된 시나리오들의 영향 합산
      let totalImpact = 0
      if (assumptionScenarios.buyHouse) totalImpact += -80
      if (assumptionScenarios.parentSick) totalImpact += -50
      if (assumptionScenarios.earlyLeave) totalImpact += -200

      for (const point of baseline) {
        let adjustedCashflow = point.cashflow

        // 조기 퇴직: 5년 뒤부터 영향
        if (assumptionScenarios.earlyLeave && point.age >= currentAge + 5 && point.age < adjustedRetirementAge) {
          adjustedCashflow = -100  // 소득 없이 자산만 소진
        } else if (point.age >= adjustedRetirementAge) {
          // 은퇴 후에만 시나리오 영향 적용
          adjustedCashflow += totalImpact
        }

        // 집 구매: 대출 영향은 구매 시점부터
        if (assumptionScenarios.buyHouse && point.age >= 50) {
          // 이미 totalImpact에 포함됨
        }

        data.push({
          age: point.age,
          cashflow: adjustedCashflow,
          baseline: point.cashflow
        })
      }
      return data
    }

    const simulationData = generateSimulationData()
    const maxCashflow = Math.max(...simulationData.map(d => Math.abs(d.cashflow)), 1)

    // 활성화된 시나리오 설명 생성
    const activeScenarioDescriptions = scenarios
      .filter(s => assumptionScenarios[s.key as keyof typeof assumptionScenarios])
      .map(s => s.description)

    return (
      <div className="left-slide">
        <div className="slide-assumptions">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">이 가정, 바뀌면 결과도 바뀝니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="assumptions-message">
            가장 불확실한 가정은 무엇인가요?
          </div>

          {/* 미니 그래프 (현금흐름) */}
          <div className="assumptions-graph">
            <div className="assumptions-graph-title">월 현금흐름 추이</div>
            <div className="assumptions-graph-container">
              <div className="assumptions-graph-zero-line"></div>
              <div className="assumptions-graph-bars">
                {simulationData.map((d, idx) => {
                  const isNegative = d.cashflow < 0
                  // 최대값 대비 비율로 높이 계산 (최대 45%까지, 0선 기준)
                  const heightPercent = Math.min(45, Math.abs(d.cashflow) / maxCashflow * 45)
                  return (
                    <div key={idx} className="assumptions-graph-bar-wrapper">
                      {isNegative ? (
                        <div
                          className="assumptions-graph-bar-negative"
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: '#f87171',
                          }}
                        />
                      ) : (
                        <div
                          className="assumptions-graph-bar-positive"
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: d.age >= adjustedRetirementAge ? '#818cf8' : '#34d399',
                          }}
                        />
                      )}
                      <span className="assumptions-graph-label">{d.age}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="assumptions-graph-legend">
              <span className="assumptions-graph-legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#34d399' }}></span>
                흑자
              </span>
              <span className="assumptions-graph-legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#f87171' }}></span>
                적자
              </span>
            </div>
          </div>

          {/* 시나리오 영향 설명 (그래프 아래) */}
          {activeScenarioDescriptions.length > 0 && (
            <div className="assumptions-impact-description">
              {activeScenarioDescriptions.map((desc, idx) => (
                <span key={idx} className="assumptions-impact-item">{desc}</span>
              ))}
            </div>
          )}

          {/* 컨트롤 영역 */}
          <div className="assumptions-controls">
            {/* 은퇴 연령 슬라이더 */}
            <div className="assumptions-control-item">
              <div className="assumptions-control-header">
                <span className="assumptions-control-label">은퇴 연령</span>
                <span className="assumptions-control-value">
                  {adjustedRetirementAge}세
                  {assumptionRetirementOffset !== 0 && (
                    <span className={`assumptions-control-diff ${assumptionRetirementOffset > 0 ? 'positive' : 'negative'}`}>
                      ({assumptionRetirementOffset > 0 ? '+' : ''}{assumptionRetirementOffset}년)
                    </span>
                  )}
                </span>
              </div>
              <div className="assumptions-slider-wrapper">
                <span className="assumptions-slider-label">{baseRetirementAge - 5}세</span>
                <input
                  type="range"
                  className="assumptions-slider"
                  min={-5}
                  max={5}
                  value={assumptionRetirementOffset}
                  onChange={(e) => setAssumptionRetirementOffset(Number(e.target.value))}
                />
                <span className="assumptions-slider-label">{baseRetirementAge + 5}세</span>
              </div>
            </div>

            {/* 시나리오 토글들 */}
            <div className="assumptions-scenarios">
              {scenarios.map((scenario) => {
                const isActive = assumptionScenarios[scenario.key as keyof typeof assumptionScenarios]
                return (
                  <button
                    key={scenario.key}
                    className={`assumptions-scenario-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setAssumptionScenarios(prev => ({
                      ...prev,
                      [scenario.key]: !prev[scenario.key as keyof typeof prev]
                    }))}
                  >
                    {scenario.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 5: 은퇴 후 매달 들어오는 돈
  const renderSlideMonthlyIncome = () => {
    const targetRetirementAge = globalData.targetRetirementAge
    // 배우자의 은퇴 시점 나이 계산
    const spouseAgeAtRetirement = targetRetirementAge - (globalData.currentAge - globalData.spouseAge)

    // 연금 수령 연령 체크 (본인/배우자 각각)
    const personalCanReceiveNationalPension = targetRetirementAge >= 65
    const spouseCanReceiveNationalPension = spouseAgeAtRetirement >= 65
    const personalCanReceivePrivatePension = targetRetirementAge >= 55 // 퇴직연금/개인연금
    const spouseCanReceivePrivatePension = spouseAgeAtRetirement >= 55

    // warning 메시지 생성 함수
    const getPensionWarning = (personalCanReceive: boolean, spouseCanReceive: boolean, minAge: number) => {
      if (personalCanReceive && spouseCanReceive) return null
      if (!personalCanReceive && !spouseCanReceive) return `(${minAge}세 이후)`
      if (!personalCanReceive) return `(본인 ${minAge}세 이후)`
      return `(배우자 ${minAge}세 이후)`
    }

    // 소득 항목 정의 (본인/배우자 구분) - globalData에서 값 가져오기
    const incomeItems = [
      {
        key: 'nationalPension',
        label: '국민연금',
        personal: globalData.nationalPensionPersonal,
        spouse: globalData.nationalPensionSpouse,
        color: '#3b82f6',
        note: '65세부터 수령',
        warning: getPensionWarning(personalCanReceiveNationalPension, spouseCanReceiveNationalPension, 65),
        personalDisabled: !personalCanReceiveNationalPension,
        spouseDisabled: !spouseCanReceiveNationalPension,
      },
      {
        key: 'retirementPension',
        label: '퇴직연금',
        personal: globalData.retirementPensionPersonal,
        spouse: globalData.retirementPensionSpouse,
        color: '#8b5cf6',
        note: '55세부터 수령',
        warning: getPensionWarning(personalCanReceivePrivatePension, spouseCanReceivePrivatePension, 55),
        personalDisabled: !personalCanReceivePrivatePension,
        spouseDisabled: !spouseCanReceivePrivatePension,
      },
      {
        key: 'privatePension',
        label: '개인연금',
        personal: globalData.privatePensionPersonal,
        spouse: globalData.privatePensionSpouse,
        color: '#ec4899',
        note: '55세부터 수령',
        warning: getPensionWarning(personalCanReceivePrivatePension, spouseCanReceivePrivatePension, 55),
        personalDisabled: !personalCanReceivePrivatePension,
        spouseDisabled: !spouseCanReceivePrivatePension,
      },
      {
        key: 'otherIncome',
        label: '기타소득',
        personal: globalData.otherIncomePersonal,
        spouse: globalData.otherIncomeSpouse,
        color: '#f59e0b',
        note: '임대소득, 배당 등',
        warning: null,
        personalDisabled: false,
        spouseDisabled: false,
      },
    ]

    // 활성화된 항목만 필터링 (본인/배우자 수령 가능 여부 반영)
    const activeItems = incomeItems.filter(
      item => incomeToggles[item.key as keyof typeof incomeToggles]
    )
    // 총 수입 계산 시 수령 불가능한 본인/배우자 금액 제외
    const totalIncome = activeItems.reduce((sum, item) => {
      const personalAmount = item.personalDisabled ? 0 : item.personal
      const spouseAmount = item.spouseDisabled ? 0 : item.spouse
      return sum + personalAmount + spouseAmount
    }, 0)

    return (
      <div className="left-slide">
        <div className="slide-monthly-income">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">{globalData.customerName}님의 은퇴 후 예상 월 수령액</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 총액 표시 */}
          <div className="monthly-income-total">
            <span className="monthly-income-total-label">월 예상 가계수입</span>
            <div className="monthly-income-total-value">
              <span className="monthly-income-total-number">{totalIncome}</span>
              <span className="monthly-income-total-unit">만원</span>
            </div>
          </div>

          {/* 스택형 바 */}
          <div className="monthly-income-bar-container">
            <div className="monthly-income-bar">
              {activeItems.map((item, idx) => {
                const personalAmount = item.personalDisabled ? 0 : item.personal
                const spouseAmount = item.spouseDisabled ? 0 : item.spouse
                const itemTotal = personalAmount + spouseAmount
                const widthPercent = totalIncome > 0 ? (itemTotal / totalIncome) * 100 : 0
                if (itemTotal === 0) return null
                return (
                  <div
                    key={idx}
                    className="monthly-income-bar-segment"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: item.color,
                    }}
                  >
                    {widthPercent >= 15 && (
                      <span className="monthly-income-bar-label">{itemTotal}만원</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 토글 리스트 */}
          <div className="monthly-income-toggles">
            {incomeItems.map((item) => {
              const isActive = incomeToggles[item.key as keyof typeof incomeToggles]
              const personalAmount = item.personalDisabled ? 0 : item.personal
              const spouseAmount = item.spouseDisabled ? 0 : item.spouse
              const itemTotal = personalAmount + spouseAmount
              return (
                <button
                  key={item.key}
                  className={`monthly-income-toggle ${isActive ? 'active' : ''} ${item.warning ? 'has-warning' : ''}`}
                  onClick={() => {
                    setIncomeToggles(prev => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof typeof prev]
                    }))
                  }}
                >
                  <div className="monthly-income-toggle-left">
                    <span
                      className="monthly-income-toggle-dot"
                      style={{ backgroundColor: isActive ? item.color : 'rgba(255,255,255,0.2)' }}
                    ></span>
                    <span className="monthly-income-toggle-label">{item.label}</span>
                    {item.warning && <span className="monthly-income-toggle-warning-note">{item.warning}</span>}
                  </div>
                  <div className="monthly-income-toggle-right">
                    <div className="monthly-income-toggle-breakdown">
                      <span className={`monthly-income-toggle-person ${item.personalDisabled ? 'disabled' : ''}`}>
                        본인 {item.personal}만원{item.personalDisabled && '*'}
                      </span>
                      {item.spouse > 0 && (
                        <span className={`monthly-income-toggle-person ${item.spouseDisabled ? 'disabled' : ''}`}>
                          배우자 {item.spouse}만원{item.spouseDisabled && '*'}
                        </span>
                      )}
                    </div>
                    <span className="monthly-income-toggle-amount">{itemTotal}만원</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* 하단 주석 */}
          <div className="slide-footer-note">
            {targetRetirementAge}세 은퇴 직후 기준, 물가상승률 미반영
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 6: 현재 생활비와 비교해보면?
  const renderSlideLivingComparison = () => {
    // 현재 월 총지출 (고정지출 + 생활비 + 월이자)
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest

    // 은퇴 후 예상 수입 (공통 함수 사용)
    const retirementIncome = calculateRetirementIncome()

    // 은퇴까지 남은 기간
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge

    // 물가상승률 계산 (연 3%)
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)

    // 기준선에 따른 목표 생활비 (물가 반영 전)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))

    // 물가 반영된 목표 생활비
    const inflatedTargetExpense = Math.round(baseTargetExpense * inflationMultiplier)

    // 최종 목표 생활비 (물가 반영 여부에 따라)
    const targetExpense = inflationEnabled ? inflatedTargetExpense : baseTargetExpense

    // 차이 계산
    const gap = retirementIncome - targetExpense
    const isPositive = gap >= 0

    return (
      <div className="left-slide">
        <div className="slide-living-comparison">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">현재 생활비와 비교해보면?</h1>
            <p className="asset-subtitle">은퇴 직후에는 보통 은퇴 전 생활비의 70% 정도를 소비한다고 합니다</p>
            <div className="asset-divider"></div>
          </div>

          {/* 설정 영역 - 한 줄 */}
          <div className="living-comparison-controls-inline">
            <span className="living-controls-label">생활 수준</span>
            <div className="living-comparison-selector-btns">
              <button
                className={`living-comparison-selector-btn ${livingStandardPercent === 100 ? 'active' : ''}`}
                onClick={() => setLivingStandardPercent(100)}
              >
                100%
              </button>
              <button
                className={`living-comparison-selector-btn ${livingStandardPercent === 70 ? 'active' : ''}`}
                onClick={() => setLivingStandardPercent(70)}
              >
                70%
              </button>
              <button
                className={`living-comparison-selector-btn ${livingStandardPercent === 50 ? 'active' : ''}`}
                onClick={() => setLivingStandardPercent(50)}
              >
                50%
              </button>
            </div>
            <div className="living-controls-divider"></div>
            <span className="living-controls-label">물가반영</span>
            <button
              className={`living-inflation-btn ${inflationEnabled ? 'active' : ''}`}
              onClick={() => setInflationEnabled(!inflationEnabled)}
            >
              <span className="living-inflation-knob"></span>
            </button>
            {inflationEnabled && (
              <span className="living-inflation-note">연 3%</span>
            )}
          </div>

          {/* Gap 계산 시각화: 수입 - 지출 = Gap */}
          <div className="living-gap-display">
            {/* 상세 비교: 수입 → 지출 → Gap 순서 */}
            <div className="living-gap-detail">
              {/* 1. 예상 수입 */}
              <div className="living-gap-row highlight">
                <span className="living-gap-row-label">예상 수입</span>
                <span className="living-gap-row-value">{retirementIncome}만원</span>
              </div>
              {/* 2. 지출 (현재 생활비 기반) */}
              {inflationEnabled ? (
                <>
                  <div className="living-gap-row sub">
                    <span className="living-gap-row-label">현재 생활비</span>
                    <span className="living-gap-row-value">{currentMonthlyExpense}만원</span>
                  </div>
                  <div className="living-gap-row sub">
                    <span className="living-gap-row-label">목표 생활비 ({livingStandardPercent}%)</span>
                    <span className="living-gap-row-value">{baseTargetExpense}만원</span>
                  </div>
                  <div className="living-gap-row inflation-adjusted">
                    <span className="living-gap-row-label">{yearsToRetirement}년 후 물가 반영</span>
                    <span className="living-gap-row-value">-{inflatedTargetExpense}만원</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="living-gap-row sub">
                    <span className="living-gap-row-label">현재 생활비</span>
                    <span className="living-gap-row-value">{currentMonthlyExpense}만원</span>
                  </div>
                  <div className="living-gap-row">
                    <span className="living-gap-row-label">목표 생활비 ({livingStandardPercent}%)</span>
                    <span className="living-gap-row-value">-{targetExpense}만원</span>
                  </div>
                </>
              )}
            </div>

            {/* 3. Gap 결과 */}
            <div className={`living-gap-main ${isPositive ? 'positive' : 'negative'}`}>
              <span className="living-gap-label">
                {isPositive ? '여유' : '부족'}
              </span>
              <span className="living-gap-value">
                {isPositive ? '+' : ''}{gap}만원
              </span>
              <span className="living-gap-per-month">/월</span>
            </div>
          </div>

          {/* 하단 주석 */}
          <div className="slide-footer-note">
            {globalData.targetRetirementAge}세 은퇴 직후 기준
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 6: 적정생활비와 비교하면?
  const renderSlideAdequateLivingComparison = () => {
    // 은퇴 후 예상 수입 (공통 함수 사용)
    const retirementIncome = calculateRetirementIncome()

    // 가구 유형 (나중에 데이터 기반으로 변경)
    const householdType: '1인' | '2인' = '2인'

    // 가계금융복지조사 기준 노후 적정생활비 (2023년 기준, 만원/월)
    // 출처: 통계청 가계금융복지조사
    const adequateLivingCost = {
      '1인': {
        minimum: 124,    // 최소생활비
        adequate: 177,   // 적정생활비
      },
      '2인': {
        minimum: 198,    // 최소생활비
        adequate: 277,   // 적정생활비
      }
    }

    const data = adequateLivingCost[householdType]
    const maxValue = Math.max(retirementIncome, data.adequate) * 1.1

    // 예상 수입이 적정생활비 대비 어느 수준인지 판단
    const getIncomeLevel = () => {
      if (retirementIncome >= data.adequate) return 'adequate'
      if (retirementIncome >= data.minimum) return 'minimum'
      return 'below'
    }

    const incomeLevel = getIncomeLevel()

    return (
      <div className="left-slide">
        <div className="slide-adequate-comparison">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">적정생활비와 비교하면?</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="adequate-comparison-message">
            통계청 가계금융복지조사 기준과 비교해봅니다.
          </div>

          {/* 가구 유형 표시 */}
          <div className="adequate-comparison-household">
            {householdType} 가구 기준
          </div>

          {/* 막대 그래프 비교 */}
          <div className="adequate-comparison-bars">
            {/* 최소생활비 */}
            <div className="adequate-comparison-bar-item">
              <div className="adequate-comparison-bar-label">
                <span>최소생활비</span>
                <span className="adequate-comparison-bar-value">{data.minimum}만원</span>
              </div>
              <div className="adequate-comparison-bar-track">
                <div
                  className="adequate-comparison-bar-fill minimum"
                  style={{ width: `${(data.minimum / maxValue) * 100}%` }}
                />
              </div>
            </div>

            {/* 적정생활비 */}
            <div className="adequate-comparison-bar-item">
              <div className="adequate-comparison-bar-label">
                <span>적정생활비</span>
                <span className="adequate-comparison-bar-value">{data.adequate}만원</span>
              </div>
              <div className="adequate-comparison-bar-track">
                <div
                  className="adequate-comparison-bar-fill adequate"
                  style={{ width: `${(data.adequate / maxValue) * 100}%` }}
                />
              </div>
            </div>

            {/* 예상 수입 */}
            <div className="adequate-comparison-bar-item highlight">
              <div className="adequate-comparison-bar-label">
                <span>예상 수입</span>
                <span className="adequate-comparison-bar-value">{retirementIncome}만원</span>
              </div>
              <div className="adequate-comparison-bar-track">
                <div
                  className={`adequate-comparison-bar-fill income ${incomeLevel}`}
                  style={{ width: `${(retirementIncome / maxValue) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 결과 메시지 */}
          <div className={`adequate-comparison-result ${incomeLevel}`}>
            {incomeLevel === 'adequate' && (
              <>
                <span className="adequate-comparison-result-status">적정생활비 충족</span>
                <span className="adequate-comparison-result-description">
                  통계 기준 적정 수준의 노후 생활이 가능합니다.
                </span>
              </>
            )}
            {incomeLevel === 'minimum' && (
              <>
                <span className="adequate-comparison-result-status">최소생활비 충족</span>
                <span className="adequate-comparison-result-description">
                  기본 생활은 가능하나, 여유 있는 노후를 위해 추가 준비가 필요합니다.
                </span>
              </>
            )}
            {incomeLevel === 'below' && (
              <>
                <span className="adequate-comparison-result-status">최소생활비 미달</span>
                <span className="adequate-comparison-result-description">
                  기본적인 생활 유지를 위한 추가 준비가 필요합니다.
                </span>
              </>
            )}
          </div>

          {/* 출처 */}
          <div className="adequate-comparison-source">
            출처: 통계청 가계금융복지조사 (2023)
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 7: 시간이 지나면 상황은?
  const renderSlideInflationImpactNew = () => {
    // 현재 월 생활비 (지출 세부 항목 합계)
    const currentMonthlyExpense = calculatedLivingExpense

    // 은퇴 후 예상 수입 (공통 함수 사용)
    const retirementIncome = calculateRetirementIncome()

    // 물가상승률 적용 (연 3%, 10년 후 기준)
    const inflationRate = 0.03
    const yearsAfterRetirement = 10
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsAfterRetirement)

    // 기준선에 따른 목표 생활비
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const inflatedTargetExpense = Math.round(baseTargetExpense * inflationMultiplier)

    // 실제 적용할 목표 생활비
    const targetExpense = inflationEnabled ? inflatedTargetExpense : baseTargetExpense

    // 차이 계산
    const gap = retirementIncome - targetExpense
    const isPositive = gap >= 0

    // 바 그래프용 최대값
    const maxValue = Math.max(inflatedTargetExpense, retirementIncome, baseTargetExpense)

    return (
      <div className="left-slide">
        <div className="slide-inflation-impact">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">시간이 지나면 상황은?</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="inflation-impact-message">
            물가는 가만히 있지 않습니다.
          </div>

          {/* 물가 반영 토글 */}
          <div className="inflation-toggle-container">
            <span className="inflation-toggle-label">물가상승률 반영 (연 3%, 10년 후)</span>
            <button
              className={`inflation-toggle-btn ${inflationEnabled ? 'active' : ''}`}
              onClick={() => setInflationEnabled(!inflationEnabled)}
            >
              <span className="inflation-toggle-knob"></span>
            </button>
          </div>

          {/* 비교 바 그래프 */}
          <div className="inflation-impact-bars">
            {/* 목표 생활비 (기준선) */}
            <div className="inflation-impact-bar-item">
              <div className="inflation-impact-bar-label">
                <span>
                  목표 생활비
                  {inflationEnabled && <span className="inflation-badge">물가 반영</span>}
                </span>
                <span className="inflation-impact-bar-value">{targetExpense}만원</span>
              </div>
              <div className="inflation-impact-bar-track">
                <div
                  className="inflation-impact-bar-fill target"
                  style={{ width: `${(targetExpense / maxValue) * 100}%` }}
                ></div>
                {/* 기준선 원래 위치 (물가 미반영) */}
                {inflationEnabled && (
                  <div
                    className="inflation-impact-baseline-original"
                    style={{ left: `${(baseTargetExpense / maxValue) * 100}%` }}
                  >
                    <span className="inflation-impact-baseline-label">현재 기준</span>
                  </div>
                )}
              </div>
            </div>

            {/* 은퇴 후 예상 수입 */}
            <div className="inflation-impact-bar-item">
              <div className="inflation-impact-bar-label">
                <span>은퇴 후 예상 수입</span>
                <span className="inflation-impact-bar-value">{retirementIncome}만원</span>
              </div>
              <div className="inflation-impact-bar-track">
                <div
                  className={`inflation-impact-bar-fill income ${isPositive ? 'positive' : 'negative'}`}
                  style={{ width: `${(retirementIncome / maxValue) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 결과 메시지 */}
          <div className={`inflation-impact-result ${isPositive ? 'positive' : 'negative'}`}>
            <span className="inflation-impact-result-label">
              {inflationEnabled ? '10년 후 ' : ''}{isPositive ? '월 여유 금액' : '월 부족 금액'}
            </span>
            <span className="inflation-impact-result-value">
              {isPositive ? '+' : ''}{gap}만원
            </span>
            {inflationEnabled && !isPositive && (
              <span className="inflation-impact-result-warning">
                물가 상승으로 부족 금액 증가
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 8: 충분한가요, 부족한가요?
  const renderSlideGapSummary = () => {
    // 슬라이드 9(평생 기준)와 동일한 계산 로직 사용
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const monthlyIncome = calculateRetirementIncome()

    // 현재 월 총지출 (고정지출 + 생활비 + 월이자) - 슬라이드 8, 9와 동일
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest

    // 은퇴까지 남은 기간 (물가상승률 계산용)
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)

    // 목표 생활비 (물가 반영 여부에 따라) - 슬라이드 8, 9와 동일
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense

    // 평생 기준 계산 (억원 단위) - 슬라이드 9와 동일
    const totalMonths = retirementYears * 12
    const lifetimeSupply = Math.round(monthlyIncome * totalMonths / 10000 * 10) / 10  // 억원
    const lifetimeExpense = Math.round(targetMonthlyExpense * totalMonths / 10000 * 10) / 10  // 억원

    // 차이 계산 (평생 기준)
    const gap = lifetimeSupply - lifetimeExpense
    const isPositive = gap >= 0

    // 비율 계산 (막대 그래프용)
    const maxValue = Math.max(lifetimeExpense, lifetimeSupply)
    const targetPercent = (lifetimeExpense / maxValue) * 100
    const incomePercent = (lifetimeSupply / maxValue) * 100
    const gapPercent = Math.abs(targetPercent - incomePercent)

    return (
      <div className="left-slide">
        <div className="slide-gap-summary">
          {/* Header - 결과에 따라 동적 타이틀 */}
          <div className="asset-header">
            <h1 className="asset-title">
              {isPositive ? '다행입니다, 여유가 있네요' : '아쉽지만, 부족합니다'}
            </h1>
            {isPositive && <p className="asset-subtitle">하지만 방심은 금물</p>}
            <div className="asset-divider"></div>
          </div>

          {/* 비교 막대 그래프 */}
          <div className="gap-bar-comparison">
            {/* 필요한 금액 (목표 생활비) */}
            <div className="gap-bar-item">
              <div className="gap-bar-label">필요한 돈</div>
              <div className="gap-bar-container">
                <div
                  className="gap-bar-fill need"
                  style={{ height: `${targetPercent}%` }}
                >
                  <span className="gap-bar-value">{lifetimeExpense}억원</span>
                </div>
              </div>
            </div>

            {/* 준비된 금액 (예상 수입) */}
            <div className="gap-bar-item">
              <div className="gap-bar-label">준비된 돈</div>
              <div className="gap-bar-container">
                <div
                  className="gap-bar-fill prepared"
                  style={{ height: `${incomePercent}%` }}
                >
                  <span className="gap-bar-value">{lifetimeSupply}억원</span>
                </div>
                {/* 부족 구간 - 빗금 처리 */}
                {!isPositive && (
                  <div
                    className="gap-bar-deficit"
                    style={{ height: `${gapPercent}%` }}
                  >
                    <div className="gap-deficit-pattern"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 결과 표시 영역 */}
          <div className={`gap-result-box ${isPositive ? 'positive' : 'negative'}`}>
            <div className="gap-result-main">
              <span className="gap-result-sign">{isPositive ? '+' : '-'}</span>
              <span className="gap-result-number">{Math.abs(gap).toFixed(1)}</span>
              <span className="gap-result-unit">억원</span>
            </div>
            <div className="gap-result-label">
              {isPositive ? '평생 여유' : '평생 부족'}
            </div>
          </div>

          {/* 부족 시 경고 메시지 */}
          {!isPositive && (
            <div className="gap-warning-message">
              <p>
                <strong>{Math.abs(gap).toFixed(1)}억원</strong>이<br />
                부족합니다
              </p>
            </div>
          )}

        </div>
      </div>
    )
  }

  // 슬라이드 9: 평생 기준으로 보면
  const renderSlideLifetimePerspective = () => {
    // 은퇴 후 기대수명까지 기간 (기대수명 - 은퇴나이)
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge

    // 월 기준 데이터 (공통 함수 사용)
    const monthlyIncome = calculateRetirementIncome()
    // 현재 월 총지출 (고정지출 + 생활비 + 월이자) - 슬라이드 8과 동일
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest

    // 은퇴까지 남은 기간 (물가상승률 계산용)
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)

    // 목표 생활비 (물가 반영 여부에 따라) - 슬라이드 8과 동일
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense

    // 평생 기준 계산 (억원 단위)
    const totalMonths = retirementYears * 12
    const lifetimeSupply = Math.round(monthlyIncome * totalMonths / 10000 * 10) / 10  // 억원
    const lifetimeExpense = Math.round(targetMonthlyExpense * totalMonths / 10000 * 10) / 10  // 억원

    // 부족/여유 금액
    const gap = lifetimeSupply - lifetimeExpense
    const isPositive = gap >= 0

    // 준비율 계산
    const readinessRate = Math.round((lifetimeSupply / lifetimeExpense) * 1000) / 10
    const securedPercent = Math.min(readinessRate, 100)
    const deficitPercent = Math.max(0, 100 - securedPercent)

    // 상태 판단
    const getStatus = () => {
      if (readinessRate >= 100) return { label: '충분', type: 'success' }
      if (readinessRate >= 70) return { label: '보완 필요', type: 'warning' }
      return { label: '부족', type: 'danger' }
    }
    const status = getStatus()

    return (
      <div className="left-slide">
        <div className="slide-lifetime-perspective">
          {/* Header - 동적 타이틀 */}
          <div className="asset-header">
            <h1 className="asset-title">
              {isPositive ? (
                `은퇴 후 필요한 총 ${lifetimeExpense}억원, 충분히 준비되어 있습니다`
              ) : (
                <>
                  은퇴 후 필요한 총 {lifetimeExpense}억원에서 <span className="text-negative">{Math.abs(gap).toFixed(1)}억원</span> 부족합니다
                </>
              )}
            </h1>
            <div className="asset-divider"></div>
          </div>

          {/* 기간 안내 */}
          <div className="lifetime-period">
            은퇴 후 {retirementYears}년 기준
          </div>

          {/* 수요 vs 공급 막대 */}
          <div className="lifetime-chart">
            <div className="lifetime-chart-header">
              <span className="lifetime-chart-title">총 수요 vs 총 공급</span>
              <span className="lifetime-chart-unit">단위: 억원</span>
            </div>

            {/* 총 수요 */}
            <div className="lifetime-bar-row">
              <span className="lifetime-bar-row-label">총 수요</span>
              <div className="lifetime-bar-row-track">
                <div className="lifetime-bar-row-fill demand" style={{ width: '100%' }}>
                  <span className="lifetime-bar-row-value">{lifetimeExpense}</span>
                </div>
              </div>
            </div>

            {/* 총 공급 (스택) */}
            <div className="lifetime-bar-row">
              <span className="lifetime-bar-row-label">총 공급</span>
              <div className="lifetime-bar-row-track">
                <div
                  className="lifetime-bar-row-fill secured"
                  style={{ width: `${securedPercent}%` }}
                >
                  <span className="lifetime-bar-row-value">{lifetimeSupply}</span>
                </div>
                {deficitPercent > 0 && (
                  <div
                    className="lifetime-bar-row-fill deficit"
                    style={{ width: `${deficitPercent}%` }}
                  >
                    <span className="lifetime-bar-row-value">{Math.abs(gap).toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 범례 */}
            <div className="lifetime-chart-legend">
              <div className="lifetime-chart-legend-item">
                <span className="lifetime-chart-legend-box demand"></span>
                <span>총 지출 수요</span>
              </div>
              <div className="lifetime-chart-legend-item">
                <span className="lifetime-chart-legend-box secured"></span>
                <span>확보 현금흐름</span>
              </div>
              {deficitPercent > 0 && (
                <div className="lifetime-chart-legend-item">
                  <span className="lifetime-chart-legend-box deficit"></span>
                  <span>부족분</span>
                </div>
              )}
            </div>
          </div>

          {/* KPI 카드 2개 */}
          <div className="lifetime-kpi-grid">
            <div className={`lifetime-kpi-card ${status.type}`}>
              <div className="lifetime-kpi-label">현금흐름 준비율</div>
              <div className="lifetime-kpi-value">
                <span className="lifetime-kpi-number">{readinessRate}</span>
                <span className="lifetime-kpi-unit">%</span>
              </div>
              <div className="lifetime-kpi-status">{status.label}</div>
            </div>

            <div className={`lifetime-kpi-card ${status.type}`}>
              <div className="lifetime-kpi-label">{isPositive ? '여유 자금' : '부족 자금'}</div>
              <div className="lifetime-kpi-value">
                <span className="lifetime-kpi-number">{isPositive ? '+' : ''}{gap.toFixed(1)}</span>
                <span className="lifetime-kpi-unit">억원</span>
              </div>
              <div className="lifetime-kpi-status">{isPositive ? '안정적' : '대비 필요'}</div>
            </div>
          </div>

          {/* 하단 경고 메시지 */}
          <div className="lifetime-warning-note">
            자녀 결혼, 부모님 병환 등 큰 이벤트는 아직 반영되지 않았습니다
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 10: 현금흐름 진단 요약
  const renderSlideCashflowDiagnosis = () => {
    // 슬라이드 9와 동일한 계산 로직
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const totalMonths = retirementYears * 12
    const monthlyIncome = calculateRetirementIncome()

    // 현재 월 총지출 (고정지출 + 생활비 + 월이자)
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest

    // 은퇴까지 남은 기간 (물가상승률 계산용)
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)

    // 목표 생활비 (물가 반영 여부에 따라)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense

    // 평생 기준 계산 (억원 단위)
    const lifetimeIncome = Math.round(monthlyIncome * totalMonths / 10000 * 10) / 10
    const lifetimeExpense = Math.round(targetMonthlyExpense * totalMonths / 10000 * 10) / 10
    const lifetimeGap = Math.round((lifetimeIncome - lifetimeExpense) * 10) / 10

    // 월간 Gap
    const monthlyGap = monthlyIncome - targetMonthlyExpense

    // 준비율 계산
    const preparationRate = Math.round((lifetimeIncome / lifetimeExpense) * 100)

    // 진단 상태 결정
    type DiagnosisStatus = 'stable' | 'conditional' | 'shortage'

    const getDiagnosisStatus = (): DiagnosisStatus => {
      if (preparationRate >= 100) return 'stable'
      if (preparationRate >= 80) return 'conditional'
      return 'shortage'
    }

    const status = getDiagnosisStatus()

    // 진단 결과 정보
    const diagnosisInfo: Record<DiagnosisStatus, { title: string; description: string; color: string }> = {
      stable: {
        title: '안정',
        description: '현재 계획대로 충분한 은퇴 준비가 되어 있습니다.',
        color: '#34d399'
      },
      conditional: {
        title: '조건부 준비',
        description: '기본 생활은 가능하나, 변수 발생 시 대비가 필요합니다.',
        color: '#fbbf24'
      },
      shortage: {
        title: '준비 필요',
        description: '추가적인 준비가 필요합니다.',
        color: '#f87171'
      }
    }

    const currentDiagnosis = diagnosisInfo[status]
    const isPositive = lifetimeGap >= 0

    return (
      <div className="left-slide">
        <div className="slide-cashflow-diagnosis-v2">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">현금흐름 진단 요약</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 수치 요약 */}
          <div className="diagnosis-summary-grid">
            <div className="diagnosis-summary-card">
              <div className="diagnosis-summary-label">월 예상 수입</div>
              <div className="diagnosis-summary-value">{monthlyIncome.toLocaleString()}만원</div>
            </div>
            <div className="diagnosis-summary-card">
              <div className="diagnosis-summary-label">월 목표 생활비</div>
              <div className="diagnosis-summary-value">{targetMonthlyExpense.toLocaleString()}만원</div>
            </div>
            <div className={`diagnosis-summary-card ${isPositive ? 'positive' : 'negative'}`}>
              <div className="diagnosis-summary-label">월 Gap</div>
              <div className="diagnosis-summary-value">
                {isPositive ? '+' : ''}{monthlyGap.toLocaleString()}만원
              </div>
            </div>
          </div>

          {/* 평생 기준 요약 */}
          <div className="diagnosis-lifetime-summary">
            <div className="diagnosis-lifetime-row">
              <span className="diagnosis-lifetime-label">은퇴 후 {retirementYears}년간 총 수요</span>
              <span className="diagnosis-lifetime-value">{lifetimeExpense}억원</span>
            </div>
            <div className="diagnosis-lifetime-row">
              <span className="diagnosis-lifetime-label">은퇴 후 {retirementYears}년간 총 공급</span>
              <span className="diagnosis-lifetime-value">{lifetimeIncome}억원</span>
            </div>
            <div className={`diagnosis-lifetime-row gap ${isPositive ? 'positive' : 'negative'}`}>
              <span className="diagnosis-lifetime-label">{isPositive ? '여유 금액' : '부족 금액'}</span>
              <span className="diagnosis-lifetime-value">{Math.abs(lifetimeGap)}억원</span>
            </div>
          </div>

          {/* 진단 결과 - 해당 상태만 강조 */}
          <div className="diagnosis-result-highlight" style={{ borderColor: currentDiagnosis.color }}>
            <div className="diagnosis-result-badge" style={{ backgroundColor: currentDiagnosis.color }}>
              {currentDiagnosis.title}
            </div>
            <div className="diagnosis-result-rate">
              현금흐름 준비율 <span style={{ color: currentDiagnosis.color }}>{preparationRate}%</span>
            </div>
            <div className="diagnosis-result-description">
              {currentDiagnosis.description}
            </div>
          </div>

          {/* 하단 안내 */}
          <div className="cashflow-diagnosis-footer">
            Part 1 현금흐름 분석이 완료되었습니다.
          </div>
        </div>
      </div>
    )
  }

  // Part 2 전환 슬라이드
  const renderSlidePart2Transition = () => {
    // 슬라이드 10과 동일한 진단 로직
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const monthlyIncome = calculateRetirementIncome()
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense
    const totalMonths = retirementYears * 12
    const lifetimeIncome = Math.round(monthlyIncome * totalMonths / 10000 * 10) / 10
    const lifetimeExpense = Math.round(targetMonthlyExpense * totalMonths / 10000 * 10) / 10
    const preparationRate = Math.round((lifetimeIncome / lifetimeExpense) * 100)

    // 진단 상태 결정
    type DiagnosisStatus = 'stable' | 'conditional' | 'shortage'
    const getDiagnosisStatus = (): DiagnosisStatus => {
      if (preparationRate >= 100) return 'stable'
      if (preparationRate >= 80) return 'conditional'
      return 'shortage'
    }
    const status = getDiagnosisStatus()

    // 상태별 메시지
    const transitionMessages: Record<DiagnosisStatus, { title: string; description: string }> = {
      stable: {
        title: '현금흐름은 괜찮습니다',
        description: '이제 자산을 더 효율적으로 굴릴 차례입니다.\n지금부터 자산 구조를 살펴보겠습니다.'
      },
      conditional: {
        title: '기본 생활비는 충당됩니다',
        description: '하지만 여유가 크지 않습니다.\n자산 구조가 이를 보완해줄 수 있을까요?'
      },
      shortage: {
        title: '그렇다면 자산은 어떨까요?',
        description: '현금흐름이 부족하다면, 자산으로 메꿔야 합니다.\n지금부터 자산이 어떻게 변화하는지 살펴보겠습니다.'
      }
    }

    const message = transitionMessages[status]

    return (
      <div className="left-slide">
        <div className="slide-part2-transition">
          <div className="part2-transition-content">
            <div className="part2-transition-part-label">Part 2</div>
            <h1 className="part2-transition-title">{message.title}</h1>
            <p className="part2-transition-description">
              {message.description.split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </p>
          </div>
          <div className="agenda-flow">
            <div className="agenda-flow-item completed">
              <div className="agenda-flow-number">1</div>
              <div className="agenda-flow-label">현금흐름</div>
            </div>
            <div className="agenda-flow-arrow"></div>
            <div className="agenda-flow-item active">
              <div className="agenda-flow-number">2</div>
              <div className="agenda-flow-label">자산</div>
            </div>
            <div className="agenda-flow-arrow"></div>
            <div className="agenda-flow-item">
              <div className="agenda-flow-number">3</div>
              <div className="agenda-flow-label">전략</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 11: 은퇴 시점 순자산
  const [targetRetirementAsset] = useState(globalData.targetAsset)  // 목표 은퇴자산 (억원) - globalData에서 초기값

  const renderSlideRetirementAsset = () => {
    // globalData에서 자산 정보 가져오기
    const currentNetAsset = calculatedNetWorth  // 순자산 (억원)
    const currentAge = globalData.currentAge
    const retirementAge = globalData.targetRetirementAge

    // 은퇴까지 남은 기간
    const yearsToRetirement = Math.max(1, retirementAge - currentAge)

    // 예상 은퇴시점 자산 (단순 추정: 연 3% 성장 가정)
    const annualGrowthRate = 0.03
    const expectedRetirementAsset = Math.round(currentNetAsset * Math.pow(1 + annualGrowthRate, yearsToRetirement) * 10) / 10

    // 목표 달성률
    const achievementRate = Math.round((expectedRetirementAsset / targetRetirementAsset) * 1000) / 10

    // 상태 판단
    const getStatus = () => {
      if (achievementRate >= 100) return { label: '달성', type: 'success' }
      if (achievementRate >= 70) return { label: '근접', type: 'warning' }
      return { label: '부족', type: 'danger' }
    }
    const status = getStatus()

    return (
      <div className="left-slide">
        <div className="slide-retirement-asset">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">은퇴할 때, 순자산은 얼마일까요?</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="retirement-asset-message">
            입력해주신 데이터를 기반으로 시뮬레이션 해봤습니다.
            <div className="retirement-asset-target-info">
              은퇴 시점 목표 자산: <strong>{targetRetirementAsset}억원</strong>
            </div>
          </div>

          {/* 주요 수치 */}
          <div className="retirement-asset-main">
            <div className="retirement-asset-expected">
              <div className="retirement-asset-expected-label">예상 은퇴시점 순자산</div>
              <div className="retirement-asset-expected-value">
                <span className="retirement-asset-expected-number">{expectedRetirementAsset}</span>
                <span className="retirement-asset-expected-unit">억원</span>
              </div>
            </div>

            <div className={`retirement-asset-achievement ${status.type}`}>
              <div className="retirement-asset-achievement-label">예상 목표 달성률</div>
              <div className="retirement-asset-achievement-value">
                <span className="retirement-asset-achievement-number">{achievementRate}</span>
                <span className="retirement-asset-achievement-unit">%</span>
              </div>
              <div className="retirement-asset-achievement-status">{status.label}</div>
            </div>
          </div>

          {/* 가정 텍스트 */}
          <div className="retirement-asset-assumptions">
            <div className="retirement-asset-assumption-item">현재 순자산: {currentNetAsset}억원</div>
            <div className="retirement-asset-assumption-item">은퇴 시점: {retirementAge}세 ({yearsToRetirement}년 후)</div>
            <div className="retirement-asset-assumption-item">연평균 자산 성장률: {(annualGrowthRate * 100).toFixed(0)}% 가정</div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 12: 은퇴 시점까지의 자산 흐름
  const renderSlideAssetFlow = () => {
    // globalData에서 가져오기
    const currentAge = globalData.currentAge
    const retirementAge = globalData.targetRetirementAge
    const yearsToRetirement = Math.max(1, retirementAge - currentAge)

    // 현재 순자산
    const currentNetAsset = calculatedNetWorth

    // 자산 성장 데이터 생성
    const annualGrowthRate = 0.05
    const generateAssetData = () => {
      const labels: string[] = []
      const expectedData: number[] = []
      const targetData: number[] = []

      // 균등한 간격으로 데이터 포인트 생성 (시작점, 중간점들, 끝점)
      const numPoints = Math.min(6, Math.max(3, Math.ceil(yearsToRetirement / 3) + 1))  // 3~6개 포인트
      for (let j = 0; j < numPoints; j++) {
        const i = Math.round((yearsToRetirement * j) / (numPoints - 1))  // 균등 분배
        const age = currentAge + i
        labels.push(`${age}세`)
        const expected = Math.round(currentNetAsset * Math.pow(1 + annualGrowthRate, i) * 100) / 100
        expectedData.push(expected)
        // 목표 자산까지 선형 증가
        const targetAtYear = currentNetAsset + (targetRetirementAsset - currentNetAsset) * (i / yearsToRetirement)
        targetData.push(Math.round(targetAtYear * 100) / 100)
      }

      return { labels, expectedData, targetData }
    }

    const { labels, expectedData, targetData } = generateAssetData()
    const finalExpected = expectedData[expectedData.length - 1]
    const maxValue = Math.max(targetRetirementAsset, finalExpected) * 1.15

    const chartOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(11, 24, 40, 0.95)',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontFamily: 'Pretendard' },
        formatter: (params: any) => {
          const age = params[0].axisValue
          let result = `<div style="font-weight:600;margin-bottom:4px">${age}</div>`
          params.forEach((item: any) => {
            const color = item.seriesName === '목표 경로' ? '#818cf8' : '#34d399'
            result += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>
              <span>${item.seriesName}: ${item.value}억원</span>
            </div>`
          })
          return result
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.5)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 11, fontFamily: 'Pretendard' },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '(억원)',
        min: 0,
        max: Math.ceil(maxValue),
        nameTextStyle: { color: '#6B7280', fontSize: 10, fontFamily: 'Pretendard', padding: [0, 30, 0, 0] },
        splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)', type: 'dashed' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, fontFamily: 'Pretendard' },
        axisLine: { show: false }
      },
      series: [
        {
          name: '목표 경로',
          type: 'line',
          data: targetData,
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 2, color: '#818cf8', type: 'dashed' },
          itemStyle: { color: '#818cf8' }
        },
        {
          name: '예상 경로',
          type: 'line',
          data: expectedData,
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { width: 3, color: '#34d399' },
          itemStyle: { color: '#34d399', borderColor: '#fff', borderWidth: 1 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(52, 211, 153, 0.25)' },
                { offset: 1, color: 'rgba(52, 211, 153, 0)' }
              ]
            }
          }
        }
      ]
    }

    return (
      <div className="left-slide">
        <div className="slide-asset-flow">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">자산은 이렇게 변합니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="asset-flow-message">
            지금까지는 대부분 여기까지만 봅니다.
          </div>

          {/* 범례 */}
          <div className="asset-flow-legend">
            <div className="asset-flow-legend-item">
              <span className="asset-flow-legend-dot expected"></span>
              <span>예상 경로</span>
            </div>
            <div className="asset-flow-legend-item">
              <span className="asset-flow-legend-dot target"></span>
              <span>목표 경로 ({targetRetirementAsset}억)</span>
            </div>
          </div>

          {/* 차트 */}
          <div className="asset-flow-chart">
            <ReactECharts
              option={chartOption}
              style={{ height: '220px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>

          {/* 요약 */}
          <div className="asset-flow-summary">
            <div className="asset-flow-summary-item">
              <span className="asset-flow-summary-label">현재</span>
              <span className="asset-flow-summary-value">{currentNetAsset}억</span>
            </div>
            <div className="asset-flow-summary-arrow">→</div>
            <div className="asset-flow-summary-item">
              <span className="asset-flow-summary-label">{retirementAge}세 예상</span>
              <span className="asset-flow-summary-value">{finalExpected}억</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 13: 은퇴 이후는 이렇게 됩니다
  const renderSlideAfterRetirement = () => {
    // globalData에서 가져오기
    const currentAge = globalData.currentAge
    const retirementAge = globalData.targetRetirementAge
    const lifeExpectancy = globalData.lifeExpectancy
    const yearsToRetirement = Math.max(1, retirementAge - currentAge)
    const yearsAfterRetirement = lifeExpectancy - retirementAge

    // 현재 순자산
    const currentNetAsset = calculatedNetWorth
    const annualGrowthRate = 0.05

    // 은퇴 후 월 지출 및 수입 (globalData 기반)
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest
    const monthlyExpenseAfterRetirement = currentMonthlyExpense * (livingStandardPercent / 100)
    const monthlyIncomeAfterRetirement = calculateRetirementIncome()

    // 자산 데이터 생성 (전체 기간)
    const generateFullAssetData = () => {
      const labels: string[] = []
      const assetData: number[] = []

      // 은퇴 전: 자산 성장 (5년 간격, 은퇴 직전까지)
      let asset = currentNetAsset
      for (let age = currentAge; age < retirementAge; age += 5) {
        labels.push(`${age}세`)
        const yearsFromNow = age - currentAge
        asset = Math.round(currentNetAsset * Math.pow(1 + annualGrowthRate, yearsFromNow) * 100) / 100
        assetData.push(asset)
      }

      // 은퇴 시점 자산 (명시적으로 추가)
      const retirementAsset = Math.round(currentNetAsset * Math.pow(1 + annualGrowthRate, yearsToRetirement) * 100) / 100
      labels.push(`${retirementAge}세`)
      assetData.push(retirementAsset)
      const retirementIndexValue = labels.length - 1  // 은퇴 시점 인덱스

      // 은퇴 후: 자산 감소 (지출 - 수입)
      const monthlyNetExpense = monthlyExpenseAfterRetirement - monthlyIncomeAfterRetirement
      const yearlyNetExpense = monthlyNetExpense * 12 / 10000 // 억원 단위

      let currentAsset = retirementAsset
      for (let age = retirementAge + 5; age < lifeExpectancy; age += 5) {
        labels.push(`${age}세`)
        const yearsSinceRetirement = age - retirementAge
        currentAsset = Math.max(0, retirementAsset - yearlyNetExpense * yearsSinceRetirement)
        assetData.push(Math.round(currentAsset * 100) / 100)
      }

      // 기대수명 시점 명시적으로 추가
      labels.push(`${lifeExpectancy}세`)
      const yearsFromRetirementToEnd = lifeExpectancy - retirementAge
      currentAsset = Math.max(0, retirementAsset - yearlyNetExpense * yearsFromRetirementToEnd)
      assetData.push(Math.round(currentAsset * 100) / 100)

      return { labels, assetData, retirementAsset, retirementIndex: retirementIndexValue }
    }

    const { labels, assetData, retirementAsset, retirementIndex } = generateFullAssetData()

    // 자산 고갈 시점 찾기
    const depletionIndex = assetData.findIndex(v => v <= 0)
    const depletionAge = depletionIndex > 0 ? parseInt(labels[depletionIndex]) : null

    const maxValue = Math.max(...assetData) * 1.15

    const chartOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(11, 24, 40, 0.95)',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontFamily: 'Pretendard' },
        formatter: (params: any) => {
          const age = params[0].axisValue
          const value = params[0].value
          return `<div style="font-weight:600">${age}</div><div>순자산: ${value}억원</div>`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.5)' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, fontFamily: 'Pretendard' },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '(억원)',
        min: 0,
        max: Math.ceil(maxValue),
        nameTextStyle: { color: '#6B7280', fontSize: 10, fontFamily: 'Pretendard', padding: [0, 30, 0, 0] },
        splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)', type: 'dashed' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, fontFamily: 'Pretendard' },
        axisLine: { show: false }
      },
      series: [
        {
          name: '순자산',
          type: 'line',
          data: assetData,
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { width: 3, color: '#34d399' },
          itemStyle: { color: '#34d399', borderColor: '#fff', borderWidth: 1 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(52, 211, 153, 0.25)' },
                { offset: 1, color: 'rgba(52, 211, 153, 0)' }
              ]
            }
          },
          markArea: {
            silent: true,
            data: [[
              {
                xAxis: labels[retirementIndex],
                itemStyle: { color: 'rgba(248, 113, 113, 0.1)' }
              },
              {
                xAxis: labels[labels.length - 1]
              }
            ]]
          },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            data: [
              {
                xAxis: labels[retirementIndex],
                lineStyle: { color: '#f87171', type: 'dashed', width: 2 },
                label: {
                  show: true,
                  formatter: '은퇴',
                  color: '#f87171',
                  fontSize: 11,
                  fontWeight: 600,
                  position: 'end',
                  rotate: 0
                }
              }
            ]
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 8,
            label: {
              show: true,
              position: 'top',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'Pretendard',
              formatter: (params: any) => `${params.value}억`
            },
            data: [
              // 은퇴 시점
              {
                coord: [labels[retirementIndex], assetData[retirementIndex]],
                value: assetData[retirementIndex],
                itemStyle: { color: '#34d399' },
                label: { color: '#34d399' }
              },
              // 중간 시점 (은퇴 후 10년 또는 기대수명의 중간)
              ...(labels.length > retirementIndex + 2 ? [{
                coord: [labels[Math.floor((retirementIndex + labels.length - 1) / 2)], assetData[Math.floor((retirementIndex + labels.length - 1) / 2)]],
                value: assetData[Math.floor((retirementIndex + labels.length - 1) / 2)],
                itemStyle: { color: '#fbbf24' },
                label: { color: '#fbbf24' }
              }] : []),
              // 기대수명 시점
              {
                coord: [labels[labels.length - 1], assetData[labels.length - 1]],
                value: assetData[labels.length - 1],
                itemStyle: { color: assetData[labels.length - 1] <= 0 ? '#f87171' : '#94a3b8' },
                label: { color: assetData[labels.length - 1] <= 0 ? '#f87171' : '#94a3b8' }
              }
            ]
          }
        }
      ]
    }

    return (
      <div className="left-slide">
        <div className="slide-after-retirement">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">은퇴 이후는 이렇게 됩니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="after-retirement-message">
            은퇴는 끝이 아니라 시작입니다.
          </div>

          {/* 차트 */}
          <div className="after-retirement-chart">
            <ReactECharts
              option={chartOption}
              style={{ height: '240px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>

          {/* 요약 */}
          <div className="after-retirement-summary">
            <div className="after-retirement-summary-item">
              <span className="after-retirement-summary-label">은퇴 시점 자산</span>
              <span className="after-retirement-summary-value">{retirementAsset}억</span>
            </div>
            <div className="after-retirement-summary-item">
              <span className="after-retirement-summary-label">기대수명</span>
              <span className="after-retirement-summary-value">{lifeExpectancy}세</span>
            </div>
            {depletionAge && (
              <div className="after-retirement-summary-item warning">
                <span className="after-retirement-summary-label">자산 고갈 예상</span>
                <span className="after-retirement-summary-value">{depletionAge}세</span>
              </div>
            )}
          </div>

          {/* 구간 설명 */}
          <div className="after-retirement-legend">
            <div className="after-retirement-legend-item">
              <span className="after-retirement-legend-box accumulation"></span>
              <span>자산 축적기 ({currentAge}~{retirementAge}세)</span>
            </div>
            <div className="after-retirement-legend-item">
              <span className="after-retirement-legend-box spending"></span>
              <span>자산 인출기 ({retirementAge}~{lifeExpectancy}세)</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 14: 이 목표를 달성하려면
  const [requiredReturnToggles, setRequiredReturnToggles] = useState({
    realEstate: true,
    financial: true,
    pension: true,  // 퇴직연금 + 개인연금
  })

  const renderSlideRequiredReturn = () => {
    // globalData에서 가져오기
    const currentAge = globalData.currentAge
    const retirementAge = globalData.targetRetirementAge
    const yearsToRetirement = Math.max(1, retirementAge - currentAge)

    // 자산 구성 (억원) - globalData에서 가져오기
    const assets = {
      realEstate: globalData.realEstateAsset,    // 부동산
      financial: globalData.financialAsset,     // 금융자산
      pension: globalData.pensionAsset,      // 연금자산
    }

    // 선택된 자산 합계
    const calculateIncludedAssets = () => {
      let total = 0
      if (requiredReturnToggles.realEstate) total += assets.realEstate
      if (requiredReturnToggles.financial) total += assets.financial
      if (requiredReturnToggles.pension) total += assets.pension
      return total
    }

    const totalSelectedAssets = calculateIncludedAssets()
    // 부채를 빼서 순자산 계산 (calculatedTotalDebt는 만원 단위, 억원으로 변환)
    const debtInBillion = calculatedTotalDebt / 10000
    const includedAssets = Math.round((totalSelectedAssets - debtInBillion) * 100) / 100

    // 필요 연평균 수익률 계산
    // 목표자산 = 현재자산 * (1 + r)^n
    // r = (목표자산/현재자산)^(1/n) - 1
    const calculateRequiredReturn = (): number | null => {
      if (includedAssets <= 0) return null  // 자산 없으면 계산 불가
      const requiredReturn = Math.pow(targetRetirementAsset / includedAssets, 1 / yearsToRetirement) - 1
      return Math.round(requiredReturn * 1000) / 10  // 소수점 1자리 %
    }

    const requiredReturn = calculateRequiredReturn()

    // 수익률 수준 판단
    const getReturnLevel = (rate: number | null) => {
      if (rate === null) return { label: '계산 불가', type: 'disabled', description: '포함할 자산을 선택해주세요.' }
      if (rate <= 5) return { label: '달성 가능', type: 'success', description: '안정적인 투자로 달성 가능한 수준입니다.' }
      if (rate <= 10) return { label: '도전적', type: 'warning', description: '적극적인 투자 전략이 필요합니다.' }
      return { label: '매우 도전적', type: 'danger', description: '목표 조정을 고려해보세요.' }
    }

    const returnLevel = getReturnLevel(requiredReturn)

    // 토글 핸들러
    const handleToggle = (key: keyof typeof requiredReturnToggles) => {
      setRequiredReturnToggles(prev => ({
        ...prev,
        [key]: !prev[key]
      }))
    }

    const assetItems = [
      { key: 'realEstate' as const, label: '부동산', value: assets.realEstate },
      { key: 'financial' as const, label: '금융자산', value: assets.financial },
      { key: 'pension' as const, label: '연금', value: assets.pension },
    ]

    return (
      <div className="left-slide">
        <div className="slide-required-return">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">적어주신 목표를 달성하려면</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="required-return-message">
            순자산이 매년 아래와 같은 수익률로 성장해야 합니다. 
          </div>

          {/* 필요 수익률 표시 */}
          <div className={`required-return-main ${returnLevel.type}`}>
            <div className="required-return-label">필요 연평균 수익률</div>
            <div className="required-return-value">
              <span className="required-return-number">{requiredReturn}</span>
              <span className="required-return-unit">%</span>
            </div>
            <div className="required-return-status">{returnLevel.label}</div>
            <div className="required-return-description">{returnLevel.description}</div>
          </div>

          {/* 자산 토글 */}
          <div className="required-return-assets">
            <div className="required-return-assets-header">
              <span>포함 자산 선택</span>
              <span className="required-return-assets-total">순자산: {includedAssets.toFixed(2)}억원</span>
            </div>
            {assetItems.map(item => (
              <div key={item.key} className="required-return-asset-item">
                <div className="required-return-asset-info">
                  <span className="required-return-asset-label">{item.label}</span>
                  <span className="required-return-asset-value">{item.value}억원</span>
                </div>
                <button
                  className={`required-return-toggle-btn ${requiredReturnToggles[item.key] ? 'active' : ''}`}
                  onClick={() => handleToggle(item.key)}
                >
                  <span className="required-return-toggle-knob"></span>
                </button>
              </div>
            ))}
            {/* 부채 차감 표시 */}
            <div className="required-return-asset-item debt-item">
              <div className="required-return-asset-info">
                <span className="required-return-asset-label">부채 차감</span>
                <span className="required-return-asset-value debt-value">-{debtInBillion.toFixed(2)}억원</span>
              </div>
            </div>
          </div>

          {/* 하단 정보 */}
          <div className="required-return-footer">
            목표: {targetRetirementAsset}억원 / 기간: {yearsToRetirement}년
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드: 목표 달성 후 현금흐름 검증
  const renderSlideWithdrawalSimulation = () => {
    // 화면 11에서 사용한 동일한 계산 로직
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const monthlyIncome = calculateRetirementIncome()

    // 현재 월 총지출
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest

    // 은퇴까지 남은 기간 (물가상승률 계산용)
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)

    // 목표 생활비 (물가 반영)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense

    // 월간 Gap (부족분이 양수)
    const monthlyGap = targetMonthlyExpense - monthlyIncome
    const hasShortfall = monthlyGap > 0

    // 목표 달성 자산
    const targetAsset = targetRetirementAsset  // 억원

    // 부동산 제외 인출 가능 자산 (금융자산 + 연금)
    // 목표 자산에서 현재 부동산 비율을 유지한다고 가정
    const currentRealEstateRatio = globalData.realEstateAsset / calculatedTotalAsset
    const withdrawableAsset = targetAsset * (1 - currentRealEstateRatio)  // 억원

    // 필요 인출률 계산 (연간)
    // 월 부족액 * 12 / 인출가능자산 * 100
    const annualShortfall = monthlyGap * 12 / 10000  // 억원
    const withdrawalRate = withdrawableAsset > 0
      ? Math.round((annualShortfall / withdrawableAsset) * 1000) / 10  // 소수점 1자리 %
      : 0

    // 인출 지속 기간 (년)
    // 인출가능자산 / 연간 부족액
    const yearsOfWithdrawal = annualShortfall > 0
      ? Math.round(withdrawableAsset / annualShortfall * 10) / 10
      : 999

    // 인출률 수준 판단
    const getWithdrawalLevel = (rate: number) => {
      if (rate <= 3) return { label: '안전', type: 'success', description: '장기 유지 가능한 수준입니다.' }
      if (rate <= 5) return { label: '주의', type: 'warning', description: '시장 상황에 따라 조정이 필요할 수 있습니다.' }
      return { label: '위험', type: 'danger', description: '자산 고갈 위험이 있습니다.' }
    }

    const withdrawalLevel = getWithdrawalLevel(withdrawalRate)

    return (
      <div className="left-slide">
        <div className="slide-withdrawal-simulation">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">목표 자산 {targetAsset}억원을 달성했다고 가정해보겠습니다.</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 질문 */}
          <div className="withdrawal-question">
            부족한 현금흐름을 채울 수 있을까요?
          </div>

          {/* 계산 결과 그리드 */}
          <div className="withdrawal-results">
            {/* 월 부족액 */}
            <div className="withdrawal-result-card">
              <div className="withdrawal-result-label">월 부족 현금흐름</div>
              <div className="withdrawal-result-value">
                <span className="withdrawal-result-number">{hasShortfall ? monthlyGap.toLocaleString() : 0}</span>
                <span className="withdrawal-result-unit">만원</span>
              </div>
              <div className="withdrawal-result-note">현금흐름 진단 결과</div>
            </div>

            {/* 인출 가능 자산 */}
            <div className="withdrawal-result-card">
              <div className="withdrawal-result-label">예상 인출 가능 자산</div>
              <div className="withdrawal-result-value">
                <span className="withdrawal-result-number">{withdrawableAsset.toFixed(1)}</span>
                <span className="withdrawal-result-unit">억원</span>
              </div>
              <div className="withdrawal-result-note">부동산 제외</div>
            </div>
          </div>

          {/* 인출률 & 지속기간 */}
          <div className="withdrawal-analysis">
            <div className={`withdrawal-rate-card ${withdrawalLevel.type}`}>
              <div className="withdrawal-rate-header">
                <span className="withdrawal-rate-label">필요 인출률</span>
                <span className="withdrawal-rate-status">{withdrawalLevel.label}</span>
              </div>
              <div className="withdrawal-rate-value">
                <span className="withdrawal-rate-number">{withdrawalRate}</span>
                <span className="withdrawal-rate-unit">%/년</span>
              </div>
              <div className="withdrawal-rate-description">{withdrawalLevel.description}</div>
            </div>

            <div className="withdrawal-duration-card">
              <div className="withdrawal-duration-label">예상 지속가능 기간</div>
              <div className="withdrawal-duration-value">
                <span className="withdrawal-duration-number">
                  {yearsOfWithdrawal > 100 ? '100+' : yearsOfWithdrawal.toFixed(0)}
                </span>
                <span className="withdrawal-duration-unit">년</span>
              </div>
              <div className="withdrawal-duration-note">
                {yearsOfWithdrawal >= retirementYears
                  ? '기대수명까지 유지 가능'
                  : `기대수명(${globalData.lifeExpectancy}세)까지 ${Math.round(retirementYears - yearsOfWithdrawal)}년 부족`
                }
              </div>
            </div>
          </div>

          {/* 하단 안내 */}
          <div className="withdrawal-footer">
            일반적으로 연 4% 이하의 인출률이 안전한 수준으로 알려져 있습니다.
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드: 안전한 인출률을 위한 필요 성장률
  const renderSlideRequiredGrowthForSafeWithdrawal = () => {
    // 화면 15와 동일한 계산 로직
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const monthlyIncome = calculateRetirementIncome()

    // 현재 월 총지출
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest

    // 은퇴까지 남은 기간
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)

    // 목표 생활비 (물가 반영)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense

    // 월간 Gap (부족분이 양수)
    const monthlyGap = targetMonthlyExpense - monthlyIncome
    const annualShortfall = monthlyGap * 12 / 10000  // 억원

    // 안전 인출률 4%를 위해 필요한 인출 가능 자산
    // 인출률 = 연간부족액 / 인출가능자산 * 100
    // 4 = annualShortfall / requiredWithdrawableAsset * 100
    // requiredWithdrawableAsset = annualShortfall / 0.04
    const safeWithdrawalRate = 0.04
    const requiredWithdrawableAsset = annualShortfall > 0
      ? Math.round(annualShortfall / safeWithdrawalRate * 10) / 10
      : 0

    // 현재 부동산 비율 유지 가정 시 필요한 총 목표자산
    const currentRealEstateRatio = globalData.realEstateAsset / calculatedTotalAsset
    const requiredTotalAsset = requiredWithdrawableAsset / (1 - currentRealEstateRatio)

    // 현재 부동산 제외 자산 (금융 + 연금)
    const currentWithdrawableAsset = globalData.financialAsset + globalData.pensionAsset

    // 필요 연평균 성장률 계산
    // 목표 = 현재 * (1 + r)^n
    // r = (목표/현재)^(1/n) - 1
    const requiredGrowthRate = currentWithdrawableAsset > 0
      ? Math.round((Math.pow(requiredWithdrawableAsset / currentWithdrawableAsset, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    // 성장률 수준 판단
    const getGrowthLevel = (rate: number) => {
      if (rate <= 5) return { label: '달성 가능', type: 'success', description: '안정적인 투자로 달성 가능한 수준입니다.' }
      if (rate <= 10) return { label: '도전적', type: 'warning', description: '적극적인 투자 전략이 필요합니다.' }
      return { label: '매우 도전적', type: 'danger', description: '목표 조정을 고려해보세요.' }
    }

    const growthLevel = getGrowthLevel(requiredGrowthRate)

    // 화면 15에서 계산된 현재 인출률 (비교용)
    const currentWithdrawableAtTarget = targetRetirementAsset * (1 - currentRealEstateRatio)
    const currentWithdrawalRate = currentWithdrawableAtTarget > 0
      ? Math.round((annualShortfall / currentWithdrawableAtTarget) * 1000) / 10
      : 0

    return (
      <div className="left-slide">
        <div className="slide-required-growth">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">안전한 인출률(4%) 달성을 위해서는</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 현재 상황 vs 필요 상황 비교 */}
          <div className="growth-comparison">
            <div className="growth-comparison-item current">
              <div className="growth-comparison-label">현재 목표 기준 인출률</div>
              <div className="growth-comparison-value">
                <span className="growth-comparison-number">{currentWithdrawalRate}</span>
                <span className="growth-comparison-unit">%</span>
              </div>
              <div className="growth-comparison-note">목표 {targetRetirementAsset}억원 달성 시</div>
            </div>
            <div className="growth-comparison-arrow">→</div>
            <div className="growth-comparison-item target">
              <div className="growth-comparison-label">안전 인출률</div>
              <div className="growth-comparison-value">
                <span className="growth-comparison-number">4.0</span>
                <span className="growth-comparison-unit">%</span>
              </div>
              <div className="growth-comparison-note">권장 수준</div>
            </div>
          </div>

          {/* 필요 자산 */}
          <div className="growth-required-asset">
            <div className="growth-required-asset-label">안전 인출률을 위해 필요한 인출 가능 자산</div>
            <div className="growth-required-asset-value">
              <span className="growth-required-asset-number">{requiredWithdrawableAsset.toFixed(1)}</span>
              <span className="growth-required-asset-unit">억원</span>
            </div>
            <div className="growth-required-asset-note">
              현재 {currentWithdrawableAsset.toFixed(1)}억원 → {requiredWithdrawableAsset.toFixed(1)}억원 필요
            </div>
          </div>

          {/* 필요 성장률 */}
          <div className="growth-rate-card">
            <div className="growth-rate-label-center">부동산 제외 자산의 필요 연평균 성장률</div>
            <div className="growth-rate-value">
              <span className="growth-rate-number">{requiredGrowthRate}</span>
              <span className="growth-rate-unit">%</span>
            </div>
          </div>

          {/* 하단 안내 */}
          <div className="growth-footer">
            금융자산 + 연금자산이 {yearsToRetirement}년간 연 {requiredGrowthRate}%로 성장해야 합니다.
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드: 은퇴 직후 예상 현금흐름
  const renderSlideRetirementCashflow = () => {
    // 은퇴 시점 예상 월 수령액 계산 (물가 미반영)
    const pensionData = {
      nationalPension: 0, // 국민연금 (65세부터)
      retirementPension: 45, // 퇴직연금
      privatePension: 24, // 개인연금
      investmentWithdrawal: 120, // 투자자산 인출
    }
    const totalMonthlyIncome = Object.values(pensionData).reduce((a, b) => a + b, 0)

    // 수령액 수준 판단
    const getIncomeLevel = (amount: number) => {
      if (amount >= 350) return { level: '여유', color: '#10b981', description: '안정적인 노후 생활 가능' }
      if (amount >= 250) return { level: '적정', color: '#3b82f6', description: '기본 생활 유지 가능' }
      if (amount >= 150) return { level: '기본', color: '#f59e0b', description: '생활비 보완 필요' }
      return { level: '부족', color: '#ef4444', description: '적극적인 준비 필요' }
    }

    const incomeLevel = getIncomeLevel(totalMonthlyIncome)

    return (
      <div className="left-slide">
        <div className="slide-retirement-cashflow">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">은퇴 직후 예상 현금흐름</h1>
            <p className="asset-subtitle">은퇴 시점(50세) 기준, 물가상승률 미반영</p>
            <div className="asset-divider"></div>
          </div>

          {/* Hero: 예상 월수령액 */}
          <div className="cashflow-hero">
            <div className="cashflow-hero-label">예상 월 수령액</div>
            <div className="cashflow-hero-value">
              <span className="cashflow-hero-number" style={{ color: incomeLevel.color }}>
                {totalMonthlyIncome}
              </span>
              <span className="cashflow-hero-unit">만원</span>
            </div>
            <div className="cashflow-hero-level" style={{ color: incomeLevel.color }}>
              {incomeLevel.level} 수준
            </div>
          </div>

          {/* 수령액 구성 요약 */}
          <div className="cashflow-breakdown-mini">
            <div className="cashflow-breakdown-item">
              <span className="cashflow-breakdown-label">퇴직연금</span>
              <span className="cashflow-breakdown-value">{pensionData.retirementPension}만원</span>
            </div>
            <div className="cashflow-breakdown-divider">+</div>
            <div className="cashflow-breakdown-item">
              <span className="cashflow-breakdown-label">개인연금</span>
              <span className="cashflow-breakdown-value">{pensionData.privatePension}만원</span>
            </div>
            <div className="cashflow-breakdown-divider">+</div>
            <div className="cashflow-breakdown-item">
              <span className="cashflow-breakdown-label">투자 인출</span>
              <span className="cashflow-breakdown-value">{pensionData.investmentWithdrawal}만원</span>
            </div>
          </div>

          {/* 상태 카드 */}
          <div className="cashflow-status-card" style={{ borderColor: incomeLevel.color }}>
            <div className="cashflow-status-header">
              <span className="cashflow-status-badge" style={{ backgroundColor: incomeLevel.color }}>
                {incomeLevel.level}
              </span>
              <span className="cashflow-status-text">{incomeLevel.description}</span>
            </div>
            <div className="cashflow-status-note">
              국민연금은 65세부터 수령 시작
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 2: 3층 연금 구성 분석
  const renderSlidePensionBreakdown = () => {
    // 3층 연금 구성
    const pensionLayers = [
      { layer: 1, name: '국민연금', amount: 120, startAge: 65, color: '#10b981', status: '수령예정' },
      { layer: 2, name: '퇴직연금', amount: 45, startAge: 55, color: '#8b5cf6', status: '수령중' },
      { layer: 3, name: '개인연금', amount: 24, startAge: 55, color: '#f59e0b', status: '수령중' },
    ]

    const totalAtRetirement = pensionLayers.filter(p => p.startAge <= 55).reduce((sum, p) => sum + p.amount, 0)
    const totalAt65 = pensionLayers.reduce((sum, p) => sum + p.amount, 0)

    return (
      <div className="left-slide">
        <div className="slide-pension-breakdown">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">3층 연금 구성</h1>
            <p className="asset-subtitle">노후 소득 안정성의 핵심 지표</p>
            <div className="asset-divider"></div>
          </div>

          {/* 3층 피라미드 시각화 */}
          <div className="pension-pyramid">
            {pensionLayers.map((pension, idx) => {
              const width = 100 - (idx * 15)
              return (
                <div
                  key={idx}
                  className="pension-pyramid-layer"
                  style={{
                    width: `${width}%`,
                    backgroundColor: pension.status === '수령예정' ? 'rgba(255,255,255,0.1)' : pension.color,
                    borderColor: pension.color,
                  }}
                >
                  <div className="pension-pyramid-content">
                    <span className="pension-layer-num">{pension.layer}층</span>
                    <span className="pension-layer-name">{pension.name}</span>
                    <span className="pension-layer-amount" style={{ color: pension.status === '수령예정' ? pension.color : '#fff' }}>
                      월 {pension.amount}만원
                    </span>
                    {pension.status === '수령예정' && (
                      <span className="pension-layer-status">{pension.startAge}세부터</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 합계 비교 */}
          <div className="pension-total-comparison">
            <div className="pension-total-item">
              <span className="pension-total-label">은퇴 직후 (55세)</span>
              <span className="pension-total-value">{totalAtRetirement}만원/월</span>
            </div>
            <div className="pension-total-arrow">→</div>
            <div className="pension-total-item highlight">
              <span className="pension-total-label">국민연금 수령 후 (65세)</span>
              <span className="pension-total-value">{totalAt65}만원/월</span>
            </div>
          </div>

          {/* 분석 코멘트 */}
          <div className="pension-analysis-note">
            국민연금 수령 시작 시 월 {pensionLayers[0].amount}만원 추가
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 3: 노후 적정생활비 비교
  const renderSlideAdequateLiving = () => {
    // 통계청 기준 노후 적정생활비 (2인 가구)
    const adequateLivingExpense = 277 // 통계청 2024 가계금융복지조사 기준
    const expectedMonthlyIncome = 189 // 은퇴 직후 예상 수령액

    const gap = expectedMonthlyIncome - adequateLivingExpense
    const coverageRate = Math.round((expectedMonthlyIncome / adequateLivingExpense) * 100)

    const getGapStatus = () => {
      if (gap >= 0) return { status: '충족', color: '#10b981', icon: 'O' }
      if (gap >= -50) return { status: '소폭 부족', color: '#f59e0b', icon: '!' }
      return { status: '크게 부족', color: '#ef4444', icon: 'X' }
    }

    const gapStatus = getGapStatus()

    return (
      <div className="left-slide">
        <div className="slide-adequate-living">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">노후 적정생활비 비교</h1>
            <p className="asset-subtitle">통계청 기준 대비 준비 현황</p>
            <div className="asset-divider"></div>
          </div>

          {/* 비교 시각화 */}
          <div className="adequate-comparison">
            <div className="adequate-comparison-bar">
              {/* 예상 수령액 바 */}
              <div
                className="adequate-bar adequate-bar-income"
                style={{ width: `${Math.min((expectedMonthlyIncome / adequateLivingExpense) * 100, 100)}%` }}
              >
                <span className="adequate-bar-label">예상 수령액</span>
                <span className="adequate-bar-value">{expectedMonthlyIncome}만원</span>
              </div>
              {/* 적정생활비 기준선 */}
              <div className="adequate-bar adequate-bar-target">
                <span className="adequate-bar-label">노후 적정생활비</span>
                <span className="adequate-bar-value">{adequateLivingExpense}만원</span>
              </div>
            </div>
          </div>

          {/* GAP 표시 */}
          <div className="adequate-gap-display" style={{ borderColor: gapStatus.color }}>
            <div className="adequate-gap-header">
              <span className="adequate-gap-badge" style={{ backgroundColor: gapStatus.color }}>
                {gapStatus.icon}
              </span>
              <span className="adequate-gap-status" style={{ color: gapStatus.color }}>
                {gapStatus.status}
              </span>
            </div>
            <div className="adequate-gap-detail">
              <div className="adequate-gap-row">
                <span>충족률</span>
                <span style={{ color: gapStatus.color }}>{coverageRate}%</span>
              </div>
              <div className="adequate-gap-row highlight">
                <span>GAP</span>
                <span style={{ color: gapStatus.color }}>
                  {gap >= 0 ? '+' : ''}{gap}만원
                </span>
              </div>
            </div>
          </div>

          {/* 기준 출처 */}
          <div className="adequate-source">
            통계청 2024 가계금융복지조사 기준 (2인 가구)
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 4: 월 부족금액 산출
  const renderSlideMonthlyShortfall = () => {
    const adequateLivingExpense = 277 // 노후 적정생활비
    const expectedMonthlyIncome = 189 // 예상 월 수령액
    const monthlyShortfall = adequateLivingExpense - expectedMonthlyIncome // 88만원

    // 연간/30년 누적 부족액
    const annualShortfall = monthlyShortfall * 12
    const years30Shortfall = annualShortfall * 30 // 90세까지

    return (
      <div className="left-slide">
        <div className="slide-monthly-shortfall">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">월 부족금액</h1>
            <p className="asset-subtitle">현재 준비 수준으로는 매월 추가 자금 필요</p>
            <div className="asset-divider"></div>
          </div>

          {/* 계산식 표시 */}
          <div className="shortfall-calculation">
            <div className="shortfall-calc-row">
              <div className="shortfall-calc-item">
                <span className="shortfall-calc-label">노후 적정생활비</span>
                <span className="shortfall-calc-value">{adequateLivingExpense}만원</span>
              </div>
              <span className="shortfall-calc-operator">-</span>
              <div className="shortfall-calc-item">
                <span className="shortfall-calc-label">예상 수령액</span>
                <span className="shortfall-calc-value">{expectedMonthlyIncome}만원</span>
              </div>
              <span className="shortfall-calc-operator">=</span>
              <div className="shortfall-calc-item result">
                <span className="shortfall-calc-label">월 부족액</span>
                <span className="shortfall-calc-value negative">-{monthlyShortfall}만원</span>
              </div>
            </div>
          </div>

          {/* 누적 부족액 */}
          <div className="shortfall-cumulative">
            <div className="shortfall-cumulative-title">누적 부족금액</div>
            <div className="shortfall-cumulative-grid">
              <div className="shortfall-cumulative-item">
                <span className="shortfall-cumulative-period">연간</span>
                <span className="shortfall-cumulative-value">-{annualShortfall.toLocaleString()}만원</span>
              </div>
              <div className="shortfall-cumulative-item highlight">
                <span className="shortfall-cumulative-period">30년간 (90세까지)</span>
                <span className="shortfall-cumulative-value">-{(years30Shortfall / 10000).toFixed(1)}억원</span>
              </div>
            </div>
          </div>

          {/* 경고 메시지 */}
          <div className="shortfall-warning">
            <span className="shortfall-warning-icon">!</span>
            <span className="shortfall-warning-text">
              물가상승률 미반영 기준입니다. 실제 부족액은 더 클 수 있습니다.
            </span>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 5: 물가상승률 반영
  const renderSlideInflationImpact = () => {
    const inflationRate = 0.025 // 연 2.5%
    const yearsToRetirement = 10 // 은퇴까지 남은 기간
    const yearsAfterRetirement = 30 // 은퇴 후 기간 (90세까지)

    const currentShortfall = 88 // 현재가치 월 부족액
    const futureShortfall = Math.round(currentShortfall * Math.pow(1 + inflationRate, yearsToRetirement))
    const shortfall30Years = Math.round(currentShortfall * Math.pow(1 + inflationRate, yearsToRetirement + yearsAfterRetirement))

    // 누적 부족금액 (물가상승 반영)
    const calculateCumulativeWithInflation = () => {
      let cumulative = 0
      for (let year = 0; year < yearsAfterRetirement; year++) {
        const yearlyShortfall = currentShortfall * 12 * Math.pow(1 + inflationRate, yearsToRetirement + year)
        cumulative += yearlyShortfall
      }
      return Math.round(cumulative)
    }

    const cumulativeShortfall = calculateCumulativeWithInflation()

    return (
      <div className="left-slide">
        <div className="slide-inflation-impact">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">물가상승률 반영</h1>
            <p className="asset-subtitle">연 2.5% 물가상승률 적용 시</p>
            <div className="asset-divider"></div>
          </div>

          {/* 현재 vs 미래 비교 */}
          <div className="inflation-comparison">
            <div className="inflation-comparison-item">
              <span className="inflation-comparison-label">현재가치</span>
              <span className="inflation-comparison-sublabel">월 부족액</span>
              <span className="inflation-comparison-value">-{currentShortfall}만원</span>
            </div>
            <div className="inflation-comparison-arrow">
              <span className="inflation-rate-badge">연 2.5%</span>
              <span className="inflation-arrow-icon">→</span>
            </div>
            <div className="inflation-comparison-item future">
              <span className="inflation-comparison-label">은퇴 시점 (10년 후)</span>
              <span className="inflation-comparison-sublabel">월 부족액</span>
              <span className="inflation-comparison-value negative">-{futureShortfall}만원</span>
            </div>
          </div>

          {/* 30년 후 */}
          <div className="inflation-future-box">
            <div className="inflation-future-label">90세 시점 (40년 후)</div>
            <div className="inflation-future-value">-{shortfall30Years}만원/월</div>
            <div className="inflation-future-note">현재 88만원 → {shortfall30Years}만원으로 증가</div>
          </div>

          {/* 누적 부족금액 */}
          <div className="inflation-cumulative">
            <div className="inflation-cumulative-header">
              <span className="inflation-cumulative-title">은퇴 후 30년간 총 부족금액</span>
              <span className="inflation-cumulative-subtitle">물가상승률 반영</span>
            </div>
            <div className="inflation-cumulative-value">
              -{(cumulativeShortfall / 10000).toFixed(1)}억원
            </div>
          </div>

          {/* 경고 */}
          <div className="inflation-warning">
            현재가치 기준 2.64억원 → 물가 반영 시 {(cumulativeShortfall / 10000).toFixed(1)}억원
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드: 현실적인 수준일까요?
  const renderSlideRealisticCheck = () => {
    // 화면 16과 동일한 계산 로직 (필요 성장률)
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const monthlyIncome = calculateRetirementIncome()
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense
    const monthlyGap = targetMonthlyExpense - monthlyIncome
    const annualShortfall = monthlyGap * 12 / 10000

    // 안전 인출률 4%를 위해 필요한 자산
    const safeWithdrawalRate = 0.04
    const requiredWithdrawableAsset = annualShortfall > 0
      ? Math.round(annualShortfall / safeWithdrawalRate * 10) / 10
      : 0

    // 현재 부동산 제외 자산 (금융 + 연금)
    const currentWithdrawableAsset = globalData.financialAsset + globalData.pensionAsset

    // 필요 연평균 성장률
    const requiredGrowthRate = currentWithdrawableAsset > 0
      ? Math.round((Math.pow(requiredWithdrawableAsset / currentWithdrawableAsset, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    // 실제 벤치마크 데이터 (출처 기반)
    const benchmarks = [
      { label: '퇴직연금 평균 수익률', rate: 4.5, source: '2023년 기준, 금융감독원', isBeatable: requiredGrowthRate <= 4.5 },
      { label: '개인투자자 평균 수익률', rate: 3.2, source: '2014-2023 10년 평균, 금융투자협회', isBeatable: requiredGrowthRate <= 3.2 },
    ]

    // 달성 가능성 판단
    const beatableCount = benchmarks.filter(b => b.isBeatable).length
    const diagnosis = beatableCount === 2
      ? { type: 'success', message: '평균 수익률보다 낮아 달성 가능성이 높습니다.' }
      : beatableCount === 1
        ? { type: 'warning', message: '평균 이상의 수익률이 필요합니다.' }
        : { type: 'danger', message: '평균을 크게 상회하는 수익률이 필요합니다.' }

    return (
      <div className="left-slide">
        <div className="slide-realistic-check-v2">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">이 수익률, 현실적일까요?</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 필요 성장률 표시 */}
          <div className="required-growth-hero">
            <div className="required-growth-label">필요 연평균 성장률</div>
            <div className="required-growth-value">
              <span className="required-growth-number">{requiredGrowthRate}</span>
              <span className="required-growth-unit">%</span>
            </div>
            <div className="required-growth-desc">
              한 번 달성해야 하는 수익률이 아니라, {yearsToRetirement}년 동안 매년 달성해야 하는 수익률입니다
            </div>
          </div>

          {/* 벤치마크 비교 */}
          <div className="benchmark-comparison-list">
            {benchmarks.map((b, i) => (
              <div key={i} className={`benchmark-comparison-item ${b.isBeatable ? 'beatable' : 'not-beatable'}`}>
                <div className="benchmark-comparison-left">
                  <div className="benchmark-comparison-label">{b.label}</div>
                  <div className="benchmark-comparison-source">{b.source}</div>
                </div>
                <div className="benchmark-comparison-right">
                  <div className="benchmark-comparison-rate">{b.rate}%</div>
                  <div className={`benchmark-comparison-status ${b.isBeatable ? 'success' : 'danger'}`}>
                    {b.isBeatable ? '달성 가능' : '초과 필요'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 진단 결과 */}
          <div className={`realistic-diagnosis ${diagnosis.type}`}>
            {diagnosis.message}
          </div>
        </div>
      </div>
    )
  }

  // 자산 파트 요약 슬라이드
  const renderSlideAssetDiagnosis = () => {
    // 기본 데이터 계산
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const monthlyIncome = calculateRetirementIncome()
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense
    const monthlyGap = targetMonthlyExpense - monthlyIncome
    const annualShortfall = monthlyGap * 12 / 10000

    // 현재 순자산 (화면 13과 동일한 로직)
    const currentNetAsset = calculatedNetWorth  // 순자산 (억원)

    // 예상 은퇴시점 자산 (화면 13과 동일: 연 3% 성장 가정)
    const annualGrowthRate = 0.03
    const expectedRetirementAsset = Math.round(currentNetAsset * Math.pow(1 + annualGrowthRate, yearsToRetirement) * 10) / 10

    // 예상 목표 달성률 (화면 13과 동일)
    const achievementRate = Math.round((expectedRetirementAsset / targetRetirementAsset) * 1000) / 10

    // 필요 수익률 (화면 14와 동일)
    const requiredReturn = currentNetAsset > 0
      ? Math.round((Math.pow(targetRetirementAsset / currentNetAsset, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    // 안전 인출률 기준 필요 성장률 (화면 16과 동일)
    const safeWithdrawalRate = 0.04
    const requiredWithdrawableAsset = annualShortfall > 0
      ? Math.round(annualShortfall / safeWithdrawalRate * 10) / 10
      : 0
    const currentWithdrawableAsset = globalData.financialAsset + globalData.pensionAsset
    const requiredGrowthRate = currentWithdrawableAsset > 0
      ? Math.round((Math.pow(requiredWithdrawableAsset / currentWithdrawableAsset, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    // 화면 15 지속가능 기간 계산 (인출 시뮬레이션)
    const currentRealEstateRatio = globalData.realEstateAsset / calculatedTotalAsset
    const withdrawableAsset = targetRetirementAsset * (1 - currentRealEstateRatio)  // 목표 자산에서 인출 가능 자산
    const yearsOfWithdrawal = annualShortfall > 0
      ? Math.round(withdrawableAsset / annualShortfall * 10) / 10
      : 999
    const shortfallYears = Math.round((retirementYears - yearsOfWithdrawal) * 10) / 10

    // 진단 상태 결정
    type AssetDiagnosisStatus = 'stable' | 'conditional' | 'shortage'

    const getAssetDiagnosisStatus = (): AssetDiagnosisStatus => {
      // 목표 달성률과 지속가능 기간을 종합 판단
      if (achievementRate >= 80 && yearsOfWithdrawal >= retirementYears) return 'stable'
      if (achievementRate >= 50 && shortfallYears <= 5) return 'conditional'
      return 'shortage'
    }

    const status = getAssetDiagnosisStatus()

    const diagnosisInfo: Record<AssetDiagnosisStatus, { title: string; description: string; color: string }> = {
      stable: {
        title: '양호',
        description: '현재 자산 규모와 성장률로 은퇴 목표 달성이 가능합니다.',
        color: '#34d399'
      },
      conditional: {
        title: '주의',
        description: '목표 달성을 위해 자산 배분 조정이 필요합니다.',
        color: '#fbbf24'
      },
      shortage: {
        title: '점검 필요',
        description: '현재 자산 구조로는 목표 달성이 어렵습니다.',
        color: '#f87171'
      }
    }

    const currentDiagnosis = diagnosisInfo[status]

    return (
      <div className="left-slide">
        <div className="slide-asset-diagnosis">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">자산 진단 요약</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 수치 요약 */}
          <div className="diagnosis-summary-grid">
            <div className="diagnosis-summary-card">
              <div className="diagnosis-summary-label">예상 은퇴시점 자산</div>
              <div className="diagnosis-summary-value">{expectedRetirementAsset}억원</div>
            </div>
            <div className="diagnosis-summary-card">
              <div className="diagnosis-summary-label">목표 자산</div>
              <div className="diagnosis-summary-value">{targetRetirementAsset}억원</div>
            </div>
            <div className={`diagnosis-summary-card ${achievementRate >= 80 ? 'positive' : achievementRate >= 50 ? 'warning' : 'negative'}`}>
              <div className="diagnosis-summary-label">달성률</div>
              <div className="diagnosis-summary-value">{achievementRate}%</div>
            </div>
          </div>

          {/* 필요 수익률 요약 */}
          <div className="diagnosis-lifetime-summary">
            <div className="diagnosis-lifetime-row">
              <span className="diagnosis-lifetime-label">목표자산 달성을 위한 필요 수익률</span>
              <span className="diagnosis-lifetime-value">{requiredReturn}%</span>
            </div>
            <div className="diagnosis-lifetime-row">
              <span className="diagnosis-lifetime-label">안전 인출률(4%) 위한 필요 성장률(부동산 제외)</span>
              <span className="diagnosis-lifetime-value">{requiredGrowthRate}%</span>
            </div>
            <div className={`diagnosis-lifetime-row gap ${yearsOfWithdrawal >= retirementYears ? 'positive' : 'negative'}`}>
              <span className="diagnosis-lifetime-label">예상 지속가능 기간 {yearsOfWithdrawal}년, 기대수명({globalData.lifeExpectancy}세)까지</span>
              <span className="diagnosis-lifetime-value">
                {yearsOfWithdrawal >= retirementYears ? '충분' : `${shortfallYears}년 부족`}
              </span>
            </div>
          </div>

          {/* 진단 결과 */}
          <div className="diagnosis-result-highlight" style={{ borderColor: currentDiagnosis.color }}>
            <div className="diagnosis-result-badge" style={{ backgroundColor: currentDiagnosis.color }}>
              {currentDiagnosis.title}
            </div>
            <div className="diagnosis-result-rate">
              자산 준비 상태 <span style={{ color: currentDiagnosis.color }}>{status === 'stable' ? '양호' : status === 'conditional' ? '보통' : '미흡'}</span>
            </div>
            <div className="diagnosis-result-description">
              {currentDiagnosis.description}
            </div>
          </div>

          {/* 하단 안내 */}
          <div className="cashflow-diagnosis-footer">
            Part 2 자산 분석이 완료되었습니다.
          </div>
        </div>
      </div>
    )
  }

  // Part 3 전환 슬라이드: 자산 분석 완료 → 전략 파트로 연결
  const renderSlidePart3Transition = () => {
    // 자산 진단 요약과 동일한 로직으로 상태 결정
    const retirementYears = globalData.lifeExpectancy - globalData.targetRetirementAge
    const monthlyIncome = calculateRetirementIncome()
    const currentMonthlyExpense = globalData.monthlyFixedExpense + calculatedLivingExpense + calculatedMonthlyInterest
    const yearsToRetirement = globalData.targetRetirementAge - globalData.currentAge
    const inflationRate = 0.03
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement)
    const baseTargetExpense = Math.round(currentMonthlyExpense * (livingStandardPercent / 100))
    const targetMonthlyExpense = inflationEnabled
      ? Math.round(baseTargetExpense * inflationMultiplier)
      : baseTargetExpense
    const monthlyGap = targetMonthlyExpense - monthlyIncome
    const annualShortfall = monthlyGap * 12 / 10000

    const currentNetAsset = calculatedNetWorth
    const annualGrowthRate = 0.03
    const expectedRetirementAsset = Math.round(currentNetAsset * Math.pow(1 + annualGrowthRate, yearsToRetirement) * 10) / 10
    const achievementRate = Math.round((expectedRetirementAsset / targetRetirementAsset) * 1000) / 10

    // 지속가능 기간 계산
    const currentRealEstateRatio = globalData.realEstateAsset / calculatedTotalAsset
    const withdrawableAsset = targetRetirementAsset * (1 - currentRealEstateRatio)
    const yearsOfWithdrawal = annualShortfall > 0
      ? Math.round(withdrawableAsset / annualShortfall * 10) / 10
      : 999
    const shortfallYears = Math.round((retirementYears - yearsOfWithdrawal) * 10) / 10

    // 진단 상태 결정
    type AssetDiagnosisStatus = 'stable' | 'conditional' | 'shortage'
    const getAssetDiagnosisStatus = (): AssetDiagnosisStatus => {
      if (achievementRate >= 80 && yearsOfWithdrawal >= retirementYears) return 'stable'
      if (achievementRate >= 50 && shortfallYears <= 5) return 'conditional'
      return 'shortage'
    }
    const status = getAssetDiagnosisStatus()

    // 상태별 메시지
    const transitionMessages: Record<AssetDiagnosisStatus, { title: string; description: string }> = {
      stable: {
        title: '자산은 준비되어 있습니다',
        description: '이제 자산을 지키고 효율적으로 활용할 전략이 필요합니다.\n지금부터 실행 전략을 살펴보겠습니다.'
      },
      conditional: {
        title: '자산은 부족하지 않습니다',
        description: '하지만 구조 조정이 필요합니다.\n어떻게 바꾸면 되는지 살펴보겠습니다.'
      },
      shortage: {
        title: '자산만으로는 부족합니다',
        description: '현금흐름과 자산 모두 보완이 필요합니다.\n지금부터 어디서부터 바꿔야 하는지 살펴보겠습니다.'
      }
    }

    const message = transitionMessages[status]

    return (
      <div className="left-slide">
        <div className="slide-part2-transition">
          <div className="part2-transition-content">
            <div className="part2-transition-part-label">Part 3</div>
            <h1 className="part2-transition-title">{message.title}</h1>
            <p className="part2-transition-description">
              {message.description.split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </p>
          </div>
          <div className="agenda-flow">
            <div className="agenda-flow-item completed">
              <div className="agenda-flow-number">1</div>
              <div className="agenda-flow-label">현금흐름</div>
            </div>
            <div className="agenda-flow-arrow"></div>
            <div className="agenda-flow-item completed">
              <div className="agenda-flow-number">2</div>
              <div className="agenda-flow-label">자산</div>
            </div>
            <div className="agenda-flow-arrow"></div>
            <div className="agenda-flow-item active">
              <div className="agenda-flow-number">3</div>
              <div className="agenda-flow-label">전략</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 16: 총자산 관점 설명
  const renderSlideTotalAssetPerspective = () => {
    // globalData에서 가져오기 (슬라이드 14, 15와 동일한 로직)
    const currentAge = globalData.currentAge
    const retirementAge = globalData.targetRetirementAge
    const yearsToRetirement = Math.max(1, retirementAge - currentAge)

    // 자산 구성 (억원) - globalData에서 가져오기
    const assets = {
      realEstate: globalData.realEstateAsset,
      financial: globalData.financialAsset,
      pension: globalData.pensionAsset,
    }

    // 선택된 자산 합계 - 슬라이드 14와 동일한 로직 (부채 차감)
    let totalSelectedAssets = 0
    if (requiredReturnToggles.realEstate) totalSelectedAssets += assets.realEstate
    if (requiredReturnToggles.financial) totalSelectedAssets += assets.financial
    if (requiredReturnToggles.pension) totalSelectedAssets += assets.pension

    // 부채를 빼서 순자산 계산 (calculatedTotalDebt는 만원 단위, 억원으로 변환)
    const debtInBillion = calculatedTotalDebt / 10000
    const includedAssets = Math.round((totalSelectedAssets - debtInBillion) * 100) / 100

    const requiredReturn = includedAssets > 0
      ? Math.round((Math.pow(targetRetirementAsset / includedAssets, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    // 자산 구조 기반 필요 수익률 분해 (동적 비율 계산)
    const totalAsset = assets.realEstate + assets.financial + assets.pension
    const realEstateRatio = totalAsset > 0 ? Math.round(assets.realEstate / totalAsset * 100) / 100 : 0
    const depositRatio = totalAsset > 0 ? Math.round((assets.financial * 0.5) / totalAsset * 100) / 100 : 0 // 금융자산 중 예금 50% 가정
    const investRatio = totalAsset > 0 ? Math.round((totalAsset - assets.realEstate - assets.financial * 0.5) / totalAsset * 100) / 100 : 0

    const realEstateReturn = 3.5 // 부동산 기대수익률
    const depositReturn = 3.0 // 예금 기대수익률

    // 나머지 자산이 달성해야 할 수익률 계산
    // 전체 목표 = 부동산 기여 + 예금 기여 + 투자 기여
    // requiredReturn = realEstateRatio * realEstateReturn + depositRatio * depositReturn + investRatio * X
    // X = (requiredReturn - realEstateRatio * realEstateReturn - depositRatio * depositReturn) / investRatio
    const requiredInvestReturn = Math.round(
      ((requiredReturn - realEstateRatio * realEstateReturn * 100 / 100 - depositRatio * depositReturn * 100 / 100) / investRatio) * 10
    ) / 10

    const assetBreakdown = [
      { label: `부동산 (${Math.round(realEstateRatio * 100)}%)`, expected: '3.5%', contribution: `${Math.round(realEstateRatio * realEstateReturn * 10) / 10}%p`, note: '묶여있는 돈' },
      { label: `예금 (${Math.round(depositRatio * 100)}%)`, expected: '3.0%', contribution: `${Math.round(depositRatio * depositReturn * 10) / 10}%p`, note: '안전하지만 낮은 수익' },
      { label: `투자자산 (${Math.round(investRatio * 100)}%)`, expected: `${requiredInvestReturn}%`, contribution: `${Math.round((requiredReturn - realEstateRatio * realEstateReturn - depositRatio * depositReturn) * 10) / 10}%p`, note: '나머지가 책임져야', isHighlight: true },
    ]

    return (
      <div className="left-slide">
        <div className="slide-total-asset">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">이 수익률, 어떻게 달성할까요?</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 메시지 - 구조적 어려움 강조 */}
          <div className="total-asset-message">
            <p className="message-main">
              부동산은 묶여있고, 예금은 3%입니다
            </p>
            <p className="message-sub">
              <strong>나머지 {Math.round(investRatio * 100)}%</strong>가 전체 {requiredReturn}%를 만들어야 합니다
            </p>
          </div>

          {/* 자산별 필요 수익률 분해 */}
          <div className="asset-breakdown-table">
            <div className="breakdown-header">
              <span className="breakdown-col">자산 구성</span>
              <span className="breakdown-col">기대 수익률</span>
              <span className="breakdown-col">기여도</span>
            </div>
            {assetBreakdown.map((item, idx) => (
              <div key={idx} className={`breakdown-row ${item.isHighlight ? 'highlight' : ''}`}>
                <span className="breakdown-asset">
                  {item.label}
                  <span className="breakdown-note">{item.note}</span>
                </span>
                <span className="breakdown-expected">{item.expected}</span>
                <span className="breakdown-contribution">{item.contribution}</span>
              </div>
            ))}
            <div className="breakdown-total">
              <span className="breakdown-asset">전체 필요 수익률</span>
              <span className="breakdown-expected"></span>
              <span className="breakdown-contribution">{requiredReturn}%</span>
            </div>
          </div>

          {/* 구조적 문제 강조 */}
          <div className="structure-problem">
            <p className="problem-text">
              <strong>투자자산 {Math.round(investRatio * 100)}%</strong>가 <strong>{requiredInvestReturn}% 수익</strong>을 내야<br />
              전체 자산이 {requiredReturn}% 성장합니다
            </p>
            <p className="problem-sub">
              현실적으로 가능한 수익률일까요?
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 21: 매년 관리해야 할 것들 (Part 4 시작)
  const renderSlideAnnualManagement = () => {
    // Action 위주로 변경
    const managementItems = [
      { label: '목표 비중에 맞게 사고팔기', desc: '자산 리밸런싱' },
      { label: '더 싼 대출로 갈아타기', desc: '금리 조건 재검토' },
      { label: '세액공제 한도 꽉 채우기', desc: '연금 납입 최적화' },
      { label: '연말정산 토해내지 않기', desc: '세금 환급 극대화' },
      { label: '빠진 보장 없는지 확인', desc: '보험 점검' },
      { label: '손실 난 건 갈아타기', desc: '투자 성과 점검' },
    ]

    return (
      <div className="left-slide">
        <div className="slide-annual-management">
          {/* Header - 질문형으로 변경 */}
          <div className="asset-header">
            <h1 className="asset-title">이걸 '매년' 하실 수 있으시겠습니까?</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 메시지 */}
          <p className="annual-message">
            자산 구조를 고치려면 매년 이 6가지를 해야 합니다
          </p>

          {/* 체크리스트 - Action 강조 */}
          <div className="management-checklist">
            {managementItems.map((item, idx) => (
              <div key={idx} className="management-item">
                <div className="management-number">{idx + 1}</div>
                <div className="management-content">
                  <span className="management-label">{item.label}</span>
                  <span className="management-desc">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 하단 메시지 - 압도감 */}
          <div className="annual-bottom-message warning">
            <p>본업 하시면서 이걸 다 챙기실 수 있으신가요?</p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 23: 결정해야 할 것들
  const renderSlideDecisionPoints = () => {
    const decisions = [
      '연금은 언제 받기 시작할까?',
      '퇴직금은 일시금? 연금?',
      '자산 비중은 이대로 괜찮을까?',
      '세금은 어떻게 줄일까?',
      '자녀 지원은 언제, 얼마나?',
    ]

    return (
      <div className="left-slide">
        <div className="slide-decision-points">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">매년 이런 결정을 해야 합니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 메시지 */}
          <p className="decision-message">
            이 질문들에 매년 답해야 합니다
          </p>

          {/* 질문 카드 */}
          <div className="decision-cards">
            {decisions.map((q, idx) => (
              <div key={idx} className="decision-card">
                <span className="decision-number">{idx + 1}</span>
                <span className="decision-text">{q}</span>
              </div>
            ))}
          </div>

          {/* 하단 메시지 */}
          <div className="decision-bottom-message">
            <p>매번 혼자 결정하시기 쉽지 않으시죠</p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 22: 3층 연금 구조 (복잡성 강조)
  const renderSlidePensionStructure = () => {
    const pensionLayers = [
      {
        level: 3,
        name: '개인연금',
        subtitle: '자유롭게 설계',
        description: '연금저축, IRP 등 본인이 선택하여 가입',
        features: ['세액공제 혜택', '다양한 상품 선택', '유연한 납입'],
        color: '#8b5cf6'
      },
      {
        level: 2,
        name: '퇴직연금',
        subtitle: '회사 + 본인',
        description: 'DC/DB형, 회사와 본인이 함께 적립',
        features: ['회사 의무 적립', '운용 방식 선택', '퇴직 시 수령'],
        color: '#3b82f6'
      },
      {
        level: 1,
        name: '국민연금',
        subtitle: '기본 안전망',
        description: '국가가 운영하는 공적 연금 제도',
        features: ['의무 가입', '물가 연동', '종신 수령'],
        color: '#10b981'
      }
    ]

    return (
      <div className="left-slide">
        <div className="slide-pension-structure">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">연금만 해도 이렇게 복잡합니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 메시지 */}
          <p className="pension-message">3층 연금, 각각 규칙이 다릅니다</p>

          {/* 3층 구조 시각화 */}
          <div className="pension-layers">
            {pensionLayers.map((layer) => (
              <div key={layer.level} className="pension-layer" style={{ borderColor: layer.color }}>
                <div className="layer-badge" style={{ backgroundColor: layer.color }}>
                  {layer.level}층
                </div>
                <div className="layer-content">
                  <div className="layer-header">
                    <span className="layer-name">{layer.name}</span>
                    <span className="layer-subtitle">{layer.subtitle}</span>
                  </div>
                  <p className="layer-description">{layer.description}</p>
                  <div className="layer-features">
                    {layer.features.map((f, i) => (
                      <span key={i} className="layer-feature">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 복잡성 강조 메시지 */}
          <div className="pension-complexity-box">
            <p className="complexity-title">각 층마다 세금, 인출 시기, 운용 방식이 다릅니다</p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 24: 저희가 대신합니다 (역할 비교표)
  const renderSlideServiceIntro = () => {
    // 고객 언어로 변경
    const roleComparison = [
      { task: '서류 작업', alone: '직접 찾고 정리하기', withUs: '저희가 정리해드려요' },
      { task: '시장 뉴스', alone: '매일 체크하기', withUs: '저희가 모니터링해요' },
      { task: '세금 계산', alone: '복잡한 공식 찾기', withUs: '저희가 계산해드려요' },
      { task: '대안 검토', alone: '뭐가 좋은지 고민', withUs: 'A/B 비교해서 제시' },
      { task: '최종 결정', alone: 'Yes / No', withUs: 'Yes / No', isHighlight: true },
    ]

    return (
      <div className="left-slide">
        <div className="slide-service-intro">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">귀찮고 어려운 건 저희가 합니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 핵심 메시지 */}
          <div className="service-main-message">
            <p>고객님은 <strong>삶을 즐기시고</strong>, 결정만 하시면 됩니다</p>
          </div>

          {/* 역할 비교표 */}
          <div className="role-comparison-table">
            <div className="role-table-header">
              <span className="role-col-task"></span>
              <span className="role-col-alone">직접 하실 때</span>
              <span className="role-col-with">저희와 함께</span>
            </div>
            {roleComparison.map((row, idx) => (
              <div key={idx} className={`role-table-row ${row.isHighlight ? 'highlight' : ''}`}>
                <span className="role-col-task">{row.task}</span>
                <span className="role-col-alone">{row.alone}</span>
                <span className="role-col-with">{row.withUs}</span>
              </div>
            ))}
          </div>

          {/* 마무리 메시지 */}
          <div className="service-closing">
            <p>
              <strong>결정은 언제나 고객님</strong>이 하십니다.<br />
              저희는 그 결정이 쉬워지도록 도와드릴 뿐입니다.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드: 선택지는 3가지입니다 (미사용 - 추후 삭제 가능)
  const renderSlideThreeOptions = () => {
    const options = [
      {
        id: 'extend-retirement',
        title: '은퇴 시점 연장',
        description: '몇 년 더 일하면 자산 축적 기간이 늘어나고, 연금 수령액도 증가합니다.',
        icon: 'clock',
        targetSlide: 17,
      },
      {
        id: 'reduce-lifestyle',
        title: '은퇴 후 생활 수준 낮추기',
        description: '목표 생활비를 조정하면 필요 자산이 줄어들어 달성이 수월해집니다.',
        icon: 'home',
        targetSlide: 18,
      },
      {
        id: 'invest-strategy',
        title: '저축/투자 전략',
        description: '저축률을 높이거나 투자 전략을 조정하여 자산 성장 속도를 높입니다.',
        icon: 'chart',
        targetSlide: 19,
      },
    ]

    const handleOptionClick = (targetSlide: number) => {
      setCurrentSlide(targetSlide)
    }

    return (
      <div className="left-slide">
        <div className="slide-three-options">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">선택지는 3가지입니다</h1>
            <div className="asset-divider"></div>
          </div>

          {/* 메시지 */}
          <div className="options-message">
            정답은 없습니다.
          </div>

          {/* 카드 3개 */}
          <div className="options-cards">
            {options.map((option) => (
              <div
                key={option.id}
                className="option-card"
                onClick={() => handleOptionClick(option.targetSlide)}
              >
                <div className="option-icon">
                  {option.icon === 'clock' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12,6 12,12 16,14" />
                    </svg>
                  )}
                  {option.icon === 'home' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9,22 9,12 15,12 15,22" />
                    </svg>
                  )}
                  {option.icon === 'chart' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="20" x2="12" y2="10" />
                      <line x1="18" y1="20" x2="18" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="16" />
                    </svg>
                  )}
                </div>
                <div className="option-content">
                  <h3 className="option-title">{option.title}</h3>
                  <p className="option-description">{option.description}</p>
                </div>
                <div className="option-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <div className="options-footer">
            카드를 클릭하여 선택지별 영향을 확인하세요
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 17: 은퇴 시점 연장 영향
  const [extendRetirementToggle, setExtendRetirementToggle] = useState(false)
  const renderSlideExtendRetirement = () => {
    const baseRetirementAge = 55 + assumptionRetirementOffset
    const extendedAge = baseRetirementAge + 5
    const currentAge = 40

    const baseYears = baseRetirementAge - currentAge
    const extendedYears = extendedAge - currentAge

    // 기존 필요 수익률 계산
    const assets = { realEstate: 3.5, financial: 2.0, pension: 1.42 }
    let includedAssets = 0
    if (requiredReturnToggles.realEstate) includedAssets += assets.realEstate
    if (requiredReturnToggles.financial) includedAssets += assets.financial
    if (requiredReturnToggles.pension) includedAssets += assets.pension

    const baseReturn = includedAssets > 0
      ? Math.round((Math.pow(targetRetirementAsset / includedAssets, 1 / baseYears) - 1) * 1000) / 10
      : 0

    const extendedReturn = includedAssets > 0
      ? Math.round((Math.pow(targetRetirementAsset / includedAssets, 1 / extendedYears) - 1) * 1000) / 10
      : 0

    const returnDiff = Math.round((baseReturn - extendedReturn) * 10) / 10

    return (
      <div className="left-slide">
        <div className="slide-option-preview">
          <div className="asset-header">
            <h1 className="asset-title">은퇴 시점 연장</h1>
            <div className="asset-divider"></div>
          </div>

          <div className="preview-message">
            이 선택을 하면 이렇게 달라집니다.
          </div>

          <div className="preview-content">
            {/* 핵심 변화 숫자 */}
            <div className="preview-highlight">
              <div className="highlight-label">필요 수익률 감소</div>
              <div className="highlight-value">-{returnDiff}%p</div>
              <div className="highlight-detail">
                {baseReturn}% → {extendedReturn}%
              </div>
            </div>

            {/* 토글 */}
            <div className="preview-toggle">
              <span className="toggle-label">5년 연장 적용</span>
              <button
                className={`preview-toggle-btn ${extendRetirementToggle ? 'active' : ''}`}
                onClick={() => setExtendRetirementToggle(!extendRetirementToggle)}
              >
                <span className="toggle-knob" />
              </button>
              <span className="toggle-status">
                {extendRetirementToggle ? `${extendedAge}세` : `${baseRetirementAge}세`}
              </span>
            </div>

            {/* 비교 바 */}
            <div className="preview-comparison">
              <div className="comparison-item">
                <span className="comparison-label">현재</span>
                <div className="comparison-bar-wrap">
                  <div
                    className="comparison-bar base"
                    style={{ width: `${Math.min(baseReturn / 15 * 100, 100)}%` }}
                  />
                  <span className="comparison-value">{baseReturn}%</span>
                </div>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">연장 시</span>
                <div className="comparison-bar-wrap">
                  <div
                    className={`comparison-bar ${extendRetirementToggle ? 'active' : 'preview'}`}
                    style={{ width: `${Math.min(extendedReturn / 15 * 100, 100)}%` }}
                  />
                  <span className="comparison-value">{extendedReturn}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-footer">
            은퇴 시점을 5년 늦추면 자산 축적 기간이 늘어나 필요 수익률이 낮아집니다.
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 18: 생활 수준 낮추기 영향
  const [reduceLifestyleToggle, setReduceLifestyleToggle] = useState(false)
  const renderSlideReduceLifestyle = () => {
    const baseTarget = targetRetirementAsset
    const reducedTarget = Math.round(baseTarget * 0.8 * 10) / 10

    const currentAge = 40
    const retirementAge = 55 + assumptionRetirementOffset
    const yearsToRetirement = retirementAge - currentAge

    const assets = { realEstate: 3.5, financial: 2.0, pension: 1.42 }
    let includedAssets = 0
    if (requiredReturnToggles.realEstate) includedAssets += assets.realEstate
    if (requiredReturnToggles.financial) includedAssets += assets.financial
    if (requiredReturnToggles.pension) includedAssets += assets.pension

    const baseReturn = includedAssets > 0
      ? Math.round((Math.pow(baseTarget / includedAssets, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    const reducedReturn = includedAssets > 0
      ? Math.round((Math.pow(reducedTarget / includedAssets, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    const returnDiff = Math.round((baseReturn - reducedReturn) * 10) / 10

    return (
      <div className="left-slide">
        <div className="slide-option-preview">
          <div className="asset-header">
            <h1 className="asset-title">은퇴 후 생활 수준 낮추기</h1>
            <div className="asset-divider"></div>
          </div>

          <div className="preview-message">
            이 선택을 하면 이렇게 달라집니다.
          </div>

          <div className="preview-content">
            <div className="preview-highlight">
              <div className="highlight-label">필요 수익률 감소</div>
              <div className="highlight-value">-{returnDiff}%p</div>
              <div className="highlight-detail">
                {baseReturn}% → {reducedReturn}%
              </div>
            </div>

            <div className="preview-toggle">
              <span className="toggle-label">목표 자산 20% 감소</span>
              <button
                className={`preview-toggle-btn ${reduceLifestyleToggle ? 'active' : ''}`}
                onClick={() => setReduceLifestyleToggle(!reduceLifestyleToggle)}
              >
                <span className="toggle-knob" />
              </button>
              <span className="toggle-status">
                {reduceLifestyleToggle ? `${reducedTarget}억` : `${baseTarget}억`}
              </span>
            </div>

            <div className="preview-comparison">
              <div className="comparison-item">
                <span className="comparison-label">현재</span>
                <div className="comparison-bar-wrap">
                  <div
                    className="comparison-bar base"
                    style={{ width: `${Math.min(baseReturn / 15 * 100, 100)}%` }}
                  />
                  <span className="comparison-value">{baseReturn}%</span>
                </div>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">조정 시</span>
                <div className="comparison-bar-wrap">
                  <div
                    className={`comparison-bar ${reduceLifestyleToggle ? 'active' : 'preview'}`}
                    style={{ width: `${Math.min(reducedReturn / 15 * 100, 100)}%` }}
                  />
                  <span className="comparison-value">{reducedReturn}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-footer">
            목표 생활비를 20% 낮추면 필요 자산이 줄어 달성이 수월해집니다.
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 19: 저축/투자 전략 영향
  const [investStrategyToggle, setInvestStrategyToggle] = useState(false)
  const renderSlideInvestStrategy = () => {
    const currentAge = 40
    const retirementAge = 55 + assumptionRetirementOffset
    const yearsToRetirement = retirementAge - currentAge

    const assets = { realEstate: 3.5, financial: 2.0, pension: 1.42 }
    let includedAssets = 0
    if (requiredReturnToggles.realEstate) includedAssets += assets.realEstate
    if (requiredReturnToggles.financial) includedAssets += assets.financial
    if (requiredReturnToggles.pension) includedAssets += assets.pension

    // 추가 저축으로 시작 자산 증가 가정 (월 100만원 * 12개월 * 15년 = 1.8억)
    const additionalSavings = 1.8
    const increasedAssets = includedAssets + additionalSavings

    const baseReturn = includedAssets > 0
      ? Math.round((Math.pow(targetRetirementAsset / includedAssets, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    const increasedReturn = increasedAssets > 0
      ? Math.round((Math.pow(targetRetirementAsset / increasedAssets, 1 / yearsToRetirement) - 1) * 1000) / 10
      : 0

    const returnDiff = Math.round((baseReturn - increasedReturn) * 10) / 10

    return (
      <div className="left-slide">
        <div className="slide-option-preview">
          <div className="asset-header">
            <h1 className="asset-title">저축/투자 전략</h1>
            <div className="asset-divider"></div>
          </div>

          <div className="preview-message">
            이 선택을 하면 이렇게 달라집니다.
          </div>

          <div className="preview-content">
            <div className="preview-highlight">
              <div className="highlight-label">필요 수익률 감소</div>
              <div className="highlight-value">-{returnDiff}%p</div>
              <div className="highlight-detail">
                {baseReturn}% → {increasedReturn}%
              </div>
            </div>

            <div className="preview-toggle">
              <span className="toggle-label">월 100만원 추가 저축</span>
              <button
                className={`preview-toggle-btn ${investStrategyToggle ? 'active' : ''}`}
                onClick={() => setInvestStrategyToggle(!investStrategyToggle)}
              >
                <span className="toggle-knob" />
              </button>
              <span className="toggle-status">
                {investStrategyToggle ? `+${additionalSavings}억` : '현재'}
              </span>
            </div>

            <div className="preview-comparison">
              <div className="comparison-item">
                <span className="comparison-label">현재</span>
                <div className="comparison-bar-wrap">
                  <div
                    className="comparison-bar base"
                    style={{ width: `${Math.min(baseReturn / 15 * 100, 100)}%` }}
                  />
                  <span className="comparison-value">{baseReturn}%</span>
                </div>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">적용 시</span>
                <div className="comparison-bar-wrap">
                  <div
                    className={`comparison-bar ${investStrategyToggle ? 'active' : 'preview'}`}
                    style={{ width: `${Math.min(increasedReturn / 15 * 100, 100)}%` }}
                  />
                  <span className="comparison-value">{increasedReturn}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-footer">
            월 100만원씩 추가 저축하면 시작 자산이 늘어 필요 수익률이 낮아집니다.
          </div>
        </div>
      </div>
    )
  }

  // 슬라이드 9: 은퇴준비 종합점수
  const renderSlideRetirementScore = () => {
    // 각 항목별 점수 (100점 만점)
    const scoreItems = [
      { category: '현금흐름 준비', score: 68, weight: 0.4, description: '월 수령액 vs 적정생활비' },
      { category: '연금 구성', score: 72, weight: 0.2, description: '3층 연금 체계' },
      { category: '자산 준비율', score: 45, weight: 0.25, description: '목표 대비 현재 자산' },
      { category: '부채 건전성', score: 78, weight: 0.15, description: 'DSR 및 부채비율' },
    ]

    const totalScore = Math.round(
      scoreItems.reduce((sum, item) => sum + item.score * item.weight, 0)
    )

    // 종합 등급
    const getGrade = (score: number) => {
      if (score >= 80) return { grade: 'A', color: '#10b981', label: '우수' }
      if (score >= 60) return { grade: 'B', color: '#3b82f6', label: '양호' }
      if (score >= 40) return { grade: 'C', color: '#f59e0b', label: '보완필요' }
      return { grade: 'D', color: '#ef4444', label: '위험' }
    }

    const gradeInfo = getGrade(totalScore)

    return (
      <div className="left-slide">
        <div className="slide-retirement-score">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">은퇴준비 종합점수</h1>
            <p className="asset-subtitle">4개 핵심 지표 종합 평가</p>
            <div className="asset-divider"></div>
          </div>

          {/* 종합 점수 */}
          <div className="score-hero">
            <div className="score-circle" style={{ borderColor: gradeInfo.color }}>
              <span className="score-grade" style={{ color: gradeInfo.color }}>{gradeInfo.grade}</span>
              <span className="score-number">{totalScore}</span>
              <span className="score-max">/100</span>
            </div>
            <div className="score-label" style={{ color: gradeInfo.color }}>{gradeInfo.label}</div>
          </div>

          {/* 항목별 점수 */}
          <div className="score-breakdown">
            {scoreItems.map((item, idx) => {
              const itemGrade = getGrade(item.score)
              return (
                <div key={idx} className="score-breakdown-item">
                  <div className="score-breakdown-header">
                    <span className="score-breakdown-category">{item.category}</span>
                    <span className="score-breakdown-score" style={{ color: itemGrade.color }}>
                      {item.score}점
                    </span>
                  </div>
                  <div className="score-breakdown-bar">
                    <div
                      className="score-breakdown-fill"
                      style={{
                        width: `${item.score}%`,
                        backgroundColor: itemGrade.color,
                      }}
                    ></div>
                  </div>
                  <div className="score-breakdown-desc">{item.description}</div>
                </div>
              )
            })}
          </div>

          {/* 요약 메시지 */}
          <div className="score-summary">
            자산 준비율 개선이 가장 시급합니다
          </div>
        </div>
      </div>
    )
  }

  // ========================================
  // 기존 슬라이드 (참고용, 사용하지 않음)
  // ========================================

  // Render Left Slide 5: Monthly Income Overview (Diagnosis Focus)
  const renderLeftSlide5 = () => {
    const targetMonthly = 400 // 목표 월 생활비
    const expectedMonthly = 189 // 은퇴 초기 예상 수령액 (50-60세)
    const achievementRate = Math.round((expectedMonthly / targetMonthly) * 100)
    const deficit = targetMonthly - expectedMonthly

    // 진단 상태 결정
    const getDiagnosisStatus = () => {
      if (achievementRate >= 100) return { status: 'success', label: '목표 달성 가능', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' }
      if (achievementRate >= 70) return { status: 'warning', label: '보완 필요', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' }
      return { status: 'danger', label: '준비 부족', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' }
    }

    const diagnosis = getDiagnosisStatus()

    // 구간 데이터 (만원 기준)
    const ranges = [
      { min: 0, max: 150, label: '최소 생활', color: '#ef4444' },
      { min: 150, max: 250, label: '기본 생활', color: '#f59e0b' },
      { min: 250, max: 350, label: '적정 생활', color: '#3b82f6' },
      { min: 350, max: 500, label: '여유 생활', color: '#10b981' },
    ]

    // 현재 수령액이 어느 구간인지
    const currentRange = ranges.find(r => expectedMonthly >= r.min && expectedMonthly < r.max) || ranges[0]
    const targetRange = ranges.find(r => targetMonthly >= r.min && targetMonthly < r.max) || ranges[ranges.length - 1]

    return (
      <div className="left-slide">
        <div className="slide-asset slide-income-diagnosis">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">은퇴 후 월수령액 진단</h1>
            <div className="asset-divider"></div>
          </div>

          {/* Hero: 예상 월수령액 */}
          <div className="income-hero">
            <div className="income-hero-label">은퇴 초기 예상 월수령액</div>
            <div className="income-hero-value">
              <span className="income-hero-number" style={{ color: currentRange.color }}>{expectedMonthly}</span>
              <span className="income-hero-unit">만원</span>
            </div>
            <div className="income-hero-sublabel">50~60세 기준</div>
          </div>

          {/* 구간 인디케이터 */}
          <div className="income-range-section">
            <div className="income-range-header">
              <span className="income-range-title">월수령액 구간</span>
              <span className="income-range-current" style={{ color: currentRange.color }}>
                현재: {currentRange.label}
              </span>
            </div>
            <div className="income-range-bar">
              {ranges.map((range, idx) => {
                const width = ((range.max - range.min) / 500) * 100
                const isCurrentRange = range === currentRange
                const isTargetRange = range === targetRange
                return (
                  <div
                    key={idx}
                    className={`income-range-segment ${isCurrentRange ? 'active' : ''}`}
                    style={{
                      width: `${width}%`,
                      backgroundColor: isCurrentRange ? range.color : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    {isTargetRange && (
                      <div className="income-target-marker" style={{ left: `${((targetMonthly - range.min) / (range.max - range.min)) * 100}%` }}>
                        <div className="income-target-line"></div>
                        <div className="income-target-label">목표</div>
                      </div>
                    )}
                    {isCurrentRange && (
                      <div className="income-current-marker" style={{ left: `${((expectedMonthly - range.min) / (range.max - range.min)) * 100}%` }}>
                        <div className="income-current-dot"></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="income-range-labels">
              {ranges.map((range, idx) => (
                <div key={idx} className="income-range-label-item" style={{ width: `${((range.max - range.min) / 500) * 100}%` }}>
                  <span style={{ color: range.color, opacity: range === currentRange ? 1 : 0.5 }}>{range.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 진단 결과 카드 */}
          <div className="income-diagnosis-card" style={{ borderColor: diagnosis.color, backgroundColor: diagnosis.bgColor }}>
            <div className="income-diagnosis-header">
              <div className="income-diagnosis-badge" style={{ backgroundColor: diagnosis.color }}>
                {diagnosis.status === 'success' ? '✓' : diagnosis.status === 'warning' ? '!' : '✕'}
              </div>
              <div className="income-diagnosis-status" style={{ color: diagnosis.color }}>{diagnosis.label}</div>
            </div>
            <div className="income-diagnosis-detail">
              <div className="income-diagnosis-row">
                <span className="income-diagnosis-label">목표 월 생활비</span>
                <span className="income-diagnosis-value">{targetMonthly}만원</span>
              </div>
              <div className="income-diagnosis-row">
                <span className="income-diagnosis-label">예상 수령액</span>
                <span className="income-diagnosis-value" style={{ color: currentRange.color }}>{expectedMonthly}만원</span>
              </div>
              <div className="income-diagnosis-divider"></div>
              <div className="income-diagnosis-row income-diagnosis-row-highlight">
                <span className="income-diagnosis-label">월 부족액</span>
                <span className="income-diagnosis-value income-diagnosis-deficit">-{deficit}만원</span>
              </div>
            </div>
            <div className="income-diagnosis-progress">
              <div className="income-diagnosis-progress-bar">
                <div
                  className="income-diagnosis-progress-fill"
                  style={{
                    width: `${Math.min(achievementRate, 100)}%`,
                    backgroundColor: diagnosis.color
                  }}
                ></div>
              </div>
              <div className="income-diagnosis-progress-label">
                목표 달성률 <strong style={{ color: diagnosis.color }}>{achievementRate}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Left Slide 6: Monthly Income Breakdown
  const renderLeftSlide6 = () => {
    const totalMonthly = 189 // 슬라이드 5의 예상 월수령액

    // 수령액 구성 항목
    const incomeBreakdown = [
      { label: '투자자산 인출', amount: 120, color: '#3b82f6', note: '' },
      { label: '국민연금', amount: 0, color: '#10b981', note: '60세부터 수령' },
      { label: '퇴직연금', amount: 45, color: '#8b5cf6', note: '' },
      { label: '개인연금', amount: 24, color: '#f59e0b', note: '' },
    ]

    // 실제 수령 중인 항목들만 (금액 > 0)
    const activeIncome = incomeBreakdown.filter(item => item.amount > 0)
    const pendingIncome = incomeBreakdown.filter(item => item.amount === 0)

    return (
      <div className="left-slide">
        <div className="slide-asset slide-income-breakdown">
          {/* Header */}
          <div className="asset-header">
            <h1 className="asset-title">월 수령액 구성</h1>
            <div className="asset-divider"></div>
          </div>

          {/* Total Summary */}
          <div className="breakdown-total">
            <span className="breakdown-total-label">50~60세 월 수령액</span>
            <div className="breakdown-total-value">
              <span className="breakdown-total-number">{totalMonthly}</span>
              <span className="breakdown-total-unit">만원</span>
            </div>
          </div>

          {/* Stacked Bar */}
          <div className="breakdown-bar-section">
            <div className="breakdown-bar">
              {activeIncome.map((item, idx) => {
                const percentage = (item.amount / totalMonthly) * 100
                return (
                  <div
                    key={idx}
                    className="breakdown-bar-segment"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    }}
                  >
                    {percentage >= 15 && (
                      <span className="breakdown-bar-percent">{Math.round(percentage)}%</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Breakdown List */}
          <div className="breakdown-list">
            {activeIncome.map((item, idx) => {
              const percentage = Math.round((item.amount / totalMonthly) * 100)
              return (
                <div key={idx} className="breakdown-item">
                  <div className="breakdown-item-left">
                    <div className="breakdown-item-color" style={{ backgroundColor: item.color }}></div>
                    <span className="breakdown-item-label">{item.label}</span>
                  </div>
                  <div className="breakdown-item-right">
                    <span className="breakdown-item-amount">{item.amount}만원</span>
                    <span className="breakdown-item-percent" style={{ color: item.color }}>{percentage}%</span>
                  </div>
                </div>
              )
            })}

            {/* Pending Income (수령 예정) */}
            {pendingIncome.length > 0 && (
              <>
                <div className="breakdown-pending-divider">
                  <span>수령 예정</span>
                </div>
                {pendingIncome.map((item, idx) => (
                  <div key={idx} className="breakdown-item breakdown-item-pending">
                    <div className="breakdown-item-left">
                      <div className="breakdown-item-color" style={{ backgroundColor: item.color, opacity: 0.4 }}></div>
                      <span className="breakdown-item-label">{item.label}</span>
                    </div>
                    <div className="breakdown-item-right">
                      <span className="breakdown-item-note">{item.note}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Info Note */}
          <div className="breakdown-note">
            <span className="breakdown-note-text">국민연금 수령 시작 후 월 수령액이 증가합니다</span>
          </div>
        </div>
      </div>
    )
  }

  // Render Left Slide 7: Next Steps
  const renderLeftSlide7 = () => (
    <div className="left-slide">
      <div className="slide-next-steps">
        <div className="next-steps-content">
          <h2 className="next-steps-title">지금 바로 시작하세요</h2>
          <p className="next-steps-subtitle">오늘 본 내용을 바탕으로<br/>더 구체적인 계획을 세워보세요</p>
          <div className="next-steps-buttons">
            <button className="next-steps-btn secondary" onClick={handleContinueToScenarios}>
              맞춤 시나리오 더 보기
            </button>
            <button className="next-steps-btn primary">
              자산관리 상담 신청
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ========================================
  // 개발 모드 슬라이드 배열
  // 여기에 새 슬라이드를 추가/수정/삭제하세요
  // 슬라이드 개수는 자동으로 계산됩니다 (미사용 슬라이드 제외)
  // ========================================
  const devSlides = [
    // 데이터 설정 (0번 슬라이드 앞)
    { id: 'slide-setup', title: '데이터 설정', render: () => renderSlideDataSetup() },
    // 0: 커버
    { id: 'slide-0', title: '커버', render: () => renderLeftSlide1() },
    // ===== 은퇴 본질 슬라이드 (A1~A5) =====
    { id: 'slide-A1', title: '은퇴의 본질은 무엇일까요?', render: () => renderSlideRetirementEssence() },
    { id: 'slide-A2', title: '자산이 많아도 실패하는 이유', render: () => renderSlideWhyAssetsFail() },
    { id: 'slide-A3', title: '은퇴는 한 번에 쓰는 돈이 아닙니다', render: () => renderSlideNotLumpSum() },
    { id: 'slide-A4', title: '은퇴 준비의 첫 질문', render: () => renderSlideFirstQuestion() },
    { id: 'slide-A5', title: '오늘 우리는 이걸 먼저 확인합니다', render: () => renderSlideTodayAgenda() },
    { id: 'slide-A4-1', title: '3층 연금 구조', render: () => renderSlidePensionCoreConcept() },
    // ===== Part 1: 현금흐름 분석 시작 =====
    // 3: 은퇴 후 월 수입 (Part 1 시작)
    { id: 'slide-3', title: `${globalData.customerName}님의 은퇴 후 예상 월 수령액`, render: () => renderSlideMonthlyIncome() },
    // 4: 지금 생활과 비교
    { id: 'slide-4', title: '현재 생활비와 비교해보면?', render: () => renderSlideLivingComparison() },
    // 5: 평생 기준 (슬라이드 8 기반으로 기대수명까지 확장)
    { id: 'slide-7', title: '평생 기준으로 보면', render: () => renderSlideLifetimePerspective() },
    // 6: 현금흐름 진단 요약 (Part 1 마무리)
    { id: 'slide-8', title: '현금흐름 진단 요약', render: () => renderSlideCashflowDiagnosis() },
    // 7: Part 2 전환
    { id: 'slide-9', title: '그렇다면 자산은 어떨까요?', render: () => renderSlidePart2Transition() },
    // Part 2: 자산 분석
    { id: 'slide-11', title: '은퇴할 때, 자산은 얼마일까요?', render: () => renderSlideRetirementAsset() },
    { id: 'slide-14', title: '이 목표를 달성하려면', render: () => renderSlideRequiredReturn() },
    { id: 'slide-14-1', title: '목표를 달성해도 충분할까요?', render: () => renderSlideWithdrawalSimulation() },
    { id: 'slide-14-2', title: '안전한 인출률을 위해서는', render: () => renderSlideRequiredGrowthForSafeWithdrawal() },
    { id: 'slide-15', title: '현실적인 수준일까요?', render: () => renderSlideRealisticCheck() },
    { id: 'slide-15-1', title: '자산 진단 요약', render: () => renderSlideAssetDiagnosis() },
    { id: 'slide-15-2', title: '자산은 준비되어 있습니다', render: () => renderSlidePart3Transition() },
    { id: 'slide-20', title: '투자 재원, 더 늘릴 수 있습니다', render: () => renderLeftSlideMonthlyCashflow() },
    { id: 'slide-12', title: '자산은 이렇게 변합니다', render: () => renderSlideAssetFlow() },
    { id: 'slide-13', title: '은퇴 이후는 이렇게 됩니다', render: () => renderSlideAfterRetirement() },
    // 16: 총자산 관점 설명
    { id: 'slide-16', title: '이 수익률, 어떻게 달성할까요?', render: () => renderSlideTotalAssetPerspective() },
    // 17: 전환 슬라이드
    { id: 'slide-17', title: '왜 이렇게 어려울까요?', render: () => renderLeftSlideTransition() },
    // Part 3: 현재 재무현황 분석 (축소: 4장)
    { id: 'slide-18', title: '자산은 잘 모으셨습니다. 하지만...', render: () => renderLeftSlideNetWorth() },
    { id: 'slide-19', title: '구조가 문제입니다', render: () => renderLeftSlideAssetOverview() },
    { id: 'slide-21', title: '이걸 매년 하실 수 있으시겠습니까?', render: () => renderSlideAnnualManagement() },
    // Part 4: 전문가 필요성 (3장)
    { id: 'slide-22', title: '연금만 해도 복잡합니다', render: () => renderSlidePensionStructure() },
    { id: 'slide-23', title: '매년 이런 결정을 해야 합니다', render: () => renderSlideDecisionPoints() },
    { id: 'slide-24', title: '귀찮고 어려운 건 저희가', render: () => renderSlideServiceIntro() },
    // 25: CTA
    { id: 'slide-25', title: '지금 바로 시작하세요', render: () => renderLeftSlide7() },
    // ===== 미사용 슬라이드 (맨뒤로 이동) =====
    { id: 'slide-unused-1', title: '[미사용] 부채 현황', render: () => renderLeftSlideDebtOverview() },
    { id: 'slide-unused-2', title: '[미사용] 금리 충격 테스트', render: () => renderLeftSlideRateShockTest() },
    { id: 'slide-unused-3', title: '[미사용] 저축률 분석', render: () => renderLeftSlideExpenseStructure() },
  ]

  // 사용 가능한 슬라이드 개수 (미사용 슬라이드 제외, 자동 계산)
  const activeDevSlides = devSlides.filter(slide => !slide.id.includes('unused'))
  const devTotalSlides = isDevMode ? activeDevSlides.length : 0

  // Left Content Router
  const renderLeftContent = (slideIndex: number) => {
    // 개발 모드: devSlides 배열 사용
    if (isDevMode) {
      return devSlides[slideIndex]?.render() || null
    }

    // 프로덕션 모드: 기존 라우터
    switch (slideIndex) {
      case 0: return renderLeftSlide1()
      // Part 1: 은퇴 준비 진단 (현금흐름 → 자산)
      case 1: return renderSlideRetirementCashflow()      // [신규] 은퇴 직후 예상 현금흐름
      case 2: return renderSlidePensionBreakdown()        // [신규] 3층 연금 구성
      case 3: return renderSlideAdequateLiving()          // [신규] 노후 적정생활비 비교
      case 4: return renderSlideMonthlyShortfall()        // [신규] 월 부족금액
      case 5: return renderSlideInflationImpact()         // [신규] 물가상승률 반영
      case 6: return renderLeftSlide4()                   // 기대수명까지 필요자금 (기존 현금흐름 준비도 활용)
      case 7: return renderLeftSlide2()                   // 순자산 관점 분석 (기존 자산 준비율 활용)
      case 8: return renderLeftSlide3()                   // 순자산 고갈 시점 (기존 자산 성장 시뮬레이션 활용)
      case 9: return renderSlideRetirementScore()         // [신규] 은퇴준비 종합점수
      // 전환 슬라이드
      case 10: return renderLeftSlideTransition()
      // Part 2: 현재 재무현황 분석
      case 11: return renderLeftSlideNetWorth()
      case 12: return renderLeftSlideAssetOverview()
      case 13: return renderLeftSlideDebtOverview()
      case 14: return renderLeftSlideRateShockTest()
      case 15: return renderLeftSlideMonthlyCashflow()
      case 16: return renderLeftSlideExpenseStructure()
      case 17: return renderLeftSlide7()
      default: return null
    }
  }

  // Render Chat Insights (Right Section) - Chat-style interface
  const renderChatInsights = (slideIndex: number) => {
    // 개발 모드: 빈 인사이트 영역
    if (isDevMode) {
      return (
        <div className="chat-insights">
          <div className="chat-gradient-line"></div>
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="chat-avatar">
                <span className="chat-avatar-text">DEV</span>
              </div>
              <div className="chat-header-info">
                <h3 className="chat-name">개발 모드</h3>
                <p className="chat-status">{slideIndex === 0 ? '데이터 설정' : `슬라이드 ${slideIndex} / ${devTotalSlides - 1}`}</p>
              </div>
            </div>
          </div>
          <div className="chat-messages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
            인사이트는 슬라이드 완성 후 작업 예정
          </div>
        </div>
      )
    }

    const insightsData = slideInsightsData[slideIndex] || slideInsightsData[0]
    const currentProgress = messageProgress[slideIndex] || 0
    const currentChatHistory = chatHistory[slideIndex] || []

    // Build message array from chat history
    const allMessages: Array<{type: 'expert' | 'user' | 'confirmation', data: any, index: number, timestamp: number}> =
      currentChatHistory.map((msg, idx) => {
        if (msg.type === 'expert') {
          return {
            type: 'expert' as const,
            data: insightsData.slides[msg.expertIndex],
            index: msg.expertIndex,
            timestamp: msg.timestamp
          }
        } else if (msg.type === 'confirmation') {
          return {
            type: 'confirmation' as const,
            data: msg.text,
            index: idx,
            timestamp: msg.timestamp
          }
        } else {
          return {
            type: 'user' as const,
            data: msg.text,
            index: idx,
            timestamp: msg.timestamp
          }
        }
      })

    return (
      <div className="chat-insights">
        {/* Gradient Top Line */}
        <div className="chat-gradient-line"></div>

        {/* Header - Messenger Style */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-avatar">
              <span className="chat-avatar-text">손</span>
              <span className="chat-online-indicator"></span>
            </div>
            <div className="chat-header-info">
              <h3 className="chat-name">손균우 자산관리사</h3>
              <p className="chat-status">
                {typingMessageIndex !== null ? (
                  <span className="chat-status-typing">입력 중...</span>
                ) : (
                  <span className="chat-status-online">온라인</span>
                )}
              </p>
            </div>
          </div>
          <div className="chat-message-counter">
            <span className="chat-message-counter-current">{currentProgress}</span>
            <span className="chat-message-counter-separator">/</span>
            <span className="chat-message-counter-total">{insightsData.slides.length}</span>
          </div>
        </div>

        {/* Chat Message List */}
        <div className="chat-message-list" ref={chatScrollRef} role="log" aria-live="polite" aria-atomic="false">
          {allMessages.map((item) =>
            item.type === 'expert' ? (
              <div
                key={`expert-${item.timestamp}`}
                className="chat-message chat-message-expert"
                role="article"
                aria-label={`Insight ${item.index + 1}: ${item.data.title}`}
              >
                {/* Expert Avatar and Name */}
                <div className="chat-message-header">
                  <div className="chat-message-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                    </svg>
                  </div>
                  <span className="chat-message-name">손균우</span>
                </div>

                <div className={`chat-message-badge chat-message-badge-${item.data.badge.type}`}>
                  {item.data.badge.text}
                </div>
                <h4 className="chat-message-title">{item.data.title}</h4>
                <p className={`chat-message-text ${item.index === currentProgress - 1 && typingMessageIndex === item.index ? 'chat-message-text-typing' : ''}`}>
                  {item.data.description}
                </p>

                {/* Alert (optional) */}
                {item.data.alert && (
                  <div className={`chat-message-alert chat-message-alert-${item.data.alert.type}`}>
                    <p className="chat-message-alert-label">{item.data.alert.label}</p>
                    <p className="chat-message-alert-value">
                      {item.data.alert.value} {item.data.alert.unit && <span className="chat-message-alert-unit">{item.data.alert.unit}</span>}
                    </p>
                    {item.data.alert.subtext && (
                      <p className="chat-message-alert-subtext">{item.data.alert.subtext}</p>
                    )}
                  </div>
                )}

                {/* Actions (optional) */}
                {item.data.actions && (
                  <div className="chat-message-actions">
                    {item.data.actions.map((action: any, actionIdx: number) => (
                      <div key={actionIdx} className="chat-action-item">
                        {action.icon === 'down' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`chat-action-icon chat-action-icon-${action.color}`}>
                            <path d="M7 10l5 5 5-5z" fill="currentColor"/>
                          </svg>
                        )}
                        {action.icon === 'up' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`chat-action-icon chat-action-icon-${action.color}`}>
                            <path d="M7 14l5-5 5 5z" fill="currentColor"/>
                          </svg>
                        )}
                        {action.icon === 'trend' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`chat-action-icon chat-action-icon-${action.color}`}>
                            <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" fill="currentColor"/>
                          </svg>
                        )}
                        <span>{action.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : item.type === 'confirmation' ? (
              <div
                key={`confirmation-${item.timestamp}`}
                className="chat-message chat-message-expert chat-message-confirmation"
              >
                {/* Expert Avatar and Name */}
                <div className="chat-message-header">
                  <div className="chat-message-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                    </svg>
                  </div>
                  <span className="chat-message-name">손균우</span>
                </div>
                <p className="chat-message-text">{item.data}</p>
              </div>
            ) : (
              <div
                key={`user-${item.timestamp}`}
                className="chat-message chat-message-user"
              >
                <p className="chat-message-text">{item.data}</p>
              </div>
            )
          )}

          {/* Typing Indicator */}
          {typingMessageIndex !== null && (
            <div className="typing-indicator">
              <div className="typing-indicator-dots">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="chat-controls">
          {/* Previous slide button - only show from slide 2 */}
          {currentSlide > 0 && (
            <button
              className="chat-prev-slide-btn"
              onClick={prevSlide}
              aria-label="이전 슬라이드"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Show "다음 인사이트" or "다음 페이지" based on progress */}
          {currentProgress < insightsData.slides.length ? (
            <button
              className="chat-next-btn"
              onClick={handleNextMessage}
              disabled={typingMessageIndex !== null}
              aria-label="다음 인사이트"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>다음 인사이트</span>
            </button>
          ) : currentSlide < totalSlides - 1 ? (
            <button
              className="chat-next-slide-btn"
              onClick={nextSlide}
              aria-label="다음 페이지"
            >
              <span>다음 페이지</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : (
            <button
              className="chat-next-slide-btn chat-finish-btn"
              onClick={handleContinueToScenarios}
              aria-label="시나리오 보기"
            >
              <span>맞춤 시나리오 보러가기</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  // Render Memo Section (Right Section)
  // Render Chat Input (replaces memo section)
  const renderChatInput = () => {
    return (
      <div className="chat-input-section">
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input-field"
            placeholder="메시지를 입력하세요..."
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button
            className="chat-send-btn"
            onClick={handleSendMessage}
            disabled={currentInput.trim() === ''}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="professional-diagnosis">
      <div className="diagnosis-container">
        {/* Split Layout */}
        <div className="split-layout">
          {/* Left Section: Slide Content (Animated) */}
          <div className="left-section">
            {/* Background Decorations */}
            <div className="circle-accent circle-1"></div>
            <div className="circle-accent circle-2"></div>

            {/* Left Content Wrapper */}
            <div className={`left-content-wrapper ${currentSlide === 0 && isDevMode ? 'scrollable' : ''}`}>
              {renderLeftContent(currentSlide)}
            </div>
          </div>

          {/* Right Section: Fixed Diagnosis Area */}
          <div className="right-section">
            {/* Chat Insights */}
            <div className="chat-insights-container">
              {renderChatInsights(currentSlide)}
            </div>

            {/* Chat Input */}
            <div className="chat-input-wrapper">
              {renderChatInput()}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default ProfessionalDiagnosis
