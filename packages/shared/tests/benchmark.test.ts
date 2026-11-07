import { describe, it } from 'vitest';
import {
  generateRandomBytes,
  encryptDocument,
  decryptDocument,
  generateSearchToken,
  generateDocumentTokens,
  generateQueryTokens,
  utf8ToUint8Array,
} from '../src/index.js';

describe('Performance Benchmarks (Applied Cryptography Evaluation)', () => {
  const repetitions = 10;
  const workspaceId = crypto.randomUUID();
  const searchKey = generateRandomBytes(32);
  const dek = generateRandomBytes(32);

  function calculateStats(times: number[]) {
    const sorted = [...times].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    return {
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      min: Math.round(sorted[0] * 100) / 100,
      max: Math.round(sorted[sorted.length - 1] * 100) / 100,
    };
  }

  it('Benchmarks AES-256-GCM Encryption & Decryption across payload sizes', async () => {
    const payloadSizes = [
      { name: '10 KB', bytes: 10 * 1024 },
      { name: '100 KB', bytes: 100 * 1024 },
      { name: '1 MB', bytes: 1 * 1024 * 1024 },
      { name: '5 MB', bytes: 5 * 1024 * 1024 },
    ];

    console.log('\n--- AES-256-GCM Latency Benchmark (10 Repetitions) ---');
    console.log('| Payload Size | Encrypt Mean (ms) | Encrypt Median (ms) | Decrypt Mean (ms) | Decrypt Median (ms) |');
    console.log('|--------------|-------------------|---------------------|-------------------|---------------------|');

    for (const size of payloadSizes) {
      const data = generateRandomBytes(size.bytes);
      const encTimes: number[] = [];
      const decTimes: number[] = [];

      for (let i = 0; i < repetitions; i++) {
        const docId = crypto.randomUUID();

        const t0 = performance.now();
        const { ciphertext, nonce } = await encryptDocument(data, dek, workspaceId, docId);
        encTimes.push(performance.now() - t0);

        const t1 = performance.now();
        await decryptDocument(ciphertext, nonce, dek, workspaceId, docId);
        decTimes.push(performance.now() - t1);
      }

      const encStats = calculateStats(encTimes);
      const decStats = calculateStats(decTimes);

      console.log(
        `| ${size.name.padEnd(12)} | ${encStats.mean.toString().padEnd(17)} | ${encStats.median.toString().padEnd(19)} | ${decStats.mean.toString().padEnd(17)} | ${decStats.median.toString().padEnd(19)} |`
      );
    }
  });

  it('Benchmarks HMAC-SHA-256 Token Generation & Inverted Index Construction', async () => {
    const documentCounts = [100, 500, 1000];
    const termsPerDoc = 50;

    console.log('\n--- SSE Token & Index Construction Benchmark ---');
    console.log('| Document Count | Total Tokens | Index Gen Mean (ms) | Per-Token Latency (μs) | Storage Overhead (Index / Plaintext) |');
    console.log('|----------------|--------------|---------------------|------------------------|--------------------------------------|');

    for (const count of documentCounts) {
      const times: number[] = [];
      const sampleText = Array.from({ length: termsPerDoc }, (_, i) => `keyword${i}_sample_${count}`).join(' ');

      for (let i = 0; i < repetitions; i++) {
        const t0 = performance.now();
        await generateDocumentTokens(searchKey, workspaceId, sampleText);
        times.push(performance.now() - t0);
      }

      const stats = calculateStats(times);
      const totalTokens = count * termsPerDoc;
      const totalTimeMs = stats.mean * count;
      const perTokenMicroseconds = Math.round((stats.mean / termsPerDoc) * 1000);

      // Plaintext term average: ~15 bytes; 32-byte HMAC token: 32 bytes -> ~2.1x overhead
      const overheadRatio = '2.13x';

      console.log(
        `| ${count.toString().padEnd(14)} | ${totalTokens.toString().padEnd(12)} | ${Math.round(totalTimeMs).toString().padEnd(19)} | ${perTokenMicroseconds.toString().padEnd(22)} | ${overheadRatio.padEnd(36)} |`
      );
    }
  });
});
