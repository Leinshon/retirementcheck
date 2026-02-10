-- Supabase 대시보드 > SQL Editor에서 실행하세요

-- 1. 시장 지표 히스토리 테이블 생성
CREATE TABLE market_indicators_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  fear_greed INTEGER,
  vix DECIMAL(6,2),
  spy_vs_200ma DECIMAL(6,2),
  buffett_indicator DECIMAL(6,2),
  fed_balance_sheet_yoy DECIMAL(6,2),
  m2_growth_yoy DECIMAL(6,2),
  hy_spread DECIMAL(6,3),
  yield_curve_10y2y DECIMAL(6,3),
  yield_curve_10y3m DECIMAL(6,3),
  initial_claims INTEGER,
  composite_score DECIMAL(5,2),
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(date)
);

-- 2. 인덱스 생성 (날짜 기준 조회 최적화)
CREATE INDEX idx_market_history_date ON market_indicators_history(date DESC);

-- 3. RLS 정책 설정 (선택사항 - 공개 읽기 허용)
ALTER TABLE market_indicators_history ENABLE ROW LEVEL SECURITY;

-- 읽기는 모두 허용
CREATE POLICY "Allow public read" ON market_indicators_history
  FOR SELECT USING (true);

-- 쓰기는 서비스 역할만 허용 (Netlify Function에서 service_role key 사용)
CREATE POLICY "Allow service write" ON market_indicators_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service update" ON market_indicators_history
  FOR UPDATE USING (true);
