import { redirect } from 'next/navigation';

export default function HomePage() {
  // Middleware will handle the redirect to /ru or /en
  // This is a fallback redirect
  redirect('/ru');
}
