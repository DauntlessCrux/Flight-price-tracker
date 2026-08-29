import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';

// useSearchParams() (used to read ?next=... after login) requires a
// Suspense boundary for Next.js to statically prerender this route.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
