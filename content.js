/**
 * LocatorInspector - Advanced Web Element Locator Tool
 * Provides intelligent locator detection, ranking, and DOM/ARIA tree analysis
 * for test automation frameworks (Playwright, Selenium)
 */
class LocatorInspector {
  constructor() {
    this.enabled = false;
    this.tooltip = null;
    this.selectedElement = null;
    this.panel = null;
    this.lastHighlighted = null;
    this.draggedListeners = new Map(); // Track event listeners for cleanup
    
    this.init();
  }

  /**
   * Initialize the inspector
   * Sets up message listeners from popup and other components
   */
  init() {
    this.setupMessageListener();
  }

  /**
   * Setup chrome message listener for communication with popup
   * Handles: toggle, getState, getCurrentElement, getDOMTree, getARIATree, closePanel
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        switch (request.action) {
          case 'toggle':
            this.toggle();
            sendResponse({ enabled: this.enabled });
            break;
            
          case 'getState':
            sendResponse({ enabled: this.enabled });
            break;
            
          case 'getCurrentElement':
            if (this.selectedElement) {
              sendResponse(this.buildLocatorInfo(this.selectedElement));
            }
            break;
            
          case 'getElementJSON':
            if (this.selectedElement) {
              sendResponse(this.getElementData(this.selectedElement));
            }
            break;
            
          case 'getDOMTree':
            sendResponse(this.getFullDOMTree());
            break;
            
          case 'getARIATree':
            sendResponse(this.getFullARIATree());
            break;
            
          case 'closePanel':
            this.closePanel();
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
      }
      return true;
    });
  }

  /**
   * Toggle inspector on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    
    if (this.enabled) {
      this.activate();
    } else {
      this.deactivate();
    }
  }

  /**
   * Activate inspector - attach event listeners
   */
  activate() {
    this.createTooltip();
    document.addEventListener('mouseover', this.onMouseOver.bind(this));
    document.addEventListener('mouseout', this.onMouseOut.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('click', this.onClick.bind(this));
    
    console.log('✓ Locator Inspector Activated');
  }

  /**
   * Deactivate inspector - remove event listeners and cleanup
   */
  deactivate() {
    this.removeTooltip();
    this.removeHighlight();
    document.removeEventListener('mouseover', this.onMouseOver.bind(this));
    document.removeEventListener('mouseout', this.onMouseOut.bind(this));
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('click', this.onClick.bind(this));
    
    this.closePanel();
    console.log('✓ Locator Inspector Deactivated');
  }

  /**
   * Handle mouse over events - highlight elements and show tooltip
   */
  onMouseOver(event) {
    if (!this.enabled || event.target === this.tooltip) return;
    
    event.stopPropagation();
    const element = event.target;
    
    this.removeHighlight();
    this.highlightElement(element);
    this.selectedElement = element;
    
    const info = this.buildLocatorInfo(element);
    this.showTooltip(info, event.pageX, event.pageY);
  }

  /**
   * Handle mouse out events - hide tooltip
   */
  onMouseOut(event) {
    if (!this.enabled || event.target === this.tooltip) return;
    
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  /**
   * Handle keyboard shortcuts
   * Alt+X: Open detail panel
   * Alt+C: Copy best locator
   * Alt+E: Export DOM tree
   */
  onKeyDown(event) {
    if (!this.enabled) return;
    
    if (event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'x':
          event.preventDefault();
          this.openPanel();
          break;
          
        case 'c':
          event.preventDefault();
          this.copyBestLocator();
          break;
          
        case 'e':
          event.preventDefault();
          this.exportDOMTree();
          break;
      }
    }
  }

  /**
   * Handle click events - prevent tooltip interference
   */
  onClick(event) {
    if (!this.enabled) return;
    
    if (event.target === this.tooltip || this.tooltip?.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // ==================== TOOLTIP METHODS ====================

  /**
   * Create tooltip DOM element
   */
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'locator-tooltip';
    document.body.appendChild(this.tooltip);
  }

  /**
   * Remove tooltip DOM element
   */
  removeTooltip() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  /**
   * Display tooltip with best locator information
   * @param {Object} info - Element info from buildLocatorInfo
   * @param {number} x - Mouse X coordinate
   * @param {number} y - Mouse Y coordinate
   */
  showTooltip(info, x, y) {
    if (!this.tooltip) return;
    
    const bestLocator = info.locators[0];
    
    this.tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tag">&lt;${info.tag}&gt;</span>
        <span class="score">${bestLocator.score}/100</span>
      </div>
      <div class="tooltip-body">
        <div class="locator-display">
          <code>${bestLocator.value}</code>
          <button class="copy-btn" title="Copy">📋</button>
        </div>
        <div class="locator-type">${bestLocator.type.toUpperCase()} • ${bestLocator.stability}</div>
        <div class="tooltip-hint">Alt+X for panel • Alt+C to copy</div>
      </div>
    `;
    
    this.tooltip.style.top = `${y + 15}px`;
    this.tooltip.style.left = `${x + 15}px`;
    this.tooltip.style.display = 'block';
    
    this.tooltip.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(bestLocator.value).then(() => {
        this.showNotification('✓ Locator copied!');
      });
    });
    
    this.makeDraggable(this.tooltip);
  }

  /**
   * Make tooltip draggable
   * @param {HTMLElement} element - Element to make draggable
   */
  makeDraggable(element) {
    let isDragging = false;
    let offsetX, offsetY;
    
    const mouseDown = (e) => {
      isDragging = true;
      offsetX = e.clientX - element.offsetLeft;
      offsetY = e.clientY - element.offsetTop;
      e.preventDefault();
    };
    
    const mouseMove = (e) => {
      if (!isDragging) return;
      element.style.left = `${e.clientX - offsetX}px`;
      element.style.top = `${e.clientY - offsetY}px`;
    };
    
    const mouseUp = () => {
      isDragging = false;
    };
    
    element.addEventListener('mousedown', mouseDown);
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mouseup', mouseUp);
  }

  // ==================== HIGHLIGHT METHODS ====================

  /**
   * Add visual highlight to element
   * @param {HTMLElement} element - Element to highlight
   */
  highlightElement(element) {
    this.removeHighlight();
    
    element.style.outline = '2px solid #667eea';
    element.style.outlineOffset = '2px';
    element.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.2)';
    element.style.transition = 'outline 0.2s';
    
    this.lastHighlighted = element;
  }

  /**
   * Remove highlight from last highlighted element
   */
  removeHighlight() {
    if (this.lastHighlighted) {
      this.lastHighlighted.style.outline = '';
      this.lastHighlighted.style.boxShadow = '';
      this.lastHighlighted = null;
    }
  }

  // ==================== PANEL METHODS ====================

  /**
   * Open detail panel with full element analysis
   */
  openPanel() {
    if (this.panel) {
      this.panel.remove();
    }
    
    const container = document.createElement('div');
    container.id = 'locator-panel-container';
    
    fetch(chrome.runtime.getURL('panel.html'))
      .then(res => res.text())
      .then(html => {
        container.innerHTML = html;
        document.body.appendChild(container);
        this.panel = container;
        
        this.initializePanelListeners();
        
        if (this.selectedElement) {
          const elementData = this.buildLocatorInfo(this.selectedElement);
          this.populatePanel(elementData);
        }
      })
      .catch(error => console.error('Failed to load panel:', error));
  }

  /**
   * Initialize panel event listeners
   * Handles tab switching, copy buttons, and close button
   */
  initializePanelListeners() {
    if (!this.panel) return;
    
    // Tab switching
    const tabBtns = this.panel.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Control buttons
    const copyJsonBtn = this.panel.querySelector('#copy-json');
    const copyDomBtn = this.panel.querySelector('#copy-dom-tree');
    const copyAriaBtn = this.panel.querySelector('#copy-aria-tree');
    const closeBtn = this.panel.querySelector('#close-panel');
    
    if (copyJsonBtn) copyJsonBtn.addEventListener('click', () => this.copyPanelJSON());
    if (copyDomBtn) copyDomBtn.addEventListener('click', () => this.copyPanelDOMTree());
    if (copyAriaBtn) copyAriaBtn.addEventListener('click', () => this.copyPanelARIATree());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closePanel());

    // Locator copy buttons
    const locatorBtns = this.panel.querySelectorAll('.copy-locator');
    locatorBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const locator = e.target.dataset.locator;
        navigator.clipboard.writeText(locator).then(() => {
          this.showNotification('✓ Locator copied!');
        });
      });
    });
  }

  /**
   * Switch active tab in panel
   * @param {string} tabId - Tab identifier (dom, aria, attributes)
   */
  switchTab(tabId) {
    if (!this.panel) return;
    
    this.panel.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    this.panel.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabId}-content`);
    });
  }

  /**
   * Close detail panel
   */
  closePanel() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /**
   * Populate panel with element data
   * @param {Object} data - Element information from buildLocatorInfo
   */
  populatePanel(data) {
    if (!this.panel) return;
    
    // Update summary
    const summary = this.panel.querySelector('#element-summary');
    if (summary) {
      summary.innerHTML = `
        <div class="summary-item">
          <span class="label">Element:</span>
          <code>&lt;${data.tag}&gt;</code>
        </div>
        <div class="summary-item">
          <span class="label">Position:</span>
          <span>${data.position.x}, ${data.position.y}</span>
        </div>
        <div class="summary-item">
          <span class="label">Size:</span>
          <span>${data.size.width}×${data.size.height}</span>
        </div>
        <div class="summary-item">
          <span class="label">Visible:</span>
          <span>${data.isVisible ? '✓ Yes' : '✗ No'}</span>
        </div>
      `;
    }

    // Update locator ranking table
    this.populateLocatorTable(data);
    
    // Update tabs content
    this.populateTabs(data);
    
    // Update recommendations
    this.populateRecommendations(data);
  }

  /**
   * Populate locator ranking table
   * @param {Object} data - Element information
   */
  populateLocatorTable(data) {
    const tbody = this.panel.querySelector('#locator-table-body');
    if (!tbody) return;

    tbody.innerHTML = data.locators.map((locator, index) => {
      const displayValue = locator.type === 'role' && locator.accessibleName 
        ? `role="${locator.accessibleName}"`
        : locator.value;
      
      return `
        <tr>
          <td class="rank-cell">#${index + 1}</td>
          <td>
            <span class="locator-type ${locator.type}">
              ${locator.type}
            </span>
          </td>
          <td>
            <code class="locator-value">${this.escapeHtml(displayValue)}</code>
            ${locator.accessibleName && locator.type === 'role' ? `<div class="accessible-name">Name: "${locator.accessibleName}"</div>` : ''}
          </td>
          <td>
            <div class="score-bar">
              <div class="score-fill" style="width: ${locator.score}%"></div>
              <span class="score-text">${locator.score}</span>
            </div>
          </td>
          <td><span class="stability ${locator.stability}">${locator.stability}</span></td>
          <td>
            <button class="copy-locator" data-locator="${locator.value}" title="Copy">📋</button>
          </td>
        </tr>
      `;
    }).join('');
    
    // Re-attach copy listeners
    this.panel.querySelectorAll('.copy-locator').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const locator = e.target.dataset.locator;
        navigator.clipboard.writeText(locator).then(() => {
          this.showNotification('✓ Locator copied!');
        });
      });
    });
  }

  /**
   * Populate DOM and ARIA tree tabs
   * @param {Object} data - Element information
   */
  populateTabs(data) {
    const domSnippet = this.panel.querySelector('#dom-snippet');
    if (domSnippet) {
      domSnippet.textContent = data.domSnippet;
    }

    const ariaTree = this.panel.querySelector('#aria-tree');
    if (ariaTree) {
      ariaTree.textContent = JSON.stringify(data.ariaTree, null, 2);
    }

    const attrTable = this.panel.querySelector('#attributes-table');
    if (attrTable) {
      attrTable.innerHTML = '<tr><th>Attribute</th><th>Value</th></tr>' + 
        Object.entries(data.attributes).map(([key, value]) => `
          <tr>
            <td><code>${key}</code></td>
            <td><code>${this.escapeHtml(value)}</code></td>
          </tr>
        `).join('');
    }
  }

  /**
   * Populate recommendations with best locator and framework code
   * @param {Object} data - Element information
   */
  populateRecommendations(data) {
    const recommendations = this.panel.querySelector('#recommendations');
    if (!recommendations || data.locators.length === 0) return;

    const bestLocator = data.locators[0];
    const playwrightCode = this.convertToPlaywright(bestLocator);
    const seleniumCode = this.convertToSelenium(bestLocator);
    
    recommendations.innerHTML = `
      <div class="recommendation best">
        <strong>Best Locator</strong>
        <code>${this.escapeHtml(bestLocator.value)}</code>
        ${bestLocator.accessibleName ? `<div class="accessible-name-box">Accessible Name: <strong>"${bestLocator.accessibleName}"</strong></div>` : ''}
        <p><small>${bestLocator.reason}</small></p>
      </div>
      <div class="recommendation code-section">
        <strong>Framework Code</strong>
        <div class="framework-codes">
          <div class="code-block">
            <h4>Playwright</h4>
            <code>${this.escapeHtml(playwrightCode)}</code>
            <button class="copy-code" data-code="${playwrightCode}">📋</button>
          </div>
          <div class="code-block">
            <h4> Selenium</h4>
            <code>${this.escapeHtml(seleniumCode)}</code>
            <button class="copy-code" data-code="${seleniumCode}">📋</button>
          </div>
        </div>
      </div>
    `;
    
    // Attach copy code listeners
    this.panel.querySelectorAll('.copy-code').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.target.dataset.code;
        navigator.clipboard.writeText(code).then(() => {
          this.showNotification('✓ Code copied!');
        });
      });
    });
  }

  /**
   * Copy element JSON data to clipboard
   */
  copyPanelJSON() {
    if (!this.selectedElement) return;
    const data = this.getElementData(this.selectedElement);
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      this.showNotification('✓ JSON copied!');
    });
  }

  /**
   * Copy full DOM tree to clipboard
   */
  copyPanelDOMTree() {
    const tree = this.getFullDOMTree();
    navigator.clipboard.writeText(JSON.stringify(tree, null, 2)).then(() => {
      this.showNotification('✓ DOM tree copied!');
    });
  }

  /**
   * Copy ARIA tree to clipboard
   */
  copyPanelARIATree() {
    const tree = this.getFullARIATree();
    navigator.clipboard.writeText(JSON.stringify(tree, null, 2)).then(() => {
      this.showNotification('✓ ARIA tree copied!');
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Escape HTML special characters for safe display
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Show notification toast message
   * @param {string} message - Message to display
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'locator-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #48bb78;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000000;
      font-family: sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
    
    // Add CSS animations if not exists
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ==================== LOCATOR GENERATION & RANKING ====================

  /**
   * Build complete locator information for element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} Complete locator info with ranking
   */
  buildLocatorInfo(element) {
    const locators = this.generateLocators(element);
    const rankedLocators = this.rankLocators(locators, element);
    
    return {
      tag: element.tagName.toLowerCase(),
      position: {
        x: Math.round(element.getBoundingClientRect().x),
        y: Math.round(element.getBoundingClientRect().y)
      },
      size: {
        width: Math.round(element.offsetWidth),
        height: Math.round(element.offsetHeight)
      },
      isVisible: this.isElementVisible(element),
      locators: rankedLocators,
      domSnippet: this.getDomSnippet(element),
      ariaTree: this.getAriaTree(element),
      attributes: this.getAllAttributes(element)
    };
  }

  /**
   * Generate all possible locators for element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Array} Array of locator objects
   */
  generateLocators(element) {
    const locators = [];
    
    // 1. Test ID - Data attributes for testing
    const testId = element.getAttribute('data-testid') || 
                   element.getAttribute('data-test-id') ||
                   element.getAttribute('data-test') ||
                   element.getAttribute('data-qa') ||
                   element.getAttribute('data-cy');
    
    if (testId) {
      locators.push({
        type: 'test-id',
        value: `[data-testid="${testId}"]`,
        reason: 'Explicit test identifier',
        queryType: 'css'
      });
    }
    
    // 2. ARIA Role with accessible name (HIGHEST PRIORITY)
    const role = element.getAttribute('role') || this.getImplicitRole(element);
    const accessibleName = this.getAccessibleName(element);
    if (role && accessibleName) {
      locators.push({
        type: 'role',
        value: `role="${role}"`,
        reason: 'ARIA role with accessible name',
        queryType: 'css',
        accessibleName: accessibleName
      });
    }
    
    // 3. ARIA Label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      locators.push({
        type: 'aria-label',
        value: `[aria-label="${ariaLabel}"]`,
        reason: 'Accessibility label',
        queryType: 'css'
      });
    }
    
    // 4. ARIA Role attribute only
    const ariaRole = element.getAttribute('role');
    if (ariaRole && !accessibleName) {
      locators.push({
        type: 'role-attr',
        value: `[role="${ariaRole}"]`,
        reason: 'ARIA role attribute',
        queryType: 'css'
      });
    }
    
    // 5. Form label association
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        const labelText = label.textContent.trim();
        locators.push({
          type: 'label',
          value: `label:has-text("${labelText}")`,
          reason: 'Form label association',
          queryType: 'playwright'
        });
      }
    }
    
    // 6. Text content
    const text = this.getStableText(element);
    if (text && text.length < 100) {
      locators.push({
        type: 'text',
        value: `text="${text}"`,
        reason: 'Visible text content',
        queryType: 'playwright'
      });
    }
    
    // 7. Placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      locators.push({
        type: 'placeholder',
        value: `[placeholder="${placeholder}"]`,
        reason: 'Input placeholder',
        queryType: 'css'
      });
    }
    
    // 8. Alt text (images)
    const alt = element.getAttribute('alt');
    if (alt) {
      locators.push({
        type: 'alt',
        value: `img[alt="${alt}"]`,
        reason: 'Image alt text',
        queryType: 'css'
      });
    }
    
    // 9. Title attribute
    const title = element.getAttribute('title');
    if (title) {
      locators.push({
        type: 'title',
        value: `[title="${title}"]`,
        reason: 'Title attribute',
        queryType: 'css'
      });
    }
    
    // 10. Name attribute
    const name = element.getAttribute('name');
    if (name) {
      locators.push({
        type: 'name',
        value: `[name="${name}"]`,
        reason: 'Form element name',
        queryType: 'css'
      });
    }
    
    // 11. ID attribute
    if (element.id && !element.id.includes(':')) {
      locators.push({
        type: 'id',
        value: `#${element.id}`,
        reason: 'Element ID',
        queryType: 'css'
      });
    }
    
    // 12. CSS Selector
    const cssSelector = this.generateCssSelector(element);
    if (cssSelector) {
      locators.push({
        type: 'css',
        value: cssSelector,
        reason: 'CSS selector',
        queryType: 'css'
      });
    }
    
    // 13. XPath
    const xpath = this.generateXPath(element);
    locators.push({
      type: 'xpath',
      value: xpath,
      reason: 'XPath selector',
      queryType: 'xpath'
    });
    
    return locators;
  }

  /**
   * Get implicit ARIA role for semantic HTML elements
   * @param {HTMLElement} element - Element to analyze
   * @returns {string|null} Implicit role or null
   */
  getImplicitRole(element) {
    const roleMap = {
      'BUTTON': 'button',
      'A': 'link',
      'INPUT': 'textbox',
      'TEXTAREA': 'textbox',
      'SELECT': 'combobox',
      'H1': 'heading',
      'H2': 'heading',
      'H3': 'heading',
      'H4': 'heading',
      'H5': 'heading',
      'H6': 'heading',
      'NAV': 'navigation',
      'MAIN': 'main',
      'FORM': 'form'
    };
    
    let role = roleMap[element.tagName];
    
    // Special handling for input types
    if (element.tagName === 'INPUT') {
      const type = element.getAttribute('type');
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit') return 'button';
      if (type === 'button') return 'button';
    }
    
    return role || null;
  }

  /**
   * Get accessible name of element following ARIA spec
   * @param {HTMLElement} element - Element to analyze
   * @returns {string|null} Accessible name or null
   */
  getAccessibleName(element) {
    // 1. aria-label takes precedence
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // 2. aria-labelledby references
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }
    
    // 3. Button/link text content
    if (element.tagName === 'BUTTON') {
      const text = element.textContent.trim();
      if (text) return text;
    }
    
    // 4. Input - associated label or placeholder
    if (element.tagName === 'INPUT') {
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent.trim();
      }
      const placeholder = element.getAttribute('placeholder');
      if (placeholder) return placeholder;
    }
    
    // 5. Link text
    if (element.tagName === 'A') {
      const text = element.textContent.trim();
      if (text) return text;
    }
    
    // 6. Image alt text
    if (element.tagName === 'IMG') {
      const alt = element.getAttribute('alt');
      if (alt) return alt;
    }
    
    return null;
  }

  /**
   * Rank locators by score
   * @param {Array} locators - Array of locator objects
   * @param {HTMLElement} element - Element for context
   * @returns {Array} Ranked locators with scores
   */
  rankLocators(locators, element) {
    return locators.map(locator => {
      const score = this.calculateScore(locator, element);
      return {
        ...locator,
        score: Math.round(score),
        stability: this.getStabilityLevel(score)
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate locator score based on type, uniqueness, and characteristics
   * @param {Object} locator - Locator object
   * @param {HTMLElement} element - Element for context
   * @returns {number} Score 0-100
   */
  calculateScore(locator, element) {
    let score = 50; // Base score
    
    // Type-based scoring (most important factor)
    const typeBonuses = {
      'role': 90,           // Best - semantic + accessible name
      'test-id': 85,        // Explicit test identifier
      'aria-label': 80,     // Accessibility label
      'role-attr': 70,      // Role without accessible name
      'name': 60,           // Form element name
      'id': 55,             // Element ID
      'placeholder': 50,    // Input placeholder
      'label': 45,          // Form label
      'alt': 40,            // Image alt
      'title': 35,          // Title attribute
      'text': 20,           // Text content (fragile)
      'css': 15,            // CSS selector (fragile)
      'xpath': 10           // XPath (most fragile)
    };
    
    score += typeBonuses[locator.type] || 0;
    
    // Uniqueness penalty/bonus
    let matchCount = this.getMatchCount(locator);
    
    if (matchCount === 1) {
      score += 10; // Perfect - unique locator
    } else if (matchCount > 1) {
      score -= (matchCount - 1) * 5; // Penalty for non-unique
    } else if (matchCount === 0) {
      score -= 20; // Penalty for invalid
    }
    
    // Penalize dynamic content
    if (this.hasDynamicParts(locator.value)) {
      score -= 30;
    }
    
    // Bonus for visible elements
    if (this.isElementVisible(element)) {
      score += 5;
    }
    
    // Bonus for short, clean selectors
    if (locator.value.length < 30) {
      score += 5;
    } else if (locator.value.length > 150) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Count matching elements for locator
   * @param {Object} locator - Locator object
   * @returns {number} Number of matches
   */
  getMatchCount(locator) {
    let matchCount = 0;
    
    try {
      if (locator.queryType === 'xpath') {
        try {
          const result = document.evaluate(
            locator.value,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          matchCount = result.snapshotLength;
        } catch (e) {
          matchCount = 0;
        }
      } else if (locator.queryType === 'css') {
        try {
          matchCount = document.querySelectorAll(locator.value).length;
        } catch (e) {
          matchCount = 0;
        }
      } else if (locator.queryType === 'playwright') {
        const est = locator.value
          .replace(/text="[^"]*"/, '')
          .replace(/label:has-text\("[^"]*"\)/, 'label')
          .replace(/"/g, '');
        try {
          matchCount = document.querySelectorAll(est).length || 1;
        } catch (e) {
          matchCount = 1;
        }
      }
    } catch (e) {
      matchCount = 0;
    }
    
    return matchCount;
  }

  /**
   * Get stability level name based on score
   * @param {number} score - Score 0-100
   * @returns {string} Stability level name
   */
  getStabilityLevel(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  /**
   * Get stable text content (remove extra whitespace)
   * @param {HTMLElement} element - Element to extract text from
   * @returns {string|null} Stable text or null
   */
  getStableText(element) {
    const text = element.textContent?.trim();
    if (!text) return null;
    return text.replace(/\s+/g, ' ').substring(0, 100);
  }

  /**
   * Generate CSS selector path for element
   * @param {HTMLElement} element - Element to analyze
   * @returns {string} CSS selector
   */
  generateCssSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const parts = [];
    let current = element;
    let depth = 0;
    
    while (current && current !== document.body && depth < 5) {
      let selector = current.tagName.toLowerCase();
      
      // Add class if available
      if (current.className && typeof current.className === 'string') {
        const firstClass = current.className.split(' ')[0];
        if (firstClass && !firstClass.includes(':')) {
          selector += `.${firstClass}`;
        }
      }
      
      // Add identifying attributes
      const attributes = ['name', 'placeholder', 'title', 'type'];
      for (const attr of attributes) {
        const value = current.getAttribute(attr);
        if (value && !this.hasDynamicParts(value)) {
          selector += `[${attr}="${value}"]`;
          break;
        }
      }
      
      parts.unshift(selector);
      current = current.parentElement;
      depth++;
    }
    
    return parts.join(' > ');
  }

  /**
   * Generate XPath for element
   * @param {HTMLElement} element - Element to analyze
   * @returns {string} XPath expression
   */
  generateXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    const parts = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current;
      
      while (sibling = sibling.previousElementSibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
      }
      
      const tagName = current.tagName.toLowerCase();
      const part = index ? `${tagName}[${index + 1}]` : tagName;
      parts.unshift(part);
      
      if (current === document.documentElement) break;
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }

  // ==================== DATA EXTRACTION METHODS ====================

  /**
   * Get DOM snippet of element
   * @param {HTMLElement} element - Element to extract
   * @param {number} maxLength - Maximum character length
   * @returns {string} HTML snippet
   */
  getDomSnippet(element, maxLength = 200) {
    const outerHTML = element.outerHTML;
    if (outerHTML.length <= maxLength) return outerHTML;
    
    const match = outerHTML.match(/^<[^>]+>/);
    if (match) {
      return match[0] + '...';
    }
    
    return outerHTML.substring(0, maxLength) + '...';
  }

  /**
   * Get ARIA tree path to element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Array} ARIA tree objects
   */
  getAriaTree(element) {
    const tree = [];
    let current = element;
    let depth = 0;
    
    while (current && depth < 10) {
      const node = {
        tag: current.tagName.toLowerCase(),
        role: current.getAttribute('role'),
        'aria-label': current.getAttribute('aria-label'),
        'aria-describedby': current.getAttribute('aria-describedby'),
        'aria-labelledby': current.getAttribute('aria-labelledby'),
        'aria-hidden': current.getAttribute('aria-hidden'),
        tabindex: current.getAttribute('tabindex')
      };
      
      Object.keys(node).forEach(key => node[key] === null && delete node[key]);
      
      if (Object.keys(node).length > 1) {
        tree.unshift(node);
      }
      
      if (current === document.documentElement) break;
      current = current.parentElement;
      depth++;
    }
    
    return tree;
  }

  /**
   * Get all attributes of element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} Key-value pairs of attributes
   */
  getAllAttributes(element) {
    const attributes = {};
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  /**
   * Get complete element data including locators and metadata
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} Complete element data
   */
  getElementData(element) {
    return {
      ...this.buildLocatorInfo(element),
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  }

  /**
   * Get full DOM tree of page
   * @returns {Object} Complete DOM tree structure
   */
  getFullDOMTree() {
    const serializeNode = (node, depth = 0) => {
      if (depth > 20) return null;
      
      const result = {
        nodeName: node.nodeName,
        nodeType: node.nodeType
      };
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        result.tagName = node.tagName.toLowerCase();
        result.attributes = {};
        
        for (const attr of node.attributes) {
          result.attributes[attr.name] = attr.value;
        }
        
        result.children = [];
        for (const child of node.childNodes) {
          const childResult = serializeNode(child, depth + 1);
          if (childResult) {
            result.children.push(childResult);
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          result.textContent = text;
        }
      }
      
      return result;
    };
    
    return serializeNode(document.documentElement);
  }

  /**
   * Get full ARIA-enabled elements tree
   * @returns {Object} ARIA tree with metadata
   */
  getFullARIATree() {
    const ariaNodes = [];
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    
    let node;
    const processedNodes = new Set();
    
    while (node = walker.nextNode()) {
      if (processedNodes.has(node)) continue;
      processedNodes.add(node);
      
      // Skip scripts and hidden content
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) continue;
      
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      
      // Build ARIA node
      const ariaNode = {
        tag: node.tagName.toLowerCase(),
        role: node.getAttribute('role'),
        'aria-label': node.getAttribute('aria-label'),
        'aria-labelledby': node.getAttribute('aria-labelledby'),
        'aria-describedby': node.getAttribute('aria-describedby'),
        'aria-hidden': node.getAttribute('aria-hidden'),
        'aria-expanded': node.getAttribute('aria-expanded'),
        'aria-pressed': node.getAttribute('aria-pressed'),
        'aria-checked': node.getAttribute('aria-checked'),
        'aria-selected': node.getAttribute('aria-selected'),
        'aria-disabled': node.getAttribute('aria-disabled'),
        'aria-readonly': node.getAttribute('aria-readonly'),
        'aria-required': node.getAttribute('aria-required'),
        'aria-invalid': node.getAttribute('aria-invalid'),
        'aria-live': node.getAttribute('aria-live'),
        'aria-atomic': node.getAttribute('aria-atomic'),
        'aria-relevant': node.getAttribute('aria-relevant'),
        tabindex: node.getAttribute('tabindex'),
        id: node.id || undefined,
        name: node.getAttribute('name'),
        dataTestId: node.getAttribute('data-testid'),
        textContent: node.textContent?.trim().substring(0, 100)
      };
      
      // Remove null/undefined values
      Object.keys(ariaNode).forEach(key => {
        const val = ariaNode[key];
        if (val === null || val === undefined || val === false) {
          delete ariaNode[key];
        }
      });
      
      // Include if semantically meaningful
      const hasAriaAttr = ['role', 'aria-label', 'aria-expanded', 'aria-pressed'].some(attr => ariaNode[attr]);
      const isSemanticHTML = /^H[1-6]$|BUTTON|A|FORM|INPUT|SELECT|TEXTAREA/.test(node.tagName);
      const hasIdentifier = ariaNode.id || ariaNode.name || ariaNode.dataTestId;
      const hasContent = ariaNode.textContent && ariaNode.textContent.length > 0;
      
      if (hasAriaAttr || isSemanticHTML || hasIdentifier || hasContent) {
        ariaNodes.push(ariaNode);
      }
    }
    
    return {
      totalAriaNodes: ariaNodes.length,
      ariaNodes: ariaNodes,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if element is visible in viewport
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if visible
   */
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return !!(rect.width && rect.height &&
             style.visibility !== 'hidden' &&
             style.display !== 'none' &&
             style.opacity !== '0');
  }

  /**
   * Check if string contains dynamic parts (IDs, timestamps, UUIDs, etc.)
   * @param {string} str - String to check
   * @returns {boolean} True if dynamic
   */
  hasDynamicParts(str) {
    if (!str) return false;
    
    const dynamicPatterns = [
      /\d{4,}/,                                                // Long numbers
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUID
      /#[0-9a-f]{6}/i,                                         // Hex colors
      /jss\d+/i,                                               // JSS classes
      /[a-z]+\d+[a-z]+\d+/i,                                   // Mixed alphanumeric
      /:\d+/,                                                  // Port numbers
      /[0-9]{13,}/                                             // Timestamps
    ];
    
    return dynamicPatterns.some(pattern => pattern.test(str));
  }

  /**
   * Copy best locator to clipboard
   */
  copyBestLocator() {
    if (!this.selectedElement) return;
    
    const info = this.buildLocatorInfo(this.selectedElement);
    const bestLocator = info.locators[0];
    
    navigator.clipboard.writeText(bestLocator.value).then(() => {
      this.showNotification('✓ Best locator copied!');
    });
  }

  /**
   * Export DOM tree as JSON file
   */
  exportDOMTree() {
    const domTree = this.getFullDOMTree();
    const dataStr = JSON.stringify(domTree, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `dom-tree-${Date.now()}.json`);
    linkElement.click();
    
    this.showNotification('✓ DOM tree exported!');
  }

  // ==================== FRAMEWORK CONVERSION METHODS ====================

  /**
   * Convert locator to framework-specific code
   * @param {Object} locator - Locator object
   * @param {string} framework - 'playwright' or 'selenium'
   * @returns {string} Framework-specific code
   */
  convertToFramework(locator, framework) {
    switch (framework.toLowerCase()) {
      case 'playwright':
        return this.convertToPlaywright(locator);
      case 'selenium':
        return this.convertToSelenium(locator);
      default:
        return locator.value;
    }
  }

  /**
   * Convert locator to Playwright code
   * @param {Object} locator - Locator object
   * @returns {string} Playwright code
   */
  convertToPlaywright(locator) {
    const { type, value, accessibleName } = locator;
    
    switch (type) {
      case 'test-id':
        const testId = value.match(/data-testid="([^"]+)"/)?.[1];
        return testId ? `page.getByTestId('${testId}')` : value;
      
      case 'role':
        const roleMatch = value.match(/role="([^"]+)"/);
        if (roleMatch && accessibleName) {
          return `page.getByRole('${roleMatch[1]}', { name: '${accessibleName}' })`;
        }
        return value;
      
      case 'role-attr':
        const role = value.match(/role="([^"]+)"/)?.[1];
        return role ? `page.getByRole('${role}')` : value;
      
      case 'aria-label':
        const ariaLabel = value.match(/aria-label="([^"]+)"/)?.[1];
        return ariaLabel ? `page.getByLabel('${ariaLabel}')` : value;
      
      case 'text':
        const text = value.match(/text="([^"]+)"/)?.[1];
        return text ? `page.getByText('${text}')` : value;
      
      case 'placeholder':
        const placeholder = value.match(/placeholder="([^"]+)"/)?.[1];
        return placeholder ? `page.getByPlaceholder('${placeholder}')` : value;
      
      case 'alt':
        const alt = value.match(/alt="([^"]+)"/)?.[1];
        return alt ? `page.getByAltText('${alt}')` : value;
      
      case 'label':
        const labelText = value.match(/label:has-text\("([^"]+)"\)/)?.[1];
        return labelText ? `page.getByLabel('${labelText}')` : value;
      
      case 'id':
        const id = value.replace('#', '');
        return `page.locator('#${id}')`;
      
      case 'name':
        const name = value.match(/name="([^"]+)"/)?.[1];
        return name ? `page.getByRole('textbox', { name: '${name}' })` : `page.locator('${value}')`;
      
      case 'css':
        return `page.locator('${value}')`;
      
      case 'xpath':
        return `page.locator('xpath=${value}')`;
      
      default:
        return `page.locator('${value}')`;
    }
  }

  /**
   * Convert locator to Selenium code
   * @param {Object} locator - Locator object
   * @returns {string} Selenium code
   */
  convertToSelenium(locator) {
    const { type, value } = locator;
    
    switch (type) {
      case 'id':
        const id = value.replace('#', '');
        return `driver.find_element(By.ID, '${id}')`;
      
      case 'css':
        return `driver.find_element(By.CSS_SELECTOR, '${value}')`;
      
      case 'xpath':
        return `driver.find_element(By.XPATH, '${value}')`;
      
      case 'test-id':
        const testId = value.match(/data-testid="([^"]+)"/)?.[1];
        return testId ? `driver.find_element(By.CSS_SELECTOR, '[data-testid="${testId}"]')` : value;
      
      case 'name':
        const name = value.match(/name="([^"]+)"/)?.[1];
        return name ? `driver.find_element(By.NAME, '${name}')` : value;
      
      case 'aria-label':
        const ariaLabel = value.match(/aria-label="([^"]+)"/)?.[1];
        return ariaLabel ? `driver.find_element(By.CSS_SELECTOR, '[aria-label="${ariaLabel}"]')` : value;
      
      case 'placeholder':
        const placeholder = value.match(/placeholder="([^"]+)"/)?.[1];
        return placeholder ? `driver.find_element(By.CSS_SELECTOR, '[placeholder="${placeholder}"]')` : value;
      
      case 'label':
        const labelText = value.match(/label:has-text\("([^"]+)"\)/)?.[1];
        return labelText ? `driver.find_element(By.XPATH, "//label[contains(text(), '${labelText}')]/..//*[@name]")` : value;
      
      case 'text':
        const text = value.match(/text="([^"]+)"/)?.[1];
        return text ? `driver.find_element(By.XPATH, "//*[contains(text(), '${text}')]")` : value;
      
      case 'alt':
        const alt = value.match(/alt="([^"]+)"/)?.[1];
        return alt ? `driver.find_element(By.CSS_SELECTOR, 'img[alt="${alt}"]')` : value;
      
      case 'role':
        const role = value.match(/role="([^"]+)"/)?.[1];
        return role ? `driver.find_element(By.CSS_SELECTOR, '[role="${role}"]')` : value;
      
      default:
        return `driver.find_element(By.CSS_SELECTOR, '${value}')`;
    }
  }
}

// Initialize the inspector when page loads
const inspector = new LocatorInspector();

