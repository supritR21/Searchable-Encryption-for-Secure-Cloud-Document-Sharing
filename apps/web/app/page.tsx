import Link from 'next/link';
import { Navbar } from '../components/layout/Navbar';
import { Shield, Lock, Search, Key, Database, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 sm:py-32 bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 sm:px-8 max-w-5xl text-center">
            <div className="inline-flex items-center space-x-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-800 mb-6">
              <Shield className="h-4 w-4" />
              <span>Applied Cryptography Semester Project</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">
              Searchable Encryption for{' '}
              <span className="text-blue-600">Secure Cloud Document Sharing</span>
            </h1>

            <p className="mt-6 text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
              CipherShare enables multi-user document collaboration on untrusted cloud storage.
              Your files and search queries are encrypted entirely on the client before leaving your device.
              The cloud operator never learns your plaintext keywords, file contents, or file names.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 transition"
              >
                <span>Launch CipherShare</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center space-x-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <span>Existing User Login</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Cryptographic Architecture Grid */}
        <section className="py-20 container mx-auto px-4 sm:px-8 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Rigorous Cryptographic Architecture
            </h2>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
              Every operation follows established cryptographic constructions without home-grown primitives.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-4">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Searchable Symmetric Encryption</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Inverted index constructed via <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">HMAC-SHA-256</code> over normalized Unicode terms. Search terms are converted into opaque 32-byte trapdoors locally.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Exact keyword & multi-keyword AND matching</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Zero plaintext query transmission to server</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 mb-4">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Authenticated Document Encryption</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Each document receives an independent random 256-bit DEK. Encrypted using <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">AES-256-GCM</code> with a 96-bit nonce and versioned AAD bound to the workspace and document ID.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>128-bit authentication tag verification</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Rejection of tampered ciphertexts & AAD</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-purple-600 mb-4">
                <Key className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Asymmetric Key Wrapping</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Users hold 3072-bit <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">RSA-OAEP</code> key pairs. Document DEKs and workspace search keys are securely wrapped per authorized recipient.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Argon2id-derived AES key private-key protection</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Dynamic document-level sharing & instant revocation</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Threat Model Callout */}
        <section className="py-12 bg-slate-100 border-t border-slate-200">
          <div className="container mx-auto px-4 sm:px-8 max-w-4xl text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Honest-But-Curious Cloud Threat Model</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              CipherShare guarantees confidentiality against a cloud database or storage operator inspecting stored tables, binary rows, and network traffic.
              The operator observes search tokens and document IDs, but cannot reconstruct plaintext keywords, recover encryption keys, or decrypt document files without the user's private key.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        CipherShare Applied Cryptography System &bull; Semester Project Demo
      </footer>
    </div>
  );
}
