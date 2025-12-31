-- Supabase SQL Editor에서 실행하세요
-- 댓글 테이블 생성

CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 활성화
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 댓글을 읽을 수 있도록 정책 생성
CREATE POLICY "Anyone can read comments" ON comments
  FOR SELECT USING (true);

-- 모든 사용자가 댓글을 작성할 수 있도록 정책 생성
CREATE POLICY "Anyone can insert comments" ON comments
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 좋아요를 업데이트할 수 있도록 정책 생성
CREATE POLICY "Anyone can update likes" ON comments
  FOR UPDATE USING (true);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_comments_likes ON comments(likes DESC);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
