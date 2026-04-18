import sharp from 'sharp';
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs';

const svg = Buffer.from(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
    <rect width='512' height='512' rx='96' fill='#0ea5e9'/>
    <text x='256' y='330' font-size='240' font-family='Arial,sans-serif' font-weight='700' text-anchor='middle' fill='white'>SF</text>
  </svg>`
);

mkdirSync('public', { recursive: true });

await sharp(svg).resize(192, 192).png().toFile('public/pwa-192x192.png');
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512x512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
writeFileSync('public/mask-icon.svg', svg);
copyFileSync('public/pwa-192x192.png', 'public/favicon.ico');

console.log('Icons generated in public/');
