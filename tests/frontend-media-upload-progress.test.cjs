'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

test('media upload reports real browser upload progress', () => {
  assert.match(APP_JS, /new XMLHttpRequest\(\)/);
  assert.match(APP_JS, /request\.upload\.addEventListener\('progress'/);
  assert.match(APP_JS, /Math\.round\(\(event\.loaded \/ event\.total\) \* 100\)/);
  assert.match(APP_JS, /data-upload-progress-percent/);
  assert.match(APP_JS, /Enviando \$\{progress\.percent\}%/);
});

test('media upload progress has accessible status and visual states', () => {
  assert.match(APP_JS, /role="progressbar"/);
  assert.match(APP_JS, /aria-valuenow/);
  assert.match(APP_JS, /Arquivo enviado\. Processando/);
  assert.match(CSS, /\.media-upload-progress-track/);
  assert.match(CSS, /\.media-upload-progress\[data-state="complete"\]/);
  assert.match(CSS, /\.media-upload-progress\[data-state="error"\]/);
});

test('large videos use chunked upload below the Cloudflare request limit', () => {
  assert.match(APP_JS, /MEDIA_DIRECT_UPLOAD_MAX_BYTES = 90 \* 1024 \* 1024/);
  assert.match(APP_JS, /\/api\/media\/chunked\/init/);
  assert.match(APP_JS, /sendMediaChunk/);
  assert.match(APP_JS, /videoFile\.slice\(start, end\)/);
  assert.match(APP_JS, /\/complete/);
});
