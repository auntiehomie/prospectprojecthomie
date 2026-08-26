import { auth } from '@clerk/nextjs/server';
import { SignOutButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import JoinForm from '@/components/JoinForm';
import { getAppMember, hasClerk } from '@/lib/auth';

export default async function JoinPage() {
  if (!hasClerk()) redirect('/');
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  if (await getAppMember()) redirect('/');
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Invitation required</p>
        <h1>Join Prospect Project Homie</h1>
        <p>Your account is signed in. Enter an invitation code once to activate access.</p>
        <JoinForm />
        <SignOutButton><button className="text-button" type="button">Use a different account</button></SignOutButton>
      </section>
    </main>
  );
}
