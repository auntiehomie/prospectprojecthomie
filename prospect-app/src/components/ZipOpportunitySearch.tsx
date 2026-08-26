'use client';

import { useState } from 'react';

type Result = {
  id: string; display_name: string; legal_name: string; status: string; address_line: string; city: string;
  zip_code: string; latitude: number | null; longitude: number | null; institution_name: string | null;
  branch_name: string | null; branch_address: string | null; branch_latitude: number | null; branch_longitude: number | null;
  closure_status: string | null; closure_source_url: string | null; relationship_confidence: string | null;
  distance_miles: number | null; ranking: { score: number; reasons: string[]; blocked: boolean };
};

function OpportunityMap({ results }: { results: Result[] }) {
  const rawPoints = results.flatMap((result) => [
    result.latitude !== null && result.longitude !== null
      ? { id: `business-${result.id}`, lat: result.latitude, lng: result.longitude, kind: 'business', label: result.display_name } : null,
    result.branch_latitude !== null && result.branch_longitude !== null
      ? { id: `branch-${result.branch_name}`, lat: result.branch_latitude, lng: result.branch_longitude, kind: 'branch', label: result.branch_name || 'Closing branch' } : null,
  ]).filter((point): point is NonNullable<typeof point> => Boolean(point));
  const points = [...new Map(rawPoints.map((point) => [point.id, point])).values()];
  if (!points.length) return <p className="map-empty">Geocode the imported records to display the relationship map.</p>;
  const minLat = Math.min(...points.map((p) => p.lat)); const maxLat = Math.max(...points.map((p) => p.lat));
  const minLng = Math.min(...points.map((p) => p.lng)); const maxLng = Math.max(...points.map((p) => p.lng));
  const x = (lng: number) => 30 + ((lng - minLng) / Math.max(0.001, maxLng - minLng)) * 640;
  const y = (lat: number) => 330 - ((lat - minLat) / Math.max(0.001, maxLat - minLat)) * 290;
  return (
    <div className="opportunity-map">
      <svg viewBox="0 0 700 360" role="img" aria-label="Businesses and nearby closing branches">
        <rect x="0" y="0" width="700" height="360" rx="18" className="map-background" />
        {points.map((point) => (
          <g key={point.id} transform={`translate(${x(point.lng)} ${y(point.lat)})`}>
            <circle r={point.kind === 'branch' ? 9 : 6} className={point.kind === 'branch' ? 'map-branch' : 'map-business'}>
              <title>{point.label}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="map-legend"><span><i className="business-dot" /> Business</span><span><i className="branch-dot" /> Closing branch</span></div>
      <small>Relative-location view based on reviewed coordinates. Open source records for street-level verification.</small>
    </div>
  );
}

export default function ZipOpportunitySearch() {
  const [zip, setZip] = useState('48334');
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const visible = results.filter((result) => !result.ranking.blocked);

  async function search(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const response = await fetch(`/api/prospects?zip=${encodeURIComponent(zip)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Search failed.');
      setResults(body.results); setMessage(`${body.count} reviewed business records found in ${body.zip}.`);
    } catch (error) { setResults([]); setMessage(error instanceof Error ? error.message : 'Search failed.'); }
    finally { setLoading(false); }
  }

  return (
    <section className="workspace-card zip-opportunity" aria-labelledby="zip-opportunity-heading">
      <div className="filters-heading"><div><p className="eyebrow">Live opportunity search</p><h2 id="zip-opportunity-heading">Cross-reference a Michigan ZIP with closing branches</h2></div></div>
      <form className="zip-search-form" onSubmit={search}>
        <label className="field"><span>Michigan ZIP code</span><input inputMode="numeric" pattern="48[0-9]{3}" maxLength={5} value={zip} onChange={(event) => setZip(event.target.value)} required /></label>
        <button className="button primary" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search ZIP'}</button>
      </form>
      {message ? <p className="zip-message" aria-live="polite">{message}</p> : null}
      {visible.length ? <>
        <OpportunityMap results={visible} />
        <div className="opportunity-grid">{visible.map((result) => <article className="opportunity-card" key={result.id}>
          <div><strong>{result.display_name}</strong><span>{result.address_line}, {result.city} {result.zip_code}</span></div>
          <b>{result.ranking.score}/100</b>
          <p>{result.branch_name ? `${result.distance_miles?.toFixed(2) ?? 'Unknown'} mi from ${result.branch_name}` : 'No geocoded closure match'}</p>
          <small>{result.relationship_confidence ? `${result.relationship_confidence} historical relationship evidence` : 'Bank relationship unknown'}</small>
          <ul>{result.ranking.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {result.closure_source_url ? <a href={result.closure_source_url} target="_blank" rel="noreferrer">Review closure source ↗</a> : null}
        </article>)}</div>
      </> : null}
    </section>
  );
}
