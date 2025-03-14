import * as crypto from 'crypto';
import * as bs58 from 'bs58';

export function base58EncodeSha256(str: string): string {
  const hash = crypto.createHash('sha256').update(str).digest();
  return bs58.encode(hash);
}
