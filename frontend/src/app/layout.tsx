import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import WalletProvider from '@/components/wallet/WalletProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Solana Trading Bot',
  description: 'Professional Solana trading bot with automated exit strategies',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  )
}
