// Shared portfolio definitions and ETF product data
// Used across App.tsx, SimpleApp.tsx, and ProfessionalApp.tsx

export interface ETFProduct {
  name: string
  ticker: string
  avgReturn: number
  volatility: number
  color: string
  description: string
}

export interface PortfolioAllocation extends ETFProduct {
  ratio: number
}

export interface Portfolio {
  name: string
  expectedReturn: { min: number; max: number }
  allocation: PortfolioAllocation[]
  description: string
  risk: string
  historicalReturn: number
  maxDrawdown: number
}

// ETF product definitions (based on historical returns)
export const etfProducts: Record<string, ETFProduct> = {
  spy: {
    name: 'S&P500 ETF',
    ticker: 'SPY/VOO',
    avgReturn: 10.5,
    volatility: 15,
    color: '#4361ee',
    description: '미국 대형주 500개 추종',
  },
  qqq: {
    name: 'NASDAQ100 ETF',
    ticker: 'QQQ',
    avgReturn: 14.5,
    volatility: 22,
    color: '#7c3aed',
    description: '미국 기술주 중심',
  },
  gld: {
    name: '금 현물 ETF',
    ticker: 'GLD/IAU',
    avgReturn: 7.5,
    volatility: 15,
    color: '#f59e0b',
    description: '인플레이션 헤지, 안전자산',
  },
  shy: {
    name: '미국 단기채 ETF',
    ticker: 'SHY/BIL',
    avgReturn: 2.5,
    volatility: 2,
    color: '#10b981',
    description: '1-3년 만기 미국 국채',
  },
  ief: {
    name: '미국 중기채 ETF',
    ticker: 'IEF/GOVT',
    avgReturn: 4.0,
    volatility: 7,
    color: '#06b6d4',
    description: '7-10년 만기 미국 국채',
  },
  agg: {
    name: '미국 채권 ETF',
    ticker: 'AGG',
    avgReturn: 3.5,
    volatility: 5,
    color: '#10b981',
    description: '미국 종합 채권',
  },
  sgov: {
    name: '초단기 국채 ETF',
    ticker: 'SGOV',
    avgReturn: 2.0,
    volatility: 1,
    color: '#94a3b8',
    description: '현금성 자산',
  },
}

// Portfolio configurations (based on historical returns)
export const portfolios: Record<string, Portfolio> = {
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

// Helper function to get portfolio by style
export function getPortfolioByStyle(style: 'conservative' | 'balanced' | 'aggressive'): Portfolio {
  return portfolios[style]
}

// Helper function to calculate weighted average return
export function calculatePortfolioReturn(allocation: PortfolioAllocation[]): number {
  return allocation.reduce((total, item) => {
    return total + (item.avgReturn * item.ratio) / 100
  }, 0)
}
