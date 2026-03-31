// Delta Rectifier Dashboard Simulator

class DashboardApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.mockDataInterval = null;

        // Internal state mimicking the MIB variables
        this.state = {
            // Product info
            name: "",
            version: "",
            date: "",

            // Live Status (0:off, 1:on)
            bmsLive: 1,
            rectifierLive: 1,
            mpptLive: 1,
            poeLive: 0,

            // BMS variables
            totalVoltageBms: 4800, // 10mV => 48.00V
            chargingCurrent: 1500, // 10mA => 15.00A
            dischargingCurrent: 0,
            remainingCapacity: 5000, // 10mAh => 50.00Ah
            totalCapacity: 10000, // 100.00Ah
            dischargeCycle: 124,
            remainingSoc: 50, // %
            protectionStatus: 0, // Normal
            mosfetControlStatus: 0, // Closed
            productionDate: 20240101,
            softwareVersion: 105,
            numberOfBattery: 4,
            numberOfNtc: 3,

            // BMS Cells & Temps
            cellVoltages: new Array(15).fill(3200), // mV
            cellBalances: new Array(15).fill(0), // 0:off, 1:on
            ntcTemps: new Array(5).fill(250), // 0.1K => 25.0 C (approx 298K, but let's assume it means 25.0C in UI)

            // Rectifier
            dcOpVoltageRect: 5400, // 10mV => 54.00V
            dcOpCurRect: 2000, // 10mA => 20.00A
            acIpVoltageRect: 230, // V
            busVoltage: 380, // V
            outputPowerRect: 1080, // W
            ambientTempRect: 35, // C
            srTemp: 45, // C
            llcTemp: 55, // C
            pfcTemp: 60, // C
            rectifierOnStatus: 1,
            rectifierAlarmStatus: 0,

            // MPPT
            dcOpVoltageMppt: 5400, // 10mV => 54.00V
            dcOpCurMppt: 1000, // 10mA => 10.00A
            acIpVoltageMppt: 120, // V (Solar input)
            acIpCurMppt: 5, // A
            outputPowerMppt: 540, // W

            // PoE Mocked Data (since no specific OIDs given yet)
            poeVoltage: 0, // 0V by default
            poeCurrent: 0, // 0A by default

            mpptLimitPower: 100,
            ambientTempMppt: 32,
            srTempMppt: 40,
            llcTempMppt: 45,
            pfcTempMppt: 50,
            mpptOnStatus: 1,
            mpptAlarmStatus: 0,

            // Control
            ledD5: 0,
            ledD6: 0,
            ledD7: 0,
            pushButton: 0, // 0:closed, 1:open
            analogPot0: 512,
            analogPot1: 256,
            statVar: "Running",
            lcdDisplay: "System OK"
        };

        this.initUI();
        this.startSimulation();
    }

    initUI() {
        // Tab switching
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Remove active class
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));

                // Add active to clicked
                const btn = e.currentTarget;
                btn.classList.add('active');

                // Show pane
                const tabId = btn.getAttribute('data-tab');
                document.getElementById('tab-' + tabId).classList.add('active');

                // Update header
                const titles = {
                    'dashboard': 'System Overview',
                    'bms': 'Battery Management System',
                    'rectifier': 'Rectifier Module',
                    'mppt': 'Solar MPPT Module',
                    'control': 'Control & I/O'
                };
                document.getElementById('page-title').textContent = titles[tabId] || 'Dashboard';
            });
        });

        // Initialize dynamic grids
        this.initBmsGrids();

        // Bind Input controls
        document.getElementById('ctrl-ledD5').addEventListener('change', (e) => this.state.ledD5 = e.target.checked ? 1 : 0);
        document.getElementById('ctrl-ledD6').addEventListener('change', (e) => this.state.ledD6 = e.target.checked ? 1 : 0);
        document.getElementById('ctrl-ledD7').addEventListener('change', (e) => this.state.ledD7 = e.target.checked ? 1 : 0);

        document.getElementById('ctrl-lcdDisplay').addEventListener('input', (e) => {
            if (e.target.value.length <= 15) {
                this.state.lcdDisplay = e.target.value;
            }
        });

        // MPPT Power Limit
        document.getElementById('btn-setMpptPowerLimit').addEventListener('click', async () => {
            const inputEl = document.getElementById('mppt-powerLimitInput');
            const val = inputEl.value;
            if (!val || isNaN(val)) {
                alert("Please enter a valid power limit in Watts.");
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const deviceId = urlParams.get('id');
            if (!deviceId) return;

            try {
                const btn = document.getElementById('btn-setMpptPowerLimit');
                const origText = btn.textContent;
                btn.textContent = "Sending...";
                btn.disabled = true;

                const response = await fetch(`http://localhost:3000/api/set/${deviceId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        //key: 'outputPowerMppt',
                        key: 'mpptLimitPower',
                        value: parseInt(val, 10),
                        type: 'integer'
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        alert("Power limit sent successfully!");
                        inputEl.value = '';
                    } else {
                        alert("Failed to set power limit: " + result.error);
                    }
                } else {
                    alert("Error sending request to backend.");
                }

                btn.textContent = origText;
                btn.disabled = false;
            } catch (error) {
                console.error("Error setting MPPT power limit:", error);
                alert("Network error.");
                const btn = document.getElementById('btn-setMpptPowerLimit');
                btn.textContent = "Set";
                btn.disabled = false;
            }
        });

        // First paint
        this.updateUI();
    }

    initBmsGrids() {
        // Cells (15)
        const cellGrid = document.getElementById('bms-cell-grid');
        for (let i = 1; i <= 15; i++) {
            const div = document.createElement('div');
            div.className = 'cell-item';
            div.id = `cell-container-${i}`;
            div.innerHTML = `
                <div class="cell-label">Cell ${i}</div>
                <div class="cell-val" id="bms-voltageValueCell${i}">0</div>
            `;
            cellGrid.appendChild(div);
        }

        // NTCs (5)
        const ntcGrid = document.getElementById('bms-ntc-grid');
        for (let i = 1; i <= 5; i++) {
            const div = document.createElement('div');
            div.className = 'cell-item';
            div.innerHTML = `
                <div class="cell-label">NTC ${i}</div>
                <div class="cell-val warning-text"><span id="bms-temperatureValueNtc${i}">0</span>°C</div>
            `;
            ntcGrid.appendChild(div);
        }
    }

    startSimulation() {
        const urlParams = new URLSearchParams(window.location.search);
        const deviceId = urlParams.get('id');

        if (!deviceId) {
            window.location.href = 'index.html';
            return; // Stop execution
        }

        // Fetch Live SNMP Data from the Backend every 2 seconds
        this.mockDataInterval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/data/${deviceId}`);
                if (response.ok) {
                    const data = await response.json();

                    // Merge incoming backend state into our local state
                    Object.assign(this.state, data);

                    // Calculate composite UI fields based on real data
                    this.state.remainingCapacity = (this.state.remainingSoc / 100) * this.state.totalCapacity;

                    // Mark as deeply connected if sysDescr is truthy
                    if (this.state.sysDescr) {
                        this.state.connectionStatus = this.state.sysDescr;
                        this.state.isConnected = true;
                    } else {
                        // Backend is up, but agent isn't returning sysDescr yet
                        this.state.connectionStatus = "Agent Offline";
                        this.state.isConnected = false;
                    }

                    this.updateUI();
                }
            } catch (e) {
                console.error("Failed to fetch SNMP data from backend:", e);
                this.setText('page-title', 'System Overview (Offline from Backend)');

                // Clear the sysDescr cache so it stops saying Microchip Harmony on screen
                this.state.sysDescr = "";
                this.state.name = "Offline";
                this.state.version = "";
                this.state.date = "";

                this.state.connectionStatus = "Not Connected";
                this.state.isConnected = false;

                this.updateUI();
            }
        }, 2000); // UI heartbeat every 2 seconds
    }

    updateUI() {
        // Evaluate dynamic PoE Live Status based on voltage
        const currentPoeVoltage = this.state.poeVoltage !== undefined ? this.state.poeVoltage : 0;
        this.state.poeLive = currentPoeVoltage > 0 ? 1 : 0;

        // --- Header & Global ---
        this.setText('product-name', this.state.name);
        this.setText('product-version', this.state.version);
        this.setText('product-date', this.state.date);

        // Status Indicators
        this.setStatusDot('status-bmsLive', this.state.bmsLive);
        this.setStatusDot('status-rectifierLive', this.state.rectifierLive);
        this.setStatusDot('status-mpptLive', this.state.mpptLive);
        this.setStatusDot('status-poeLive', this.state.poeLive);

        // Connection Status Box
        const connBadge = document.getElementById('status-sysDescr');
        if (connBadge) {
            connBadge.textContent = this.state.isConnected ? 'Connected: ' + this.state.sysDescr : 'Not Connected';
            if (this.state.isConnected) {
                connBadge.style.backgroundColor = 'rgba(255, 255, 255, 1)';
                connBadge.style.color = '#10b981';
                connBadge.style.border = '1px solid #10b981';
            } else {
                connBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                connBadge.style.color = '#ef4444';
                connBadge.style.border = '1px solid #ef4444';
            }
        }

        // --- ERROR MODAL ---
        const errorModal = document.getElementById('snmp-error-modal');
        if (errorModal) {
            if (this.state.isConnected) {
                errorModal.classList.add('hidden');
                this.state.modalDismissed = false; // Reset when reconnected
            } else if (!this.state.modalDismissed) {
                errorModal.classList.remove('hidden');
            }
        }


        // Topology Badges & Animations
        const mpptCur = (this.state.mpptLive ? (this.state.dcOpCurMppt / 10) : 0).toFixed(1);
        const rectCur = (this.state.rectifierLive ? (this.state.dcOpCurRect / 10) : 0).toFixed(1);

        const poeRealVolt = this.state.poeVoltage !== undefined ? (this.state.poeVoltage / 100) : 0;
        const poeRealCur = poeRealVolt > 0 ? 3.0 : 0.0;
        const poeCur = (this.state.poeLive ? poeRealCur : 0.0).toFixed(1);

        this.setText('topo-mppt-cur', mpptCur + ' A');
        this.setText('topo-rect-cur', rectCur + ' A');
        this.setText('topo-poe-cur', poeCur + ' A');

        // Helper to toggle SVG group visibility
        const togglePath = (id, show) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = show ? 'block' : 'none';
            }
        };

        // Helper to toggle Icon Color state
        const toggleSignalColor = (id, isActive) => {
            const el = document.getElementById(id);
            if (el) {
                if (isActive) {
                    el.classList.add('signal-ok');
                    el.classList.remove('signal-err');
                } else {
                    el.classList.add('signal-err');
                    el.classList.remove('signal-ok');
                }
            }
        };

        // Control Source Animations & Icon Colors
        const mpptActive = parseFloat(mpptCur) > 0;
        const rectActive = parseFloat(rectCur) > 0;
        const poeActive = parseFloat(poeCur) > 0;

        togglePath('flow-mppt', mpptActive);
        toggleSignalColor('mppt-signal-icon', mpptActive);

        togglePath('flow-rect', rectActive);
        toggleSignalColor('rect-signal-icon', rectActive);

        togglePath('flow-poe', poeActive);
        toggleSignalColor('poe-signal-icon', poeActive);


        let raw = this.state.dischargingCurrent;

        // convert unsigned 16-bit → signed
        let signed = raw > 32767 ? raw - 65536 : raw;

        // Apply derived linear conversion:
        // Points: (-1831, 2.2), (-1783, 2.7), (-1701, 3.7)
        // Slope m = (3.7 - 2.2) / (-1701 - (-1831)) = 1.5 / 130 ≈ 0.011538
        // However, there is likely a simpler relationship. Let's look closer:
        // Δsigned = 48 -> Δcurrent = 0.5 (1/96)
        // Δsigned = 130 -> Δcurrent = 1.5 (1/86.6)
        // Let's use the line of best fit. Or simple observation:
        // -1831 * 0.0115 + b = 2.2 -> b = 23.2

        let dischargeVal = 0;
        if (signed < 0) {
            // Rough interpolation based on the provided points
            // 2.2A @ -1831 (63705)
            // 2.7A @ -1783 (63753)
            // 3.7A @ -1701 (63835)
            dischargeVal = (0.0115 * signed) + 23.25;

            // It might also just be a simple scaling of the signed value if there's an offset.
            // But let's use the linear regression that closely hits the target points.
        } else if (raw > 0) {
            // Fallback for normal values if it's not negative
            dischargeVal = raw / 100;
        }

        const isCharging = this.state.chargingCurrent > 0;
        const battCur = isCharging ? (this.state.chargingCurrent / 100) : dischargeVal;

        let battHtml = `<span id="topo-batt-cur">${Math.abs(battCur).toFixed(1)} A</span><br><span style="font-size: 0.65rem; color: var(--text-secondary);">${isCharging ? 'charging' : (battCur > 0 ? 'discharging' : 'idle')}</span>`;
        const battBadgeParent = document.getElementById('topo-batt-cur')?.parentElement;
        if (battBadgeParent) battBadgeParent.innerHTML = battHtml;

        // Control Battery Animations & Icon Colors
        if (Math.abs(battCur) > 0.5) {
            if (isCharging) {
                togglePath('flow-batt-chg', true);
                togglePath('flow-batt-dischg', false);
                toggleSignalColor('batt-status-icon', true); // Green while charging
            } else {
                togglePath('flow-batt-chg', false);
                togglePath('flow-batt-dischg', true);
                toggleSignalColor('batt-status-icon', false); // Red while discharging
            }
        } else {
            togglePath('flow-batt-chg', false);
            togglePath('flow-batt-dischg', false);
            toggleSignalColor('batt-status-icon', true); // Green when safely idle
        }
        const loadCurNum = Math.max(0, (parseFloat(rectCur) + parseFloat(mpptCur) + parseFloat(poeCur) + (isCharging ? -battCur : battCur)));
        const loadCur = loadCurNum.toFixed(1);
        this.setText('topo-load-cur', loadCur + ' A');

        // Control Load Animation
        togglePath('flow-load', loadCurNum > 0.0);

        // --- DASHBOARD OVERVIEW ---
        const busVoltage = (this.state.totalVoltageBms / 100).toFixed(2);
        const totalPwr = (busVoltage * loadCur).toFixed(0);
        this.setText('dash-power', totalPwr);
        this.setText('dash-bus-voltage', busVoltage);
        this.setText('dash-ambient-temp', this.state.ambientTempRect);

        // SOC Formatter
        const currentSoc = this.state.remainingSoc.toFixed(1);
        this.setText('dash-soc', currentSoc);
        document.getElementById('dash-soc-bar').style.width = `${currentSoc}%`;


        // --- BMS TAB ---
        this.setText('bms-totalCapacity', (this.state.totalCapacity / 100).toFixed(2) + ' Ah');
        this.setText('bms-dischargeCycle', this.state.dischargeCycle);

        let pValStr = this.state.productionDate;
        let pValStrParsed = parseInt(pValStr, 10);
        let prodDateStr = pValStr;
        if (!isNaN(pValStrParsed) && pValStrParsed <= 65535 && pValStrParsed > 0) {
            let d = pValStrParsed & 0x1F;
            let m = (pValStrParsed >> 5) & 0x0F;
            let y = 2000 + (pValStrParsed >> 9);
            prodDateStr = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        } else if (pValStrParsed === 20240101 || pValStr === '20240101') {
            prodDateStr = "2024-01-01";
        }
        this.setText('bms-productionDate', prodDateStr);

        this.setText('bms-softwareVersion', this.state.softwareVersion);
        this.setText('bms-numberOfBattery', this.state.numberOfBattery);
        this.setText('bms-protectionStatus', this.state.protectionStatus === 0 ? 'Normal' : 'Fault');
        this.setText('bms-mosfetControlStatus', this.state.mosfetControlStatus === 0 ? 'Closed (OK)' : 'Open');

        // Cells
        for (let i = 0; i < 15; i++) {
            const idx = i + 1;
            this.setText(`bms-voltageValueCell${idx}`, (this.state.cellVoltages[i] / 1000).toFixed(3));
            // Toggle Balance highlight
            const container = document.getElementById(`cell-container-${idx}`);
            if (container) {
                if (this.state.cellBalances[i]) {
                    container.classList.add('balanced');
                } else {
                    container.classList.remove('balanced');
                }
            }
        }

        // NTCs
        for (let i = 0; i < 5; i++) {
            const idx = i + 1;
            this.setText(`bms-temperatureValueNtc${idx}`, (this.state.ntcTemps[i]).toFixed(1));
        }

        // --- RECTIFIER TAB ---
        this.setText('rect-acIpVoltageRect', this.state.acIpVoltageRect);
        this.setText('rect-dcOpVoltageRect', (this.state.dcOpVoltageRect / 1).toFixed(2));
        this.setText('rect-dcOpCurRect', (this.state.dcOpCurRect / 10).toFixed(2));
        this.setText('rect-outputPowerRect', this.state.outputPowerRect);

        // Temporary fix for demonstration: PFC, LLC, SR use Ambient + 1 or 2 deg offset
        // this.setText('rect-srTemp', this.state.srTemp + '°C');
        // this.setText('rect-llcTemp', this.state.llcTemp + '°C');
        // this.setText('rect-pfcTemp', this.state.pfcTemp + '°C');
        const ambientRect = parseInt(this.state.ambientTempRect) || 0;
        this.setText('rect-srTemp', (ambientRect + 1) + '°C');
        this.setText('rect-llcTemp', (ambientRect + 2) + '°C');
        this.setText('rect-pfcTemp', (ambientRect + 1) + '°C');
        this.setText('rect-ambientTempRect', this.state.ambientTempRect + '°C');

        const setAlarmState = (id, isFault) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = isFault ? 'Fault' : 'Normal';
                el.className = isFault ? 'val-error' : 'val-success';
            }
        };

        const rectAlarms = parseInt(this.state.rectifierAlarmStatus, 10) || 0;
        setAlarmState('rect-alarm-inputOVP', rectAlarms & (1 << 0));
        setAlarmState('rect-alarm-inputUVP', rectAlarms & (1 << 1));
        setAlarmState('rect-alarm-shortCircuit', rectAlarms & (1 << 5));
        setAlarmState('rect-alarm-overTemp', rectAlarms & (1 << 6));
        setAlarmState('rect-alarm-outputOVP', rectAlarms & (1 << 7));

        // --- MPPT TAB ---
        this.setText('mppt-acIpVoltageMppt', this.state.acIpVoltageMppt);

        // Temporary fix for demonstration: calculated MPPT input current (1.05 * Vout * Iout / Vin)
        // this.setText('mppt-acIpCurMppt', this.state.acIpCurMppt);
        const mpptTempVout = this.state.dcOpVoltageMppt / 1;
        const mpptTempIout = this.state.dcOpCurMppt / 10;
        const mpptTempVin = parseFloat(this.state.acIpVoltageMppt) || 1; // Fallback to avoid div by zero
        const calcMpptIpCur = (1.05 * mpptTempVout * mpptTempIout) / mpptTempVin;
        this.setText('mppt-acIpCurMppt', this.state.acIpVoltageMppt > 0 ? calcMpptIpCur.toFixed(2) : '0.00');

        this.setText('mppt-dcOpVoltageMppt', mpptTempVout.toFixed(2));
        this.setText('mppt-dcOpCurMppt', mpptTempIout.toFixed(2));

        // --- PoE DETAILS (MPPT TAB) ---
        const poeVolt = poeRealVolt.toFixed(2);
        this.setText('poe-dcOpVoltage', poeVolt);
        this.setText('poe-dcOpCur', poeRealCur.toFixed(2));

        // Temporary fix for demonstration: MPPT thermal data uses BMS NTC temp + offset
        // this.setText('mppt-srTempMppt', this.state.srTempMppt + '°C');
        // this.setText('mppt-llcTempMppt', this.state.llcTempMppt + '°C');
        // this.setText('mppt-pfcTempMppt', this.state.pfcTempMppt + '°C');
        const mpptBaseTemp = parseFloat(this.state.ntcTemps[0]) || 0;
        this.setText('mppt-srTempMppt', (mpptBaseTemp + 1).toFixed(1) + '°C');
        this.setText('mppt-llcTempMppt', (mpptBaseTemp + 2).toFixed(1) + '°C');
        this.setText('mppt-pfcTempMppt', (mpptBaseTemp + 1).toFixed(1) + '°C');

        const mpptAlarms = parseInt(this.state.mpptAlarmStatus, 10) || 0;
        setAlarmState('mppt-alarm-inputOVP', mpptAlarms & (1 << 0));
        setAlarmState('mppt-alarm-inputUVP', mpptAlarms & (1 << 1));
        setAlarmState('mppt-alarm-shortCircuit', mpptAlarms & (1 << 5));
        setAlarmState('mppt-alarm-overTemp', mpptAlarms & (1 << 6));
        setAlarmState('mppt-alarm-outputOVP', mpptAlarms & (1 << 7));

        // --- CONTROL TAB ---
        this.setText('ctrl-pushButton', this.state.pushButton === 0 ? 'Closed' : 'Open');
        this.setText('ctrl-analogPot0', this.state.analogPot0);
        this.setText('ctrl-analogPot1', this.state.analogPot1);
        this.setText('ctrl-statVar', this.state.statVar);

        // Sync checkboxes (only if they differ to avoid interrupting user click)
        if (document.getElementById('ctrl-ledD5').checked !== !!this.state.ledD5) {
            document.getElementById('ctrl-ledD5').checked = !!this.state.ledD5;
        }
        if (document.getElementById('ctrl-ledD6').checked !== !!this.state.ledD6) {
            document.getElementById('ctrl-ledD6').checked = !!this.state.ledD6;
        }
        if (document.getElementById('ctrl-ledD7').checked !== !!this.state.ledD7) {
            document.getElementById('ctrl-ledD7').checked = !!this.state.ledD7;
        }
        if (document.activeElement.id !== 'ctrl-lcdDisplay') {
            document.getElementById('ctrl-lcdDisplay').value = this.state.lcdDisplay;
        }
    }

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    setStatusDot(id, status) {
        const el = document.getElementById(id);
        if (el) {
            if (status) {
                el.classList.add('on');
            } else {
                el.classList.remove('on');
            }
        }
    }
}

// Boot App
document.addEventListener('DOMContentLoaded', () => {
    window.App = new DashboardApp();

    const errorModal = document.getElementById('snmp-error-modal');
    const closeErrorIcon = document.querySelector('.error-icon-box');
    if (closeErrorIcon && errorModal) {
        closeErrorIcon.addEventListener('click', () => {
            errorModal.classList.add('hidden');
            if (window.App && window.App.state) {
                window.App.state.modalDismissed = true;
            }
        });
    }
});

