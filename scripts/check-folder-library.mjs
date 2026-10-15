import { fileURLToPath } from 'node:url';
import { readFolderLibrary } from '../src/lib/folderLibraryReader.node.js';

const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => arg.startsWith('-'))) {
  console.error('Usage: npm run library:check -- [library-directory]');
  process.exitCode = 1;
} else {
  const root = args[0] ?? fileURLToPath(new URL('../library-exports/moodboard-library-2026-09-21/', import.meta.url));
  try {
    const snapshot = await readFolderLibrary(root);
    const { inventory: i, availableAssets: a, warnings } = snapshot;
    console.log(`Library: ${snapshot.root}`);
    console.log(`Records: ${i.itemCount}; originals: ${i.originals}; preview fallbacks: ${i.previewFallbacks}; metadata-only: ${i.metadataOnly}`);
    console.log(`Thumbnails registered: desktop ${i.desktopThumbnails}, mobile ${i.mobileThumbnails}`);
    console.log(`Files available: main ${a.image}, desktop ${a['image-thumbs']}, mobile ${a['image-thumbs-mobile']}`);
    const counts = new Map();
    for (const { code } of warnings) counts.set(code, (counts.get(code) ?? 0) + 1);
    console.log(`Warnings: ${warnings.length}${counts.size ? ' (' + [...counts].map(([code, count]) => `${code}: ${count}`).join(', ') + ')' : ''}`);
    console.log('Read-only check complete. No library or browser data was changed.');
  } catch (error) {
    console.error(`Library check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
