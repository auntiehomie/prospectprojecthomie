import ProspectExplorer from '@/components/ProspectExplorer';
import prospectsData from '@/data/prospects.json';
import type { Prospect } from '@/data/types';
import ZipOpportunitySearch from '@/components/ZipOpportunitySearch';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { getAppMember, hasClerk } from '@/lib/auth';

const prospects = prospectsData as Prospect[];

export default async function Home() {
  const clerkEnabled = hasClerk();
  let member = null;
  if (clerkEnabled) {
    const { userId } = await auth();
    if (!userId) redirect('/sign-in');
    member = await getAppMember();
    if (!member) redirect('/join');
  }
  const zipCodes = [...new Set(prospects.map((prospect) => prospect['Zip Code']))].sort();
  const branches = [...new Set(prospects.map((prospect) => prospect['Nearest Closing Branch']))].sort();
  const totalLoan = prospects.reduce(
    (sum, prospect) => sum + Number(prospect['Total PPP Loan Amount']),
    0,
  );
  const totalForgiven = prospects.reduce(
    (sum, prospect) => sum + Number(prospect['Total Forgiveness Amount']),
    0,
  );
  const averageDistance = prospects.reduce(
    (sum, prospect) => sum + Number(prospect['Distance to Closing Branch (mi)']),
    0,
  ) / prospects.length;

  return (
    <main>
      <header className="site-header">
        <div className="page-shell header-inner">
          <a className="brand" href="#top" aria-label="Prospect Project Homie home">
            <span className="brand-mark" aria-hidden="true">PH</span>
            <span>
              <strong>Prospect Project Homie</strong>
              <small>Business opportunity intelligence</small>
            </span>
          </a>
          <div className="header-actions">
            {member?.role === 'owner' ? <a className="source-link" href="/admin/invites">Manage invitations</a> : null}
            <a className="source-link" href="https://data.sba.gov/dataset/ppp-foia" target="_blank" rel="noreferrer">SBA data source ↗</a>
            {clerkEnabled ? <UserButton /> : null}
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="page-shell hero-grid">
          <div>
            <p className="eyebrow">Comerica × Fifth Third branch transition</p>
            <h1>Find nearby businesses that may need a new banking relationship.</h1>
            <p className="hero-copy">
              Start with historical PPP borrowers, then add registry findings, official-site facts, news, social signals, and your own research. Compare cited evidence with a reviewable Flagstar product catalog.
            </p>
          </div>
          <aside className="method-card">
            <span>Evidence workflow</span>
            <ul>
              <li>PPP record is one starting source</li>
              <li>Add cited public research or notes</li>
              <li>Keep confidence and review status</li>
              <li>Use LLM matches only as reviewed drafts</li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="page-shell content-stack">
        <ZipOpportunitySearch />
        <ProspectExplorer
          prospects={prospects}
          zipCodes={zipCodes}
          branches={branches}
          stats={{
            total: prospects.length,
            totalLoan,
            totalForgiven,
            withPhone: prospects.filter((prospect) => Boolean(prospect.Phone)).length,
            withEmail: prospects.filter((prospect) => Boolean(prospect.Email)).length,
            avgDistance: averageDistance,
          }}
        />
        <section className="data-note">
          <div>
            <p className="eyebrow">Data notes</p>
            <h2>Use as a qualified lead list, not a live business registry.</h2>
          </div>
          <p>
            PPP records are historical SBA FOIA data, not proof of a current bank relationship. Added research remains source-attributed and should be reviewed for entity match, freshness, lawful use, and accuracy before outreach. Product matches are discovery prompts—not approvals, pricing, underwriting, or financial advice.
          </p>
        </section>
      </div>

      <footer>
        <div className="page-shell footer-inner">
          <span>Prospect Project Homie</span>
          <span>{prospects.length} curated PPP seeds · Live records come from the reviewed database</span>
        </div>
      </footer>
    </main>
  );
}
