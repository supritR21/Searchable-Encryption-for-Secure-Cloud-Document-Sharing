import './globals.css';
import { AuthProvider } from '../lib/auth/auth-context';

export const metadata = {
  title: 'CipherShare — Secure Searchable Cloud Document Sharing',
  description: 'Applied Cryptography SSE System with AES-256-GCM, HMAC-SHA-256 and RSA-OAEP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
