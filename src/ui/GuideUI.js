/**
 * GuideUI.js - Encyclopedia/Guide Panel Manager
 * 
 * Displays game content (buildings, units, resources, etc.)
 * - Unlocked entries: Show full details
 * - Locked entries: Show "???" with hint on when they unlock
 * - Searchable and categorized
 */

class GuideUI {
  constructor(hudManager, progressionManager) {
    this.hudManager = hudManager;
    this.progressionManager = progressionManager;
    
    this.guidePanel = null;
    this.searchInput = null;
    this.contentContainer = null;
    
    // Track which section is currently expanded
    this.expandedSections = new Set();
  }
  
  /**
   * Initialize the guide panel
   */
  initialize(guidePanelElement) {
    this.guidePanel = guidePanelElement;
    this.searchInput = guidePanelElement.querySelector('#guide-search-input');
    this.contentContainer = guidePanelElement.querySelector('#guide-content');
    
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.onSearch(e.target.value));
    }
    
    // Load progression callbacks
    if (this.progressionManager) {
      this.progressionManager.onUnlockCallback = (data) => this.onEntryUnlocked(data);
    }
    
    // Populate initial content
    this.populateGuide();
    
    console.log("[GuideUI] Initialized");
  }
  
  /**
   * Populate the guide with all entries
   */
  populateGuide(searchTerm = "") {
    if (!this.contentContainer) return;
    
    this.contentContainer.innerHTML = '';
    
    const db = BioDatabase;
    const types = [
      { key: 'buildings', icon: '🏗', label: 'Buildings' },
      { key: 'resources', icon: '📦', label: 'Resources' },
      { key: 'units', icon: '🧬', label: 'Units' },
      { key: 'terrain', icon: '🌍', label: 'Terrain' },
      { key: 'technologies', icon: '🧪', label: 'Technologies' }
    ];
    
    for (const typeInfo of types) {
      const entries = db[typeInfo.key] || [];
      
      // Filter by search term
      const filtered = entries.filter(entry => {
        const searchLower = searchTerm.toLowerCase();
        return entry.name.toLowerCase().includes(searchLower) ||
               entry.description.toLowerCase().includes(searchLower);
      });
      
      if (filtered.length === 0) continue;
      
      // Create section
      const section = document.createElement('div');
      section.className = 'guide-section';
      
      const header = document.createElement('div');
      header.className = 'guide-section-header';
      header.innerHTML = `${typeInfo.icon} ${typeInfo.label}`;
      header.style.cursor = 'pointer';
      
      const entries_div = document.createElement('div');
      entries_div.className = 'guide-section-entries';
      
      // Add entries
      for (const entry of filtered) {
        const entryElement = this.createEntryElement(entry);
        entries_div.appendChild(entryElement);
      }
      
      section.appendChild(header);
      section.appendChild(entries_div);
      this.contentContainer.appendChild(section);
      
      // Section toggle
      header.addEventListener('click', () => {
        entries_div.style.display = entries_div.style.display === 'none' ? 'block' : 'none';
      });
    }
  }
  
  /**
   * Create a single entry element (locked or unlocked)
   */
  createEntryElement(entry) {
    const isUnlocked = this.progressionManager.isUnlocked(entry.id);
    
    const wrapper = document.createElement('div');
    wrapper.className = `guide-entry ${isUnlocked ? 'unlocked' : 'locked'}`;
    wrapper.id = `entry-${entry.id}`;
    
    if (isUnlocked) {
      // Show full details
      wrapper.innerHTML = `
        <div class="entry-header">
          <span class="entry-icon">${entry.icon || '❓'}</span>
          <span class="entry-name">${entry.name}</span>
        </div>
        <div class="entry-description">${entry.description}</div>
        ${this.formatEntryStats(entry)}
      `;
    } else {
      // Show locked state with hint
      const hint = this.progressionManager.getUnlockHint(entry.id);
      wrapper.innerHTML = `
        <div class="entry-header">
          <span class="entry-icon">❓</span>
          <span class="entry-name">??? Unknown</span>
        </div>
        <div class="entry-description locked-hint">${hint || 'Requirements unknown'}</div>
      `;
    }
    
    return wrapper;
  }
  
  /**
   * Format entry stats (cost, production, stats, etc.)
   */
  formatEntryStats(entry) {
    let html = '';
    
    // Cost
    if (entry.cost && Object.keys(entry.cost).length > 0) {
      html += '<div class="entry-stat"><strong>Cost:</strong> ';
      html += Object.entries(entry.cost)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      html += '</div>';
    }
    
    // Production
    if (entry.production && Object.keys(entry.production).length > 0) {
      html += '<div class="entry-stat"><strong>Produces:</strong> ';
      html += Object.entries(entry.production)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      html += '</div>';
    }
    
    // Consumption
    if (entry.consumption && Object.keys(entry.consumption).length > 0) {
      html += '<div class="entry-stat"><strong>Consumes:</strong> ';
      html += Object.entries(entry.consumption)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      html += '</div>';
    }
    
    // Health, Speed, etc.
    if (entry.health) {
      html += `<div class="entry-stat"><strong>Health:</strong> ${entry.health}</div>`;
    }
    if (entry.speed) {
      html += `<div class="entry-stat"><strong>Speed:</strong> ${entry.speed}</div>`;
    }
    if (entry.attack) {
      html += `<div class="entry-stat"><strong>Attack:</strong> ${entry.attack}</div>`;
    }
    
    // Tips
    if (entry.tips) {
      html += `<div class="entry-tip">💡 ${entry.tips}</div>`;
    }
    
    // Behavior Patterns (for units)
    if (entry.behavior_patterns && entry.behavior_patterns.length > 0) {
      html += '<div class="entry-stat"><strong>Behaviors:</strong> ';
      html += entry.behavior_patterns
        .map(b => `<span class="behavior-tag">${b.name}</span>`)
        .join(' ');
      html += '</div>';
    }
    
    return html;
  }
  
  /**
   * Search entries by name/description
   */
  onSearch(searchTerm) {
    this.populateGuide(searchTerm);
  }
  
  /**
   * Called when an entry is unlocked
   */
  onEntryUnlocked(data) {
    const { entryId, entry } = data;
    
    console.log(`[GuideUI] Entry unlocked: ${entryId}`);
    
    // Update or re-add the entry element
    const existingElement = this.contentContainer.querySelector(`#entry-${entryId}`);
    if (existingElement) {
      existingElement.replaceWith(this.createEntryElement(entry));
    }
    
    // Show notification
    this.showUnlockNotification(entry);
  }
  
  /**
   * Show toast notification for unlocked entry
   */
  showUnlockNotification(entry) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'guide-unlock-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${entry.icon || '🔓'}</span>
        <span class="notification-text">
          <strong>Unlocked:</strong> ${entry.name}
        </span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 1000);
    }, 3000);
  }
  
  /**
   * Get all visible entries (for testing, debugging)
   */
  getVisibleEntries() {
    return Array.from(this.contentContainer.querySelectorAll('.guide-entry.unlocked'));
  }
  
  /**
   * Get all locked entries
   */
  getLockedEntries() {
    return Array.from(this.contentContainer.querySelectorAll('.guide-entry.locked'));
  }
}

// Export for use
if (typeof module !== "undefined" && module.exports) {
  module.exports = GuideUI;
}
