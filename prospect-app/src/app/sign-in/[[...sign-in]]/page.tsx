import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return <main className="auth-shell"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/" /></main>;
}
