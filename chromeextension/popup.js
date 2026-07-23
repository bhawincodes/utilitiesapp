const statusEl = document.getElementById('status');
const refreshButton = document.getElementById('refresh');

function updateStatus() {
  const timestamp = new Date().toLocaleTimeString();
  statusEl.textContent = `Last refreshed at ${timestamp}`;
}

refreshButton.addEventListener('click', updateStatus);
updateStatus();
