import { ReactNode } from "react"
import Link from "next/link"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

interface AuthCardProps {
  title: string
  description?: string
  children: ReactNode
  footerLink?: {
    label: string
    href: string
    linkLabel: string
  }
}

export function AuthCard({ title, description, children, footerLink }: AuthCardProps) {
  return (
    <div className="relative">
      {/* Decorative gradient glow behind card */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] rounded-2xl blur-xl opacity-30" />
      
      <Card className="relative w-full max-w-md bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-white font-bold">{title}</CardTitle>
          {description && (
            <CardDescription className="text-zinc-400 mt-2">{description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pb-6">{children}</CardContent>
        {footerLink && (
          <CardFooter className="justify-center pt-2 pb-6">
            <span className="text-sm text-zinc-400">
              {footerLink.label}{" "}
              <Link 
                href={footerLink.href} 
                className="text-transparent bg-clip-text bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#1a8bc7] hover:to-[#7c4fdd] font-semibold transition-all duration-300"
              >
                {footerLink.linkLabel}
              </Link>
            </span>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
