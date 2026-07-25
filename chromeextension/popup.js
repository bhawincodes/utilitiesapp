const statusEl = document.getElementById('status');
const refreshButton = document.getElementById('refresh');

function updateStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => {
    updateStatus('Refreshed');
  });
}

class TimeTracking {
  constructor() {
    this.currentTimerStart = null;
    this.currentDomain = null;
    this.currentTabId = null;
    this.addEventListeners();
  }

  addEventListeners() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onActivated.addListener((activeInfo) => {
        this.handleTabChange(activeInfo.tabId);
      });

      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.active) {
          this.handleTabChange(tabId);
        }
      });

      chrome.windows.onRemoved.addListener((windowId) => {
        this.stopAndSubmitTimer();
      });

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          this.handleTabChange(tabs[0].id);
        }
      });
    }
  }

  getDomainFromUrl(url) {
    if (!url) {
      return 'Unknown';
    }

    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.replace(/^www\./i, '');
    } catch (error) {
      return 'Unknown';
    }
  }

  startTimer(domain, tabId) {
    console.log("send timer")
    this.currentDomain = domain;
    this.currentTabId = tabId;
    this.currentTimerStart = Date.now();
    updateStatus(`Tracking ${domain}`);
  }

  stopAndSubmitTimer() {
    if (!this.currentDomain || !this.currentTimerStart) {
      return;
    }

    const elapsedMs = Date.now() - this.currentTimerStart;
    const seconds = Math.round(elapsedMs / 1000);
    const domain = this.currentDomain;

    this.currentTimerStart = null;
    this.currentDomain = null;
    this.currentTabId = null;

    this.sendTimerData(domain, seconds);
  }

  sendTimerData(domain, seconds) {
    if (!domain || domain === 'Unknown') {
      return;
    }

    fetch('http://localhost:8080/postTimer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domain, seconds })
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => {
        console.log('Timer posted successfully', data);
      })
      .catch((error) => {
        console.error('Failed to post timer', error);
      });
  }

  handleTabChange(tabId) {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }

      const domain = this.getDomainFromUrl(tab && tab.url ? tab.url : '');
      const title = tab && tab.title ? tab.title : 'Unknown tab';

      if (this.currentTimerStart && this.currentTabId !== null && this.currentTabId !== tabId) {
        this.stopAndSubmitTimer();
      }

      if (!this.currentTimerStart) {
        this.startTimer(domain, tabId);
      } else if (this.currentDomain !== domain || this.currentTabId !== tabId) {
        this.stopAndSubmitTimer();
        this.startTimer(domain, tabId);
      }

      updateStatus(`Active tab: ${domain} (${title})`);
    });
  }
}

new TimeTracking();
updateStatus('Tracking active tab...');

