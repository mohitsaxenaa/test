/**
 * Popup UI Controller
 * Manages the extension popup interface for toggling inspector
 */

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggle');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // Get current tab and check inspector state
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getState' });
    updateUI(response.enabled);
  } catch (error) {
    console.log('Content script not ready');
    updateUI(false);
  }

  /**
   * Handle toggle button click
   */
  toggleBtn.onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      updateUI(response.enabled);
    } catch (error) {
      console.error('Error toggling inspector:', error);
    }
  };

  /**
   * Update UI based on inspector state
   * @param {boolean} enabled - True if inspector is enabled
   */
  function updateUI(enabled) {
    if (enabled) {
      toggleBtn.textContent = '⊘ Disable Inspector';
      toggleBtn.classList.remove('off');
      statusDot.className = 'status-dot';
      statusText.textContent = 'Active';
      toggleBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
    } else {
      toggleBtn.textContent = '⊕ Enable Inspector';
      toggleBtn.classList.add('off');
      statusDot.className = 'status-dot off';
      statusText.textContent = 'Inactive';
      toggleBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    }
  }
});