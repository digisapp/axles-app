-- Add transcript field to call_logs for AI-generated transcriptions
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add transcription status
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcript_status TEXT
  DEFAULT NULL
  CHECK (transcript_status IN ('pending', 'processing', 'completed', 'failed'));

-- Index for finding calls needing transcription
CREATE INDEX IF NOT EXISTS idx_call_logs_transcript_status
  ON call_logs(transcript_status)
  WHERE transcript_status IS NOT NULL;

-- RLS policy for dealers to view their own call logs (via voice agent)
CREATE POLICY "Dealers can view their call logs"
ON call_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM dealer_voice_agents dva
        WHERE dva.id = call_logs.dealer_voice_agent_id
        AND dva.dealer_id = auth.uid()
    )
);
