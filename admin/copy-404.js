import fs from 'fs';
try {
  fs.copyFileSync('dist/index.html', 'dist/404.html');
  console.log('Successfully copied index.html to 404.html');
} catch (e) {
  console.error('Failed to copy index.html to 404.html:', e);
}
