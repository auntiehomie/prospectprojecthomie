import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return <main className="auth-shell"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/join" /></main>;
}
