const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Smaller viewport = content fills more of the frame
  const width = 1120;
  const height = 630;
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  const filePath = 'file://' + path.resolve(__dirname, 'index.html');
  await page.goto(filePath, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 2000));

  // Override padding/spacing to be tighter for PDF
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      .slide-inner { padding: 2rem 2.5rem !important; }
      .title-founders { margin-top: 2rem !important; }
      .challenge-header { margin-bottom: 2rem !important; }
      .provide-header { margin-bottom: 2rem !important; }
      .whynow-header { margin-bottom: 2rem !important; }
      .business-content { gap: 2.5rem !important; }
    `;
    document.head.appendChild(style);
  });

  const totalSlides = 8;
  const screenshots = [];

  for (let i = 0; i < totalSlides; i++) {
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

    await new Promise(r => setTimeout(r, 2500));

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

  // Standard 16:9 widescreen PDF (10in x 5.625in like Google Slides/PowerPoint)
  const pageWIn = 10;
  const pageHIn = 5.625;

  const pdfPage = await browser.newPage();
  await pdfPage.setViewport({ width: Math.round(pageWIn * 96), height: Math.round(pageHIn * 96), deviceScaleFactor: 1 });

  const imagesHtml = screenshots.map((buf) =>
    `<div class="page"><img src="data:image/png;base64,${buf.toString('base64')}" /></div>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${pageWIn}in ${pageHIn}in; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .page {
    width: ${pageWIn}in;
    height: ${pageHIn}in;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: avoid; }
  .page img {
    width: ${pageWIn}in;
    height: ${pageHIn}in;
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
    width: `${pageWIn}in`,
    height: `${pageHIn}in`,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });

  console.log('PDF generated: sixty-two-pitch-deck.pdf');
  await browser.close();
})();
