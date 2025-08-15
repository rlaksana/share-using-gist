#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Read current version from package.json
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Auto-increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`🔄 Auto-incrementing version: ${currentVersion} → ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');

// Update manifest.json
const manifestJson = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifestJson.version = newVersion;
writeFileSync('manifest.json', JSON.stringify(manifestJson, null, '\t') + '\n');

// Update versions.json
const versionsJson = JSON.parse(readFileSync('versions.json', 'utf8'));
versionsJson[newVersion] = manifestJson.minAppVersion;
writeFileSync('versions.json', JSON.stringify(versionsJson, null, '\t') + '\n');

console.log(`✅ Updated all version files to ${newVersion}`);

// Build the plugin
console.log('🏗️  Building plugin...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

console.log(`🚀 Ready for commit and push with version ${newVersion}`);
console.log('💡 Next: git add -A && git commit -m "message" && git push');