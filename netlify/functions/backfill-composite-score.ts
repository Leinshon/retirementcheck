import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { calculateCompositeScore } from '../../src/lib/composite-score'

// composite_score만 Z-score 기반으로 재계산하는 경량 백필 함수
// GET /.netlify/functions/backfill-composite-score

const handler: Handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Missing Supabase environment variables' }),
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 모든 레코드 가져오기
    const { data: records, error: fetchError } = await supabase
      .from('market_indicators_history')
      .select('date, hy_spread, vix, initial_claims, spy_vs_200ma, yield_curve_10y2y, composite_score')
      .order('date', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch records: ${fetchError.message}`)
    }

    console.log(`Found ${records?.length || 0} records to update`)

    let updatedCount = 0

    for (const record of records || []) {
      const newScore = calculateCompositeScore({
        hy_spread: record.hy_spread,
        vix: record.vix,
        initial_claims: record.initial_claims,
        spy_vs_200ma: record.spy_vs_200ma,
        yield_curve_10y2y: record.yield_curve_10y2y,
      })

      // 값이 다를 때만 업데이트
      if (Math.abs(newScore - (record.composite_score || 0)) > 0.01) {
        const { error: updateError } = await supabase
          .from('market_indicators_history')
          .update({ composite_score: newScore })
          .eq('date', record.date)

        if (!updateError) {
          updatedCount++
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        totalRecords: records?.length || 0,
        updated: updatedCount,
        note: 'composite_score를 Z-score 기반으로 재계산 (5개 핵심 지표 사용)',
      }),
    }
  } catch (error) {
    console.error('Backfill composite score error:', error)
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
