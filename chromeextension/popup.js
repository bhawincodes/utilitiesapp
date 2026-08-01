const statusEl = document.getElementById('status');
const refreshButton = document.getElementById('refresh');

function updateStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function loadTrackingStatus() {
  chrome.storage.local.get(['trackingStatus'], (result) => {
    if (result.trackingStatus) {
      updateStatus(result.trackingStatus);
    }
  });
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => {
    loadTrackingStatus();
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.trackingStatus) {
    updateStatus(changes.trackingStatus.newValue);
  }
});

loadTrackingStatus();
