import crypto from 'node:crypto';
import fs from 'node:fs';

export function sha256FileDigest(filePath) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}
