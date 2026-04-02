import { buildNoIndexMetadata } from '@/lib/site/seo'

export const metadata = buildNoIndexMetadata(
  'CBTooll Auth',
  'Authentication pages for CBTooll users.'
)

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
