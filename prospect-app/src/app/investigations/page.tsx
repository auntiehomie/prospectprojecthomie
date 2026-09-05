import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import InvestigationWorkspace from '@/components/InvestigationWorkspace';
import { getAppMember, hasClerk } from '@/lib/auth';

export default async function InvestigationsPage() {
  if (hasClerk()) {
    const { userId } = await auth();
    if (!userId) redirect('/sign-in');
    if (!await getAppMember()) redirect('/join');
  }
  return <main>
    <header className="site-header"><div className="page-shell header-inner"><Link className="brand" href="/"><span className="brand-mark">PH</span><span><strong>Prospect Project Homie</strong><small>Business investigations</small></span></Link><div className="header-actions"><Link className="source-link" href="/">Prospect search</Link>{hasClerk() ? <UserButton /> : null}</div></div></header>
    <section className="investigation-hero"><div className="page-shell"><p className="eyebrow">Evidence before inference</p><h1>Investigate a business’s banking needs.</h1><p>Combine reviewed UCC filings with current public-web evidence while keeping lending evidence, deposit relationships, and needs hypotheses clearly separated.</p></div></section>
    <div className="page-shell investigation-page"><InvestigationWorkspace /></div>
  </main>;
}
