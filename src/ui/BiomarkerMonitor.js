/**
 * BiomarkerMonitor: Real-time health metric visualization
 * Displays animated sparkline graphs for patient biomarkers
 * Features:
 * - WBC (White Blood Cells) trending
 * - pH Balance indicator
 * - Glucose levels
 * - Oxygen saturation
 * - Color-coded warnings (Green/Yellow/Red)
 */
class BiomarkerMonitor {
    constructor() {
        // Historical data for sparklines (keep last 60 data points)
        this.historyLength = 60;
        
        // Disease tracking
        this.hasDisease = false;  // Start healthy - no vitals fluctuation
        this.diseaseIntensity = 0; // Will scale biomarker fluctuations (0-1)
        this.biomarkers = {
            wbc: {
                name: 'WBC',
                unit: 'K/μL',
                normal: 7.5,
                min: 4,
                max: 11,
                warning: 9,
                critical: 12,
                color: '#00ffff',
                warningColor: '#ffff00',
                criticalColor: '#ff3333',
                history: [7.5],
                current: 7.5
            },
            ph: {
                name: 'pH',
                unit: '',
                normal: 7.4,
                min: 7.0,
                max: 7.8,
                warning: 7.2,
                criticalLow: 6.8,
                criticalHigh: 7.8,
                color: '#00ffff',
                warningColor: '#ffff00',
                criticalColor: '#ff3333',
                history: [7.4],
                current: 7.4
            },
            glucose: {
                name: 'GLUCOSE',
                unit: 'mg/dL',
                normal: 100,
                min: 70,
                max: 150,
                warning: 140,
                critical: 200,
                color: '#00ffff',
                warningColor: '#ffff00',
                criticalColor: '#ff3333',
                history: [100],
                current: 100
            },
            oxygen: {
                name: 'O₂',
                unit: '%',
                normal: 98,
                min: 90,
                max: 100,
                warning: 92,
                critical: 85,
                color: '#00ffff',
                warningColor: '#ffff00',
                criticalColor: '#ff3333',
                history: [98],
                current: 98
            }
        };

        // Global alert state
        this.hasAlert = false;
        this.alertMessage = '';
        this.alertTime = 0;

        this.createMonitorUI();
    }

    /**
     * Create the HTML structure for biomarker display
     */
    createMonitorUI() {
        const monitor = document.createElement('div');
        monitor.id = 'biomarker-monitor';
        monitor.className = 'biomarker-monitor';
        
        // Title
        const title = document.createElement('div');
        title.className = 'biomarker-title';
        title.textContent = '/// VITALS MONITOR';
        monitor.appendChild(title);

        // Biomarker items
        const container = document.createElement('div');
        container.className = 'biomarker-container';

        Object.entries(this.biomarkers).forEach(([key, biomarker]) => {
            const item = document.createElement('div');
            item.className = 'biomarker-item';
            item.id = `biomarker-${key}`;

            item.innerHTML = `
                <div class="biomarker-header">
                    <span class="biomarker-name">${biomarker.name}</span>
                    <span class="biomarker-value" data-key="${key}">${biomarker.current.toFixed(1)} ${biomarker.unit}</span>
                </div>
                <div class="biomarker-graph">
                    <canvas id="graph-${key}" class="sparkline" width="120" height="30"></canvas>
                </div>
                <div class="biomarker-status" data-key="${key}"></div>
            `;

            container.appendChild(item);
        });

        monitor.appendChild(container);

        // Global alert bar
        const alerts = document.createElement('div');
        alerts.id = 'global-alerts';
        alerts.className = 'global-alerts hidden';
        alerts.innerHTML = `
            <div class="alert-marquee">
                <span id="alert-text"></span>
            </div>
        `;
        monitor.appendChild(alerts);

        document.body.appendChild(monitor);

        // Store references
        this.monitor = monitor;
        this.alertsContainer = alerts;
        this.alertText = alerts.querySelector('#alert-text');

        // Initial draw of graphs
        this.drawAllGraphs();
    }

    /**
     * Update biomarker value and add to history
     */
    updateBiomarker(key, value) {
        if (!this.biomarkers[key]) return;

        const biomarker = this.biomarkers[key];
        biomarker.current = value;
        
        // Add to history (keep last N points)
        biomarker.history.push(value);
        if (biomarker.history.length > this.historyLength) {
            biomarker.history.shift();
        }

        // Update UI
        this.updateBiomarkerDisplay(key);
        this.checkAlerts();
    }

    /**
     * Update displayed value and status
     */
    updateBiomarkerDisplay(key) {
        const biomarker = this.biomarkers[key];
        const item = document.querySelector(`#biomarker-${key}`);
        
        if (!item) return;

        // Update value
        const valueEl = item.querySelector('.biomarker-value');
        valueEl.textContent = `${biomarker.current.toFixed(1)} ${biomarker.unit}`;

        // Update status color
        const statusEl = item.querySelector('.biomarker-status');
        const status = this.getStatus(biomarker);
        statusEl.textContent = status.text;
        statusEl.style.color = status.color;

        // Redraw graph
        this.drawGraph(key);
    }

    /**
     * Determine status (normal, warning, critical)
     */
    getStatus(biomarker) {
        const val = biomarker.current;

        // Handle special case for pH (can be critical on both ends)
        if (biomarker.name === 'pH') {
            if (val < biomarker.criticalLow || val > biomarker.criticalHigh) {
                return { text: '⚠ CRITICAL', color: biomarker.criticalColor };
            }
            if (val < biomarker.warning) {
                return { text: '⚠ ACIDOSIS', color: biomarker.warningColor };
            }
            if (val > 7.6) {
                return { text: '⚠ ALKALOSIS', color: biomarker.warningColor };
            }
        }

        // Standard max-based warning
        if (val >= biomarker.critical) {
            return { text: '⚠ CRITICAL', color: biomarker.criticalColor };
        }
        if (val >= biomarker.warning) {
            return { text: '⚠ WARNING', color: biomarker.warningColor };
        }

        // Check minimums
        if (val <= biomarker.min) {
            return { text: '⚠ LOW', color: biomarker.warningColor };
        }

        return { text: '✓ NORMAL', color: biomarker.color };
    }

    /**
     * Check if any biomarkers are in alert state
     */
    checkAlerts() {
        let alertTriggered = false;
        let alertMsg = '';

        Object.entries(this.biomarkers).forEach(([key, biomarker]) => {
            const status = this.getStatus(biomarker);
            
            if (status.text.includes('CRITICAL')) {
                alertTriggered = true;
                alertMsg += `${biomarker.name} ${status.text} | `;
            }
        });

        if (alertTriggered) {
            this.setAlert(alertMsg.slice(0, -3)); // Remove trailing "| "
        } else {
            this.clearAlert();
        }
    }

    /**
     * Set global alert message
     */
    setAlert(message) {
        this.hasAlert = true;
        this.alertMessage = message;
        this.alertText.textContent = message;
        this.alertsContainer.classList.remove('hidden');
        this.alertsContainer.style.animation = 'none';
        
        // Trigger animation
        setTimeout(() => {
            this.alertsContainer.style.animation = 'marquee 6s linear infinite';
        }, 10);
    }

    /**
     * Clear alert
     */
    clearAlert() {
        this.hasAlert = false;
        this.alertsContainer.classList.add('hidden');
    }

    /**
     * Draw all biomarker graphs
     */
    drawAllGraphs() {
        console.log('[BiomarkerMonitor] Drawing all graphs...');
        Object.keys(this.biomarkers).forEach(key => {
            try {
                this.drawGraph(key);
            } catch (e) {
                console.error(`[BiomarkerMonitor] Error drawing graph for ${key}:`, e);
            }
        });
        console.log('[BiomarkerMonitor] Graph drawing complete');
    }

    /**
     * Draw sparkline graph for a biomarker
     */
    drawGraph(key) {
        const canvas = document.querySelector(`#graph-${key}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const biomarker = this.biomarkers[key];
        const history = biomarker.history;

        // Clear canvas
        ctx.fillStyle = 'rgba(10, 25, 40, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (history.length < 2) return;

        // Calculate min/max for scaling
        const minVal = biomarker.min;
        const maxVal = biomarker.max;
        const range = maxVal - minVal;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        
        // Normal range line
        const normalY = canvas.height - ((biomarker.normal - minVal) / range) * canvas.height;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, normalY);
        ctx.lineTo(canvas.width, normalY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw graph line
        const width = canvas.width;
        const height = canvas.height;
        const pointSpacing = width / (history.length - 1);

        // Determine color based on status
        const status = this.getStatus(biomarker);
        ctx.strokeStyle = status.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        history.forEach((val, idx) => {
            const x = idx * pointSpacing;
            const y = height - ((val - minVal) / range) * height;
            
            if (idx === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw area fill (gradient)
        ctx.fillStyle = status.color + '20'; // Add transparency
        ctx.fill();

        // Draw current value indicator (dot)
        const lastVal = history[history.length - 1];
        const lastX = (history.length - 1) * pointSpacing;
        const lastY = height - ((lastVal - minVal) / range) * height;

        ctx.fillStyle = status.color;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw warning/critical zones
        if (biomarker.warning) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.05)';
            const warningY = height - ((biomarker.warning - minVal) / range) * height;
            ctx.fillRect(0, 0, width, warningY);
        }

        if (biomarker.critical) {
            ctx.fillStyle = 'rgba(255, 51, 51, 0.05)';
            const criticalY = height - ((biomarker.critical - minVal) / range) * height;
            ctx.fillRect(0, 0, width, criticalY);
        }
    }

    /**
     * Simulate biomarker fluctuation (for testing)
     */
    simulateBiomarkers() {
        // If no disease is present, vitals stay completely normal
        if (!this.hasDisease) {
            return; // No changes - organism is healthy
        }
        
        // DISEASE MODE: Biomarkers fluctuate based on illness severity
        Object.keys(this.biomarkers).forEach(key => {
            const biomarker = this.biomarkers[key];
            
            // Smooth sine-wave-like fluctuations for natural appearance
            const time = Date.now() * 0.001;
            const sineWave = Math.sin(time + Math.random() * Math.PI);
            
            // Disease severity determines fluctuation amplitude (0-1 scale)
            const diseaseSeverity = this.diseaseIntensity || 0.5; // Will be set by disease system
            const baseDeviation = (biomarker.max - biomarker.min) * diseaseSeverity * 0.15;
            
            let newVal = biomarker.normal + (sineWave * baseDeviation * 0.5);
            
            // Add subtle randomness
            const randomComponent = (Math.random() - 0.5) * baseDeviation * 0.3;
            newVal += randomComponent;
            
            // Clamp within bounds
            newVal = Math.max(biomarker.min, Math.min(biomarker.max, newVal));
            
            this.updateBiomarker(key, newVal);
        });
    }

    /**
     * Update multiple biomarkers at once
     */
    updateBiomarkers(data) {
        Object.entries(data).forEach(([key, value]) => {
            if (this.biomarkers[key]) {
                this.updateBiomarker(key, value);
            }
        });
    }

    /**
     * Get all biomarker data
     */
    getBiomarkerData() {
        const data = {};
        Object.entries(this.biomarkers).forEach(([key, biomarker]) => {
            data[key] = biomarker.current;
        });
        return data;
    }

    /**
     * Reset to defaults
     */
    reset() {
        Object.entries(this.biomarkers).forEach(([key, biomarker]) => {
            biomarker.current = biomarker.normal;
            biomarker.history = [biomarker.normal];
            this.updateBiomarkerDisplay(key);
        });
        this.clearAlert();
    }
}

export default BiomarkerMonitor;
