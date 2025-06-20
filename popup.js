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
  const prevBtn = getElementOrWarn('prevBtn');
  const nextBtn = getElementOrWarn('nextBtn');
  const currentPageSpan = getElementOrWarn('currentPage');
  const totalPagesSpan = getElementOrWarn('totalPages');

  // Valeurs fictives pour la démo UI (à remplacer par la vraie synchro avec la page)
  let currentPage = 1;
  let totalPages = 14;

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

  // Synchronisation réelle avec la page
  function updatePaginationFromTab(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'getSlideInfo' }, (info) => {
      if (info && typeof info.current === 'number' && typeof info.total === 'number') {
        currentPage = info.current;
        totalPages = info.total;
        updatePagination();
      }
    });
  }

  function goToNextSlideInTab(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'goToNextSlide' }, (info) => {
      if (info && typeof info.current === 'number' && typeof info.total === 'number') {
        currentPage = info.current;
        totalPages = info.total;
        updatePagination();
      }
    });
  }

  function goToPrevSlideInTab(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'goToPrevSlide' }, (info) => {
      if (info && typeof info.current === 'number' && typeof info.total === 'number') {
        currentPage = info.current;
        totalPages = info.total;
        updatePagination();
      }
    });
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
        // Initialiser la pagination réelle
        updatePaginationFromTab(tab.id);
        if (prevBtn) {
          prevBtn.addEventListener('click', () => goToPrevSlideInTab(tab.id));
        }
        if (nextBtn) {
          nextBtn.addEventListener('click', () => goToNextSlideInTab(tab.id));
        }
      } else {
        setInactiveVisible(true);
      }
      console.log(tab.url);
    });
  }

  function updatePagination() {
    if (currentPageSpan) currentPageSpan.textContent = currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  // Initialiser la pagination à l'ouverture
  updatePagination();

  checkTabAndInit();
});
