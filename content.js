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
    if (prevButton.style.opacity === '0' || prevButton.style.display === 'none') break;
    prevButton.click();
    // Wait for slide to update
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}

async function waitForSlideNumber(target, getCurrentSlideIndex, el) {
  return new Promise(resolve => {
    // Fast path: already at target
    if (getCurrentSlideIndex() === target) {
      resolve();
      return;
    }
    // Observe text changes
    const observer = new MutationObserver(() => {
      if (getCurrentSlideIndex() === target) {
        observer.disconnect();
        clearInterval(interval);
        resolve();
      }
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    // Fallback: poll every 100ms in case observer misses it
    const interval = setInterval(() => {
      if (getCurrentSlideIndex() === target) {
        clearInterval(interval);
        observer.disconnect();
        resolve();
      }
    }, 100);
  });
}

function realClick(element) {
  if (!element) return;
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// DocSend-adapted slide capture
async function captureSlides() {
  const platform = getPlatform();
  if (!platform) throw new Error('Unsupported site. Only Pitch.com and DocSend are supported.');

  if (platform === 'pitch') {
    const slideCountElement = document.querySelector('.player-v2-chrome-controls-slide-count');
    const totalSlides = parseInt(slideCountElement.textContent.split(' / ')[1]);
    const nextButton = document.querySelector('.player-v2--button[aria-label="next"]');
    const slideImages = [];
    for (let i = 0; i < totalSlides; i++) {
      const dataUrl = await new Promise((resolve) => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'captureTab' }, (dataUrl) => {
            resolve(dataUrl);
          });
        }, 1000);
      });
      if (dataUrl) {
        slideImages.push(dataUrl);
      } else {
        console.warn('Screenshot failed, skipping this slide.');
      }
      if (i < totalSlides - 1) {
        nextButton.click();
      }
    }
    return slideImages;
  } else if (platform === 'docsend') {
    const slideCountElement = document.querySelector('.toolbar-page-indicator');
    if (!slideCountElement) throw new Error('Slide count element not found.');
    const currentSlideEl = document.getElementById('page-number');
    if (!currentSlideEl) throw new Error('Current slide element not found.');
    const match = slideCountElement.textContent.match(/\d+\s*\/\s*(\d+)/);
    if (!match) throw new Error('Could not parse total slides.');
    const totalSlides = parseInt(match[1], 10);
    const nextButton = document.getElementById('nextPageIcon');
    if (!nextButton) throw new Error('Next button not found.');
    await goToFirstSlideDocSend();
    const slideImages = [];
    for (let i = 0; i < totalSlides; i++) {
      const dataUrl = await new Promise((resolve) => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'captureTab' }, (dataUrl) => {
            resolve(dataUrl);
          });
        }, 1500);
      });
      if (dataUrl) {
        slideImages.push(dataUrl);
      } else {
        console.warn('Screenshot failed, skipping this slide.');
      }
      if (i < totalSlides - 1) {
        console.log('Before click, slide:', document.getElementById('page-number')?.textContent);
        realClick(nextButton);
        setTimeout(() => {
          console.log('After click, slide:', document.getElementById('page-number')?.textContent);
        }, 1000);
      }
    }
    return slideImages;
  }
}

async function exportPresentation() {
  try {
    if (getPlatform() === 'pitch') {
      await goToFirstSlidePitch();
    }
    const slideImages = await captureSlides();
    const pdf = new window.jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [1920, 980],
    });
    slideImages.forEach((image, index) => {
      if (!image) return;
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
  