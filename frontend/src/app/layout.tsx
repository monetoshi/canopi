import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import WalletProvider from '@/components/wallet/WalletProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Canopi - Solana Trading Bot',
  description: 'Algorithmic trading, elevated. Intelligent entry and exit strategies for Solana with DCA, limit orders, and 15 automated strategies.',
  icons: {
    icon: '/canopi-icon.svg',
    apple: '/canopi-icon.svg',
  },
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
