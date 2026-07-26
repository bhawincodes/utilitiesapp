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


chrome.runtime.sendMessage({ action: "START_PROCESS" }, (response) => {
  console.log("Background response:", response);
});



