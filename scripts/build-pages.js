#!/usr/bin/env node
/**
 * Build script for Cloudflare Pages deployment
 *
 * This script combines the outputs from:
 * - apps/site (Astro SSG) -> dist/
 * - apps/admin (React SPA) -> dist/admin/
 * - functions/ -> dist/functions/ (handled by Cloudflare Pages)
 *
 * The final structure:
 * dist/
 * - index.html (from site)
 * - posts/... (from site)
 * - admin/... (from admin)
 * - _routes.json (routing config)
 */

import { cpSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

console.log('Building Cloudflare Pages output...');

// Clean and create dist directory
if (existsSync(distDir)) {
  console.log('  Cleaning existing dist directory...');
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

// Copy Astro site output to dist root
const siteDistDir = join(rootDir, 'apps/site/dist');
if (existsSync(siteDistDir)) {
  console.log('  Copying site output to dist/...');
  cpSync(siteDistDir, distDir, { recursive: true });
} else {
  console.warn('  Site dist not found, skipping...');
}

// Copy admin output to dist/admin
const adminDistDir = join(rootDir, 'apps/admin/dist');
const adminOutputDir = join(distDir, 'admin');
if (existsSync(adminDistDir)) {
  console.log('  Copying admin output to dist/admin/...');
  mkdirSync(adminOutputDir, { recursive: true });
  cpSync(adminDistDir, adminOutputDir, { recursive: true });
} else {
  console.warn('  Admin dist not found, skipping...');
}

// Copy _routes.json to dist
const routesFile = join(rootDir, '_routes.json');
if (existsSync(routesFile)) {
  console.log('  Copying _routes.json...');
  copyFileSync(routesFile, join(distDir, '_routes.json'));
}

// Copy _redirects for SPA routing
const redirectsFile = join(rootDir, '_redirects');
if (existsSync(redirectsFile)) {
  console.log('  Copying _redirects...');
  copyFileSync(redirectsFile, join(distDir, '_redirects'));
}

console.log('Build complete! Output in dist/');
