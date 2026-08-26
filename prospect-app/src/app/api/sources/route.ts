import { SOURCE_CATALOG } from '@/data/source-catalog';

export const dynamic = 'force-static';

export function GET() {
  return Response.json({ sources: SOURCE_CATALOG }, { headers: { 'X-Content-Type-Options': 'nosniff' } });
}
