document.addEventListener('DOMContentLoaded', () => {
  function getElementOrWarn(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`Element with id '${id}' not found.`);
    }
    return el;
  }

  const statusMessage = getElementOrWarn('statusMessage');
  const instructions = getElementOrWarn('instructions');
  const inactiveMessage = getElementOrWarn('inactiveMessage');
  const exportBtn = getElementOrWarn('exportBtn');

  function setStatus(text) {
    if (statusMessage) {
      statusMessage.innerText = text;
      statusMessage.style.display = 'block';
    }
  }

  function setInstructionsVisible(visible) {
    if (instructions) instructions.style.display = visible ? 'block' : 'none';
  }

  function setInactiveVisible(visible) {
    if (inactiveMessage) inactiveMessage.style.display = visible ? 'block' : 'none';
  }

  function handleExportClick(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'exportPresentation' }, (response) => {
      console.log('Export response:', response, chrome.runtime.lastError);
      if (chrome.runtime.lastError || !response || !response.success) {
        setStatus('EXPORT FAILED');
        console.error('Popup error:', chrome.runtime.lastError, response?.error);
      } else {
        setStatus('EXPORT COMPLETE');
      }
    });
    setInstructionsVisible(false);
    setStatus('EXPORTING');
  }

  function isSupportedUrl(url) {
    return url.includes('pitch.com') || url.includes('docsend.com');
  }

  function checkTabAndInit() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        setInactiveVisible(true);
        return;
      }
      if (isSupportedUrl(tab.url)) {
        setInstructionsVisible(true);
        if (exportBtn) {
          exportBtn.addEventListener('click', () => handleExportClick(tab.id));
        }
      } else {
        setInactiveVisible(true);
      }
      console.log(tab.url);
    });
  }

  checkTabAndInit();
});
