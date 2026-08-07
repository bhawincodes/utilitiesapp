const API_URL = 'http://127.0.0.1:8000/domain-time';
const KEEPALIVE_ALARM = 'keepalive';
const FLUSH_ALARM = 'flushTimer';

let tracker = null;

function setStatus(message) {
  console.log('[TimeTracking]', message);
  chrome.storage.local.set({ trackingStatus: message });
}

function isTrackableUrl(url) {
  if (!url) {
    return false;
  }
  return url.startsWith('http://') || url.startsWith('https://');
}

class TimeTracking {
  constructor() {
    this.currentTimerStart = null;
    this.currentDomain = null;
    this.currentTabId = null;
    this.isWindowFocused = true;
    this.addEventListeners();
    this.ensureKeepalive();
    this.restoreAndResume();
  }

  ensureKeepalive() {
    if (!chrome.alarms) {
      return;
    }

    chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 1 });
    chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  }

  persistTimerState() {
    if (!this.currentTimerStart || !this.currentDomain) {
      chrome.storage.local.remove('timerState');
      return;
    }

    chrome.storage.local.set({
      timerState: {
        currentTimerStart: this.currentTimerStart,
        currentDomain: this.currentDomain,
        currentTabId: this.currentTabId,
      },
    });
  }

  restoreAndResume() {
    chrome.storage.local.get(['timerState'], (result) => {
      const state = result.timerState;
      if (state?.currentTimerStart && state?.currentDomain) {
        this.currentTimerStart = state.currentTimerStart;
        this.currentDomain = state.currentDomain;
        this.currentTabId = state.currentTabId ?? null;
        console.log('[TimeTracking] Restored session for', this.currentDomain);
      }

      this.trackActiveTab();
    });
  }

  trackActiveTab() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('[TimeTracking]', chrome.runtime.lastError.message);
        setStatus('Tracking idle (waiting for a tab)');
        return;
      }

      if (tabs && tabs[0]) {
        this.handleTabChange(tabs[0].id);
        return;
      }

      setStatus('Tracking idle (waiting for a tab)');
    });
  }

  addEventListeners() {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return;
    }

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabChange(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        this.handleTabChange(tabId);
      }
    });

    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.active && tab.id != null) {
        this.handleTabChange(tab.id);
      }
    });

    // Keep tracker alive: submit closed tab, then continue on the next active tab
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (this.currentTabId === tabId) {
        this.stopAndSubmitTimer();
      }
      // Do not shut down — pick up whatever tab is now active (if any)
      this.trackActiveTab();
    });

    chrome.windows.onCreated.addListener(() => {
      this.isWindowFocused = true;
      this.trackActiveTab();
    });

    chrome.windows.onRemoved.addListener(() => {
      // Submit current session, but leave the tracker running for the next window
      this.stopAndSubmitTimer();
      setStatus('Tracking idle (waiting for a window)');
    });

    if (chrome.windows.onFocusChanged) {
      chrome.windows.onFocusChanged.addListener((windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
          this.isWindowFocused = false;
          this.stopAndSubmitTimer();
          setStatus('Paused (Chrome unfocused)');
          return;
        }

        this.isWindowFocused = true;
        this.trackActiveTab();
      });
    }

    if (chrome.alarms) {
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === FLUSH_ALARM) {
          this.flushCurrentTimer();
        }
        if (alarm.name === KEEPALIVE_ALARM) {
          // Wake the service worker and re-assert keepalive + active tab
          this.ensureKeepalive();
          if (!this.currentTimerStart) {
            this.trackActiveTab();
          }
          console.log('[TimeTracking] Keepalive tick');
        }
      });
    }
  }

  getDomainFromUrl(url) {
    if (!isTrackableUrl(url)) {
      return null;
    }

    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.replace(/^www\./i, '');
    } catch (error) {
      return null;
    }
  }

  startTimer(domain, tabId) {
    if (!domain || !this.isWindowFocused) {
      return;
    }

    this.currentDomain = domain;
    this.currentTabId = tabId;
    this.currentTimerStart = Date.now();
    this.persistTimerState();
    setStatus(`Tracking ${domain}`);
  }

  stopAndSubmitTimer() {
    if (!this.currentDomain || !this.currentTimerStart) {
      return;
    }

    const elapsedMs = Date.now() - this.currentTimerStart;
    const timeSpent = Math.round(elapsedMs / 1000);
    const domain = this.currentDomain;

    this.currentTimerStart = null;
    this.currentDomain = null;
    this.currentTabId = null;
    this.persistTimerState();

    this.sendTimerData(domain, timeSpent);
  }

  flushCurrentTimer() {
    if (!this.currentDomain || !this.currentTimerStart) {
      return;
    }

    const elapsedMs = Date.now() - this.currentTimerStart;
    const timeSpent = Math.round(elapsedMs / 1000);
    const domain = this.currentDomain;

    this.currentTimerStart = Date.now();
    this.persistTimerState();

    this.sendTimerData(domain, timeSpent);
    setStatus(`Tracking ${domain}`);
  }

  sendTimerData(domain, timeSpent) {
    if (!domain || timeSpent < 1) {
      console.log('[TimeTracking] Skipping POST', { domain, timeSpent });
      return;
    }

    console.log('[TimeTracking] POST', API_URL, { domain, timeSpent });

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain, timeSpent }),
    })
      .then((response) => {
        console.log('[TimeTracking] Response status', response.status);
        return response.json().catch(() => ({}));
      })
      .then((data) => {
        console.log('[TimeTracking] Domain time posted successfully', data);
      })
      .catch((error) => {
        console.error('[TimeTracking] Failed to post domain time', error);
      });
  }

  handleTabChange(tabId) {
    if (typeof chrome === 'undefined' || !chrome.tabs || !this.isWindowFocused) {
      return;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab may already be gone — stay alive; onRemoved/onActivated will resume
        console.warn('[TimeTracking]', chrome.runtime.lastError.message);
        setStatus('Tracking idle (waiting for a tab)');
        return;
      }

      const domain = this.getDomainFromUrl(tab && tab.url ? tab.url : '');
      const title = tab && tab.title ? tab.title : 'Unknown tab';

      if (
        this.currentTimerStart &&
        this.currentTabId === tabId &&
        this.currentDomain === domain &&
        domain
      ) {
        setStatus(`Active tab: ${domain} (${title})`);
        return;
      }

      this.stopAndSubmitTimer();

      if (domain) {
        this.startTimer(domain, tabId);
        setStatus(`Active tab: ${domain} (${title})`);
      } else {
        setStatus(`Not tracking: ${tab?.url || 'non-http tab'}`);
      }
    });
  }
}

function ensureTracker() {
  if (!tracker) {
    tracker = new TimeTracking();
  }
  return tracker;
}

ensureTracker();

chrome.runtime.onInstalled.addListener(() => {
  ensureTracker();
  setStatus('Extension installed — tracking active');
});

chrome.runtime.onStartup.addListener(() => {
  ensureTracker();
  setStatus('Browser started — tracking active');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_PROCESS') {
    ensureTracker();
    setStatus('Tracking active tab...');
    sendResponse({ status: 'Started' });
  }
  return true;
});
