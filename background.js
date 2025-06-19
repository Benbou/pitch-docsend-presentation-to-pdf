chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'captureTab') {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Capture failed:', chrome.runtime.lastError);
          sendResponse(null);
        } else {
          sendResponse(dataUrl);
        }
      });
      return true;
    }
    return false;
  });
  