const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Standard 16:9 presentation at 1x scale
  const width = 1920;
  const height = 1080;
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  const filePath = 'file://' + path.resolve(__dirname, 'index.html');
  await page.goto(filePath, { waitUntil: 'networkidle0' });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 2000));

  const totalSlides = 8;
  const screenshots = [];

  for (let i = 0; i < totalSlides; i++) {
    // Navigate to slide
    if (i > 0) {
      await page.evaluate((idx) => {
        document.querySelectorAll('.slide').forEach(s => {
          s.classList.remove('active', 'leaving');
          s.style.opacity = '0';
          s.style.visibility = 'hidden';
        });
        const target = document.querySelectorAll('.slide')[idx];
        target.classList.add('active');
        target.style.opacity = '1';
        target.style.visibility = 'visible';
      }, i);
    }

    // Wait for slide animations
    await new Promise(r => setTimeout(r, 2500));

    // Force all animated elements visible
    await page.evaluate((idx) => {
      const slide = document.querySelectorAll('.slide')[idx];

      slide.querySelectorAll('[style]').forEach(el => {
        const computed = window.getComputedStyle(el);
        if (parseFloat(computed.opacity) < 0.9 && !el.classList.contains('noise-overlay') &&
            !el.classList.contains('particles-canvas') && !el.classList.contains('geo-line') &&
            !el.closest('.corner-accent') && !el.classList.contains('frontier-glow') &&
            !el.classList.contains('closing-glow') && !el.classList.contains('closing-glow-2') &&
            !el.classList.contains('mission-watermark') && !el.classList.contains('frontier-grid-accent')) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      });

      slide.querySelectorAll('.word, .line-inner, .founder-name, .closing-founder, .pillar, .provide-card, .whynow-card, .biz-tier').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });

      slide.querySelectorAll('.title-overline, .title-subtitle, .title-logo, .frontier-label, .challenge-label, .challenge-title, .mission-label, .provide-label, .provide-title, .whynow-label, .whynow-title, .business-label, .business-title, .business-desc, .closing-logo').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });

      slide.querySelectorAll('.title-divider, .mission-accent-line, .closing-divider').forEach(el => {
        el.classList.add('animate');
      });

      slide.querySelectorAll('.pillar').forEach(el => {
        el.classList.add('animate');
      });

      // Hide nav UI
      document.querySelector('.nav-fixed').style.display = 'none';
      document.querySelector('.nav-dots').style.display = 'none';
      document.querySelector('.nav-arrows').style.display = 'none';
      document.querySelector('.progress-bar').style.display = 'none';
      document.getElementById('cursorDot').style.display = 'none';
      document.getElementById('cursorRing').style.display = 'none';
    }, i);

    await new Promise(r => setTimeout(r, 500));

    const screenshotBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height }
    });
    screenshots.push(screenshotBuffer);
    console.log(`Captured slide ${i + 1}/${totalSlides}`);
  }

  // Create PDF: use a new page at 1x scale with inch-based dimensions
  // Standard widescreen: 13.333in x 7.5in (same as PowerPoint 16:9)
  const pdfPage = await browser.newPage();
  const slideW = 13.333;
  const slideH = 7.5;

  // Viewport in pixels at 96dpi CSS
  const pdfViewW = Math.round(slideW * 96);  // ~1280
  const pdfViewH = Math.round(slideH * 96);  // ~720
  await pdfPage.setViewport({ width: pdfViewW, height: pdfViewH, deviceScaleFactor: 1 });

  const imagesHtml = screenshots.map((buf) =>
    `<div class="page"><img src="data:image/png;base64,${buf.toString('base64')}" /></div>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${slideW}in ${slideH}in; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .page {
    width: ${slideW}in;
    height: ${slideH}in;
    page-break-after: always;
    overflow: hidden;
    position: relative;
  }
  .page:last-child { page-break-after: avoid; }
  .page img {
    position: absolute;
    top: 0;
    left: 0;
    width: ${slideW}in;
    height: ${slideH}in;
    display: block;
  }
</style>
</head>
<body>${imagesHtml}</body>
</html>`;

  await pdfPage.setContent(html, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  await pdfPage.pdf({
    path: path.resolve(__dirname, 'sixty-two-pitch-deck.pdf'),
    width: `${slideW}in`,
    height: `${slideH}in`,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });

  console.log('PDF generated: sixty-two-pitch-deck.pdf');
  await browser.close();
})();
