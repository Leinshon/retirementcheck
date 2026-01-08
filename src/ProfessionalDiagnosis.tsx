import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  1: {
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
  2: {
    slides: [
      {
        badge: { type: 'info', text: 'ASSET' },
        title: '자산현황 분석',
        description: '좌측 화면에서 현재 자산 구성을 확인하실 수 있습니다.',
      }
    ]
  },
  3: {
    slides: [
      {
        badge: { type: 'info', text: 'DEBT' },
        title: '부채현황 분석',
        description: '좌측 화면에서 현재 부채 현황을 확인하실 수 있습니다.',
      }
    ]
  },
  4: {
    slides: [
      {
        badge: { type: 'info', text: 'CASHFLOW' },
        title: '월별 가용 현금흐름 분석',
        description: '좌측 화면에서 월별 가용 현금흐름을 확인하실 수 있습니다.',
      }
    ]
  },
  5: {
    slides: [
      {
        badge: { type: 'info', text: 'EXPENSE' },
        title: '지출 구조 분석',
        description: '좌측 화면에서 지출 구조를 확인하실 수 있습니다.',
      }
    ]
  },
  6: {
    slides: [
      {
        badge: { type: 'info', text: 'PART 1 COMPLETE' },
        title: '현재 재무현황 분석 완료',
        description: '지금까지 현재 재무상태를 살펴봤습니다. 순자산, 자산구성, 부채, 현금흐름, 지출 구조를 확인하셨습니다.',
      },
      {
        badge: { type: 'info', text: 'NEXT' },
        title: '이제 미래를 진단합니다',
        description: '다음 페이지부터는 이 상태로 은퇴까지 갔을 때 어떤 결과가 나오는지 진단해보겠습니다. 준비되셨으면 다음 페이지로 이동해주세요.',
      }
    ]
  },
  7: {
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
  8: {
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
  9: {
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
  10: {
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
  11: {
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
  12: {
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

// Slide별 메모 플레이스홀더
const memoPlaceholders: Record<number, string> = {
  0: '보고서 전반에 대한 궁금한 점이나 추가 분석 요청 사항을 기록해 주세요',
  1: '순자산 분포 분석에 대해 궁금한 점이나 의견은?',
  2: '자산현황에 대해 궁금한 점은?',
  3: '부채현황에 대해 궁금한 점은?',
  4: '월별 가용 현금흐름에 대해 궁금한 점은?',
  5: '지출 구조에 대해 궁금한 점은?',
  6: '현재 재무현황에 대해 궁금한 점은?',
  7: '목표 은퇴자산 50억원 달성을 위한 추가 전략이나 궁금한 점은?',
  8: '자산 성장 시뮬레이션에 대한 질문이나 의견을 남겨주세요',
  9: '현금흐름 진단에 대한 궁금한 점은?',
  10: '예상 월 수령액에 대해 궁금한 점이나 추가 시뮬레이션 요청은?',
  11: '수령액 구성에 대해 궁금한 점은?',
  12: '다음 단계 실행 전 확인하고 싶은 내용은?'
}

function ProfessionalDiagnosis() {
  const location = useLocation()
  const navigate = useNavigate()
  const { userState, scenarios, roadmaps, baselineProjection } = (location.state || {}) as DiagnosisPageProps

  // State management
  const [currentSlide, setCurrentSlide] = useState(0)
  const [reportDate] = useState(new Date())
  const [carouselIndices, setCarouselIndices] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0
  })

  // Chat-style insights state
  const [messageProgress, setMessageProgress] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0
  })
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Unified chat history - stores all messages (expert + user + confirmation) in order
  type ChatMessage =
    | { type: 'expert'; expertIndex: number; timestamp: number }
    | { type: 'user'; text: string; timestamp: number }
    | { type: 'confirmation'; text: string; timestamp: number }

  const [chatHistory, setChatHistory] = useState<Record<number, ChatMessage[]>>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: []
  })
  const [currentInput, setCurrentInput] = useState<string>('')
  const lastSentMessageRef = useRef<string>('')

  const totalSlides = 13

  // If no data, redirect back to input
  useEffect(() => {
    if (!userState || !scenarios || !roadmaps) {
      navigate('/professional')
    }
  }, [userState, scenarios, roadmaps, navigate])

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

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
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

  // Carousel navigation handlers
  const handleCarouselNext = (slideIndex: number) => {
    const totalSlides = slideInsightsData[slideIndex].slides.length
    setCarouselIndices(prev => ({
      ...prev,
      [slideIndex]: (prev[slideIndex] + 1) % totalSlides
    }))
  }

  const handleCarouselPrev = (slideIndex: number) => {
    const totalSlides = slideInsightsData[slideIndex].slides.length
    setCarouselIndices(prev => ({
      ...prev,
      [slideIndex]: (prev[slideIndex] - 1 + totalSlides) % totalSlides
    }))
  }

  const handleCarouselGoTo = (slideIndex: number, carouselIndex: number) => {
    setCarouselIndices(prev => ({
      ...prev,
      [slideIndex]: carouselIndex
    }))
  }

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

  if (!userState || !scenarios || !roadmaps) {
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
            <span className="cover-info-value">{userState.name}님 ({userState.age}세)</span>
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
          <h1 className="asset-title">은퇴 자산 준비율 진단</h1>
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
          {/* Header */}
          <div className="networth-header">
            <h1 className="networth-title">순자산 분포에서 나의 위치</h1>
            <p className="networth-subtitle">{userAgeGroup} 가구 기준</p>
            <div className="networth-divider"></div>
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

          {/* Result Badge */}
          <div className="networth-result">
            <div className="networth-badge">
              상위 <strong>{100 - userRange.high}~{100 - userRange.low}%</strong> 구간
            </div>
            <p className="networth-detail">
              {userAgeGroup} 가구 중 상위 {100 - userRange.high}~{100 - userRange.low}% 구간에 속합니다.
              {userPercentile >= 50 ? (
                <span className="networth-good"> 동 연령대 중위 이상입니다.</span>
              ) : (
                <span className="networth-moderate"> 동 연령대 중위 미만입니다.</span>
              )}
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

          {/* Source Note */}
          <p className="networth-note">
            * 통계청 2025 가계금융복지조사 기준
          </p>
        </div>
      </div>
    )
  }

  // Render Left Slide: 자산현황 분석 (Part 1)
  const renderLeftSlideAssetStatus = () => (
    <div className="left-slide">
      <div className="slide-asset">
        <div className="asset-header">
          <h1 className="asset-title">자산현황 분석</h1>
          <div className="asset-divider"></div>
        </div>
        {/* TODO: 내용 추가 예정 */}
      </div>
    </div>
  )

  // Render Left Slide: 부채현황 분석 (Part 1)
  const renderLeftSlideDebtStatus = () => (
    <div className="left-slide">
      <div className="slide-asset">
        <div className="asset-header">
          <h1 className="asset-title">부채현황 분석</h1>
          <div className="asset-divider"></div>
        </div>
        {/* TODO: 내용 추가 예정 */}
      </div>
    </div>
  )

  // Render Left Slide: 월별 가용 현금흐름 분석 (Part 1)
  const renderLeftSlideMonthlyCashflow = () => (
    <div className="left-slide">
      <div className="slide-asset">
        <div className="asset-header">
          <h1 className="asset-title">월별 가용 현금흐름 분석</h1>
          <div className="asset-divider"></div>
        </div>
        {/* TODO: 내용 추가 예정 */}
      </div>
    </div>
  )

  // Render Left Slide: 지출 구조 분석 (Part 1)
  const renderLeftSlideExpenseStructure = () => (
    <div className="left-slide">
      <div className="slide-asset">
        <div className="asset-header">
          <h1 className="asset-title">지출 구조 분석</h1>
          <div className="asset-divider"></div>
        </div>
        {/* TODO: 내용 추가 예정 */}
      </div>
    </div>
  )

  // Render Left Slide: Part 1 -> Part 2 전환 슬라이드
  const renderLeftSlideTransition = () => (
    <div className="left-slide">
      <div className="slide-transition">
        <div className="transition-content">
          <p className="transition-label">PART 1 완료</p>
          <h1 className="transition-title">현재 재무현황을 살펴봤습니다</h1>
          <div className="transition-divider"></div>
          <p className="transition-subtitle">
            이제 이 상태로 은퇴까지 갔을 때<br />
            어떤 결과가 나오는지 진단해보겠습니다
          </p>
          <div className="transition-next">
            <span className="transition-next-label">PART 2</span>
            <span className="transition-next-title">은퇴 준비상태 진단</span>
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
            <h1 className="simulation-title">자산 성장 시뮬레이션</h1>
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
          <h1 className="cashflow-title">은퇴 현금흐름 준비도 진단</h1>
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
          <h2 className="next-steps-title">진단 완료</h2>
          <p className="next-steps-subtitle">맞춤 시나리오 분석을 통해<br/>구체적인 실행 계획을 확인하세요</p>
          <button className="next-steps-btn" onClick={handleContinueToScenarios}>
            맞춤 시나리오 보러가기
          </button>
        </div>
      </div>
    </div>
  )

  // Left Content Router
  const renderLeftContent = (slideIndex: number) => {
    switch (slideIndex) {
      case 0: return renderLeftSlide1()
      // Part 1: 현재 재무현황 진단
      case 1: return renderLeftSlideNetWorth()
      case 2: return renderLeftSlideAssetStatus()
      case 3: return renderLeftSlideDebtStatus()
      case 4: return renderLeftSlideMonthlyCashflow()
      case 5: return renderLeftSlideExpenseStructure()
      // 전환 슬라이드
      case 6: return renderLeftSlideTransition()
      // Part 2: 은퇴 준비상태 진단
      case 7: return renderLeftSlide2()
      case 8: return renderLeftSlide3()
      case 9: return renderLeftSlide4()
      case 10: return renderLeftSlide5()
      case 11: return renderLeftSlide6()
      case 12: return renderLeftSlide7()
      default: return null
    }
  }

  // Render Chat Insights (Right Section) - Chat-style interface
  const renderChatInsights = (slideIndex: number) => {
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
          {allMessages.map((item, msgIdx) =>
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
            <div className="left-content-wrapper">
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
