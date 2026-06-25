-- =============================================================================
-- Beer Game — Auto-cleanup trigger: keep at most 25 completed games
-- Run in Supabase Dashboard → SQL Editor → New query
--
-- Fires after any UPDATE on the games table.
-- If the updated game just reached phase='ended' AND the total count of ended
-- games now exceeds 25, it deletes the oldest ended game(s) until only 25 remain.
-- Active / lobby games are never touched.
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_ended_games()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ended_count INT;
  v_excess      INT;
BEGIN
  -- Only act when a game transitions INTO 'ended' phase
  IF NEW.state->>'phase' = 'ended' AND
     (OLD.state->>'phase' IS DISTINCT FROM 'ended') THEN

    -- Count total ended games
    SELECT COUNT(*) INTO v_ended_count
    FROM games
    WHERE state->>'phase' = 'ended';

    v_excess := v_ended_count - 25;

    IF v_excess > 0 THEN
      -- Delete the oldest ended games (by created_at) to get back to 25
      DELETE FROM games
      WHERE id IN (
        SELECT id FROM games
        WHERE state->>'phase' = 'ended'
        ORDER BY created_at ASC
        LIMIT v_excess
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if re-running this script
DROP TRIGGER IF EXISTS trg_cleanup_ended_games ON games;

CREATE TRIGGER trg_cleanup_ended_games
AFTER UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION cleanup_ended_games();
