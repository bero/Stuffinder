import sharp from 'sharp';

const svg = Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630' viewBox='0 0 1200 630'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#0f172a'/>
      <stop offset='100%' stop-color='#1e293b'/>
    </linearGradient>
  </defs>
  <rect width='1200' height='630' fill='url(#bg)'/>
  <rect x='80' y='195' width='240' height='240' rx='48' fill='#0ea5e9'/>
  <text x='200' y='370' font-size='150' font-family='Inter,Arial,sans-serif' font-weight='700' text-anchor='middle' fill='white'>SF</text>
  <text x='370' y='290' font-size='86' font-family='Inter,Arial,sans-serif' font-weight='700' fill='#f1f5f9'>Stuffinder</text>
  <text x='370' y='360' font-size='34' font-family='Inter,Arial,sans-serif' font-weight='500' fill='#cbd5e1'>Catalogue and find your belongings.</text>
  <text x='370' y='405' font-size='34' font-family='Inter,Arial,sans-serif' font-weight='500' fill='#cbd5e1'>One inventory shared with your household.</text>
  <text x='370' y='480' font-size='26' font-family='Inter,Arial,sans-serif' font-weight='400' fill='#94a3b8'>Free PWA · iOS · Android · 9 languages</text>
</svg>`);

await sharp(svg).png().toFile('public/og-image.png');

console.log('Generated public/og-image.png (1200x630)');
