const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const inputFile = process.argv[2] || 'index.html';
  const outputFile = process.argv[3] || 'sixty-two-pitch-deck.pdf';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Smaller viewport = content fills more of the frame
  const width = 1200;
  const height = 675;
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  const filePath = 'file://' + path.resolve(__dirname, inputFile);
  await page.goto(filePath, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 2000));

  // Legacy decks can opt into tighter PDF spacing via `data-pdf-tighten="true"`.
  await page.evaluate(() => {
    if (document.body?.dataset?.pdfTighten !== 'true') return;

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

  // Detect if this is a scroll-snap deck (v6+) or absolute-positioned (v4/v5)
  const isScrollDeck = await page.evaluate(() => {
    const html = document.documentElement;
    const style = window.getComputedStyle(html);
    return style.scrollSnapType && style.scrollSnapType !== 'none';
  });

  const totalSlides = await page.evaluate(() => document.querySelectorAll('.slide').length);
  const screenshots = [];

  // For scroll-snap decks, switch to absolute positioning for PDF capture
  if (isScrollDeck) {
    await page.evaluate(() => {
      document.documentElement.style.scrollSnapType = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.querySelectorAll('.slide').forEach(s => {
        s.style.position = 'absolute';
        s.style.inset = '0';
        s.style.scrollSnapAlign = 'unset';
        s.style.height = '100vh';
        s.style.opacity = '0';
        s.style.visibility = 'hidden';
      });
      // Show first slide
      const first = document.querySelectorAll('.slide')[0];
      first.style.opacity = '1';
      first.style.visibility = 'visible';
      first.classList.add('visible');
    });
  }

  for (let i = 0; i < totalSlides; i++) {
    if (i > 0) {
      await page.evaluate((idx) => {
        document.querySelectorAll('.slide').forEach(s => {
          s.classList.remove('active', 'leaving');
          s.style.opacity = '0';
          s.style.visibility = 'hidden';
        });
        const target = document.querySelectorAll('.slide')[idx];
        target.classList.add('active', 'visible');
        target.style.opacity = '1';
        target.style.visibility = 'visible';
      }, i);
    }

    await new Promise(r => setTimeout(r, 2500));

    await page.evaluate((idx) => {
      const slide = document.querySelectorAll('.slide')[idx];

      // Force all .reveal elements visible (scroll-snap decks use this)
      slide.querySelectorAll('.reveal').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.transitionDelay = '0s';
        el.style.filter = 'none';
      });

      // Force animated bar fills to their target width
      slide.querySelectorAll('.m-bar-fill, .market-bar-fill').forEach(el => {
        const fill = el.style.getPropertyValue('--fill');
        if (fill) el.style.width = fill;
      });

      // Legacy deck elements
      slide.querySelectorAll('[style]').forEach(el => {
        const computed = window.getComputedStyle(el);
        if (parseFloat(computed.opacity) < 0.9 && !el.classList.contains('noise-overlay') &&
            !el.classList.contains('particles-canvas') && !el.classList.contains('geo-line') &&
            !el.closest('.corner-accent') && !el.classList.contains('frontier-glow') &&
            !el.classList.contains('closing-glow') && !el.classList.contains('closing-glow-2') &&
            !el.classList.contains('mission-watermark') && !el.classList.contains('frontier-grid-accent') &&
            !el.classList.contains('title-glow') && !el.classList.contains('glow-cyan') &&
            !el.classList.contains('glow-signal')) {
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

      const hideIfPresent = (selector) => {
        const el = document.querySelector(selector);
        if (el) el.style.display = 'none';
      };

      const hideByIdIfPresent = (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      };

      hideIfPresent('.nav-fixed');
      hideIfPresent('.nav-dots');
      hideIfPresent('.nav-arrows');
      hideIfPresent('.progress-bar');
      hideByIdIfPresent('cursorDot');
      hideByIdIfPresent('cursorRing');
      hideByIdIfPresent('progressBar');
      hideByIdIfPresent('navDots');
      hideByIdIfPresent('slideCounter');
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
    path: path.resolve(__dirname, outputFile),
    width: `${pageWIn}in`,
    height: `${pageHIn}in`,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });

  console.log(`PDF generated: ${outputFile}`);
  await browser.close();
})();
