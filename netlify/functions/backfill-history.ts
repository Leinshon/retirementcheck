import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// FRED + Yahoo Finance API로 최대 기간 데이터를 백필하는 함수
// 1996년부터 (HY Spread 데이터 시작) ~ 현재
// 한 번만 실행하면 됨: GET /.netlify/functions/backfill-history

interface FREDObservation {
  date: string
  value: string
}

interface FREDResponse {
  observations: FREDObservation[]
}

interface YahooQuote {
  date: Date
  close: number
}

// Yahoo Finance 과거 데이터 조회
async function fetchYahooHistory(symbol: string, startDate: Date): Promise<YahooQuote[]> {
  try {
    const period1 = Math.floor(startDate.getTime() / 1000)
    const period2 = Math.floor(Date.now() / 1000)

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.warn(`Yahoo Finance warning for ${symbol}: ${response.status}`)
      return []
    }

    const data = await response.json()
    const timestamps = data.chart?.result?.[0]?.timestamp || []
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []

    const quotes: YahooQuote[] = []
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null) {
        quotes.push({
          date: new Date(timestamps[i] * 1000),
          close: closes[i]
        })
      }
    }

    return quotes
  } catch (error) {
    console.warn(`Yahoo Finance error for ${symbol}:`, error)
    return []
  }
}

// 200일 이동평균 계산
function calculate200MA(quotes: YahooQuote[], targetDate: Date): number | null {
  // targetDate 이전 200일치 데이터 필요
  const targetTime = targetDate.getTime()
  const relevantQuotes = quotes.filter(q => q.date.getTime() <= targetTime)

  if (relevantQuotes.length < 200) return null

  const last200 = relevantQuotes.slice(-200)
  const sum = last200.reduce((acc, q) => acc + q.close, 0)
  return sum / 200
}

// SPY 가격 찾기
function findSPYPrice(quotes: YahooQuote[], targetDate: Date): number | null {
  const targetTime = targetDate.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  let closestQuote: YahooQuote | null = null
  let minDiff = Infinity

  for (const q of quotes) {
    const diff = Math.abs(q.date.getTime() - targetTime)
    if (diff < minDiff && diff < 7 * dayMs) {
      minDiff = diff
      closestQuote = q
    }
  }

  return closestQuote ? Math.round(closestQuote.close * 100) / 100 : null
}

// SPY 가격과 200MA 대비 % 계산
function calculateSPYvs200MA(quotes: YahooQuote[], targetDate: Date): number | null {
  const targetTime = targetDate.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  // targetDate에 가장 가까운 가격 찾기
  let closestQuote: YahooQuote | null = null
  let minDiff = Infinity

  for (const q of quotes) {
    const diff = Math.abs(q.date.getTime() - targetTime)
    if (diff < minDiff && diff < 7 * dayMs) { // 7일 이내
      minDiff = diff
      closestQuote = q
    }
  }

  if (!closestQuote) return null

  const ma200 = calculate200MA(quotes, targetDate)
  if (!ma200) return null

  return Math.round(((closestQuote.close - ma200) / ma200) * 10000) / 100
}

// VIX 값 찾기
function findVIXValue(quotes: YahooQuote[], targetDate: Date): number | null {
  const targetTime = targetDate.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  let closestQuote: YahooQuote | null = null
  let minDiff = Infinity

  for (const q of quotes) {
    const diff = Math.abs(q.date.getTime() - targetTime)
    if (diff < minDiff && diff < 7 * dayMs) {
      minDiff = diff
      closestQuote = q
    }
  }

  return closestQuote ? Math.round(closestQuote.close * 100) / 100 : null
}

// Fear & Greed Index 데이터 구조 (Alternative.me - 암호화폐 기반)
interface FearGreedData {
  value: string
  timestamp: string
}

// Alternative.me Fear & Greed API (암호화폐 기반이지만 시장 심리 대용)
// 최대 400일치만 제공 - 있는 만큼만 사용
interface FearGreedResponse {
  data: FearGreedData[]
}

async function fetchFearGreedHistory(): Promise<FearGreedData[]> {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=0&format=json') // limit=0 = 전체
    if (!response.ok) {
      console.warn(`Alternative.me API warning: ${response.status}`)
      return []
    }
    const data: FearGreedResponse = await response.json()
    return data.data || []
  } catch (error) {
    console.warn('Alternative.me API error:', error)
    return []
  }
}

// Fear & Greed 값 찾기
function findFearGreedValue(data: FearGreedData[], targetDate: Date): number | null {
  const targetTime = targetDate.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  for (const item of data) {
    const itemTime = parseInt(item.timestamp) * 1000
    const diff = Math.abs(itemTime - targetTime)
    if (diff < 2 * dayMs) { // 2일 이내
      return parseInt(item.value)
    }
  }
  return null
}

// FRED API Helper - 과거 데이터 조회
async function fetchFREDHistory(
  seriesId: string,
  apiKey: string,
  startDate: string
): Promise<FREDObservation[]> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startDate}&sort_order=asc`
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`FRED API warning for ${seriesId}: ${response.status}`)
      return []
    }
    const data: FREDResponse = await response.json()
    return data.observations.filter((obs) => obs.value !== '.')
  } catch (error) {
    console.warn(`FRED API error for ${seriesId}:`, error)
    return []
  }
}

// 점수 정규화 함수
function normalizeScore(value: number, min: number, max: number, invert = false): number {
  const clamped = Math.max(min, Math.min(max, value))
  const normalized = ((clamped - min) / (max - min)) * 100
  return invert ? 100 - normalized : normalized
}

// 종합 점수 계산 (투자 매력도 - 역발상 투자)
// 높은 점수 = 공포/저평가 = 매수 기회
function calculateCompositeScore(data: {
  fearGreed: number | null
  vix: number | null
  spyVs200ma: number | null
  buffettIndicator: number | null
  fedBalanceSheetYoY: number | null
  m2GrowthYoY: number | null
  hySpread: number | null
  yieldCurve10Y2Y: number | null
  yieldCurve10Y3M: number | null
  initialClaims: number | null
  erp: number | null
}): number {
  const categories: { [key: string]: number[] } = {
    sentiment: [],
    valuation: [],
    liquidity: [],
    credit: [],
    macro: [],
  }

  // Sentiment - 공포 = 기회 = 높은 점수
  if (data.fearGreed !== null)
    categories.sentiment.push(normalizeScore(data.fearGreed, 0, 100, true)) // 공포(0) = 높은 점수
  if (data.vix !== null)
    categories.sentiment.push(normalizeScore(data.vix, 10, 40, false)) // 높은 VIX = 공포 = 높은 점수

  // Valuation - 저평가 = 기회 = 높은 점수
  if (data.spyVs200ma !== null)
    categories.valuation.push(normalizeScore(data.spyVs200ma, -15, 15, true)) // 200MA 아래 = 높은 점수
  if (data.buffettIndicator !== null)
    categories.valuation.push(normalizeScore(data.buffettIndicator, 80, 250, true)) // 저평가 = 높은 점수
  if (data.erp !== null)
    categories.valuation.push(normalizeScore(data.erp, -2, 6)) // ERP 높을수록 주식 매력적

  // Liquidity - 긴축 중 = 향후 완화 기대 = 높은 점수
  if (data.fedBalanceSheetYoY !== null)
    categories.liquidity.push(normalizeScore(data.fedBalanceSheetYoY, -5, 15, true)) // 축소 = 높은 점수
  if (data.m2GrowthYoY !== null)
    categories.liquidity.push(normalizeScore(data.m2GrowthYoY, -5, 10, true)) // 감소 = 높은 점수

  // Credit - 높은 스프레드 = 공포 = 기회
  if (data.hySpread !== null)
    categories.credit.push(normalizeScore(data.hySpread, 2.5, 8, false)) // 높은 스프레드 = 높은 점수

  // Macro
  if (data.yieldCurve10Y2Y !== null)
    categories.macro.push(normalizeScore(data.yieldCurve10Y2Y, -1, 2))
  if (data.yieldCurve10Y3M !== null)
    categories.macro.push(normalizeScore(data.yieldCurve10Y3M, -1, 2))
  if (data.initialClaims !== null)
    categories.macro.push(normalizeScore(data.initialClaims, 200000, 400000, false)) // 높은 실업 = 바닥 = 높은 점수

  // 카테고리별 가중치: 심리 20%, 밸류 25%, 유동성 20%, 신용 15%, 경기 20%
  const categoryWeights: { [key: string]: number } = {
    sentiment: 0.20,
    valuation: 0.25,
    liquidity: 0.20,
    credit: 0.15,
    macro: 0.20,
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const [category, scores] of Object.entries(categories)) {
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      const weight = categoryWeights[category] || 0
      weightedSum += avg * weight
      totalWeight += weight
    }
  }

  if (totalWeight === 0) return 0
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

// YoY 계산 헬퍼
function findYearAgoValue(
  data: FREDObservation[],
  targetDate: string,
  weeksBack: number
): number | null {
  const target = new Date(targetDate)
  target.setDate(target.getDate() - weeksBack * 7)
  const targetStr = target.toISOString().split('T')[0]

  // 가장 가까운 날짜 찾기
  let closest: FREDObservation | null = null
  let minDiff = Infinity

  for (const obs of data) {
    const diff = Math.abs(new Date(obs.date).getTime() - new Date(targetStr).getTime())
    if (diff < minDiff) {
      minDiff = diff
      closest = obs
    }
  }

  return closest ? parseFloat(closest.value) : null
}

const handler: Handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
  }

  const FRED_API_KEY = process.env.FRED_API_KEY
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!FRED_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Missing required environment variables' }),
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1996년부터 데이터 조회 (HY Spread 데이터 시작, YoY 계산을 위해 1년 추가로 1995년부터)
    const dataStartDate = new Date('1995-01-01')
    const startDate = dataStartDate.toISOString().split('T')[0]

    console.log(`Fetching FRED, Yahoo Finance data from ${startDate} (max period backfill)...`)

    // 모든 데이터 병렬 조회 (FRED + Yahoo Finance + Alternative.me)
    const [
      gdpData, marketCapData, walclData, m2Data, hySpreadData, dgs10Data, dgs2Data, dgs3moData, icsaData,
      cpData, // Corporate Profits for ERP calculation
      vixData, spyData, fearGreedData,
      // 포트폴리오 티커 데이터
      qqqData, sgovData, gldData, schdData, vymData
    ] = await Promise.all([
      fetchFREDHistory('GDP', FRED_API_KEY, startDate),
      fetchFREDHistory('NCBCEL', FRED_API_KEY, startDate),
      fetchFREDHistory('WALCL', FRED_API_KEY, startDate), // Weekly (2002년부터)
      fetchFREDHistory('M2SL', FRED_API_KEY, startDate), // Monthly
      fetchFREDHistory('BAMLH0A0HYM2', FRED_API_KEY, startDate), // Daily (1996년부터)
      fetchFREDHistory('DGS10', FRED_API_KEY, startDate), // Daily
      fetchFREDHistory('DGS2', FRED_API_KEY, startDate), // Daily
      fetchFREDHistory('DGS3MO', FRED_API_KEY, startDate), // Daily
      fetchFREDHistory('ICSA', FRED_API_KEY, startDate), // Weekly
      fetchFREDHistory('CP', FRED_API_KEY, startDate), // Corporate Profits (Quarterly)
      fetchYahooHistory('^VIX', dataStartDate), // VIX (1990년부터)
      fetchYahooHistory('SPY', dataStartDate), // SPY (1993년부터)
      fetchFearGreedHistory(), // Fear & Greed (Alternative.me - 최대 ~400일, 있는 만큼만)
      // 포트폴리오 ETF 티커
      fetchYahooHistory('QQQ', dataStartDate), // 나스닥 100 (1999년부터)
      fetchYahooHistory('SGOV', dataStartDate), // 단기 국채 (2021년 출시)
      fetchYahooHistory('GLD', dataStartDate), // 금 (2004년부터)
      fetchYahooHistory('SCHD', dataStartDate), // 배당 성장 (2011년부터)
      fetchYahooHistory('VYM', dataStartDate), // 고배당 (2006년부터)
    ])

    console.log(
      `Data fetched: GDP=${gdpData.length}, WALCL=${walclData.length}, M2=${m2Data.length}, HY=${hySpreadData.length}, DGS10=${dgs10Data.length}, CP=${cpData.length}, VIX=${vixData.length}, SPY=${spyData.length}, FearGreed=${fearGreedData.length}`
    )
    console.log(
      `Portfolio tickers: QQQ=${qqqData.length}, SGOV=${sgovData.length}, GLD=${gldData.length}, SCHD=${schdData.length}, VYM=${vymData.length}`
    )

    // 1996년부터 날짜 생성 (매주 금요일 기준) - HY Spread 데이터 시작
    const backfillStartDate = new Date('1996-01-05') // 1996년 첫 금요일

    const records: Array<{
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
      qqq_price: number | null
      sgov_price: number | null
      gld_price: number | null
      schd_price: number | null
      vym_price: number | null
      treasury_3m: number | null
      composite_score: number
      raw_data: object
    }> = []

    // 티커 가격 찾기 헬퍼 (targetDate 이전 가장 가까운 데이터 사용)
    const findTickerPrice = (quotes: YahooQuote[], targetDate: Date): number | null => {
      const targetTime = targetDate.getTime()
      let closestQuote: YahooQuote | null = null
      let minDiff = Infinity

      // targetDate 이전의 가장 가까운 데이터 찾기
      for (const q of quotes) {
        const qTime = q.date.getTime()
        if (qTime <= targetTime) {
          const diff = targetTime - qTime
          if (diff < minDiff) {
            minDiff = diff
            closestQuote = q
          }
        }
      }
      return closestQuote ? Math.round(closestQuote.close * 100) / 100 : null
    }

    // 매주 금요일 데이터 생성
    const current = new Date()
    const date = new Date(backfillStartDate)

    while (date <= current) {
      const dateStr = date.toISOString().split('T')[0]

      // 해당 날짜에 가장 가까운 데이터 찾기
      const findClosest = (data: FREDObservation[], targetDate: string): FREDObservation | null => {
        let closest: FREDObservation | null = null
        let minDiff = Infinity
        const target = new Date(targetDate).getTime()

        for (const obs of data) {
          const obsDate = new Date(obs.date).getTime()
          if (obsDate <= target) {
            const diff = target - obsDate
            if (diff < minDiff) {
              minDiff = diff
              closest = obs
            }
          }
        }
        return closest
      }

      // Buffett Indicator
      let buffettIndicator: number | null = null
      const gdpObs = findClosest(gdpData, dateStr)
      const mcObs = findClosest(marketCapData, dateStr)
      if (gdpObs && mcObs) {
        const gdp = parseFloat(gdpObs.value) * 1000000000
        const marketCap = parseFloat(mcObs.value) * 1000000
        buffettIndicator = Math.round((marketCap / gdp) * 10000) / 100
      }

      // Fed Balance Sheet YoY
      let fedBalanceSheetYoY: number | null = null
      const walclObs = findClosest(walclData, dateStr)
      if (walclObs) {
        const yearAgoVal = findYearAgoValue(walclData, dateStr, 52)
        if (yearAgoVal) {
          const currentVal = parseFloat(walclObs.value)
          fedBalanceSheetYoY = Math.round(((currentVal - yearAgoVal) / yearAgoVal) * 10000) / 100
        }
      }

      // M2 YoY
      let m2GrowthYoY: number | null = null
      const m2Obs = findClosest(m2Data, dateStr)
      if (m2Obs) {
        const yearAgoVal = findYearAgoValue(m2Data, dateStr, 52)
        if (yearAgoVal) {
          const currentVal = parseFloat(m2Obs.value)
          m2GrowthYoY = Math.round(((currentVal - yearAgoVal) / yearAgoVal) * 10000) / 100
        }
      }

      // High Yield Spread
      let hySpread: number | null = null
      const hyObs = findClosest(hySpreadData, dateStr)
      if (hyObs) {
        hySpread = Math.round(parseFloat(hyObs.value) * 1000) / 1000
      }

      // Yield Curves
      let yieldCurve10Y2Y: number | null = null
      let yieldCurve10Y3M: number | null = null
      const dgs10Obs = findClosest(dgs10Data, dateStr)
      const dgs2Obs = findClosest(dgs2Data, dateStr)
      const dgs3moObs = findClosest(dgs3moData, dateStr)

      if (dgs10Obs && dgs2Obs) {
        yieldCurve10Y2Y =
          Math.round((parseFloat(dgs10Obs.value) - parseFloat(dgs2Obs.value)) * 1000) / 1000
      }
      if (dgs10Obs && dgs3moObs) {
        yieldCurve10Y3M =
          Math.round((parseFloat(dgs10Obs.value) - parseFloat(dgs3moObs.value)) * 1000) / 1000
      }

      // Initial Claims
      let initialClaims: number | null = null
      const icsaObs = findClosest(icsaData, dateStr)
      if (icsaObs) {
        initialClaims = parseInt(icsaObs.value)
      }

      // ERP (Equity Risk Premium) = Earnings Yield - 10Y Treasury
      // Earnings Yield = Corporate Profits / Market Cap
      let erp: number | null = null
      const cpObs = findClosest(cpData, dateStr)
      if (cpObs && mcObs && dgs10Obs) {
        const corporateProfits = parseFloat(cpObs.value) * 1000000000 // CP is in billions
        const marketCap = parseFloat(mcObs.value) * 1000000 // NCBCEL is in millions
        const earningsYield = (corporateProfits / marketCap) * 100 // as percentage
        const treasury10Y = parseFloat(dgs10Obs.value)
        erp = Math.round((earningsYield - treasury10Y) * 100) / 100
      }

      // Fear & Greed (Alternative.me - 있는 만큼만 사용)
      const targetDate = new Date(dateStr)
      const fearGreed = findFearGreedValue(fearGreedData, targetDate)

      // VIX (Yahoo Finance)
      const vix = findVIXValue(vixData, targetDate)

      // SPY vs 200MA (Yahoo Finance)
      const spyVs200ma = calculateSPYvs200MA(spyData, targetDate)

      // SPY 가격 (Yahoo Finance)
      const spyPrice = findSPYPrice(spyData, targetDate)

      // 포트폴리오 티커 가격
      const qqqPrice = findTickerPrice(qqqData, targetDate)
      const sgovPrice = findTickerPrice(sgovData, targetDate)
      const gldPrice = findTickerPrice(gldData, targetDate)
      const schdPrice = findTickerPrice(schdData, targetDate)
      const vymPrice = findTickerPrice(vymData, targetDate)

      // Composite Score
      const compositeScore = calculateCompositeScore({
        fearGreed,
        vix,
        spyVs200ma,
        buffettIndicator,
        fedBalanceSheetYoY,
        m2GrowthYoY,
        hySpread,
        yieldCurve10Y2Y,
        yieldCurve10Y3M,
        initialClaims,
        erp,
      })

      // 3개월 국채 금리 (현금성 자산 수익률로 사용)
      const treasury3m = dgs3moObs ? Math.round(parseFloat(dgs3moObs.value) * 100) / 100 : null

      records.push({
        date: dateStr,
        fear_greed: fearGreed,
        vix,
        spy_vs_200ma: spyVs200ma,
        buffett_indicator: buffettIndicator,
        fed_balance_sheet_yoy: fedBalanceSheetYoY,
        m2_growth_yoy: m2GrowthYoY,
        hy_spread: hySpread,
        yield_curve_10y2y: yieldCurve10Y2Y,
        yield_curve_10y3m: yieldCurve10Y3M,
        initial_claims: initialClaims,
        erp,
        spy_price: spyPrice,
        qqq_price: qqqPrice,
        sgov_price: sgovPrice,
        gld_price: gldPrice,
        schd_price: schdPrice,
        vym_price: vymPrice,
        treasury_3m: treasury3m,
        composite_score: compositeScore,
        raw_data: {
          fearGreed,
          vix,
          spyVs200ma,
          buffettIndicator,
          fedBalanceSheetYoY,
          m2GrowthYoY,
          hySpread,
          yieldCurve10Y2Y,
          yieldCurve10Y3M,
          initialClaims,
          erp,
        },
      })

      // 다음 주로
      date.setDate(date.getDate() + 7)
    }

    console.log(`Generated ${records.length} weekly records`)

    // Supabase에 저장 (배치)
    const { error } = await supabase
      .from('market_indicators_history')
      .upsert(records, { onConflict: 'date' })

    if (error) {
      console.error('Supabase error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save data', details: error.message }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        recordsInserted: records.length,
        dateRange: {
          start: records[0]?.date,
          end: records[records.length - 1]?.date,
        },
        note: 'Fear & Greed는 Alternative.me(암호화폐 기반) 데이터 사용',
      }),
    }
  } catch (error) {
    console.error('Backfill error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Backfill failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}

export { handler }
