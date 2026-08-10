const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const hasIoniconsUsage = content.includes('<Ionicons');
  const hasMaterialIconsUsage = content.includes('<MaterialIcons');
  const hasAntDesignUsage = content.includes('<AntDesign');
  const hasVectorIconsImport = content.includes('@expo/vector-icons');

  const issues = [];
  if (hasIoniconsUsage && !hasVectorIconsImport) issues.push('Ionicons');
  if (hasMaterialIconsUsage && !hasVectorIconsImport) issues.push('MaterialIcons');
  if (hasAntDesignUsage && !hasVectorIconsImport) issues.push('AntDesign');

  if (issues.length > 0) {
    const rel = filePath.replace(/\\/g, '/').replace('c:/X-DATA/Chirag Sekhar/zomato-clothing/frontend/', '');
    console.log('MISSING IMPORT: ' + rel + ' => ' + issues.join(', '));
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules', '.expo', 'android', 'ios'].includes(f)) walkDir(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      checkFile(full);
    }
  }
}

walkDir('c:/X-DATA/Chirag Sekhar/zomato-clothing/frontend/app');
walkDir('c:/X-DATA/Chirag Sekhar/zomato-clothing/frontend/components');
console.log('SCAN COMPLETE');
