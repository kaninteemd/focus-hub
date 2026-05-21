import './globals.css'

export const metadata = {
  title: 'Focus Hub',
  description: 'Brain dump, focus timer & Notion sync',
  manifest: '/manifest.json',
  themeColor: '#185FA5',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Focus Hub',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#111' }}>
        {children}
      </body>
    </html>
  )
}
