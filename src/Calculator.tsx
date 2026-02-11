import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
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
import { supabase } from './lib/supabase'
import { calculateCompositeScore } from './lib/composite-score'
import './Calculator.css'

// Chart.js 등록
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

// 히스토리 데이터 타입
interface MarketHistoryRecord {
  date: string
  fear_greed: number | null
  vix: number | null
  spy_vs_200ma: number | null
  buffett_indicator: number | null
  fed_balance_sheet_yoy: number | null
  m2_growth_yoy: number | null
  hy_spread: number | null
  yield_curve_10y2y: number | null
  yield_curve_10y3m: number | null
  initial_claims: number | null
  erp: number | null
  spy_price: number | null
  composite_score: number
  // 포트폴리오 자산 가격
  qqq_price: number | null
  gld_price: number | null
  schd_price: number | null
  vym_price: number | null
  treasury_3m: number | null  // 3개월 국채 금리 (현금성 자산 수익률)
}

// 시장 지표 타입
interface MarketIndicators {
  fearGreed: {
    value: number
    rating: string
    previousClose: number
    oneWeekAgo: number
    oneMonthAgo: number
    oneYearAgo: number
  } | null
  vix: number | null
  spyVs200MA: {
    currentPrice: number
    ma200: number
    percentAbove: number
  } | null
  buffettIndicator: {
    value: number
    gdp: number
    marketCap: number
  } | null
  fedBalanceSheet: {
    value: number
    yoyChange: number
  } | null
  m2Growth: {
    value: number
    yoyChange: number
  } | null
  highYieldSpread: number | null
  yieldCurve10Y2Y: number | null
  yieldCurve10Y3M: number | null
  initialClaims: {
    value: number
    fourWeekAvg: number
  } | null
  erp: number | null // Equity Risk Premium
  treasury3m: number | null // 3개월 국채 금리
  lastUpdated: string
}


// 점수화 함수들
// 점수 기준: 높을수록 "투자 매력도" (공포/저평가 = 매수 기회)
// 역발상 투자 관점: 시장이 두려워할 때가 기회
const normalizeScore = (value: number, min: number, max: number, invert = false): number => {
  const clamped = Math.max(min, Math.min(max, value))
  const normalized = ((clamped - min) / (max - min)) * 100
  return invert ? 100 - normalized : normalized
}

// 극단값 캡 적용 (개별 지표가 전체 점수를 과도하게 왜곡하지 않도록)
const applyExtremeCap = (score: number, minCap = 15, maxCap = 85): number => {
  return Math.max(minCap, Math.min(maxCap, score))
}

// 지표별 선행/후행 특성 정의
// leading: 선행지표 - 변화율 가중 높음 (현재 50% + 변화율 50%)
// coincident: 동행지표 - 변화율 가중 중간 (현재 70% + 변화율 30%)
// lagging: 후행지표 - 현재값 중심 (현재 90% + 변화율 10%)
type IndicatorTiming = 'leading' | 'coincident' | 'lagging'

const indicatorTiming: Record<string, { timing: IndicatorTiming; currentWeight: number; momentumWeight: number }> = {
  'Fear & Greed': { timing: 'lagging', currentWeight: 0.9, momentumWeight: 0.1 },
  'VIX': { timing: 'coincident', currentWeight: 0.7, momentumWeight: 0.3 },
  'S&P vs 200MA': { timing: 'coincident', currentWeight: 0.7, momentumWeight: 0.3 },
  'Buffett Indicator': { timing: 'lagging', currentWeight: 0.9, momentumWeight: 0.1 },
  'Equity Risk Premium': { timing: 'coincident', currentWeight: 0.7, momentumWeight: 0.3 },
  'Fed Balance Sheet': { timing: 'leading', currentWeight: 0.5, momentumWeight: 0.5 },
  'M2 Growth': { timing: 'leading', currentWeight: 0.5, momentumWeight: 0.5 },
  'HY Spread': { timing: 'leading', currentWeight: 0.5, momentumWeight: 0.5 },
  'Yield Curve 10Y-2Y': { timing: 'leading', currentWeight: 0.5, momentumWeight: 0.5 },
  'Yield Curve 10Y-3M': { timing: 'leading', currentWeight: 0.5, momentumWeight: 0.5 },
  'Initial Claims': { timing: 'coincident', currentWeight: 0.7, momentumWeight: 0.3 },
}

// 지표 점수 타입
interface IndicatorScore {
  name: string
  value: number | string
  score: number           // 최종 점수 (현재값 + 모멘텀 가중)
  baseScore: number       // 현재값 기준 점수
  momentumScore: number   // 3개월 변화율 기준 점수
  category: string
  range: string
  description: string
  rawValue: number        // 실제 값 (범위 내 위치 계산용)
  min: number             // 범위 최소값
  max: number             // 범위 최대값
  timing: IndicatorTiming // 선행/동행/후행
}

// 3개월 전 데이터에서 모멘텀 점수 계산
// 변화율이 개선되면 높은 점수, 악화되면 낮은 점수
const calculateMomentumScore = (
  currentScore: number,
  threeMonthAgoScore: number | null
): number => {
  if (threeMonthAgoScore === null) return 50 // 데이터 없으면 중립
  const change = currentScore - threeMonthAgoScore
  // 변화량을 -30 ~ +30 범위로 가정하고 0-100으로 정규화
  const normalizedChange = ((change + 30) / 60) * 100
  return Math.max(0, Math.min(100, normalizedChange))
}

// 지표별 3개월 전 값 추출
const getThreeMonthAgoValue = (
  history: MarketHistoryRecord[],
  field: keyof MarketHistoryRecord
): number | null => {
  // 약 12-13주 전 데이터 (3개월)
  const targetIndex = Math.max(0, history.length - 13)
  const record = history[targetIndex]
  if (!record) return null
  const value = record[field]
  return typeof value === 'number' ? value : null
}

const calculateIndicatorScores = (
  data: MarketIndicators,
  history: MarketHistoryRecord[] = []
): IndicatorScore[] => {
  const scores: IndicatorScore[] = []

  // 헬퍼 함수: 지표 추가
  const addIndicator = (
    name: string,
    value: number | string,
    rawValue: number,
    baseScoreRaw: number,
    category: string,
    range: string,
    description: string,
    min: number,
    max: number,
    historyField: keyof MarketHistoryRecord,
    invert: boolean
  ) => {
    const timing = indicatorTiming[name] || { timing: 'coincident' as IndicatorTiming, currentWeight: 0.7, momentumWeight: 0.3 }

    // 극단값 캡 적용
    const baseScore = applyExtremeCap(baseScoreRaw)

    // 3개월 전 값으로 모멘텀 계산
    const threeMonthAgoValue = getThreeMonthAgoValue(history, historyField)
    let momentumScore = 50 // 기본값 (중립)

    if (threeMonthAgoValue !== null) {
      const threeMonthAgoScore = invert
        ? normalizeScore(threeMonthAgoValue, min, max, true)
        : normalizeScore(threeMonthAgoValue, min, max, false)
      momentumScore = calculateMomentumScore(baseScoreRaw, threeMonthAgoScore)
    }

    // 최종 점수 = 현재값 가중치 + 모멘텀 가중치
    const finalScore = applyExtremeCap(
      baseScore * timing.currentWeight + momentumScore * timing.momentumWeight
    )

    scores.push({
      name,
      value,
      score: finalScore,
      baseScore,
      momentumScore,
      category,
      range,
      description,
      rawValue,
      min,
      max,
      timing: timing.timing,
    })
  }

  // Fear & Greed (0-100) - 공포일 때 매수 기회
  if (data.fearGreed) {
    addIndicator(
      'Fear & Greed',
      data.fearGreed.value,
      data.fearGreed.value,
      100 - data.fearGreed.value,
      'sentiment',
      '0-100',
      '낮을수록(공포) 매력 상승, 높을수록(탐욕) 매력 하락',
      0, 100,
      'fear_greed',
      true
    )
  }

  // VIX (12-40) - 높은 VIX = 공포 = 매수 기회
  if (data.vix) {
    addIndicator(
      'VIX',
      data.vix.toFixed(1),
      data.vix,
      normalizeScore(data.vix, 12, 40, false),
      'sentiment',
      '12-40',
      '높을수록(공포) 매력 상승. 40+ 패닉은 적극 매수 구간',
      12, 40,
      'vix',
      false
    )
  }

  // S&P vs 200MA (-10% ~ +10%) - 200일선 아래일 때 매수 기회
  if (data.spyVs200MA) {
    addIndicator(
      'S&P vs 200MA',
      `${data.spyVs200MA.percentAbove > 0 ? '+' : ''}${data.spyVs200MA.percentAbove.toFixed(1)}%`,
      data.spyVs200MA.percentAbove,
      normalizeScore(data.spyVs200MA.percentAbove, -10, 10, true),
      'sentiment',
      '-10% ~ +10%',
      '200일선 아래일수록 매력 상승 (저점 매수 기회)',
      -10, 10,
      'spy_vs_200ma',
      true
    )
  }

  // Buffett Indicator (80-250%) - 저평가일 때 매수 기회
  if (data.buffettIndicator) {
    addIndicator(
      'Buffett Indicator',
      `${data.buffettIndicator.value.toFixed(0)}%`,
      data.buffettIndicator.value,
      normalizeScore(data.buffettIndicator.value, 80, 250, true),
      'valuation',
      '80-250%',
      '시총/GDP 비율. 낮을수록(저평가) 매력 상승',
      80, 250,
      'buffett_indicator',
      true
    )
  }

  // Equity Risk Premium (-2% ~ +6%) - 높을수록 주식 매력적
  if (data.erp !== null) {
    addIndicator(
      'Equity Risk Premium',
      `${data.erp > 0 ? '+' : ''}${data.erp.toFixed(2)}%`,
      data.erp,
      normalizeScore(data.erp, -2, 6),
      'valuation',
      '-2% ~ +6%',
      '채권 대비 주식 초과수익률. 높을수록 매력 상승',
      -2, 6,
      'erp',
      false
    )
  }

  // Fed Balance Sheet YoY (-5% ~ +15%) - 축소 중 = 향후 완화 기대
  if (data.fedBalanceSheet) {
    addIndicator(
      'Fed Balance Sheet',
      `${data.fedBalanceSheet.yoyChange > 0 ? '+' : ''}${data.fedBalanceSheet.yoyChange.toFixed(1)}% YoY`,
      data.fedBalanceSheet.yoyChange,
      normalizeScore(data.fedBalanceSheet.yoyChange, -5, 15, true),
      'liquidity',
      '-5% ~ +15%',
      '긴축(QT) 중일수록 매력 상승. 완화 전환 시 상승 여력',
      -5, 15,
      'fed_balance_sheet_yoy',
      true
    )
  }

  // M2 YoY (-5% ~ +10%) - 감소 중 = 향후 확대 기대
  if (data.m2Growth) {
    addIndicator(
      'M2 Growth',
      `${data.m2Growth.yoyChange > 0 ? '+' : ''}${data.m2Growth.yoyChange.toFixed(1)}% YoY`,
      data.m2Growth.yoyChange,
      normalizeScore(data.m2Growth.yoyChange, -5, 10, true),
      'liquidity',
      '-5% ~ +10%',
      '통화량 감소 중일수록 매력 상승. 확대 전환 시 상승 여력',
      -5, 10,
      'm2_growth_yoy',
      true
    )
  }

  // High Yield Spread (2.5-8%) - 높은 스프레드 = 공포 = 매수 기회
  if (data.highYieldSpread) {
    addIndicator(
      'HY Spread',
      `${data.highYieldSpread.toFixed(2)}%`,
      data.highYieldSpread,
      normalizeScore(data.highYieldSpread, 2.5, 8, false),
      'credit',
      '2.5-8%',
      '높을수록(신용위기 우려) 매력 상승. 6%+ 위기 = 기회',
      2.5, 8,
      'hy_spread',
      false
    )
  }

  // Yield Curve 10Y-2Y (-1 ~ +2%) - 정상화되면 경기 회복 기대
  if (data.yieldCurve10Y2Y !== null) {
    addIndicator(
      'Yield Curve 10Y-2Y',
      `${data.yieldCurve10Y2Y > 0 ? '+' : ''}${data.yieldCurve10Y2Y.toFixed(2)}%`,
      data.yieldCurve10Y2Y,
      normalizeScore(data.yieldCurve10Y2Y, -1, 2),
      'macro',
      '-1% ~ +2%',
      '정상(+)일수록 매력 상승. 역전(-) = 침체 우려',
      -1, 2,
      'yield_curve_10y2y',
      false
    )
  }

  // Yield Curve 10Y-3M (-1 ~ +2%)
  if (data.yieldCurve10Y3M !== null) {
    addIndicator(
      'Yield Curve 10Y-3M',
      `${data.yieldCurve10Y3M > 0 ? '+' : ''}${data.yieldCurve10Y3M.toFixed(2)}%`,
      data.yieldCurve10Y3M,
      normalizeScore(data.yieldCurve10Y3M, -1, 2),
      'macro',
      '-1% ~ +2%',
      '연준 중시 지표. 정상(+)일수록 매력 상승',
      -1, 2,
      'yield_curve_10y3m',
      false
    )
  }

  // Initial Claims (200K-400K) - 높은 실업 = 경기 바닥 신호 = 매수 기회
  if (data.initialClaims) {
    addIndicator(
      'Initial Claims',
      `${(data.initialClaims.value / 1000).toFixed(0)}K`,
      data.initialClaims.value,
      normalizeScore(data.initialClaims.value, 200000, 400000, false),
      'macro',
      '200K-400K',
      '높을수록(실업 증가) 매력 상승. 바닥 신호 = 반등 기대',
      200000, 400000,
      'initial_claims',
      false
    )
  }

  return scores
}

// MarketIndicators -> 공유 모듈용 입력으로 변환하여 Z-score 계산
const calculateZScoreBasedScore = (data: MarketIndicators): number => {
  return calculateCompositeScore({
    hySpread: data.highYieldSpread,
    vix: data.vix,
    initialClaims: data.initialClaims?.value ?? null,
    spyVs200MA: data.spyVs200MA?.percentAbove ?? null,
    yieldCurve10Y2Y: data.yieldCurve10Y2Y,
  })
}

// MarketHistoryRecord -> 공유 모듈용 입력으로 변환하여 Z-score 계산
const calculateZScoreFromHistory = (record: MarketHistoryRecord): number => {
  return calculateCompositeScore({
    hy_spread: record.hy_spread,
    vix: record.vix,
    initial_claims: record.initial_claims,
    spy_vs_200ma: record.spy_vs_200ma,
    yield_curve_10y2y: record.yield_curve_10y2y,
  })
}


// 투자 매력도 기반 자산배분 가이드 (역사적 데이터 기반 최적화)
// 점수가 높을수록 = 저평가 + 공포 + 유동성 긴축(향후 완화 기대) = 주식 비중 확대 기회
// 점수가 낮을수록 = 고평가 + 탐욕 + 유동성 과잉 = 방어적 포지션
type InvestmentStance = 'aggressive_plus' | 'aggressive' | 'moderate_aggressive' | 'neutral' | 'moderate_defensive' | 'defensive' | 'unknown'

// 실제 수익률 기반 투자 스탠스 결정 (2015-2025 백테스트 검증)
// 각 구간별 3개월 후 수익률 분석 결과를 반영
const determineInvestmentStance = (avgScore: number): InvestmentStance => {
  if (avgScore >= 60) return 'aggressive_plus'     // 승률 100%, 평균 +10% 이상
  if (avgScore >= 55) return 'aggressive'          // 승률 89%, 평균 +6.5%
  if (avgScore >= 50) return 'moderate_aggressive' // 승률 90%, 평균 +5.3%
  if (avgScore >= 45) return 'neutral'             // 승률 51-67%, 평균 0~1%
  if (avgScore >= 41) return 'moderate_defensive'  // 승률 58%, 평균 0%
  if (avgScore >= 0) return 'defensive'            // 승률 8-37%, 평균 -3%
  return 'unknown'
}

const getStanceInfo = (stance: InvestmentStance) => {
  const info = {
    aggressive_plus: {
      label: '매수 적기',
      color: '#059669',
      description: '목돈 투자에 가장 좋은 시기입니다. 2020년 코로나 폭락 때와 유사한 수준으로, 10년에 몇 번 나타나는 드문 기회입니다. 과거 이런 시기에 목돈을 투자하면 3개월 후 100% 상승했고, 평균 +10% 이상의 수익을 기록했습니다.',
      allocation: { stocks: '90%', bonds: '10%', cash: '0%' },
      action: '목돈이 있다면 지금 투자를 적극 고려하세요',
    },
    aggressive: {
      label: '매수 우위',
      color: '#16a34a',
      description: '목돈 투자에 좋은 시기입니다. 시장에 공포심이 퍼져있어 주식이 저렴한 구간입니다. 과거 이런 시기에 3개월 후 89%는 상승해 평균 +6.5% 수익을 거뒀습니다.',
      allocation: { stocks: '80%', bonds: '15%', cash: '5%' },
      action: '목돈 투자를 고려해볼 만한 시점입니다',
    },
    moderate_aggressive: {
      label: '소폭 매수 우위',
      color: '#22c55e',
      description: '목돈 투자에 나쁘지 않은 시기입니다. 과거 이런 시기에 3개월 후 90%는 상승해 평균 +5.3% 수익을 거뒀고, 하락 시에도 손실폭이 제한적이었습니다(-3.5%). 목돈을 넣어도 괜찮은 구간입니다.',
      allocation: { stocks: '70%', bonds: '20%', cash: '10%' },
      action: '목돈은 2~3회 분할 매수를 권장합니다',
    },
    neutral: {
      label: '중립',
      color: '#f59e0b',
      description: '목돈 투자를 서두를 필요가 없는 시기입니다. 과거 이런 시기에 3개월 후 51-67%는 상승했지만, 평균 수익은 0~1%에 불과했습니다. 동전 던지기 수준이라 "지금이 기회다"라고 말하기 어렵습니다.',
      allocation: { stocks: '60%', bonds: '25%', cash: '15%' },
      action: '적립식 투자는 유지하되, 목돈은 더 좋은 기회를 기다리세요',
    },
    moderate_defensive: {
      label: '소폭 방어 우위',
      color: '#f97316',
      description: '목돈 투자에 좋지 않은 시기입니다. 과거 이런 시기에 3개월 후 승률은 58%였지만 평균 수익은 0%입니다. 하락 시 -4.5% 손실이 발생했습니다.',
      allocation: { stocks: '50%', bonds: '25%', cash: '25%' },
      action: '목돈 투자는 보류하고, 더 좋은 기회를 기다리세요',
    },
    defensive: {
      label: '방어 우위',
      color: '#ef4444',
      description: '목돈 투자를 피해야 할 시기입니다. 과거 이런 시기에 3개월 후 승률은 8-37%로 낮았고, 평균 -3% 손실이 발생했습니다. 하락 시 -7% 이상 손실 위험이 있습니다.',
      allocation: { stocks: '40%', bonds: '20%', cash: '40%' },
      action: '목돈은 현금으로 보유하고, 조정을 기다리세요',
    },
    unknown: {
      label: '판단 불가',
      color: '#6b7280',
      description: '현재 시장 데이터가 충분하지 않아 정확한 판단이 어렵습니다.',
      allocation: { stocks: '-', bonds: '-', cash: '-' },
      action: '-',
    },
  }
  return info[stance]
}

// 구간별 4주/12주 후 상승/하락 확률 (2020~2026년 백테스트 기반)
const getStanceProbability = (stance: InvestmentStance) => {
  const probabilities: Record<InvestmentStance, {
    week4: { up: number; down: number; avgUp: number; avgDown: number };
    week12: { up: number; down: number; avgUp: number; avgDown: number };
  }> = {
    aggressive_plus: {
      week4: { up: 100, down: 0, avgUp: 12.6, avgDown: 0 },
      week12: { up: 100, down: 0, avgUp: 23.0, avgDown: 0 },
    },
    aggressive: {
      week4: { up: 100, down: 0, avgUp: 4.6, avgDown: 0 },
      week12: { up: 88, down: 12, avgUp: 11.8, avgDown: -0.8 },
    },
    moderate_aggressive: {
      week4: { up: 72, down: 28, avgUp: 5.4, avgDown: -6.9 },
      week12: { up: 86, down: 14, avgUp: 7.0, avgDown: -2.5 },
    },
    neutral: {
      week4: { up: 58, down: 42, avgUp: 4.2, avgDown: -4.3 },
      week12: { up: 75, down: 25, avgUp: 7.4, avgDown: -5.7 },
    },
    moderate_defensive: {
      week4: { up: 69, down: 31, avgUp: 2.7, avgDown: -4.6 },
      week12: { up: 67, down: 33, avgUp: 5.5, avgDown: -7.5 },
    },
    defensive: {
      week4: { up: 72, down: 28, avgUp: 1.9, avgDown: -2.2 },
      week12: { up: 84, down: 16, avgUp: 4.1, avgDown: -5.7 },
    },
    unknown: {
      week4: { up: 0, down: 0, avgUp: 0, avgDown: 0 },
      week12: { up: 0, down: 0, avgUp: 0, avgDown: 0 },
    },
  }
  return probabilities[stance]
}

// 지표명 -> 히스토리 필드 매핑
const indicatorToHistoryField: Record<string, keyof MarketHistoryRecord> = {
  'Fear & Greed': 'fear_greed',
  'VIX': 'vix',
  'S&P vs 200MA': 'spy_vs_200ma',
  'Buffett Indicator': 'buffett_indicator',
  'Equity Risk Premium': 'erp',
  'Fed Balance Sheet': 'fed_balance_sheet_yoy',
  'M2 Growth': 'm2_growth_yoy',
  'HY Spread': 'hy_spread',
  'Yield Curve 10Y-2Y': 'yield_curve_10y2y',
  'Yield Curve 10Y-3M': 'yield_curve_10y3m',
  'Initial Claims': 'initial_claims',
}

// 지표명 한국어 표현
const indicatorKoreanName: Record<string, string> = {
  'Fear & Greed': '공포탐욕지수',
  'VIX': '변동성지수',
  'S&P vs 200MA': 'S&P 200일선 대비',
  'Buffett Indicator': '버핏지표',
  'Equity Risk Premium': '주식위험프리미엄',
  'Fed Balance Sheet': '연준 대차대조표',
  'M2 Growth': 'M2 통화량',
  'HY Spread': '하이일드 스프레드',
  'Yield Curve 10Y-2Y': '장단기금리차 10Y-2Y',
  'Yield Curve 10Y-3M': '장단기금리차 10Y-3M',
  'Initial Claims': '신규실업수당청구',
}

// 극단적 지표 해설 생성
const generateExtremeIndicatorCommentary = (
  coreIndicators: IndicatorScore[],
  marketHistory: MarketHistoryRecord[],
  indicatorWeights: Record<string, number>
): string[] => {
  const commentaries: string[] = []

  // 가중치 순으로 정렬
  const sortedIndicators = [...coreIndicators].sort(
    (a, b) => (indicatorWeights[b.name] || 0) - (indicatorWeights[a.name] || 0)
  )

  for (const indicator of sortedIndicators) {
    const historyField = indicatorToHistoryField[indicator.name]
    if (!historyField) continue

    // 해당 지표의 히스토리 값들
    const historyValues = marketHistory
      .map(h => h[historyField] as number | null)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)

    if (historyValues.length < 10) continue

    const currentValue = indicator.rawValue
    const koreanName = indicatorKoreanName[indicator.name]

    // 백분위 계산 (현재 값이 히스토리에서 몇 번째인지)
    const rank = historyValues.filter(v => v <= currentValue).length
    const percentile = Math.round((rank / historyValues.length) * 100)

    // 상위/하위 20% 이하일 때만 해설 생성
    if (percentile <= 20 || percentile >= 80) {
      const isExtremeLow = percentile <= 20
      const extremeLabel = isExtremeLow ? `하위 ${percentile}%` : `상위 ${100 - percentile}%`

      // 지표별 맞춤 해설
      if (indicator.name === 'VIX') {
        if (isExtremeLow) {
          commentaries.push(`${koreanName}가 ${indicator.value}로 ${extremeLabel} 수준입니다. 시장 안도감이 높아 조정 가능성에 유의하세요.`)
        } else {
          commentaries.push(`${koreanName}가 ${indicator.value}로 ${extremeLabel} 수준의 공포 구간입니다. 역사적으로 높은 VIX는 매수 기회였습니다.`)
        }
      } else if (indicator.name === 'HY Spread') {
        if (isExtremeLow) {
          commentaries.push(`${koreanName}가 ${indicator.value}로 ${extremeLabel} 수준입니다. 신용 리스크 경계심이 낮아 주의가 필요합니다.`)
        } else {
          commentaries.push(`${koreanName}가 ${indicator.value}로 ${extremeLabel} 수준입니다. 신용 스트레스가 높지만 역발상 매수 기회일 수 있습니다.`)
        }
      } else if (indicator.name === 'Initial Claims') {
        if (isExtremeLow) {
          commentaries.push(`${koreanName}가 ${indicator.value}로 ${extremeLabel} 수준입니다. 고용시장이 과열 상태로 긴축 지속 가능성이 있습니다.`)
        } else {
          commentaries.push(`${koreanName}가 ${indicator.value}로 ${extremeLabel} 수준입니다. 고용 악화는 연준 완화 전환 신호일 수 있습니다.`)
        }
      } else if (indicator.name === 'S&P vs 200MA') {
        if (isExtremeLow) {
          commentaries.push(`S&P500이 200일선 대비 ${indicator.value}로 ${extremeLabel} 수준입니다. 기술적으로 저점 매수 구간입니다.`)
        } else {
          commentaries.push(`S&P500이 200일선 대비 ${indicator.value}로 ${extremeLabel} 수준입니다. 과열 구간으로 추격 매수는 주의하세요.`)
        }
      } else if (indicator.name === 'Yield Curve 10Y-2Y') {
        if (isExtremeLow) {
          commentaries.push(`${koreanName}가 ${indicator.value}로 ${extremeLabel} 수준의 역전 상태입니다. 경기 침체 우려가 있지만 주가는 선반영하는 경향이 있습니다.`)
        } else {
          commentaries.push(`${koreanName}가 ${indicator.value}로 정상화되어 ${extremeLabel} 수준입니다. 경기 회복 기대가 반영되고 있습니다.`)
        }
      }
    }

    // 최대 2개 해설만
    if (commentaries.length >= 2) break
  }

  return commentaries
}

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

// 백테스팅 전략 타입
type BacktestStrategy = 'percentile' | 'dynamic_allocation' | 'dca_enhanced' | 'portfolio_simple' | 'portfolio_segmented'

// 전략 설정 인터페이스
interface StrategyConfig {
  investmentType: 'lump_sum' | 'dca'    // 일시투자 vs 적립식
  benchmarkType: 'buy_hold' | 'dca'     // 벤치마크 유형
  requiresMultiAsset: boolean           // 다중 자산 필요 여부
  rebalanceFrequency?: number           // 리밸런싱 주기 (주 단위)
}

// 전략별 설정 (새 전략 추가 시 여기에 설정 추가)
const STRATEGY_CONFIG: Record<BacktestStrategy, StrategyConfig> = {
  percentile: { investmentType: 'lump_sum', benchmarkType: 'buy_hold', requiresMultiAsset: false },
  dynamic_allocation: { investmentType: 'lump_sum', benchmarkType: 'buy_hold', requiresMultiAsset: false },
  dca_enhanced: { investmentType: 'dca', benchmarkType: 'dca', requiresMultiAsset: false },
  portfolio_simple: { investmentType: 'dca', benchmarkType: 'dca', requiresMultiAsset: true, rebalanceFrequency: 13 },
  portfolio_segmented: { investmentType: 'dca', benchmarkType: 'dca', requiresMultiAsset: true, rebalanceFrequency: 13 },
}

// 전략 상태 인터페이스 (모든 전략에서 공통 사용)
interface StrategyState {
  cash: number
  holdings: Record<string, number>  // SPY, QQQ, GLD, SCHD 등
  totalInvested: number
  cashflows: number[]
}

// 벤치마크 상태 인터페이스
interface BenchmarkState {
  shares: number
  invested: number
  cashflows: number[]
}

interface BacktestResult {
  dates: string[]
  portfolioValues: number[]
  spyValues: number[]
  trades: Array<{
    date: string
    action: 'buy' | 'sell' | 'hold'
    price: number
    shares: number
    score: number
    reason: string
  }>
  metrics: {
    totalInvested: number      // 총 투자금 (전략)
    spyTotalInvested: number   // 총 투자금 (벤치마크)
    finalValue: number         // 최종 평가금액
    totalProfit: number        // 총 수익금
    spyFinalValue: number      // 벤치마크 최종 평가금액
    spyTotalProfit: number     // 벤치마크 총 수익금
    totalReturn: number
    spyReturn: number
    cagr: number
    spyCagr: number
    maxDrawdown: number
    spyMaxDrawdown: number
    sharpeRatio: number
    winRate: number
    totalTrades: number
  }
}

// 가격 조회 헬퍼 (null-safe, fallback 포함)
const getAssetPrice = (
  history: MarketHistoryRecord[],
  index: number,
  field: keyof MarketHistoryRecord
): number | null => {
  let price = history[index]?.[field] as number | null
  if (price === null || price === undefined) {
    for (let j = index - 1; j >= 0; j--) {
      const prev = history[j]?.[field]
      if (prev !== null && prev !== undefined) {
        price = prev as number
        break
      }
    }
  }
  return price
}

// 벤치마크 업데이트 헬퍼
const updateBenchmark = (
  state: BenchmarkState,
  weekIndex: number,
  price: number,
  config: StrategyConfig,
  initialCash: number,
  weeklyAmount: number,
  sameInvestment: boolean,
  strategyWeeklyAmount?: number  // DCA 동일 투자금 모드에서 전략의 주간 투자금
): number => {
  if (config.benchmarkType === 'buy_hold') {
    // 일시 투자: 첫 주에 전액 투자, 이후 0
    if (weekIndex === 0) {
      state.invested = initialCash
      state.cashflows.push(-initialCash)
      state.shares = initialCash / price
    } else {
      state.cashflows.push(0)
    }
  } else {
    // DCA 벤치마크: 매주 투자
    // 동일 투자금 모드면 전략과 같은 금액, 아니면 기본 금액
    const benchmarkWeeklyAmount = sameInvestment && strategyWeeklyAmount !== undefined
      ? strategyWeeklyAmount
      : weeklyAmount

    if (weekIndex === 0) {
      const firstWeekTotal = initialCash + benchmarkWeeklyAmount
      state.invested += firstWeekTotal
      state.cashflows.push(-firstWeekTotal)
      state.shares += firstWeekTotal / price
    } else {
      state.invested += benchmarkWeeklyAmount
      state.cashflows.push(-benchmarkWeeklyAmount)
      state.shares += benchmarkWeeklyAmount / price
    }
  }
  return state.shares * price
}

// 포트폴리오 가치 계산 헬퍼
const calculatePortfolioValue = (
  state: StrategyState,
  history: MarketHistoryRecord[],
  index: number
): number => {
  let value = state.cash
  for (const [asset, shares] of Object.entries(state.holdings)) {
    if (shares > 0) {
      const priceField = `${asset.toLowerCase()}_price` as keyof MarketHistoryRecord
      const assetPrice = getAssetPrice(history, index, priceField) || 0
      value += shares * assetPrice
    }
  }
  return value
}

// 동적 배분 전략 실행
const executeDynamicAllocation = (
  state: StrategyState,
  history: MarketHistoryRecord[],
  weekIndex: number,
  initialCash: number,
  trades: BacktestResult['trades'],
  asset: 'SPY' | 'QQQ' = 'SPY'
): void => {
  const record = history[weekIndex]
  const priceField = asset === 'QQQ' ? 'qqq_price' : 'spy_price'
  const price = (getAssetPrice(history, weekIndex, priceField) || record.spy_price)!
  const score = record.composite_score

  // IRR 계산용: 첫 주에 초기 투자금, 이후는 0 (일시 투자)
  if (weekIndex === 0) {
    state.cashflows.push(-initialCash)
    state.totalInvested = initialCash
    state.cash = initialCash
  } else {
    state.cashflows.push(0)
  }

  // 최근 4주(약 1개월) 점수 추적
  const lookbackWeeks = 4
  const recentScores = history
    .slice(Math.max(0, weekIndex - lookbackWeeks), weekIndex + 1)
    .map(d => d.composite_score)
  const recentLow = Math.min(...recentScores)
  const reboundFromLow = recentLow > 0 ? ((score - recentLow) / recentLow) * 100 : 0

  // V자 반등 감지: 저점 대비 20% 이상 반등
  const isVShapedRebound = reboundFromLow >= 20 && recentLow < score

  // 목표 비중 결정
  let targetStockRatio: number
  let reason: string

  if (isVShapedRebound) {
    targetStockRatio = 0.95
    reason = `V자 반등 감지 (저점 ${recentLow.toFixed(1)} -> ${score.toFixed(1)}, +${reboundFromLow.toFixed(0)}%) - 비중 95%`
  } else if (score <= 35) {
    targetStockRatio = 0.40
    reason = `방어 구간 (점수 ${score.toFixed(1)} <= 35) - 비중 40%`
  } else if (score >= 50) {
    targetStockRatio = 0.85
    reason = `고매력 구간 (점수 ${score.toFixed(1)}) - 비중 85%`
  } else {
    targetStockRatio = 0.50 + (score - 35) * 0.02
    reason = `중립 구간 (점수 ${score.toFixed(1)}) - 비중 ${Math.round(targetStockRatio * 100)}%`
  }

  const assetShares = state.holdings[asset] || 0
  const totalValue = state.cash + assetShares * price
  const targetShares = (totalValue * targetStockRatio) / price

  // 첫 번째 거래 또는 10% 이상 차이나면 리밸런싱
  const currentRatio = assetShares > 0 ? (assetShares * price) / totalValue : 0
  if (weekIndex === 0 || Math.abs(targetStockRatio - currentRatio) > 0.1) {
    if (targetShares > assetShares) {
      const buyShares = targetShares - assetShares
      const cost = buyShares * price
      if (cost <= state.cash) {
        state.cash -= cost
        state.holdings[asset] = targetShares
        trades.push({
          date: record.date,
          action: 'buy',
          price,
          shares: buyShares,
          score,
          reason
        })
      }
    } else {
      const sellShares = assetShares - targetShares
      state.cash += sellShares * price
      state.holdings[asset] = targetShares
      trades.push({
        date: record.date,
        action: 'sell',
        price,
        shares: sellShares,
        score,
        reason
      })
    }
  }
}

// DCA 강화 전략 실행
const executeDcaEnhanced = (
  state: StrategyState,
  history: MarketHistoryRecord[],
  weekIndex: number,
  initialCash: number,
  weeklyBase: number,
  trades: BacktestResult['trades'],
  asset: 'SPY' | 'QQQ' = 'SPY'
): number => {  // 실제 주간 투자금 반환 (벤치마크 동일 투자금 모드용)
  const record = history[weekIndex]
  const priceField = asset === 'QQQ' ? 'qqq_price' : 'spy_price'
  const price = (getAssetPrice(history, weekIndex, priceField) || record.spy_price)!
  const score = record.composite_score

  // 급등 감지: 최근 12주(약 3개월) 저점 대비 20% 이상 상승 시 2배 투자
  let weeklyAmount = weeklyBase
  let surgeDetected = false

  if (weekIndex >= 12) {
    // 최근 12주간 최저 점수 찾기
    let minScore = score
    for (let j = weekIndex - 12; j < weekIndex; j++) {
      if (history[j].composite_score < minScore) {
        minScore = history[j].composite_score
      }
    }
    // 현재 점수가 저점 대비 20% 이상 높으면 급등으로 판단
    // (예: 저점 40점 -> 48점 이상이면 급등)
    if (minScore > 0 && score >= minScore * 1.2) {
      weeklyAmount = weeklyBase * 2
      surgeDetected = true
    }
  }

  const assetShares = state.holdings[asset] || 0

  if (weekIndex === 0 && initialCash > 0) {
    // 첫 주: 초기 투자금 + 주간 투자금
    const initialBuyShares = initialCash / price
    const weeklyBuyShares = weeklyAmount / price
    state.holdings[asset] = assetShares + initialBuyShares + weeklyBuyShares
    state.cash = 0

    const firstWeekTotal = initialCash + weeklyAmount
    state.totalInvested += firstWeekTotal
    state.cashflows.push(-firstWeekTotal)

    trades.push({
      date: record.date,
      action: 'buy',
      price,
      shares: initialBuyShares + weeklyBuyShares,
      score,
      reason: `초기 투자금 $${initialCash.toLocaleString()} + 주간 $${weeklyAmount} ${asset} 매수`
    })
  } else {
    // 2주차 이후: 주간 투자금만
    state.totalInvested += weeklyAmount
    state.cashflows.push(-weeklyAmount)

    const buyShares = weeklyAmount / price
    state.holdings[asset] = assetShares + buyShares

    // 급등 감지 시 거래 기록
    if (surgeDetected) {
      trades.push({
        date: record.date,
        action: 'buy',
        price,
        shares: buyShares,
        score,
        reason: `급등 감지 2배 ${asset} 매수 ($${weeklyAmount}, ${score}점)`
      })
    }
  }

  return weeklyAmount
}

// 포트폴리오 전략 실행 (simple / segmented)
const executePortfolioStrategy = (
  state: StrategyState,
  history: MarketHistoryRecord[],
  weekIndex: number,
  strategy: 'portfolio_simple' | 'portfolio_segmented',
  initialCash: number,
  weeklyBase: number,
  trades: BacktestResult['trades']
): boolean => {  // 정상 실행 여부 반환 (가격 데이터 없으면 false)
  const record = history[weekIndex]
  const score = record.composite_score

  // 자산 가격 가져오기
  const qqqPrice = getAssetPrice(history, weekIndex, 'qqq_price')
  const gldPrice = getAssetPrice(history, weekIndex, 'gld_price')
  const schdPrice = getAssetPrice(history, weekIndex, 'schd_price')
  const treasury3m = getAssetPrice(history, weekIndex, 'treasury_3m')

  // 가격 데이터 없으면 스킵
  if (!qqqPrice || !gldPrice || !schdPrice || treasury3m === null) {
    // cashflow는 추가 (IRR 타이밍 유지)
    if (weekIndex === 0) {
      state.totalInvested += initialCash
      state.cashflows.push(-initialCash)
      state.cash = initialCash
    } else if (weeklyBase > 0) {
      state.totalInvested += weeklyBase
      state.cashflows.push(-weeklyBase)
      state.cash += weeklyBase
    } else {
      state.cashflows.push(0)
    }
    return false
  }

  // 매주 투자금 유입
  if (weekIndex === 0) {
    state.totalInvested += initialCash
    state.cashflows.push(-initialCash)
    state.cash = initialCash
  } else if (weeklyBase > 0) {
    state.totalInvested += weeklyBase
    state.cashflows.push(-weeklyBase)
    // 현금 수익 (주간 이자)
    const weeklyInterest = state.cash * (treasury3m / 100 / 52)
    state.cash += weeklyInterest + weeklyBase
  } else {
    state.cashflows.push(0)
    // 현금 수익만
    const weeklyInterest = state.cash * (treasury3m / 100 / 52)
    state.cash += weeklyInterest
  }

  // 현재 포트폴리오 가치
  const qqqShares = state.holdings['QQQ'] || 0
  const gldShares = state.holdings['GLD'] || 0
  const schdShares = state.holdings['SCHD'] || 0
  const assetValue = qqqShares * qqqPrice + gldShares * gldPrice + schdShares * schdPrice
  const currentPortfolioValue = assetValue + state.cash

  if (currentPortfolioValue <= 0 && weekIndex > 0) {
    return false
  }

  // 목표 배분 비율 계산
  let targetQQQ = 0, targetGLD = 0, targetSCHD = 0, targetCash = 0

  if (strategy === 'portfolio_simple') {
    let stockRatio = 0.6
    if (score >= 50) stockRatio = 0.8
    else if (score >= 44) stockRatio = 0.7
    else if (score < 35) stockRatio = 0.5

    targetQQQ = stockRatio * 0.7
    targetSCHD = stockRatio * 0.3
    targetGLD = 0
    targetCash = 1 - stockRatio
  } else {
    if (score >= 50) {
      targetQQQ = 0.50; targetSCHD = 0.20; targetGLD = 0.10; targetCash = 0.20
    } else if (score >= 44) {
      targetQQQ = 0.40; targetSCHD = 0.20; targetGLD = 0.15; targetCash = 0.25
    } else if (score >= 35) {
      targetQQQ = 0.30; targetSCHD = 0.20; targetGLD = 0.15; targetCash = 0.35
    } else if (score >= 31) {
      targetQQQ = 0.20; targetSCHD = 0.20; targetGLD = 0.20; targetCash = 0.40
    } else {
      targetQQQ = 0.10; targetSCHD = 0.15; targetGLD = 0.25; targetCash = 0.50
    }
  }

  // 리밸런싱 (분기별 또는 첫 주)
  const isRebalanceWeek = weekIndex % 13 === 0
  if (isRebalanceWeek || weekIndex === 0) {
    const targetQQQValue = currentPortfolioValue * targetQQQ
    const targetGLDValue = currentPortfolioValue * targetGLD
    const targetSCHDValue = currentPortfolioValue * targetSCHD
    const targetCashValue = currentPortfolioValue * targetCash

    const newQQQShares = targetQQQValue / qqqPrice
    const newGLDShares = targetGLDValue / gldPrice
    const newSCHDShares = targetSCHDValue / schdPrice

    // 거래 기록
    if (Math.abs(newQQQShares - qqqShares) > 0.01 || Math.abs(newGLDShares - gldShares) > 0.01 || Math.abs(newSCHDShares - schdShares) > 0.01) {
      const allocationDesc = strategy === 'portfolio_simple'
        ? `주식 ${Math.round((targetQQQ + targetSCHD) * 100)}% / 현금 ${Math.round(targetCash * 100)}%`
        : `QQQ ${Math.round(targetQQQ * 100)}% / SCHD ${Math.round(targetSCHD * 100)}% / GLD ${Math.round(targetGLD * 100)}% / Cash ${Math.round(targetCash * 100)}%`

      trades.push({
        date: record.date,
        action: 'buy',
        price: qqqPrice,
        shares: newQQQShares - qqqShares,
        score,
        reason: `분기 리밸런싱 (${score.toFixed(0)}점): ${allocationDesc}`
      })
    }

    state.holdings['QQQ'] = newQQQShares
    state.holdings['GLD'] = newGLDShares
    state.holdings['SCHD'] = newSCHDShares
    state.cash = targetCashValue
  }

  return true
}

const Calculator = () => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'pension' | 'investment' | 'dc' | 'market' | 'backtest'>('market')

  // 시장 환경 상태
  const [marketData, setMarketData] = useState<MarketIndicators | null>(null)
  const [marketHistory, setMarketHistory] = useState<MarketHistoryRecord[]>([])
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null)
  const [chartPeriod, setChartPeriod] = useState<'1y' | '3y' | '5y' | '10y'>('1y')
  const [highlightStance, setHighlightStance] = useState<InvestmentStance | null>(null)
  const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null) // null = 최신

  // Gemini 채팅 상태
  const [marketChatOpen, setMarketChatOpen] = useState(false)
  const [marketChatMessages, setMarketChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [marketChatInput, setMarketChatInput] = useState('')
  const [marketChatLoading, setMarketChatLoading] = useState(false)
  const marketChatRef = useRef<HTMLDivElement>(null)

  // 백테스팅 상태
  const [backtestStrategy, setBacktestStrategy] = useState<BacktestStrategy>('dynamic_allocation')
  const [backtestPeriod, setBacktestPeriod] = useState<'3y' | '5y' | '10y'>('5y')
  const [backtestInitialCash, setBacktestInitialCash] = useState(10000)  // 초기 투자금
  const [backtestWeeklyAmount, setBacktestWeeklyAmount] = useState(100)  // 주간 투자금
  const [backtestSameInvestment, setBacktestSameInvestment] = useState(false)  // 동일 투자금 모드
  const [backtestAsset, setBacktestAsset] = useState<'SPY' | 'QQQ'>('SPY')  // 투자 자산 선택
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [backtestLoading, setBacktestLoading] = useState(false)

  // 백테스팅 실행 함수
  // IRR 계산 함수 (Newton-Raphson method)
  // 주간 현금흐름을 받아서 연환산 IRR을 반환
  const calculateIRR = (cashflows: number[], periodsPerYear: number = 52): number => {
    // cashflows: 음수 = 투자, 양수 = 회수 (마지막에 최종 자산 가치)
    if (cashflows.length < 2) return 0

    const maxIterations = 100
    const tolerance = 0.000001
    let weeklyRate = 0.002 // 초기 추정값 (주간 0.2% = 연 ~11%)

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0
      let npvDerivative = 0

      for (let t = 0; t < cashflows.length; t++) {
        const discountFactor = Math.pow(1 + weeklyRate, t)
        npv += cashflows[t] / discountFactor
        // d(NPV)/d(r) = sum of -t * CF_t / (1+r)^(t+1)
        npvDerivative -= t * cashflows[t] / Math.pow(1 + weeklyRate, t + 1)
      }

      if (Math.abs(npvDerivative) < 1e-10) break

      const newRate = weeklyRate - npv / npvDerivative

      if (Math.abs(newRate - weeklyRate) < tolerance) {
        // 주간 수익률을 연환산으로 변환: (1 + weeklyRate)^52 - 1
        const annualRate = Math.pow(1 + newRate, periodsPerYear) - 1
        return annualRate * 100
      }

      weeklyRate = newRate

      // 수렴 범위 제한 (주간 -5% ~ +5%)
      if (weeklyRate < -0.05) weeklyRate = -0.05
      if (weeklyRate > 0.05) weeklyRate = 0.05
    }

    // 주간 수익률을 연환산으로 변환
    const annualRate = Math.pow(1 + weeklyRate, periodsPerYear) - 1
    return annualRate * 100
  }

  const runBacktest = (history: MarketHistoryRecord[]) => {
    if (history.length === 0) return null

    const periodDays = { '3y': 365 * 3, '5y': 365 * 5, '10y': 365 * 10 }
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - periodDays[backtestPeriod])

    const filteredHistory = history.filter(d =>
      new Date(d.date) >= cutoffDate && d.spy_price !== null
    )

    if (filteredHistory.length < 10) return null

    // 설정 가져오기
    const config = STRATEGY_CONFIG[backtestStrategy]
    const initialCash = backtestInitialCash
    const weeklyBase = backtestWeeklyAmount

    // 결과 배열
    const portfolioValues: number[] = []
    const spyValues: number[] = []
    const dates: string[] = []
    const trades: BacktestResult['trades'] = []

    // 전략 상태 초기화
    const strategyState: StrategyState = {
      cash: 0,
      holdings: {},
      totalInvested: 0,
      cashflows: []
    }

    // 벤치마크 상태 초기화
    const benchmarkState: BenchmarkState = {
      shares: 0,
      invested: 0,
      cashflows: []
    }

    // 메인 루프
    for (let i = 0; i < filteredHistory.length; i++) {
      const record = filteredHistory[i]
      const spyPrice = record.spy_price!
      // 투자 자산 가격 (SPY 또는 QQQ)
      const assetPrice = backtestAsset === 'QQQ'
        ? (getAssetPrice(filteredHistory, i, 'qqq_price') || spyPrice)
        : spyPrice

      dates.push(record.date)

      // 전략 실행
      let actualWeeklyAmount = weeklyBase  // DCA에서 실제 투자금 (동일 투자금 모드용)

      switch (backtestStrategy) {
        case 'dynamic_allocation':
          executeDynamicAllocation(strategyState, filteredHistory, i, initialCash, trades, backtestAsset)
          break

        case 'dca_enhanced':
          actualWeeklyAmount = executeDcaEnhanced(strategyState, filteredHistory, i, initialCash, weeklyBase, trades, backtestAsset)
          break

        case 'portfolio_simple':
        case 'portfolio_segmented': {
          const success = executePortfolioStrategy(strategyState, filteredHistory, i, backtestStrategy, initialCash, weeklyBase, trades)
          if (!success) {
            // 가격 데이터 없으면 이전 값 유지
            if (portfolioValues.length > 0) {
              portfolioValues.push(portfolioValues[portfolioValues.length - 1])
            } else {
              portfolioValues.push(initialCash)
            }
            // 벤치마크도 계산
            const bmValue = updateBenchmark(benchmarkState, i, assetPrice, config, initialCash, weeklyBase, backtestSameInvestment)
            spyValues.push(bmValue)
            continue
          }
          break
        }
      }

      // 벤치마크 계산 (공통)
      const benchmarkValue = updateBenchmark(
        benchmarkState,
        i,
        assetPrice,
        config,
        initialCash,
        weeklyBase,
        backtestSameInvestment,
        actualWeeklyAmount
      )
      spyValues.push(benchmarkValue)

      // 포트폴리오 가치 계산
      const portfolioValue = calculatePortfolioValue(strategyState, filteredHistory, i)
      portfolioValues.push(portfolioValue)
    }

    // 성과 지표 계산
    const finalValue = portfolioValues[portfolioValues.length - 1]
    const finalSpyValue = spyValues[spyValues.length - 1]

    // 총 투자금 (StrategyState에서 가져옴)
    const totalInvested = strategyState.totalInvested
    const spyTotalInvested = benchmarkState.invested

    const totalReturn = ((finalValue - totalInvested) / totalInvested) * 100
    const spyReturn = ((finalSpyValue - spyTotalInvested) / spyTotalInvested) * 100

    // IRR 계산 (cashflows 배열 사용)
    const strategyFlows = [...strategyState.cashflows, finalValue]
    const benchmarkFlows = [...benchmarkState.cashflows, finalSpyValue]

    const cagr = calculateIRR(strategyFlows, 52)
    const spyCagr = calculateIRR(benchmarkFlows, 52)

    // MDD 계산
    const calcMDD = (values: number[]) => {
      const validValues = values.filter(v => v > 0)
      if (validValues.length === 0) return 0

      let maxValue = validValues[0]
      let maxDrawdown = 0
      for (const value of validValues) {
        maxValue = Math.max(maxValue, value)
        if (maxValue > 0) {
          const drawdown = ((maxValue - value) / maxValue) * 100
          maxDrawdown = Math.max(maxDrawdown, drawdown)
        }
      }
      return maxDrawdown
    }

    const maxDrawdown = calcMDD(portfolioValues)
    const spyMaxDrawdown = calcMDD(spyValues)

    // 샤프 비율
    const weeklyReturns = portfolioValues.slice(1).map((v, idx) =>
      (v - portfolioValues[idx]) / portfolioValues[idx]
    )
    const avgReturn = weeklyReturns.reduce((a, b) => a + b, 0) / weeklyReturns.length
    const returnVariance = weeklyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / weeklyReturns.length
    const returnStdDev = Math.sqrt(returnVariance) * Math.sqrt(52)
    const sharpeRatio = returnStdDev > 0 ? (cagr / 100) / returnStdDev : 0

    // 승률
    let winningTrades = 0
    let totalSellTrades = 0
    let lastBuyPrice = 0
    for (const trade of trades) {
      if (trade.action === 'buy') {
        lastBuyPrice = trade.price
      } else if (trade.action === 'sell') {
        totalSellTrades++
        if (trade.price > lastBuyPrice) winningTrades++
      }
    }
    const winRate = totalSellTrades > 0 ? (winningTrades / totalSellTrades) * 100 : 0

    return {
      dates,
      portfolioValues,
      spyValues,
      trades,
      metrics: {
        totalInvested,
        spyTotalInvested,
        finalValue,
        totalProfit: finalValue - totalInvested,
        spyFinalValue: finalSpyValue,
        spyTotalProfit: finalSpyValue - spyTotalInvested,
        totalReturn,
        spyReturn,
        cagr,
        spyCagr,
        maxDrawdown,
        spyMaxDrawdown,
        sharpeRatio,
        winRate,
        totalTrades: trades.length
      }
    }
  }

  // 시장 환경 데이터 로드 (로컬 전용 - Supabase 직접 연결)
  useEffect(() => {
    if (activeTab === 'market' && !marketData && !marketLoading) {
      setMarketLoading(true)
      setMarketError(null)

      const fetchMarketData = async () => {
        try {
          // 1. Supabase에서 히스토리 데이터 조회 (전체 10년치)
          const startDate = new Date()
          startDate.setFullYear(startDate.getFullYear() - 10)

          const { data: historyData, error: historyError } = await supabase
            .from('market_indicators_history')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true })

          if (historyError) {
            console.error('Supabase history error:', historyError)
          }

          // 히스토리 데이터 매핑
          const history: MarketHistoryRecord[] = (historyData || []).map((row) => ({
            date: row.date,
            fear_greed: row.fear_greed,
            vix: row.vix,
            spy_vs_200ma: row.spy_vs_200ma,
            buffett_indicator: row.buffett_indicator,
            fed_balance_sheet_yoy: row.fed_balance_sheet_yoy,
            m2_growth_yoy: row.m2_growth_yoy,
            hy_spread: row.hy_spread,
            yield_curve_10y2y: row.yield_curve_10y2y,
            yield_curve_10y3m: row.yield_curve_10y3m,
            initial_claims: row.initial_claims,
            erp: row.erp,
            spy_price: row.spy_price,
            composite_score: row.composite_score,
            qqq_price: row.qqq_price,
            gld_price: row.gld_price,
            schd_price: row.schd_price,
            vym_price: row.vym_price,
            treasury_3m: row.treasury_3m,
          }))

          setMarketHistory(history)

          // 2. 최신 히스토리 데이터를 현재 데이터로 사용 (가장 최근 레코드)
          if (history.length > 0) {
            const latest = history[history.length - 1]

            // 히스토리 데이터로 현재 시장 데이터 구성
            const currentData: MarketIndicators = {
              fearGreed: latest.fear_greed !== null ? {
                value: latest.fear_greed,
                rating: latest.fear_greed >= 75 ? 'Extreme Greed' :
                        latest.fear_greed >= 55 ? 'Greed' :
                        latest.fear_greed >= 45 ? 'Neutral' :
                        latest.fear_greed >= 25 ? 'Fear' : 'Extreme Fear',
                previousClose: history.length > 1 ? (history[history.length - 2].fear_greed || 0) : 0,
                oneWeekAgo: history.length > 7 ? (history[history.length - 8]?.fear_greed || 0) : 0,
                oneMonthAgo: history.length > 30 ? (history[history.length - 31]?.fear_greed || 0) : 0,
                oneYearAgo: history.length > 365 ? (history[0]?.fear_greed || 0) : 0,
              } : null,
              vix: latest.vix,
              spyVs200MA: latest.spy_vs_200ma !== null ? {
                currentPrice: 0, // 히스토리에는 퍼센트만 저장됨
                ma200: 0,
                percentAbove: latest.spy_vs_200ma,
              } : null,
              buffettIndicator: latest.buffett_indicator !== null ? {
                value: latest.buffett_indicator,
                gdp: 0,
                marketCap: 0,
              } : null,
              fedBalanceSheet: latest.fed_balance_sheet_yoy !== null ? {
                value: 0,
                yoyChange: latest.fed_balance_sheet_yoy,
              } : null,
              m2Growth: latest.m2_growth_yoy !== null ? {
                value: 0,
                yoyChange: latest.m2_growth_yoy,
              } : null,
              highYieldSpread: latest.hy_spread,
              yieldCurve10Y2Y: latest.yield_curve_10y2y,
              yieldCurve10Y3M: latest.yield_curve_10y3m,
              initialClaims: latest.initial_claims !== null ? {
                value: latest.initial_claims,
                fourWeekAvg: latest.initial_claims,
              } : null,
              erp: latest.erp ?? null,
              treasury3m: latest.treasury_3m ?? null,
              lastUpdated: latest.date,
            }

            setMarketData(currentData)
          } else {
            setMarketError('히스토리 데이터가 없습니다. 백필이 필요합니다.')
          }

          setMarketLoading(false)
        } catch (err) {
          console.error('Market data fetch error:', err)
          setMarketError(err instanceof Error ? err.message : '알 수 없는 오류')
          setMarketLoading(false)
        }
      }

      fetchMarketData()
    }
  }, [activeTab, marketData, marketLoading])

  // 선택된 날짜의 시장 데이터 계산
  const selectedMarketData = useMemo(() => {
    if (marketHistory.length === 0) return marketData

    // selectedDateIndex가 null이면 최신 데이터
    const index = selectedDateIndex ?? marketHistory.length - 1
    const record = marketHistory[index]
    if (!record) return marketData

    // 히스토리 레코드에서 MarketIndicators 생성
    const data: MarketIndicators = {
      fearGreed: record.fear_greed !== null ? {
        value: record.fear_greed,
        rating: record.fear_greed >= 75 ? 'Extreme Greed' :
                record.fear_greed >= 55 ? 'Greed' :
                record.fear_greed >= 45 ? 'Neutral' :
                record.fear_greed >= 25 ? 'Fear' : 'Extreme Fear',
        previousClose: index > 0 ? (marketHistory[index - 1]?.fear_greed || 0) : 0,
        oneWeekAgo: index >= 7 ? (marketHistory[index - 7]?.fear_greed || 0) : 0,
        oneMonthAgo: index >= 30 ? (marketHistory[index - 30]?.fear_greed || 0) : 0,
        oneYearAgo: index >= 365 ? (marketHistory[index - 365]?.fear_greed || 0) : 0,
      } : null,
      vix: record.vix,
      spyVs200MA: record.spy_vs_200ma !== null ? {
        currentPrice: 0,
        ma200: 0,
        percentAbove: record.spy_vs_200ma,
      } : null,
      buffettIndicator: record.buffett_indicator !== null ? {
        value: record.buffett_indicator,
        gdp: 0,
        marketCap: 0,
      } : null,
      fedBalanceSheet: record.fed_balance_sheet_yoy !== null ? {
        value: 0,
        yoyChange: record.fed_balance_sheet_yoy,
      } : null,
      m2Growth: record.m2_growth_yoy !== null ? {
        value: 0,
        yoyChange: record.m2_growth_yoy,
      } : null,
      highYieldSpread: record.hy_spread,
      yieldCurve10Y2Y: record.yield_curve_10y2y,
      yieldCurve10Y3M: record.yield_curve_10y3m,
      initialClaims: record.initial_claims !== null ? {
        value: record.initial_claims,
        fourWeekAvg: record.initial_claims,
      } : null,
      erp: record.erp ?? null,
      treasury3m: record.treasury_3m ?? null,
      lastUpdated: record.date,
    }
    return data
  }, [marketHistory, selectedDateIndex, marketData])

  // 1. 퇴직연금 인출 계산기 상태
  const [pensionBalance, setPensionBalance] = useState<number>(100000000)
  const [pensionReturn, setPensionReturn] = useState<number>(4)
  const [pensionPeriod, setPensionPeriod] = useState<number>(20)
  const [pensionStartAge, setPensionStartAge] = useState<number>(60)

  // 2. 적립식 투자 계산기 상태
  const [investCalcMode, setInvestCalcMode] = useState<'target' | 'future'>('target')
  const [targetAmount, setTargetAmount] = useState<number>(100000000)
  const [investReturn, setInvestReturn] = useState<number>(7)
  const [investPeriod, setInvestPeriod] = useState<number>(10)
  // 미래 자산 예측 계산기 상태
  const [futureMonthlyAmount, setFutureMonthlyAmount] = useState<number>(1000000)
  const [futureReturn, setFutureReturn] = useState<number>(7)
  const [futurePeriod, setFuturePeriod] = useState<number>(10)

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
    const n = investPeriod * 12 // 총 개월 수
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
    const n = futurePeriod * 12 // 총 개월 수
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

  const pensionResult = calculatePensionWithdrawal()
  const investResult = calculateInvestment()
  const futureResult = calculateFutureAsset()
  const dcResult = calculateDC()

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
        <p className="calc-subtitle">시장 분석, 투자 전략, 퇴직연금 설계</p>
      </header>

      {/* 탭 네비게이션 */}
      <div className="calc-tabs">
        <button
          className={`calc-tab ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => setActiveTab('market')}
        >
          시장 환경
        </button>
        <button
          className={`calc-tab ${activeTab === 'backtest' ? 'active' : ''}`}
          onClick={() => setActiveTab('backtest')}
        >
          백테스트
        </button>
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
                    <span className="calc-unit">년</span>
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
                    <span className="calc-unit">년</span>
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

      {/* 4. 시장 환경 진단 */}
      {activeTab === 'market' && (
        <div className="calc-section">
          <h2 className="calc-section-title">글로벌 시장 환경 진단</h2>
          <p className="calc-section-desc">
            10년 상관분석 기반 5개 핵심 지표로 투자 매력도 산출. 공포/저평가일수록 점수 상승.
          </p>

          {/* 날짜 선택 슬라이더 */}
          {marketHistory.length > 0 && (
            <div className="market-date-slider">
              <div className="market-date-slider-header">
                <span className="market-date-slider-label">조회 날짜</span>
                <span className="market-date-slider-value">
                  {marketHistory[selectedDateIndex ?? marketHistory.length - 1]?.date || ''}
                  {(selectedDateIndex === null || selectedDateIndex === marketHistory.length - 1) && (
                    <span className="market-date-latest-badge">최신</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={marketHistory.length - 1}
                value={selectedDateIndex ?? marketHistory.length - 1}
                onChange={(e) => {
                  const idx = parseInt(e.target.value)
                  setSelectedDateIndex(idx === marketHistory.length - 1 ? null : idx)
                }}
                className="market-date-slider-input"
              />
              <div className="market-date-slider-range">
                <span>{marketHistory[0]?.date}</span>
                <span>{marketHistory[marketHistory.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {marketLoading && (
            <div className="market-loading">
              <div className="market-spinner"></div>
              <p>시장 데이터를 불러오는 중...</p>
            </div>
          )}

          {marketError && (
            <div className="market-error">
              <p>데이터를 불러오는데 실패했습니다: {marketError}</p>
              <button onClick={() => { setMarketData(null); setMarketError(null); }}>
                다시 시도
              </button>
            </div>
          )}

          {selectedMarketData && (() => {
            const scores = calculateIndicatorScores(selectedMarketData, marketHistory)
            // Z-score 기반 종합 점수 계산 (50점 = 역사적 평균, 60점 = 상위 16%, 70점 = 상위 2%)
            const avgScore = Math.round(calculateZScoreBasedScore(selectedMarketData))
            const stance = determineInvestmentStance(avgScore)
            const stanceInfo = getStanceInfo(stance)

            // 핵심 지표 (가중치 > 0) vs 참고 지표 (가중치 = 0)
            const indicatorWeightsDisplay: Record<string, number> = {
              'HY Spread': 28.1,
              'VIX': 25.7,
              'Initial Claims': 23.5,
              'S&P vs 200MA': 16.3,
              'Yield Curve 10Y-2Y': 6.3,
            }
            const coreIndicators = scores.filter(s => indicatorWeightsDisplay[s.name] !== undefined)
            const refIndicators = scores.filter(s => indicatorWeightsDisplay[s.name] === undefined)

            // 순위 계산 (현재 점수가 전체/1년 중 몇 위인지)
            // Z-score 기반으로 모든 히스토리 점수 재계산하여 동일한 척도로 비교
            const allScores = marketHistory.map(h => calculateZScoreFromHistory(h)).sort((a, b) => b - a)
            const totalCount = allScores.length
            const rankInAll = allScores.filter(s => s > avgScore).length + 1

            // 최근 1년 순위
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
            const oneYearScores = marketHistory
              .filter(h => new Date(h.date) >= oneYearAgo)
              .map(h => calculateZScoreFromHistory(h))
              .sort((a, b) => b - a)
            const oneYearCount = oneYearScores.length
            const rankIn1Y = oneYearScores.filter(s => s > avgScore).length + 1

            return (
              <>
                {/* 투자 매력도 기반 자산배분 가이드 */}
                <div className="market-phase-card" style={{ borderColor: stanceInfo.color }}>
                  <div className="market-phase-header">
                    <div className="market-phase-badge" style={{ backgroundColor: stanceInfo.color }}>
                      {stanceInfo.label}
                    </div>
                    <div className="market-phase-score">
                      <span className="market-score-label">투자 매력도</span>
                      <span className="market-score-value">{avgScore}</span>
                      <span className="market-score-max">/100</span>
                    </div>
                  </div>
                  <div className="market-percentile-info">
                    <span className="market-percentile-item">
                      1년 내 {rankIn1Y}위 / {oneYearCount}건
                    </span>
                    <span className="market-percentile-divider">|</span>
                    <span className="market-percentile-item">
                      10년 내 {rankInAll}위 / {totalCount}건
                    </span>
                  </div>

                  {/* 표준정규분포 곡선 */}
                  {(() => {
                    // 실제 분포 기반 Z-score 계산
                    // 30년 데이터 분석 결과: 평균 = 50점, 표준편차 = 7점
                    const actualMean = 50
                    const actualStdDev = 7 // 실제 분포의 표준편차
                    const currentZScore = (avgScore - actualMean) / actualStdDev

                    // 표준정규분포 PDF: f(z) = (1/sqrt(2*pi)) * e^(-z^2/2)
                    const normalPDF = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)

                    // -3 ~ +3 범위에서 곡선 점 생성 (60개 점)
                    const points = 60
                    const zMin = -3
                    const zMax = 3
                    const step = (zMax - zMin) / points

                    // SVG path 생성 - 크기 확대
                    const width = 360
                    const height = 100
                    const topPadding = 30 // 상단 여백 (점수 라벨용)
                    const maxPDF = normalPDF(0) // z=0일 때 최대값

                    let pathD = ''
                    for (let i = 0; i <= points; i++) {
                      const z = zMin + i * step
                      const x = (i / points) * width
                      const y = topPadding + height - (normalPDF(z) / maxPDF) * (height - 10)
                      pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
                    }

                    // 현재 위치 (Z-score -> x 좌표)
                    const clampedZ = Math.max(zMin, Math.min(zMax, currentZScore))
                    const currentX = ((clampedZ - zMin) / (zMax - zMin)) * width
                    const currentY = topPadding + height - (normalPDF(clampedZ) / maxPDF) * (height - 10)

                    // 누적 확률 (CDF 근사) - 현재 Z-score 기준 상위/하위 몇 %인지
                    const cdf = (z: number) => {
                      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
                      const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
                      const sign = z < 0 ? -1 : 1
                      const absZ = Math.abs(z)
                      const t = 1 / (1 + p * absZ)
                      const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2)
                      return 0.5 * (1 + sign * y)
                    }
                    const cdfValue = cdf(currentZScore)
                    // 점수가 높을수록 좋으므로: 상위 = 1-CDF, 하위 = CDF
                    const isAboveMedian = currentZScore >= 0
                    const percentileLabel = isAboveMedian
                      ? `상위 ${Math.round((1 - cdfValue) * 100)}%`
                      : `하위 ${Math.round(cdfValue * 100)}%`

                    // stance 경계 Z값들 (점수 -> Z-score 변환, 실제 std=7 기준)
                    // 65점 -> Z=2.14, 57점 -> Z=1.0, 50점 -> Z=0, 43점 -> Z=-1.0, 35점 -> Z=-2.14
                    const stanceBoundaries = [
                      { z: (65 - actualMean) / actualStdDev, label: '65' },  // Z=2.14
                      { z: (57 - actualMean) / actualStdDev, label: '57' },  // Z=1.0
                      { z: 0, label: '50' },                                  // Z=0
                      { z: (43 - actualMean) / actualStdDev, label: '43' },  // Z=-1.0
                      { z: (35 - actualMean) / actualStdDev, label: '35' },  // Z=-2.14
                    ]

                    return (
                      <div className="market-distribution">
                        <div className="market-distribution-header">
                          <span className="market-distribution-title">역사적 분포 내 위치</span>
                          <span className="market-distribution-stats">
                            Z = {currentZScore >= 0 ? '+' : ''}{currentZScore.toFixed(2)} ({percentileLabel})
                          </span>
                        </div>
                        <div className="market-normal-curve">
                          <svg viewBox={`0 0 ${width} ${topPadding + height + 35}`} preserveAspectRatio="xMidYMid meet">
                            {/* 곡선 아래 영역 (현재 위치까지 채우기) */}
                            <defs>
                              <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                              </linearGradient>
                            </defs>
                            <path
                              d={`${pathD} L ${width} ${topPadding + height} L 0 ${topPadding + height} Z`}
                              fill="url(#curveGradient)"
                            />
                            {/* 곡선 */}
                            <path d={pathD} fill="none" stroke="#94a3b8" strokeWidth="2" />

                            {/* Stance 경계선들 */}
                            {stanceBoundaries.map(({ z, label }) => {
                              const x = ((z - zMin) / (zMax - zMin)) * width
                              const lineY = topPadding + height - (normalPDF(z) / maxPDF) * (height - 10)
                              return (
                                <g key={z}>
                                  <line
                                    x1={x}
                                    y1={lineY}
                                    x2={x}
                                    y2={topPadding + height}
                                    stroke="#cbd5e1"
                                    strokeWidth="1"
                                    strokeDasharray="2,2"
                                  />
                                  {/* 점수 라벨 (상단) */}
                                  <text
                                    x={x}
                                    y={topPadding - 8}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fill="#64748b"
                                  >
                                    {label}점
                                  </text>
                                </g>
                              )
                            })}

                            {/* 현재 위치 수직선 */}
                            <line
                              x1={currentX}
                              y1={currentY}
                              x2={currentX}
                              y2={topPadding + height}
                              stroke="#3b82f6"
                              strokeWidth="2.5"
                              strokeDasharray="4,2"
                            />
                            {/* 현재 위치 점 */}
                            <circle cx={currentX} cy={currentY} r="6" fill="#3b82f6" />
                            {/* 현재 점수 라벨 */}
                            <text
                              x={currentX}
                              y={currentY - 12}
                              textAnchor="middle"
                              fontSize="12"
                              fontWeight="600"
                              fill="#3b82f6"
                            >
                              {avgScore}점
                            </text>

                            {/* X축: Z-score 라벨 */}
                            {[-3, -2, -1, 0, 1, 2, 3].map((z) => {
                              const x = ((z - zMin) / (zMax - zMin)) * width
                              return (
                                <text
                                  key={z}
                                  x={x}
                                  y={topPadding + height + 14}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#94a3b8"
                                >
                                  {z === 0 ? '0' : z > 0 ? `+${z}` : z}
                                </text>
                              )
                            })}

                            {/* X축: stance 경계 Z값 라벨 (작은 글씨) */}
                            {stanceBoundaries.filter(b => b.z !== 0).map(({ z }) => {
                              const x = ((z - zMin) / (zMax - zMin)) * width
                              const zLabel = z.toFixed(1)
                              return (
                                <text
                                  key={`z-${z}`}
                                  x={x}
                                  y={topPadding + height + 26}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fill="#94a3b8"
                                >
                                  z={z > 0 ? `+${zLabel}` : zLabel}
                                </text>
                              )
                            })}
                          </svg>
                        </div>
                        <div className="market-distribution-legend">
                          <span>평균 = 50점 (Z=0)</span>
                          <span>실제 분포 std: 약 7점</span>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="market-insight-section">
                    <div className="market-insight-box">
                      <div className="market-insight-header">
                        <span className="market-insight-icon">i</span>
                        <span className="market-insight-title">현재 시장 상황</span>
                      </div>
                      <p className="market-insight-content">{stanceInfo.description}</p>
                      {(() => {
                        const extremeComments = generateExtremeIndicatorCommentary(coreIndicators, marketHistory, indicatorWeightsDisplay)
                        if (extremeComments.length === 0) return null
                        return (
                          <div className="market-extreme-commentary">
                            {extremeComments.map((comment, idx) => (
                              <p key={idx} className="market-extreme-comment">{comment}</p>
                            ))}
                          </div>
                        )
                      })()}
                    </div>

                    <div className="market-recommendation-row">
                      <div className="market-action-box">
                        <span className="market-action-label">권장 행동</span>
                        <p className="market-action-content">{stanceInfo.action}</p>
                      </div>

                      <div className="market-allocation-box">
                        <span className="market-allocation-label-title">권장 자산배분</span>
                        <div className="market-allocation-bars">
                          <div className="market-allocation-bar-item">
                            <div className="market-allocation-bar-header">
                              <span>주식</span>
                              <span>{stanceInfo.allocation.stocks}</span>
                            </div>
                            <div className="market-allocation-bar-track">
                              <div
                                className="market-allocation-bar-fill stocks"
                                style={{ width: `${parseInt(stanceInfo.allocation.stocks) || 50}%` }}
                              />
                            </div>
                          </div>
                          <div className="market-allocation-bar-item">
                            <div className="market-allocation-bar-header">
                              <span>채권</span>
                              <span>{stanceInfo.allocation.bonds}</span>
                            </div>
                            <div className="market-allocation-bar-track">
                              <div
                                className="market-allocation-bar-fill bonds"
                                style={{ width: `${parseInt(stanceInfo.allocation.bonds) || 30}%` }}
                              />
                            </div>
                          </div>
                          <div className="market-allocation-bar-item">
                            <div className="market-allocation-bar-header">
                              <span>현금</span>
                              <span>{stanceInfo.allocation.cash}</span>
                            </div>
                            <div className="market-allocation-bar-track">
                              <div
                                className="market-allocation-bar-fill cash"
                                style={{ width: `${parseInt(stanceInfo.allocation.cash) || 10}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4주/12주/5년 후 확률 */}
                    {(() => {
                      const prob = getStanceProbability(stance)
                      return (
                        <div className="market-probability-box">
                          <span className="market-probability-title">지금 투자하면? (2020~2026 백테스트 기준)</span>
                          <div className="market-probability-grid">
                            <div className="market-probability-period">
                              <span className="market-probability-label">4주 후</span>
                              <div className="market-probability-bars">
                                <div className="market-probability-bar-row">
                                  <span className="market-probability-direction up">상승</span>
                                  <div className="market-probability-bar-track">
                                    <div
                                      className="market-probability-bar-fill up"
                                      style={{ width: `${prob.week4.up}%` }}
                                    />
                                  </div>
                                  <span className="market-probability-value">{prob.week4.up}%</span>
                                  <span className="market-probability-avg">(+{prob.week4.avgUp.toFixed(1)}%)</span>
                                </div>
                                <div className="market-probability-bar-row">
                                  <span className="market-probability-direction down">하락</span>
                                  <div className="market-probability-bar-track">
                                    <div
                                      className="market-probability-bar-fill down"
                                      style={{ width: `${prob.week4.down}%` }}
                                    />
                                  </div>
                                  <span className="market-probability-value">{prob.week4.down}%</span>
                                  <span className="market-probability-avg">({prob.week4.avgDown.toFixed(1)}%)</span>
                                </div>
                              </div>
                            </div>
                            <div className="market-probability-period">
                              <span className="market-probability-label">12주 후</span>
                              <div className="market-probability-bars">
                                <div className="market-probability-bar-row">
                                  <span className="market-probability-direction up">상승</span>
                                  <div className="market-probability-bar-track">
                                    <div
                                      className="market-probability-bar-fill up"
                                      style={{ width: `${prob.week12.up}%` }}
                                    />
                                  </div>
                                  <span className="market-probability-value">{prob.week12.up}%</span>
                                  <span className="market-probability-avg">(+{prob.week12.avgUp.toFixed(1)}%)</span>
                                </div>
                                <div className="market-probability-bar-row">
                                  <span className="market-probability-direction down">하락</span>
                                  <div className="market-probability-bar-track">
                                    <div
                                      className="market-probability-bar-fill down"
                                      style={{ width: `${prob.week12.down}%` }}
                                    />
                                  </div>
                                  <span className="market-probability-value">{prob.week12.down}%</span>
                                  <span className="market-probability-avg">({prob.week12.avgDown.toFixed(1)}%)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* 종합 점수 추이 차트 (+ S&P500) */}
                {marketHistory.length > 0 && (() => {
                  // 선택된 기간에 따라 데이터 필터링
                  const periodDays = {
                    '1y': 365,
                    '3y': 365 * 3,
                    '5y': 365 * 5,
                    '10y': 365 * 10,
                  }
                  const cutoffDate = new Date()
                  cutoffDate.setDate(cutoffDate.getDate() - periodDays[chartPeriod])
                  const filteredHistory = marketHistory.filter(
                    (d) => new Date(d.date) >= cutoffDate
                  )

                  // Y축 범위 동적 계산 (투자 매력도)
                  const compositeScores = filteredHistory.map((d) => d.composite_score)
                  const minScore = Math.min(...compositeScores)
                  const maxScore = Math.max(...compositeScores)
                  const padding = (maxScore - minScore) * 0.2
                  const yMin = Math.max(0, Math.floor((minScore - padding) / 5) * 5)
                  const yMax = Math.min(100, Math.ceil((maxScore + padding) / 5) * 5)

                  // S&P500 데이터
                  const spyPrices = filteredHistory.map((d) => d.spy_price)
                  const validSpyPrices = spyPrices.filter((p): p is number => p !== null)
                  const hasSpyData = validSpyPrices.length > 0

                  // S&P500 Y축 범위
                  const spyMin = hasSpyData ? Math.min(...validSpyPrices) : 0
                  const spyMax = hasSpyData ? Math.max(...validSpyPrices) : 100
                  const spyPadding = (spyMax - spyMin) * 0.1
                  const spyYMin = Math.floor((spyMin - spyPadding) / 10) * 10
                  const spyYMax = Math.ceil((spyMax + spyPadding) / 10) * 10

                  const periodLabels = { '1y': '1년', '3y': '3년', '5y': '5년', '10y': '10년' }

                  // 구간별 정보 (실제 수익률 기반)
                  const stanceRanges: { stance: InvestmentStance; label: string; min: number; max: number; color: string }[] = [
                    { stance: 'aggressive_plus', label: '매수 적기', min: 60, max: 100, color: '#059669' },
                    { stance: 'aggressive', label: '매수 우위', min: 55, max: 60, color: '#16a34a' },
                    { stance: 'moderate_aggressive', label: '소폭 매수', min: 50, max: 55, color: '#22c55e' },
                    { stance: 'neutral', label: '중립', min: 45, max: 50, color: '#f59e0b' },
                    { stance: 'moderate_defensive', label: '소폭 방어', min: 41, max: 45, color: '#f97316' },
                    { stance: 'defensive', label: '방어 우위', min: 0, max: 41, color: '#ef4444' },
                  ]

                  return (
                    <div className="market-history-chart">
                      <div className="market-chart-header">
                        <h3 className="market-chart-title">투자 매력도 vs S&P500 추이</h3>
                        <div className="market-period-selector">
                          {(['1y', '3y', '5y', '10y'] as const).map((period) => (
                            <button
                              key={period}
                              className={`market-period-btn ${chartPeriod === period ? 'active' : ''}`}
                              onClick={() => setChartPeriod(period)}
                            >
                              {periodLabels[period]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="market-stance-filter">
                        <button
                          className={`market-stance-btn ${highlightStance === null ? 'active' : ''}`}
                          onClick={() => setHighlightStance(null)}
                        >
                          전체
                        </button>
                        {stanceRanges.map(({ stance, label, color }) => (
                          <button
                            key={stance}
                            className={`market-stance-btn ${highlightStance === stance ? 'active' : ''}`}
                            style={{
                              '--stance-color': color,
                              borderColor: highlightStance === stance ? color : undefined,
                              background: highlightStance === stance ? `${color}15` : undefined,
                            } as React.CSSProperties}
                            onClick={() => setHighlightStance(highlightStance === stance ? null : stance)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="market-chart-range">
                        매력도: {Math.round(minScore)} ~ {Math.round(maxScore)}점
                        {hasSpyData && ` | S&P500: $${Math.round(spyMin)} ~ $${Math.round(spyMax)}`}
                      </p>
                      <div className="market-chart-container">
                        {(() => {
                          // 선택된 구간에 따른 하이라이트 처리
                          const selectedRange = highlightStance
                            ? stanceRanges.find(r => r.stance === highlightStance)
                            : null

                          // 선택된 구간에 해당하는 포인트 강조
                          const pointColors = selectedRange
                            ? compositeScores.map(score =>
                                score >= selectedRange.min && score < selectedRange.max
                                  ? selectedRange.color
                                  : 'transparent'
                              )
                            : compositeScores.map(() => 'transparent')

                          const pointRadii = selectedRange
                            ? compositeScores.map(score =>
                                score >= selectedRange.min && score < selectedRange.max ? 3 : 0
                              )
                            : compositeScores.map(() => 0)

                          return (
                            <Line
                              data={{
                                labels: filteredHistory.map((d) => {
                                  const date = new Date(d.date)
                                  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`
                                }),
                                datasets: [
                                  {
                                    label: '투자 매력도',
                                    data: compositeScores,
                                    borderColor: highlightStance ? '#cbd5e1' : '#3b82f6',
                                    backgroundColor: highlightStance ? 'rgba(203, 213, 225, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                    fill: true,
                                    tension: 0.3,
                                    pointRadius: pointRadii,
                                    pointBackgroundColor: pointColors,
                                    pointBorderColor: pointColors,
                                    pointHoverRadius: 4,
                                    yAxisID: 'y',
                                  },
                                  // 선택된 구간 데이터만 강조하는 별도 라인
                                  ...(selectedRange ? [{
                                    label: selectedRange.label,
                                    data: compositeScores.map(score =>
                                      score >= selectedRange.min && score < selectedRange.max ? score : null
                                    ),
                                    borderColor: selectedRange.color,
                                    backgroundColor: `${selectedRange.color}20`,
                                    fill: false,
                                    tension: 0.3,
                                    pointRadius: 2,
                                    pointBackgroundColor: selectedRange.color,
                                    spanGaps: false,
                                    yAxisID: 'y',
                                  }] : []),
                                  ...(hasSpyData ? [{
                                    label: 'S&P500',
                                    data: spyPrices,
                                    borderColor: highlightStance ? '#d1d5db' : '#10b981',
                                    backgroundColor: 'transparent',
                                    borderWidth: 2,
                                    fill: false,
                                    tension: 0.3,
                                    pointRadius: 0,
                                    pointHoverRadius: 4,
                                    yAxisID: 'y1',
                                  }] : []),
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
                                    display: hasSpyData || !!highlightStance,
                                    position: 'top',
                                    labels: { font: { size: 10 }, boxWidth: 12 },
                                  },
                                  tooltip: {
                                    callbacks: {
                                      title: (items) => {
                                        const idx = items[0].dataIndex
                                        return filteredHistory[idx]?.date || ''
                                      },
                                      label: (context) => {
                                        const value = context.parsed.y
                                        if (context.dataset.label === 'S&P500') {
                                          return `S&P500: $${value?.toFixed(2) || '-'}`
                                        }
                                        if (value === null) return ''
                                        return `매력도: ${value?.toFixed(1) || '-'}점`
                                      },
                                    },
                                  },
                                },
                                scales: {
                                  x: {
                                    ticks: { maxTicksLimit: 12, font: { size: 10 } },
                                    grid: { display: false },
                                  },
                                  y: {
                                    type: 'linear',
                                    display: true,
                                    position: 'left',
                                    min: yMin,
                                    max: yMax,
                                    ticks: { stepSize: 5, font: { size: 10 }, color: '#3b82f6' },
                                    grid: { color: '#f1f5f9' },
                                    title: { display: true, text: '매력도', font: { size: 10 }, color: '#3b82f6' },
                                  },
                                  ...(hasSpyData ? {
                                    y1: {
                                      type: 'linear' as const,
                                      display: true,
                                      position: 'right' as const,
                                      min: spyYMin,
                                      max: spyYMax,
                                      ticks: { font: { size: 10 }, color: '#10b981' },
                                      grid: { drawOnChartArea: false },
                                      title: { display: true, text: 'S&P500', font: { size: 10 }, color: '#10b981' },
                                    },
                                  } : {}),
                                },
                              }}
                            />
                          )
                        })()}
                      </div>
                    </div>
                  )
                })()}

                {/* 지표별 상세 - 핵심 지표 / 참고 지표 */}
                <div className="market-indicators">
                  {/* 핵심 지표 (가중치 반영) */}
                  <div className="market-category">
                    <div className="market-category-header">
                      <h3 className="market-category-title">핵심 지표</h3>
                      <span className="market-category-subtitle">10년 상관분석 기반 가중 반영</span>
                    </div>
                    <div className="market-category-items">
                      {coreIndicators
                        .sort((a, b) => (indicatorWeightsDisplay[b.name] || 0) - (indicatorWeightsDisplay[a.name] || 0))
                        .map((item) => {
                          const scoreColor = item.score >= 60 ? '#22c55e' : item.score >= 40 ? '#f59e0b' : '#ef4444'
                          const rangePosition = ((item.rawValue - item.min) / (item.max - item.min)) * 100
                          const clampedPosition = Math.max(0, Math.min(100, rangePosition))
                          const isExpanded = expandedIndicator === item.name
                          const historyField = indicatorToHistoryField[item.name]
                          const weight = indicatorWeightsDisplay[item.name] || 0

                          const indicatorHistory = historyField ? marketHistory
                            .filter(h => h[historyField] !== null)
                            .map(h => ({
                              date: h.date,
                              value: h[historyField] as number,
                            })) : []

                          return (
                            <div key={item.name} className={`market-indicator-row ${isExpanded ? 'expanded' : ''}`}>
                              <div
                                className="market-indicator-header"
                                onClick={() => setExpandedIndicator(isExpanded ? null : item.name)}
                                style={{ cursor: 'pointer' }}
                              >
                                <span className="market-indicator-name">
                                  <span className="market-indicator-toggle">{isExpanded ? '-' : '+'}</span>
                                  {item.name} ({indicatorKoreanName[item.name]})
                                  <span className="market-indicator-weight">{weight.toFixed(1)}%</span>
                                </span>
                                <span className="market-indicator-score" style={{ color: scoreColor }}>{Math.round(item.score)}점</span>
                              </div>
                              <div className="market-indicator-progress">
                                <div className="market-indicator-bar">
                                  <div
                                    className="market-indicator-fill"
                                    style={{
                                      width: `${clampedPosition}%`,
                                      backgroundColor: scoreColor,
                                    }}
                                  />
                                  <span
                                    className="market-indicator-marker"
                                    style={{ left: `${clampedPosition}%` }}
                                  >
                                    {item.value}
                                  </span>
                                </div>
                              </div>
                              <div className="market-indicator-meta">
                                <span className="market-indicator-range">{item.range}</span>
                                <span className="market-indicator-desc">{item.description}</span>
                              </div>

                              {isExpanded && indicatorHistory.length > 0 && (() => {
                                const values = indicatorHistory.map(h => h.value)
                                const minVal = Math.min(...values)
                                const maxVal = Math.max(...values)
                                const padding = (maxVal - minVal) * 0.1 || 1
                                // Fear & Greed만 0-100 고정 범위 적용
                                const yMin = item.name === 'Fear & Greed' ? Math.max(0, minVal - padding) : minVal - padding
                                const yMax = item.name === 'Fear & Greed' ? Math.min(100, maxVal + padding) : maxVal + padding

                                return (
                                  <div className="market-indicator-chart">
                                    <Line
                                      data={{
                                        labels: indicatorHistory.map(h => {
                                          const d = new Date(h.date)
                                          return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
                                        }),
                                        datasets: [{
                                          label: item.name,
                                          data: values,
                                          borderColor: scoreColor,
                                          backgroundColor: `${scoreColor}20`,
                                          fill: true,
                                          tension: 0.3,
                                          pointRadius: 0,
                                          pointHoverRadius: 4,
                                        }],
                                      }}
                                      options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                          legend: { display: false },
                                          tooltip: {
                                            callbacks: {
                                              title: (items) => {
                                                const idx = items[0].dataIndex
                                                return indicatorHistory[idx]?.date || ''
                                              },
                                              label: (context) => {
                                                const val = context.parsed.y
                                                if (val === null || val === undefined) return ''
                                                if (item.name === 'Initial Claims') {
                                                  return `${(val / 1000).toFixed(0)}K`
                                                }
                                                return val.toFixed(2)
                                              },
                                            },
                                          },
                                        },
                                        scales: {
                                          x: {
                                            ticks: { maxTicksLimit: 8, font: { size: 9 } },
                                            grid: { display: false },
                                          },
                                          y: {
                                            min: yMin,
                                            max: yMax,
                                            ticks: { font: { size: 9 } },
                                            grid: { color: '#f1f5f9' },
                                          },
                                        },
                                      }}
                                    />
                                  </div>
                                )
                              })()}
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* 참고 지표 (점수에 미반영) */}
                  <div className="market-category market-category-ref">
                    <div className="market-category-header">
                      <h3 className="market-category-title">참고 지표</h3>
                      <span className="market-category-subtitle">점수에 미반영 (음수/무상관)</span>
                    </div>
                    <div className="market-category-items">
                      {refIndicators.map((item) => {
                        const grayColor = '#94a3b8' // 접힌 상태 회색
                        const activeColor = item.score >= 60 ? '#22c55e' : item.score >= 40 ? '#f59e0b' : '#ef4444' // 펼친 상태 점수별 색상
                        const rangePosition = ((item.rawValue - item.min) / (item.max - item.min)) * 100
                        const clampedPosition = Math.max(0, Math.min(100, rangePosition))
                        const isExpanded = expandedIndicator === item.name
                        const historyField = indicatorToHistoryField[item.name]
                        const displayColor = isExpanded ? activeColor : grayColor

                        const indicatorHistory = historyField ? marketHistory
                          .filter(h => h[historyField] !== null)
                          .map(h => ({
                            date: h.date,
                            value: h[historyField] as number,
                          })) : []

                        return (
                          <div key={item.name} className={`market-indicator-row market-indicator-ref ${isExpanded ? 'expanded' : ''}`}>
                            <div
                              className="market-indicator-header"
                              onClick={() => setExpandedIndicator(isExpanded ? null : item.name)}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className="market-indicator-name">
                                <span className="market-indicator-toggle">{isExpanded ? '-' : '+'}</span>
                                {item.name} ({indicatorKoreanName[item.name]})
                              </span>
                              <span className="market-indicator-score" style={{ color: displayColor }}>{Math.round(item.score)}점</span>
                            </div>
                            <div className="market-indicator-progress">
                              <div className="market-indicator-bar">
                                <div
                                  className="market-indicator-fill"
                                  style={{
                                    width: `${clampedPosition}%`,
                                    backgroundColor: displayColor,
                                  }}
                                />
                                <span
                                  className="market-indicator-marker"
                                  style={{ left: `${clampedPosition}%` }}
                                >
                                  {item.value}
                                </span>
                              </div>
                            </div>
                            <div className="market-indicator-meta">
                              <span className="market-indicator-range">{item.range}</span>
                              <span className="market-indicator-desc">{item.description}</span>
                            </div>

                            {isExpanded && indicatorHistory.length > 0 && (() => {
                              const values = indicatorHistory.map(h => h.value)
                              const minVal = Math.min(...values)
                              const maxVal = Math.max(...values)
                              const padding = (maxVal - minVal) * 0.1 || 1
                              // Fear & Greed만 0-100 고정 범위 적용
                              const yMin = item.name === 'Fear & Greed' ? Math.max(0, minVal - padding) : minVal - padding
                              const yMax = item.name === 'Fear & Greed' ? Math.min(100, maxVal + padding) : maxVal + padding

                              return (
                                <div className="market-indicator-chart">
                                  <Line
                                    data={{
                                      labels: indicatorHistory.map(h => {
                                        const d = new Date(h.date)
                                        return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
                                      }),
                                      datasets: [{
                                        label: item.name,
                                        data: values,
                                        borderColor: activeColor,
                                        backgroundColor: `${activeColor}20`,
                                        fill: true,
                                        tension: 0.3,
                                        pointRadius: 0,
                                        pointHoverRadius: 4,
                                      }],
                                    }}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                          callbacks: {
                                            title: (items) => {
                                              const idx = items[0].dataIndex
                                              return indicatorHistory[idx]?.date || ''
                                            },
                                            label: (context) => {
                                              const val = context.parsed.y
                                              if (val === null || val === undefined) return ''
                                              if (item.name === 'Initial Claims') {
                                                return `${(val / 1000).toFixed(0)}K`
                                              }
                                              return val.toFixed(2)
                                            },
                                          },
                                        },
                                      },
                                      scales: {
                                        x: {
                                          ticks: { maxTicksLimit: 8, font: { size: 9 } },
                                          grid: { display: false },
                                        },
                                        y: {
                                          min: yMin,
                                          max: yMax,
                                          ticks: { font: { size: 9 } },
                                          grid: { color: '#f1f5f9' },
                                        },
                                      },
                                    }}
                                  />
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>


                <div className="market-footer">
                  <p>마지막 업데이트: {new Date(selectedMarketData.lastUpdated).toLocaleString('ko-KR')}</p>
                  <p className="market-disclaimer">* 본 자료는 참고용이며, 투자 판단의 책임은 본인에게 있습니다.</p>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* 백테스트 탭 */}
      {activeTab === 'backtest' && (
        <div className="calc-section">
          <h2 className="calc-section-title">투자 전략 백테스트</h2>
          <p className="calc-section-desc">투자 매력도 기반 전략의 과거 성과를 시뮬레이션합니다</p>

          {/* 전략 설정 */}
          <div className="backtest-settings">
            <div className="backtest-setting-group">
              <label>전략 선택</label>
              <div className="backtest-strategy-buttons">
                <button
                  className={`backtest-strategy-btn ${backtestStrategy === 'dynamic_allocation' ? 'active' : ''}`}
                  onClick={() => setBacktestStrategy('dynamic_allocation')}
                >
                  동적 배분
                </button>
                <button
                  className={`backtest-strategy-btn ${backtestStrategy === 'dca_enhanced' ? 'active' : ''}`}
                  onClick={() => setBacktestStrategy('dca_enhanced')}
                >
                  DCA 강화
                </button>
                <button
                  className={`backtest-strategy-btn ${backtestStrategy === 'portfolio_simple' ? 'active' : ''}`}
                  onClick={() => setBacktestStrategy('portfolio_simple')}
                >
                  포트폴리오 (단순)
                </button>
                <button
                  className={`backtest-strategy-btn ${backtestStrategy === 'portfolio_segmented' ? 'active' : ''}`}
                  onClick={() => setBacktestStrategy('portfolio_segmented')}
                >
                  포트폴리오 (세분화)
                </button>
              </div>
            </div>

            <div className="backtest-setting-group">
              <label>테스트 기간</label>
              <div className="backtest-period-buttons">
                {(['3y', '5y', '10y'] as const).map((period) => (
                  <button
                    key={period}
                    className={`backtest-period-btn ${backtestPeriod === period ? 'active' : ''}`}
                    onClick={() => setBacktestPeriod(period)}
                  >
                    {{ '3y': '3년', '5y': '5년', '10y': '10년' }[period]}
                  </button>
                ))}
              </div>
            </div>

            {/* 투자 자산 선택 - 동적 배분, DCA 강화만 해당 */}
            {(backtestStrategy === 'dynamic_allocation' || backtestStrategy === 'dca_enhanced') && (
              <div className="backtest-setting-group">
                <label>투자 자산</label>
                <div className="backtest-period-buttons">
                  <button
                    className={`backtest-period-btn ${backtestAsset === 'SPY' ? 'active' : ''}`}
                    onClick={() => setBacktestAsset('SPY')}
                  >
                    SPY (S&P 500)
                  </button>
                  <button
                    className={`backtest-period-btn ${backtestAsset === 'QQQ' ? 'active' : ''}`}
                    onClick={() => setBacktestAsset('QQQ')}
                  >
                    QQQ (NASDAQ)
                  </button>
                </div>
              </div>
            )}

            <button
              className="backtest-run-btn"
              onClick={() => {
                setBacktestLoading(true)
                // 데이터 로드 후 백테스트 실행
                const loadAndRun = async () => {
                  try {
                    const startDate = new Date()
                    startDate.setFullYear(startDate.getFullYear() - 10)

                    const { data: historyData } = await supabase
                      .from('market_indicators_history')
                      .select('*')
                      .gte('date', startDate.toISOString().split('T')[0])
                      .order('date', { ascending: true })

                    if (historyData) {
                      const result = runBacktest(historyData)
                      setBacktestResult(result)
                    }
                  } finally {
                    setBacktestLoading(false)
                  }
                }
                loadAndRun()
              }}
              disabled={backtestLoading}
            >
              {backtestLoading ? '분석 중...' : '백테스트 실행'}
            </button>
          </div>

          {/* 전략 설명 */}
          <div className="backtest-strategy-desc">
            {backtestStrategy === 'dynamic_allocation' && (
              <p>V자 반등 + 절대 점수 기반 전략. 최근 4주 저점 대비 20% 이상 반등 시 적극 매수(95%), 절대 점수 35점 이하 시 방어(40%), 50점 이상 시 고비중(85%) 유지. 상대적 하락은 무시하고 절대 수치로만 매도 판단.</p>
            )}
            {backtestStrategy === 'dca_enhanced' && (
              <p>매주 기본 적립 + 급등 감지 시 2배 투자. 최근 12주(3개월) 저점 대비 지표가 20% 이상 급등하면 다음 주 적립금을 2배로 늘려 시장 회복기에 적극 매수합니다.</p>
            )}
            {backtestStrategy === 'portfolio_simple' && (
              <p>QQQ+SCHD/현금 비율을 매력도에 따라 조절합니다. 50점+(상위 10%): 주식 80%, 44점+: 70%, 35-44점: 60%, 35점-: 50%. 분기별 리밸런싱, 현금은 3개월 국채 금리 적용.</p>
            )}
            {backtestStrategy === 'portfolio_segmented' && (
              <p>QQQ/SCHD/GLD/현금 4자산을 매력도에 따라 배분합니다. 50점+(상위 10%): QQQ 50%/현금 20%, 35점(중앙): QQQ 30%/현금 35%, 31점-(하위 10%): QQQ 10%/현금 50%. 분기별 리밸런싱.</p>
            )}
          </div>

          {/* 투자금 설정 */}
          {backtestStrategy === 'dynamic_allocation' && (
            <div className="backtest-dca-settings">
              <div className="backtest-dca-input-group">
                <label>초기 투자금 (일시 투자)</label>
                <div className="backtest-dca-input-wrapper">
                  <span className="backtest-dca-currency">$</span>
                  <input
                    type="number"
                    value={backtestInitialCash}
                    onChange={(e) => setBacktestInitialCash(Math.max(100, Number(e.target.value)))}
                    min={100}
                    step={1000}
                  />
                </div>
                <span className="backtest-dca-hint">최소 $100</span>
              </div>
            </div>
          )}

          {/* DCA/포트폴리오 투자금 설정 */}
          {(backtestStrategy === 'dca_enhanced' || backtestStrategy === 'portfolio_simple' || backtestStrategy === 'portfolio_segmented') && (
            <div className="backtest-dca-settings">
              <div className="backtest-dca-input-group">
                <label>초기 투자금</label>
                <div className="backtest-dca-input-wrapper">
                  <span className="backtest-dca-currency">$</span>
                  <input
                    type="number"
                    value={backtestInitialCash}
                    onChange={(e) => setBacktestInitialCash(Math.max(0, Number(e.target.value)))}
                    min={0}
                    step={1000}
                  />
                </div>
                <span className="backtest-dca-hint">0이면 순수 적립식</span>
              </div>
              <div className="backtest-dca-input-group">
                <label>주간 기본 투자금</label>
                <div className="backtest-dca-input-wrapper">
                  <span className="backtest-dca-currency">$</span>
                  <input
                    type="number"
                    value={backtestWeeklyAmount}
                    onChange={(e) => setBacktestWeeklyAmount(Math.max(0, Number(e.target.value)))}
                    min={0}
                    step={10}
                  />
                </div>
                <span className="backtest-dca-hint">{backtestStrategy === 'dca_enhanced' ? '급등 감지 시 2배 투자' : '매주 고정 투자'}</span>
              </div>
              {backtestStrategy === 'dca_enhanced' && (
                <div className="backtest-dca-input-group backtest-dca-checkbox-group">
                  <label className="backtest-dca-checkbox-label">
                    <input
                      type="checkbox"
                      checked={backtestSameInvestment}
                      onChange={(e) => setBacktestSameInvestment(e.target.checked)}
                    />
                    <span>동일 투자금 모드</span>
                  </label>
                  <span className="backtest-dca-hint">벤치마크도 전략과 동일한 금액 투자</span>
                </div>
              )}
            </div>
          )}

          {/* 백테스트 결과 */}
          {backtestResult && (
            <div className="backtest-results">
              {/* 금액 요약 */}
              <div className="backtest-summary">
                <h3>투자 결과 요약</h3>
                <div className="backtest-summary-grid">
                  <div className="backtest-summary-card strategy">
                    <span className="backtest-summary-label">전략 투자금 / 평가금</span>
                    <span className="backtest-summary-value">
                      ${backtestResult.metrics.finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="backtest-summary-invested">
                      투자: ${backtestResult.metrics.totalInvested.toLocaleString()}
                    </span>
                    <span className={`backtest-summary-profit ${backtestResult.metrics.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                      {backtestResult.metrics.totalProfit >= 0 ? '+' : ''}${backtestResult.metrics.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="backtest-summary-card benchmark">
                    <span className="backtest-summary-label">{(backtestStrategy === 'portfolio_simple' || backtestStrategy === 'portfolio_segmented') ? 'SPY DCA' : backtestStrategy === 'dca_enhanced' ? `${backtestAsset} DCA` : backtestAsset} 투자금 / 평가금</span>
                    <span className="backtest-summary-value">
                      ${backtestResult.metrics.spyFinalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="backtest-summary-invested">
                      투자: ${backtestResult.metrics.spyTotalInvested.toLocaleString()}
                    </span>
                    <span className={`backtest-summary-profit ${backtestResult.metrics.spyTotalProfit >= 0 ? 'positive' : 'negative'}`}>
                      {backtestResult.metrics.spyTotalProfit >= 0 ? '+' : ''}${backtestResult.metrics.spyTotalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 성과 지표 */}
              <div className="backtest-metrics">
                <h3>성과 비교</h3>
                <div className="backtest-metrics-grid">
                  <div className="backtest-metric-card">
                    <span className="backtest-metric-label">누적 수익률</span>
                    <span className={`backtest-metric-value ${backtestResult.metrics.totalReturn >= backtestResult.metrics.spyReturn ? 'positive' : 'negative'}`}>
                      {backtestResult.metrics.totalReturn >= 0 ? '+' : ''}{backtestResult.metrics.totalReturn.toFixed(1)}%
                    </span>
                    <span className="backtest-metric-benchmark">
                      vs {(backtestStrategy === 'portfolio_simple' || backtestStrategy === 'portfolio_segmented') ? 'SPY DCA' : backtestStrategy === 'dca_enhanced' ? `${backtestAsset} DCA` : backtestAsset}: {backtestResult.metrics.spyReturn >= 0 ? '+' : ''}{backtestResult.metrics.spyReturn.toFixed(1)}%
                    </span>
                  </div>
                  <div className="backtest-metric-card">
                    <span className="backtest-metric-label">연환산 수익률 (IRR)</span>
                    <span className={`backtest-metric-value ${backtestResult.metrics.cagr >= backtestResult.metrics.spyCagr ? 'positive' : 'negative'}`}>
                      {backtestResult.metrics.cagr >= 0 ? '+' : ''}{backtestResult.metrics.cagr.toFixed(1)}%
                    </span>
                    <span className="backtest-metric-benchmark">
                      vs {(backtestStrategy === 'portfolio_simple' || backtestStrategy === 'portfolio_segmented') ? 'SPY DCA' : backtestStrategy === 'dca_enhanced' ? `${backtestAsset} DCA` : backtestAsset}: {backtestResult.metrics.spyCagr >= 0 ? '+' : ''}{backtestResult.metrics.spyCagr.toFixed(1)}%
                    </span>
                  </div>
                  <div className="backtest-metric-card">
                    <span className="backtest-metric-label">최대 낙폭 (MDD)</span>
                    <span className={`backtest-metric-value ${backtestResult.metrics.maxDrawdown <= backtestResult.metrics.spyMaxDrawdown ? 'positive' : 'negative'}`}>
                      -{backtestResult.metrics.maxDrawdown.toFixed(1)}%
                    </span>
                    <span className="backtest-metric-benchmark">
                      vs {(backtestStrategy === 'portfolio_simple' || backtestStrategy === 'portfolio_segmented') ? 'SPY DCA' : backtestStrategy === 'dca_enhanced' ? `${backtestAsset} DCA` : backtestAsset}: -{backtestResult.metrics.spyMaxDrawdown.toFixed(1)}%
                    </span>
                  </div>
                  <div className="backtest-metric-card">
                    <span className="backtest-metric-label">샤프 비율</span>
                    <span className="backtest-metric-value">
                      {backtestResult.metrics.sharpeRatio.toFixed(2)}
                    </span>
                    <span className="backtest-metric-benchmark">
                      거래 횟수: {backtestResult.metrics.totalTrades}회
                    </span>
                  </div>
                </div>
              </div>

              {/* 포트폴리오 가치 차트 */}
              <div className="backtest-chart">
                <h3>포트폴리오 가치 추이</h3>
                <div className="backtest-chart-container">
                  <Line
                    data={{
                      labels: backtestResult.dates.filter((_, i) => i % 4 === 0).map(d => {
                        const date = new Date(d)
                        return `${date.getFullYear()}.${date.getMonth() + 1}`
                      }),
                      datasets: [
                        {
                          label: '전략',
                          data: backtestResult.portfolioValues.filter((_, i) => i % 4 === 0),
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          fill: true,
                          tension: 0.3,
                          pointRadius: 0,
                          borderWidth: 2,
                        },
                        {
                          label: (backtestStrategy === 'portfolio_simple' || backtestStrategy === 'portfolio_segmented') ? 'SPY DCA' : backtestStrategy === 'dca_enhanced' ? `${backtestAsset} DCA` : `${backtestAsset} (Buy & Hold)`,
                          data: backtestResult.spyValues.filter((_, i) => i % 4 === 0),
                          borderColor: '#94a3b8',
                          backgroundColor: 'transparent',
                          fill: false,
                          tension: 0.3,
                          pointRadius: 0,
                          borderWidth: 2,
                          borderDash: [5, 5],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: {
                        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const y = context.parsed.y ?? 0
                              return `${context.dataset.label}: $${y.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            },
                          },
                        },
                      },
                      scales: {
                        x: { ticks: { maxTicksLimit: 10, font: { size: 10 } }, grid: { display: false } },
                        y: {
                          ticks: {
                            callback: (v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                            font: { size: 10 }
                          },
                          grid: { color: '#f1f5f9' },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {/* 거래 내역 */}
              {backtestResult.trades.length > 0 && (
                <div className="backtest-trades">
                  <h3>주요 거래 내역 (최근 20건)</h3>
                  <div className="backtest-trades-list">
                    {backtestResult.trades.slice(-20).reverse().map((trade, i) => (
                      <div key={i} className={`backtest-trade-item ${trade.action}`}>
                        <span className="backtest-trade-date">{trade.date}</span>
                        <span className={`backtest-trade-action ${trade.action}`}>
                          {trade.action === 'buy' ? '매수' : '매도'}
                        </span>
                        <span className="backtest-trade-price">${trade.price.toFixed(2)}</span>
                        <span className="backtest-trade-reason">{trade.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="backtest-disclaimer">
                * 과거 성과가 미래 수익을 보장하지 않습니다. 거래 비용 및 슬리피지는 반영되지 않았습니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Gemini 채팅 패널 - 시장 환경 탭일 때만 표시 */}
      {activeTab === 'market' && selectedMarketData && createPortal(
        <div
          className={`market-chat-panel ${marketChatOpen ? 'open' : ''}`}
          onClick={() => !marketChatOpen && setMarketChatOpen(true)}
        >
          {!marketChatOpen && <span className="market-chat-toggle">AI</span>}
          <div className="market-chat-header">
            <span className="market-chat-title">Gemini</span>
            <span className="market-chat-toggle" onClick={() => setMarketChatOpen(false)}>x</span>
          </div>
          <div className="market-chat-messages" ref={marketChatRef}>
            {marketChatMessages.length === 0 && (
              <div className="market-chat-empty">
                <p>현재 시장 지표를 기반으로 질문해보세요.</p>
                <div className="market-chat-suggestions">
                  <button onClick={() => setMarketChatInput('현재 시장 상황을 요약해줘')}>
                    현재 시장 상황 요약
                  </button>
                  <button onClick={() => setMarketChatInput('지금 매수해도 될까?')}>
                    매수 타이밍 조언
                  </button>
                  <button onClick={() => setMarketChatInput('가장 주목해야 할 지표는?')}>
                    주목할 지표
                  </button>
                </div>
              </div>
            )}
            {marketChatMessages.map((msg, idx) => (
              <div key={idx} className={`market-chat-message ${msg.role}`}>
                <div className="market-chat-message-content">{msg.content}</div>
              </div>
            ))}
            {marketChatLoading && (
              <div className="market-chat-message assistant">
                <div className="market-chat-message-content loading">분석 중...</div>
              </div>
            )}
          </div>
          <form className="market-chat-input-form" onSubmit={async (e) => {
            e.preventDefault()
            if (!marketChatInput.trim() || marketChatLoading) return

            const userMessage = marketChatInput.trim()
            setMarketChatInput('')
            setMarketChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
            setMarketChatLoading(true)

            try {
              const scores = calculateIndicatorScores(selectedMarketData, marketHistory)
              const indicatorsText = scores.map(s =>
                `${s.name}: ${s.value} (${Math.round(s.score)}점)`
              ).join('\n')

              const response = await fetch('/.netlify/functions/market-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  question: userMessage,
                  marketContext: {
                    date: marketHistory[selectedDateIndex ?? marketHistory.length - 1]?.date,
                    indicators: indicatorsText,
                  },
                }),
              })

              const data = await response.json()
              setMarketChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
            } catch {
              setMarketChatMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }])
            } finally {
              setMarketChatLoading(false)
              setTimeout(() => {
                marketChatRef.current?.scrollTo({ top: marketChatRef.current.scrollHeight, behavior: 'smooth' })
              }, 100)
            }
          }}>
            <input
              type="text"
              value={marketChatInput}
              onChange={(e) => setMarketChatInput(e.target.value)}
              placeholder="시장에 대해 질문하세요..."
              disabled={marketChatLoading}
            />
            <button type="submit" disabled={marketChatLoading || !marketChatInput.trim()}>
              전송
            </button>
          </form>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Calculator
