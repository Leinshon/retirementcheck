// Professional Scenario 페이지용 타입 정의 및 데모 데이터

// ============ 타입 정의 ============

export type ScenarioType = 'aggressive' | 'balanced'
export type ActionStatus = 'completed' | 'in_progress' | 'upcoming'
export type Priority = 'high' | 'medium' | 'low'
export type ActionCategory = 'saving' | 'investment' | 'tax' | 'insurance' | 'debt'

export interface KeyMetrics {
  projectedAsset: number           // 예상 은퇴자산 (만원)
  monthlyRetirementIncome: number  // 은퇴 후 월 수령액 (만원)
  achievementRate: number          // 목표 달성률 (%)
  requiredMonthlySaving: number    // 필요 월 저축액 (만원)
  expectedReturnRate: number       // 예상 연 수익률 (%)
}

export interface ActionItem {
  id: string
  title: string
  description: string
  priority: Priority
  category: ActionCategory
  impact: string                   // "연 148만원 세액공제"
}

export interface PortfolioItem {
  name: string
  ticker: string
  ratio: number                    // 비율 (%)
  color: string
}

export interface Scenario {
  id: string
  type: ScenarioType
  name: string                     // "공격적 성장형"
  subtitle: string
  keyMetrics: KeyMetrics
  highlights: string[]             // 핵심 포인트 3개
  actionItems: ActionItem[]
  portfolioAllocation: PortfolioItem[]
  riskLevel: 1 | 2 | 3 | 4 | 5
}

export interface TimelineAction {
  id: string
  month: 1 | 2 | 3
  week?: 1 | 2 | 3 | 4
  title: string
  description: string
  status: ActionStatus
  category: ActionCategory
  estimatedTime: string            // "30분", "1시간"
  impact?: string
}

export interface MonthBlock {
  month: 1 | 2 | 3
  theme: string                    // "기초 세팅", "투자 시작", "최적화"
  actions: TimelineAction[]
}

export interface InvestmentGuide {
  portfolioSummary: string
  stepByStepGuide: string[]
  cautionNotes: string[]
}

export interface ThreeMonthRoadmap {
  scenarioId: string
  months: MonthBlock[]
  investmentGuide: InvestmentGuide
}

export interface UserCurrentState {
  name: string
  age: number
  targetRetirementAge: number
  currentAsset: number             // 현재 금융자산 (만원)
  monthlySaving: number            // 현재 월 저축액 (만원)
  monthlyExpense: number           // 월 지출 (만원)
  targetRetirementAsset: number    // 목표 은퇴자산 (만원)
  currentProjectedAsset: number    // 현재 추세 유지 시 예상 자산
  currentAchievementRate: number   // 현재 추세 목표 달성률
}

// ============ 데모 데이터 ============

export const demoUserState: UserCurrentState = {
  name: '김철수',
  age: 35,
  targetRetirementAge: 55,
  currentAsset: 8000,              // 8000만원
  monthlySaving: 150,              // 150만원
  monthlyExpense: 250,             // 250만원
  targetRetirementAsset: 50000,    // 5억원
  currentProjectedAsset: 28000,    // 현재 추세: 2.8억
  currentAchievementRate: 56,      // 56%
}

export const demoScenarios: Scenario[] = [
  {
    id: 'scenario-a',
    type: 'aggressive',
    name: '공격적 성장형',
    subtitle: '적극적인 투자로 목표 초과 달성',
    keyMetrics: {
      projectedAsset: 42000,       // 4.2억
      monthlyRetirementIncome: 350,
      achievementRate: 84,
      requiredMonthlySaving: 200,
      expectedReturnRate: 8.5,
    },
    highlights: [
      '월 저축을 200만원으로 증액',
      '공격적 ETF 포트폴리오 (SPY 45%, QQQ 35%)',
      '연금저축+IRP 세액공제 한도 100% 활용',
    ],
    actionItems: [
      {
        id: 'a1',
        title: '연금저축계좌 개설 및 납입',
        description: '세액공제 혜택을 위한 연금저축 계좌 개설 후 연 600만원 납입',
        priority: 'high',
        category: 'tax',
        impact: '연 99만원 세액공제',
      },
      {
        id: 'a2',
        title: 'IRP 계좌 개설 및 납입',
        description: '추가 세액공제를 위한 IRP 계좌 개설 후 연 300만원 납입',
        priority: 'high',
        category: 'tax',
        impact: '연 49.5만원 추가 세액공제',
      },
      {
        id: 'a3',
        title: '해외 ETF 투자 시작',
        description: 'SPY, QQQ 중심의 공격적 포트폴리오 구성',
        priority: 'medium',
        category: 'investment',
        impact: '연 8.5% 기대 수익률',
      },
    ],
    portfolioAllocation: [
      { name: 'S&P500', ticker: 'SPY', ratio: 45, color: '#4361ee' },
      { name: 'NASDAQ100', ticker: 'QQQ', ratio: 35, color: '#7c3aed' },
      { name: '금', ticker: 'GLD', ratio: 10, color: '#f59e0b' },
      { name: '미국 중기채', ticker: 'IEF', ratio: 10, color: '#06b6d4' },
    ],
    riskLevel: 4,
  },
  {
    id: 'scenario-b',
    type: 'balanced',
    name: '안정적 균형형',
    subtitle: '현실적인 목표와 안정적인 성장',
    keyMetrics: {
      projectedAsset: 35000,       // 3.5억
      monthlyRetirementIncome: 290,
      achievementRate: 70,
      requiredMonthlySaving: 150,
      expectedReturnRate: 6.5,
    },
    highlights: [
      '현재 월 저축액 유지 (150만원)',
      '균형잡힌 자산배분 (주식 60%, 채권 30%)',
      '세액공제 계좌 우선 활용으로 절세',
    ],
    actionItems: [
      {
        id: 'b1',
        title: '연금저축계좌 개설 및 납입',
        description: '세액공제 혜택을 위한 연금저축 계좌 개설',
        priority: 'high',
        category: 'tax',
        impact: '연 99만원 세액공제',
      },
      {
        id: 'b2',
        title: '균형형 ETF 포트폴리오 구성',
        description: '국내외 주식과 채권을 혼합한 안정적 포트폴리오',
        priority: 'medium',
        category: 'investment',
        impact: '연 6.5% 기대 수익률',
      },
      {
        id: 'b3',
        title: '비상금 확보',
        description: '6개월치 생활비를 파킹통장에 예치',
        priority: 'medium',
        category: 'saving',
        impact: '재정 안정성 확보',
      },
    ],
    portfolioAllocation: [
      { name: 'S&P500', ticker: 'SPY', ratio: 40, color: '#4361ee' },
      { name: 'NASDAQ100', ticker: 'QQQ', ratio: 20, color: '#7c3aed' },
      { name: '미국 채권', ticker: 'AGG', ratio: 25, color: '#10b981' },
      { name: '금', ticker: 'GLD', ratio: 10, color: '#f59e0b' },
      { name: '현금성', ticker: 'SGOV', ratio: 5, color: '#94a3b8' },
    ],
    riskLevel: 3,
  },
]

export const demoRoadmaps: Record<string, ThreeMonthRoadmap> = {
  'scenario-a': {
    scenarioId: 'scenario-a',
    months: [
      {
        month: 1,
        theme: '기초 세팅',
        actions: [
          {
            id: 't1-1',
            month: 1,
            week: 1,
            title: '연금저축계좌 개설',
            description: '증권사 앱에서 연금저축계좌를 개설합니다. 미래에셋, 삼성증권, 한국투자증권 등에서 가능합니다.',
            status: 'completed',
            category: 'saving',
            estimatedTime: '30분',
            impact: '연 99만원 세액공제 시작',
          },
          {
            id: 't1-2',
            month: 1,
            week: 2,
            title: 'IRP 계좌 개설',
            description: '추가 세액공제를 위한 IRP 계좌를 개설합니다. 연금저축과 같은 증권사에서 개설하면 관리가 편합니다.',
            status: 'in_progress',
            category: 'saving',
            estimatedTime: '30분',
            impact: '연 49.5만원 추가 세액공제',
          },
          {
            id: 't1-3',
            month: 1,
            week: 3,
            title: '자동이체 설정',
            description: '월급일에 맞춰 연금저축 50만원, IRP 25만원 자동이체를 설정합니다.',
            status: 'upcoming',
            category: 'saving',
            estimatedTime: '15분',
          },
          {
            id: 't1-4',
            month: 1,
            week: 4,
            title: '해외 ETF 거래 신청',
            description: '증권사 앱에서 해외 ETF 거래를 위한 외화증권 거래 신청을 완료합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '10분',
          },
        ],
      },
      {
        month: 2,
        theme: '투자 시작',
        actions: [
          {
            id: 't2-1',
            month: 2,
            week: 1,
            title: '연금저축에서 ETF 매수',
            description: 'SPY 45%, QQQ 35% 비율로 연금저축 계좌에서 매수합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '20분',
            impact: '장기 복리 효과 시작',
          },
          {
            id: 't2-2',
            month: 2,
            week: 2,
            title: 'IRP에서 ETF 매수',
            description: 'GLD 10%, IEF 10% 비율로 IRP 계좌에서 매수합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '20분',
          },
          {
            id: 't2-3',
            month: 2,
            week: 3,
            title: 'ISA 계좌 개설 검토',
            description: '추가 비과세 혜택을 위한 ISA 계좌 개설을 검토합니다.',
            status: 'upcoming',
            category: 'tax',
            estimatedTime: '30분',
            impact: '연 200만원 비과세',
          },
        ],
      },
      {
        month: 3,
        theme: '최적화',
        actions: [
          {
            id: 't3-1',
            month: 3,
            week: 1,
            title: '포트폴리오 점검',
            description: '첫 달 투자 결과를 점검하고 목표 비율과의 차이를 확인합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '30분',
          },
          {
            id: 't3-2',
            month: 3,
            week: 2,
            title: '리밸런싱 실행',
            description: '목표 비율에서 5% 이상 벗어난 자산이 있다면 리밸런싱합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '20분',
            impact: '리스크 관리',
          },
          {
            id: 't3-3',
            month: 3,
            week: 3,
            title: '지출 패턴 분석',
            description: '3개월간의 지출을 분석하고 추가 저축 여력을 확인합니다.',
            status: 'upcoming',
            category: 'saving',
            estimatedTime: '1시간',
          },
          {
            id: 't3-4',
            month: 3,
            week: 4,
            title: '다음 분기 계획 수립',
            description: '3개월 성과를 바탕으로 다음 분기 투자 계획을 세웁니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '30분',
          },
        ],
      },
    ],
    investmentGuide: {
      portfolioSummary: '공격적 성장을 위한 주식 중심 포트폴리오입니다. 장기적으로 연 8.5% 수익률을 목표로 합니다.',
      stepByStepGuide: [
        '증권사 앱에서 해외 ETF 거래 신청 (외화증권 거래 신청 필요)',
        '연금저축 계좌에서 SPY(45%), QQQ(35%) 매수',
        'IRP 계좌에서 GLD(10%), IEF(10%) 매수',
        '매월 초 자동이체 후 적립식으로 추가 매수',
        '분기 1회 포트폴리오 점검 및 리밸런싱',
      ],
      cautionNotes: [
        '투자 원금 손실 가능성이 있습니다. 여유자금으로 투자하세요.',
        '단기 변동성에 흔들리지 말고 장기 투자 관점을 유지하세요.',
        '연금저축/IRP는 55세 이전 해지 시 세금 불이익이 있습니다.',
        '개인의 상황에 따라 적합한 투자 방법이 다를 수 있습니다.',
      ],
    },
  },
  'scenario-b': {
    scenarioId: 'scenario-b',
    months: [
      {
        month: 1,
        theme: '기초 세팅',
        actions: [
          {
            id: 'tb1-1',
            month: 1,
            week: 1,
            title: '비상금 점검',
            description: '6개월치 생활비(1,500만원)가 파킹통장에 있는지 확인합니다.',
            status: 'completed',
            category: 'saving',
            estimatedTime: '15분',
            impact: '재정 안정성 확보',
          },
          {
            id: 'tb1-2',
            month: 1,
            week: 2,
            title: '연금저축계좌 개설',
            description: '세액공제 혜택을 위한 연금저축 계좌를 개설합니다.',
            status: 'in_progress',
            category: 'saving',
            estimatedTime: '30분',
            impact: '연 99만원 세액공제',
          },
          {
            id: 'tb1-3',
            month: 1,
            week: 3,
            title: '자동이체 설정',
            description: '월급일에 맞춰 연금저축 50만원 자동이체를 설정합니다.',
            status: 'upcoming',
            category: 'saving',
            estimatedTime: '15분',
          },
        ],
      },
      {
        month: 2,
        theme: '투자 시작',
        actions: [
          {
            id: 'tb2-1',
            month: 2,
            week: 1,
            title: '연금저축에서 ETF 매수',
            description: 'SPY 40%, QQQ 20%, AGG 25% 비율로 매수합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '30분',
            impact: '균형잡힌 포트폴리오 구성',
          },
          {
            id: 'tb2-2',
            month: 2,
            week: 2,
            title: '정기 적금 재검토',
            description: '기존 적금 만기 확인 및 금리 비교를 통해 최적화합니다.',
            status: 'upcoming',
            category: 'saving',
            estimatedTime: '30분',
          },
          {
            id: 'tb2-3',
            month: 2,
            week: 3,
            title: '보험 점검',
            description: '현재 가입된 보험을 점검하고 불필요한 보험료 지출을 확인합니다.',
            status: 'upcoming',
            category: 'insurance',
            estimatedTime: '1시간',
            impact: '월 지출 절감 가능',
          },
        ],
      },
      {
        month: 3,
        theme: '안정화',
        actions: [
          {
            id: 'tb3-1',
            month: 3,
            week: 1,
            title: '포트폴리오 점검',
            description: '투자 결과를 점검하고 목표 비율과의 차이를 확인합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '30분',
          },
          {
            id: 'tb3-2',
            month: 3,
            week: 2,
            title: '월 지출 분석',
            description: '3개월간의 지출을 분석하고 절약 가능한 항목을 찾습니다.',
            status: 'upcoming',
            category: 'saving',
            estimatedTime: '1시간',
          },
          {
            id: 'tb3-3',
            month: 3,
            week: 4,
            title: '다음 분기 계획',
            description: '안정적인 성장을 위한 다음 분기 계획을 수립합니다.',
            status: 'upcoming',
            category: 'investment',
            estimatedTime: '30분',
          },
        ],
      },
    ],
    investmentGuide: {
      portfolioSummary: '안정적인 성장을 위한 균형형 포트폴리오입니다. 연 6.5% 수익률을 목표로 하며 변동성을 낮췄습니다.',
      stepByStepGuide: [
        '비상금 6개월치 확보 후 투자 시작',
        '연금저축 계좌에서 SPY(40%), QQQ(20%), AGG(25%) 매수',
        '나머지 15%는 GLD와 현금성 자산으로 배분',
        '매월 적립식으로 꾸준히 투자',
        '분기 1회 포트폴리오 점검',
      ],
      cautionNotes: [
        '투자 원금 손실 가능성이 있습니다.',
        '비상금은 항상 유지하고 투자금으로 사용하지 마세요.',
        '급하게 목돈이 필요할 수 있으니 유동성을 확보하세요.',
        '연금저축은 55세 이전 해지 시 세금 불이익이 있습니다.',
      ],
    },
  },
}

// 우선순위 색상 매핑
export const priorityColors: Record<Priority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
}

// 상태 스타일 매핑
export const statusStyles: Record<ActionStatus, { icon: string; color: string; bgColor: string }> = {
  completed: { icon: '[v]', color: '#10b981', bgColor: '#f0fdf4' },
  in_progress: { icon: '[>]', color: '#4361ee', bgColor: '#eef2ff' },
  upcoming: { icon: '[ ]', color: '#94a3b8', bgColor: '#f8fafc' },
}
