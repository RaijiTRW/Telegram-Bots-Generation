import packageJson from '@/package.json'

export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(
    {
      version: packageJson.version,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )
}
