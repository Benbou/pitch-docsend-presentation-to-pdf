// Constants for delays
const SLIDE_CAPTURE_DELAY_MS = 1000;
const SLIDE_NAVIGATION_DELAY_MS = 500;
const SLIDE_COUNT_SELECTOR = '.player-v2-chrome-controls-slide-count';
const NEXT_BUTTON_SELECTOR = '.player-v2--button[aria-label="next"]';
const FIRST_SLIDE_BTN_SELECTOR = 'div.dash[data-test-id="dash-0"][idx="0"]';

// Helper: Detects which platform is active
function getPlatform() {
  if (window.location.hostname.includes('pitch.com')) return 'pitch';
  if (window.location.hostname.includes('docsend.com')) return 'docsend';
  return null;
}

async function goToFirstSlideDocSend() {
  const prevButton = document.getElementById('prevPageIcon');
  const currentSlideEl = document.getElementById('page-number');
  if (!prevButton || !currentSlideEl) throw new Error('Prev button or current slide element not found.');
  // Click prev until on first slide
  while (parseInt(currentSlideEl.textContent, 10) > 1) {
    prevButton.click();
    // Wait for slide to update
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}

// DocSend-adapted slide capture
async function captureSlides() {
  const platform = getPlatform();
  if (!platform) throw new Error('Unsupported site. Only Pitch.com and DocSend are supported.');

  let totalSlides, nextButton, getCurrentSlideIndex;

  if (platform === 'pitch') {
    // Pitch.com selectors
    const slideCountElement = document.querySelector('.player-v2-chrome-controls-slide-count');
    if (!slideCountElement) throw new Error('Slide count element not found.');
    totalSlides = parseInt(slideCountElement.textContent.split(' / ')[1]);
    if (isNaN(totalSlides)) throw new Error('Could not parse total slides.');
    nextButton = document.querySelector('.player-v2--button[aria-label="next"]');
    if (!nextButton) throw new Error('Next button not found.');
    getCurrentSlideIndex = () => {
      const text = slideCountElement.textContent;
      return parseInt(text.split(' / ')[0], 10);
    };
  } else if (platform === 'docsend') {
    // DocSend selectors
    const slideCountElement = document.querySelector('.toolbar-page-indicator');
    if (!slideCountElement) throw new Error('Slide count element not found.');
    const currentSlideEl = document.getElementById('page-number');
    if (!currentSlideEl) throw new Error('Current slide element not found.');
    const match = slideCountElement.textContent.match(/\d+\s*\/\s*(\d+)/);
    if (!match) throw new Error('Could not parse total slides.');
    totalSlides = parseInt(match[1], 10);
    nextButton = document.getElementById('nextPageIcon');
    if (!nextButton) throw new Error('Next button not found.');
    getCurrentSlideIndex = () => parseInt(currentSlideEl.textContent, 10);
    // Go to first slide before capturing
    await goToFirstSlideDocSend();
  }

  const slideImages = [];
  let currentSlide = getCurrentSlideIndex();

  for (let i = currentSlide; i <= totalSlides; i++) {
    // Wait for slide to render (adjust delay as needed)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Capture screenshot
    const dataUrl = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'captureTab' }, (dataUrl) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(dataUrl);
      });
    });

    slideImages.push(dataUrl);

    // Go to next slide if not last
    if (i < totalSlides) {
      nextButton.click();
    }
  }

  return slideImages;
}

async function exportPresentation() {
  try {
    // For Pitch, try to go to first slide if possible
    if (getPlatform() === 'pitch') {
      await goToFirstSlidePitch();
    }
    // For DocSend, go to first slide is handled in captureSlides
    const slideImages = await captureSlides();

    const pdf = new window.jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [1920, 980],
    });

    slideImages.forEach((image, index) => {
      if (index > 0) {
        pdf.addPage();
      }
      pdf.addImage(image, 'PNG', 0, 0, 1920, 980);
    });

    pdf.save('presentation.pdf');
  } catch (err) {
    alert('Failed to export presentation: ' + err.message);
    console.error(err);
  }
}

// Only for Pitch.com
async function goToFirstSlidePitch() {
  const slideCountElement = document.querySelector('.player-v2-chrome-controls-slide-count');
  if (!slideCountElement) throw new Error('Slide count element not found.');
  const slideCountText = slideCountElement.textContent;
  const [currentSlide] = slideCountText.split(' / ').map(Number);
  if (currentSlide !== 1) {
    const firstSlideBtn = document.querySelector('div.dash[data-test-id="dash-0"][idx="0"]');
    if (!firstSlideBtn) throw new Error('First slide button not found.');
    firstSlideBtn.click();
    // Wait for the slide to change and make sure the current slide is 1
    await new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (slideCountElement.textContent.startsWith('1 /')) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(slideCountElement, { childList: true, subtree: true });
    });
    // Add a short delay to ensure slide navigation is complete before capturing
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function init() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'exportPresentation') {
      exportPresentation().then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // Keep the message channel open for async response
    }
  });
}

init();
  