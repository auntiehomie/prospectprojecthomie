import { getDb } from '@/lib/db';
import { distanceMiles, isMichiganZip } from '@/lib/geo';
import { isAuthorized, privateHeaders } from '@/lib/auth';
import { rankProspect } from '@/lib/prospect-score';

export const runtime = 'nodejs';

type ProspectRow = {
  id: string; display_name: string; legal_name: string; status: string; naics_code: string | null;
  address_line: string; city: string; zip_code: string; latitude: number | null; longitude: number | null;
  branch_id: string | null; institution_name: string | null; branch_name: string | null;
  branch_address: string | null; branch_latitude: number | null; branch_longitude: number | null;
  closure_status: 'filed' | 'approved' | 'withdrawn' | 'completed' | 'unverified' | null;
  effective_at: string | null; closure_source_url: string | null;
  relationship_confidence: 'confirmed' | 'likely' | 'possible' | 'unverified' | null;
  current_signals: number; contact_verified: boolean; suppressed: boolean;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  const zip = new URL(request.url).searchParams.get('zip')?.trim() || '';
  if (!isMichiganZip(zip)) {
    return Response.json({ error: 'Enter a five-digit Michigan ZIP code beginning with 48.' }, { status: 400, headers: privateHeaders });
  }
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT b.id, b.display_name, b.legal_name, b.status, b.naics_code,
        l.address_line, l.city, l.zip_code, l.latitude, l.longitude,
        nearest.branch_id, nearest.institution_name, nearest.branch_name,
        nearest.address_line AS branch_address, nearest.latitude AS branch_latitude,
        nearest.longitude AS branch_longitude, nearest.closure_status,
        nearest.effective_at, nearest.source_url AS closure_source_url,
        rel.confidence AS relationship_confidence,
        COALESCE(signals.current_signals, 0)::int AS current_signals,
        EXISTS (SELECT 1 FROM stored_contacts c WHERE c.business_id = b.id AND c.verified) AS contact_verified,
        EXISTS (SELECT 1 FROM suppression_entries s WHERE s.business_id = b.id) AS suppressed
      FROM businesses b
      JOIN business_locations l ON l.business_id = b.id
      LEFT JOIN LATERAL (
        SELECT br.id AS branch_id, br.institution_name, br.branch_name, br.address_line,
          br.latitude, br.longitude, ce.status AS closure_status, ce.effective_at, ce.source_url
        FROM bank_branches br
        JOIN branch_closure_events ce ON ce.branch_id = br.id
        WHERE br.latitude IS NOT NULL AND br.longitude IS NOT NULL
          AND ce.status IN ('filed','approved','completed')
        ORDER BY power(br.latitude - l.latitude, 2) + power(br.longitude - l.longitude, 2)
        LIMIT 1
      ) nearest ON l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      LEFT JOIN LATERAL (
        SELECT re.confidence FROM relationship_evidence re
        WHERE re.business_id = b.id
          AND (nearest.institution_name IS NULL OR lower(re.institution_name) = lower(nearest.institution_name))
        ORDER BY CASE re.confidence WHEN 'confirmed' THEN 4 WHEN 'likely' THEN 3 WHEN 'possible' THEN 2 ELSE 1 END DESC
        LIMIT 1
      ) rel ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS current_signals FROM business_signals bs
        WHERE bs.business_id = b.id AND (bs.expires_at IS NULL OR bs.expires_at >= current_date)
      ) signals ON true
      WHERE l.zip_code = ${zip}
      ORDER BY b.display_name
      LIMIT 500
    ` as ProspectRow[];
    const results = rows.map((row) => {
      const distance = row.latitude !== null && row.longitude !== null
        && row.branch_latitude !== null && row.branch_longitude !== null
        ? distanceMiles(
            { latitude: row.latitude, longitude: row.longitude },
            { latitude: row.branch_latitude, longitude: row.branch_longitude },
          ) : null;
      return { ...row, distance_miles: distance, ranking: rankProspect({
        distanceMiles: distance, closureStatus: row.closure_status,
        relationshipConfidence: row.relationship_confidence,
        currentSignals: row.current_signals, contactVerified: row.contact_verified,
        suppressed: row.suppressed,
      }) };
    }).sort((a, b) => b.ranking.score - a.ranking.score);
    return Response.json({ zip, count: results.length, results }, { headers: privateHeaders });
  } catch (error) {
    console.error('prospect ZIP search failed', error);
    return Response.json({ error: 'Prospect database is unavailable. Confirm DATABASE_URL and run the migration.' }, { status: 503, headers: privateHeaders });
  }
}
