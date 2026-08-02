import ProspectExplorer from '@/components/ProspectExplorer';
import prospectsData from '@/data/prospects.json';
import type { Prospect } from '@/data/types';

const prospects = prospectsData as Prospect[];

export default function Home() {
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
          <a className="source-link" href="https://data.sba.gov/dataset/ppp-foia" target="_blank" rel="noreferrer">
            SBA data source ↗
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="page-shell hero-grid">
          <div>
            <p className="eyebrow">Comerica × Fifth Third branch transition</p>
            <h1>Find nearby businesses that may need a new banking relationship.</h1>
            <p className="hero-copy">
              Search forgiven PPP borrowers near closing branches in Farmington Hills and West Bloomfield. Filter, prioritize, and export a focused outreach list.
            </p>
          </div>
          <aside className="method-card">
            <span>Current qualification</span>
            <ul>
              <li>Comerica PPP lender</li>
              <li>Loan of at least $50,000</li>
              <li>Forgiveness recorded</li>
              <li>Within 2 miles of a closing branch</li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="page-shell content-stack">
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
            PPP records are historical SBA FOIA data. Contact details were gathered from public sources and may change. Records marked as relocated, closed, mismatched, or unverified should be checked before outreach.
          </p>
        </section>
      </div>

      <footer>
        <div className="page-shell footer-inner">
          <span>Prospect Project Homie</span>
          <span>52 qualified records · Refreshed August 2, 2026</span>
        </div>
      </footer>
    </main>
  );
}
