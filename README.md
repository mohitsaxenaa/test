# 🎯Locator Inspector - Saksoft

**Professional-Grade Web Element Locator Tool for Enterprise Test Automation**

A powerful Chrome extension that intelligently identifies, scores, and ranks web element locators for test automation frameworks like Playwright and Selenium. Built with accessibility-first principles and enterprise-ready features.

---

## ✨ Features

### 🔍 Intelligent Locator Detection
- **13 locator types** automatically detected and generated
- **Smart ranking algorithm** scores locators by stability and reliability
- **Dynamic content detection** identifies fragile selectors
- **Uniqueness validation** ensures locators are specific to target element

### 🎭 Framework Support
- **Playwright** - `getByRole()`, `getByTestId()`, `getByLabel()`, etc.
- **Selenium** - `By.ID`, `By.CSS_SELECTOR`, `By.XPATH`, etc.
- **Copy-paste ready code** for both frameworks
- **Real-time code generation** with one-click copy

### ♿ Accessibility First
- **ARIA analysis** - Full ARIA tree extraction
- **Accessible name calculation** following WCAG spec
- **Role detection** for semantic HTML elements
- **Complete DOM tree** with accessibility metadata

### 📊 Advanced Analytics
- **Score-based ranking** (0-100) with stability levels
  - **Excellent** (80+) - Production ready
  - **Good** (60+) - Generally reliable
  - **Fair** (40+) - May need review
  - **Poor** (<40) - Use with caution
- **Element metrics** - Position, size, visibility
- **Attribute inspection** - All element attributes
- **JSON export** - Complete element data

### 🚀 Performance
- Lightweight and non-intrusive
- No impact on page performance
- Efficient DOM traversal
- Minimal memory footprint

---

## 📦 Installation

### From Chrome Web Store
1. Visit [Chrome Web Store](#) (when published)
2. Click "Add to Chrome"
3. Confirm permissions

### Manual Installation (Development)
1. Clone/download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `extension` folder
6. Extension icon appears in toolbar

---

## 🎮 Usage Guide

### Basic Workflow

#### 1. **Enable Inspector**
   - Click extension icon in toolbar
   - Click "Enable Inspector" button
   - Status changes to "Active"

#### 2. **Hover Over Elements**
   - Move mouse over any element
   - **Tooltip appears** showing:
     - Element tag (`<button>`, `<input>`, etc.)
     - **Best locator** recommendation
     - **Score** (0-100)
     - **Stability** level
   - Element is **highlighted** with blue outline

#### 3. **View Details Panel**
   - Press **`Alt+X`** to open detail panel
   - Shows:
     - ✅ **Element summary** (position, size, visibility)
     - 🏆 **Locator ranking** (all 13 locator types)
     - 💡 **Recommendations** with framework code
     - 📝 **DOM, ARIA, and attributes** tabs

#### 4. **Copy Locators**
   - **Tooltip**: Click copy button to copy best locator
   - **Table**: Click 📋 button on any row
   - **Framework code**: Click button below Playwright/Selenium code
   - Toast notification confirms copy

#### 5. **Export Data**
   - **Alt+C**: Copy best locator directly
   - **Alt+E**: Export full DOM tree as JSON file
   - **Panel buttons**: Copy JSON, DOM tree, or ARIA tree

---

## 🎯 Locator Types (Ranked)

All 13 locator types detected and ranked automatically:

| Rank | Type | Score | Use Case | Stability |
|------|------|-------|----------|-----------|
| 1 | **role** | 90 | ARIA role + accessible name | ⭐⭐⭐⭐⭐ |
| 2 | **test-id** | 85 | Explicit test data attributes | ⭐⭐⭐⭐⭐ |
| 3 | **aria-label** | 80 | Accessibility labels | ⭐⭐⭐⭐ |
| 4 | **role-attr** | 70 | ARIA role only | ⭐⭐⭐⭐ |
| 5 | **name** | 60 | Form element names | ⭐⭐⭐ |
| 6 | **id** | 55 | Element ID | ⭐⭐⭐ |
| 7 | **placeholder** | 50 | Input placeholders | ⭐⭐⭐ |
| 8 | **label** | 45 | Form labels | ⭐⭐⭐ |
| 9 | **alt** | 40 | Image alt text | ⭐⭐⭐ |
| 10 | **title** | 35 | Title attributes | ⭐⭐ |
| 11 | **text** | 20 | Text content | ⭐ |
| 12 | **css** | 15 | CSS selectors | ⭐ |
| 13 | **xpath** | 10 | XPath expressions | ☆ |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+X` | Open detail panel |
| `Alt+C` | Copy best locator |
| `Alt+E` | Export DOM tree as JSON |

---

## 📋 Panel Sections

### 1. Element Summary
