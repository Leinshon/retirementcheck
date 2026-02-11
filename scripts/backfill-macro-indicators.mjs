#!/usr/bin/env node

/**
 * 매크로 경제 지표 과거 데이터 백필 스크립트
 * 성장/물가/고용/통화정책 지표를 FRED에서 가져와 DB에 저장
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const FRED_API_KEY = process.env.FRED_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !FRED_API_KEY) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// FRED API에서 전체 히스토리 가져오기
async function fetchFREDHistory(seriesId, startDate = '1990-01-01') {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&sort_order=asc`
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`FRED API warning for ${seriesId}: ${response.status}`)
      return []
    }
    const data = await response.json()
    return data.observations.filter(obs => obs.value !== '.')
  } catch (error) {
    console.warn(`FRED API error for ${seriesId}:`, error)
    return []
  }
}

// YoY 변화율 계산
function calculateYoY(data, currentIndex, monthsBack = 12) {
  if (currentIndex < monthsBack) return null
  const current = parseFloat(data[currentIndex].value)
  const yearAgo = parseFloat(data[currentIndex - monthsBack].value)
  if (isNaN(current) || isNaN(yearAgo) || yearAgo === 0) return null
  return Math.round(((current - yearAgo) / yearAgo) * 10000) / 100
}

// MoM 변화 계산 (천명 단위 -> 명 단위)
function calculateMoM(data, currentIndex) {
  if (currentIndex < 1) return null
  const current = parseFloat(data[currentIndex].value)
  const prevMonth = parseFloat(data[currentIndex - 1].value)
  if (isNaN(current) || isNaN(prevMonth)) return null
  return Math.round((current - prevMonth) * 1000)
}

async function main() {
  console.log('Fetching macro indicator history from FRED...')

  // 모든 지표 데이터 병렬로 가져오기
  const [
    gdpGrowthData,      // GDP 성장률 (분기별, 연율화)
    ismManufData,       // 제조업 고용 (월별)
    ismServData,        // 비제조업 지수 (월별)
    retailSalesData,    // 소매 판매 (월별)
    cpiData,            // CPI (월별)
    coreCpiData,        // Core CPI (월별)
    pceData,            // PCE (월별)
    corePceData,        // Core PCE (월별)
    ppiData,            // PPI (월별)
    payrollsData,       // 비농업 고용 (월별)
    unemploymentData,   // 실업률 (월별)
    laborPartData,      // 경제활동참가율 (월별)
    treasury10yData,    // 10년물 금리 (일별)
    treasury2yData,     // 2년물 금리 (일별)
    dollarIndexData,    // 달러 인덱스 (주별)
  ] = await Promise.all([
    fetchFREDHistory('A191RL1Q225SBEA'),
    fetchFREDHistory('MANEMP'),
    fetchFREDHistory('NMFBAI'),
    fetchFREDHistory('RSXFS'),
    fetchFREDHistory('CPIAUCSL'),
    fetchFREDHistory('CPILFESL'),
    fetchFREDHistory('PCEPI'),
    fetchFREDHistory('PCEPILFE'),
    fetchFREDHistory('PPIACO'),
    fetchFREDHistory('PAYEMS'),
    fetchFREDHistory('UNRATE'),
    fetchFREDHistory('CIVPART'),
    fetchFREDHistory('DGS10'),
    fetchFREDHistory('DGS2'),
    fetchFREDHistory('DTWEXBGS'),
  ])

  console.log(`GDP Growth: ${gdpGrowthData.length} records`)
  console.log(`ISM Manufacturing: ${ismManufData.length} records`)
  console.log(`ISM Services: ${ismServData.length} records`)
  console.log(`Retail Sales: ${retailSalesData.length} records`)
  console.log(`CPI: ${cpiData.length} records`)
  console.log(`Core CPI: ${coreCpiData.length} records`)
  console.log(`PCE: ${pceData.length} records`)
  console.log(`Core PCE: ${corePceData.length} records`)
  console.log(`PPI: ${ppiData.length} records`)
  console.log(`Payrolls: ${payrollsData.length} records`)
  console.log(`Unemployment: ${unemploymentData.length} records`)
  console.log(`Labor Participation: ${laborPartData.length} records`)
  console.log(`Treasury 10Y: ${treasury10yData.length} records`)
  console.log(`Treasury 2Y: ${treasury2yData.length} records`)
  console.log(`Dollar Index: ${dollarIndexData.length} records`)

  // 날짜별로 데이터 인덱싱
  const createDateMap = (data) => {
    const map = {}
    data.forEach((obs, idx) => {
      map[obs.date] = { value: obs.value, index: idx }
    })
    return map
  }

  const gdpGrowthMap = createDateMap(gdpGrowthData)
  const ismManufMap = createDateMap(ismManufData)
  const ismServMap = createDateMap(ismServData)
  const retailSalesMap = createDateMap(retailSalesData)
  const cpiMap = createDateMap(cpiData)
  const coreCpiMap = createDateMap(coreCpiData)
  const pceMap = createDateMap(pceData)
  const corePceMap = createDateMap(corePceData)
  const ppiMap = createDateMap(ppiData)
  const payrollsMap = createDateMap(payrollsData)
  const unemploymentMap = createDateMap(unemploymentData)
  const laborPartMap = createDateMap(laborPartData)
  const treasury10yMap = createDateMap(treasury10yData)
  const treasury2yMap = createDateMap(treasury2yData)
  const dollarIndexMap = createDateMap(dollarIndexData)

  // 기존 market_indicators_history에서 모든 날짜 가져오기 (2번에 나눠서)
  const { data: batch1, error: error1 } = await supabase
    .from('market_indicators_history')
    .select('date')
    .order('date', { ascending: true })
    .range(0, 999)

  const { data: batch2, error: error2 } = await supabase
    .from('market_indicators_history')
    .select('date')
    .order('date', { ascending: true })
    .range(1000, 1999)

  if (error1 || error2) {
    console.error('Error fetching existing dates:', error1 || error2)
    process.exit(1)
  }

  const existingDates = [...(batch1 || []), ...(batch2 || [])]
  console.log(`\nUpdating ${existingDates.length} existing records...`)

  // 가장 가까운 이전 날짜 찾기 (월별/분기별 데이터용)
  const findClosestPreviousValue = (dateMap, targetDate, dataArray, monthlyLookback = 12) => {
    // 정확히 일치하는 날짜 찾기
    if (dateMap[targetDate]) {
      return { ...dateMap[targetDate], data: dataArray }
    }

    // 해당 월의 첫날 체크 (FRED 월별 데이터는 보통 1일)
    const d = new Date(targetDate)
    const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    if (dateMap[monthStart]) {
      return { ...dateMap[monthStart], data: dataArray }
    }

    // 최대 90일 이전까지 찾기 (월별 데이터 발표 지연 고려)
    for (let i = 1; i <= 90; i++) {
      const prevDate = new Date(d)
      prevDate.setDate(prevDate.getDate() - i)
      const prevDateStr = prevDate.toISOString().split('T')[0]
      if (dateMap[prevDateStr]) {
        return { ...dateMap[prevDateStr], data: dataArray }
      }
    }
    return null
  }

  // 배치 업데이트
  let updated = 0
  let errors = 0
  const batchSize = 50

  for (let i = 0; i < existingDates.length; i += batchSize) {
    const batch = existingDates.slice(i, i + batchSize)
    const updates = []

    for (const { date } of batch) {
      const updateData = {}

      // GDP 성장률 (분기별)
      const gdpMatch = findClosestPreviousValue(gdpGrowthMap, date, gdpGrowthData)
      if (gdpMatch) {
        updateData.gdp_growth_qoq = Math.round(parseFloat(gdpMatch.value) * 100) / 100
      }

      // ISM 제조업
      const ismManufMatch = findClosestPreviousValue(ismManufMap, date, ismManufData)
      if (ismManufMatch) {
        updateData.ism_manufacturing = Math.round(parseFloat(ismManufMatch.value) * 100) / 100
      }

      // ISM 서비스업
      const ismServMatch = findClosestPreviousValue(ismServMap, date, ismServData)
      if (ismServMatch) {
        updateData.ism_services = Math.round(parseFloat(ismServMatch.value) * 100) / 100
      }

      // 소매 판매 YoY
      const retailMatch = findClosestPreviousValue(retailSalesMap, date, retailSalesData)
      if (retailMatch && retailMatch.index >= 12) {
        updateData.retail_sales_yoy = calculateYoY(retailSalesData, retailMatch.index, 12)
      }

      // CPI YoY
      const cpiMatch = findClosestPreviousValue(cpiMap, date, cpiData)
      if (cpiMatch && cpiMatch.index >= 12) {
        updateData.cpi_yoy = calculateYoY(cpiData, cpiMatch.index, 12)
      }

      // Core CPI YoY
      const coreCpiMatch = findClosestPreviousValue(coreCpiMap, date, coreCpiData)
      if (coreCpiMatch && coreCpiMatch.index >= 12) {
        updateData.core_cpi_yoy = calculateYoY(coreCpiData, coreCpiMatch.index, 12)
      }

      // PCE YoY
      const pceMatch = findClosestPreviousValue(pceMap, date, pceData)
      if (pceMatch && pceMatch.index >= 12) {
        updateData.pce_yoy = calculateYoY(pceData, pceMatch.index, 12)
      }

      // Core PCE YoY
      const corePceMatch = findClosestPreviousValue(corePceMap, date, corePceData)
      if (corePceMatch && corePceMatch.index >= 12) {
        updateData.core_pce_yoy = calculateYoY(corePceData, corePceMatch.index, 12)
      }

      // PPI YoY
      const ppiMatch = findClosestPreviousValue(ppiMap, date, ppiData)
      if (ppiMatch && ppiMatch.index >= 12) {
        updateData.ppi_yoy = calculateYoY(ppiData, ppiMatch.index, 12)
      }

      // 비농업 고용 MoM
      const payrollsMatch = findClosestPreviousValue(payrollsMap, date, payrollsData)
      if (payrollsMatch && payrollsMatch.index >= 1) {
        updateData.nonfarm_payrolls_mom = calculateMoM(payrollsData, payrollsMatch.index)
      }

      // 실업률
      const unemploymentMatch = findClosestPreviousValue(unemploymentMap, date, unemploymentData)
      if (unemploymentMatch) {
        updateData.unemployment_rate = Math.round(parseFloat(unemploymentMatch.value) * 100) / 100
      }

      // 경제활동참가율
      const laborPartMatch = findClosestPreviousValue(laborPartMap, date, laborPartData)
      if (laborPartMatch) {
        updateData.labor_participation = Math.round(parseFloat(laborPartMatch.value) * 100) / 100
      }

      // 10년물 금리 (일별이라 정확히 일치 또는 이전)
      const t10yMatch = findClosestPreviousValue(treasury10yMap, date, treasury10yData)
      if (t10yMatch) {
        updateData.treasury_10y = Math.round(parseFloat(t10yMatch.value) * 1000) / 1000
      }

      // 2년물 금리
      const t2yMatch = findClosestPreviousValue(treasury2yMap, date, treasury2yData)
      if (t2yMatch) {
        updateData.treasury_2y = Math.round(parseFloat(t2yMatch.value) * 1000) / 1000
      }

      // 달러 인덱스
      const dxyMatch = findClosestPreviousValue(dollarIndexMap, date, dollarIndexData)
      if (dxyMatch) {
        updateData.dollar_index = Math.round(parseFloat(dxyMatch.value) * 100) / 100
      }

      if (Object.keys(updateData).length > 0) {
        updates.push({ date, ...updateData })
      }
    }

    // 배치 업데이트 실행
    if (updates.length > 0) {
      for (const update of updates) {
        const { error } = await supabase
          .from('market_indicators_history')
          .update(update)
          .eq('date', update.date)

        if (error) {
          console.error(`Error updating ${update.date}:`, error.message)
          errors++
        } else {
          updated++
        }
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, existingDates.length)}/${existingDates.length} (${updated} updated, ${errors} errors)`)
  }

  console.log(`\nBackfill complete!`)
  console.log(`Updated: ${updated}`)
  console.log(`Errors: ${errors}`)
}

main().catch(console.error)
