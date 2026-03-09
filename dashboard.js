let allDevices = [];

document.addEventListener('DOMContentLoaded', () => {
    let map;
    let markers = [];

    const mapEl = document.getElementById('map');
    if (mapEl) {
        map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([20.5937, 78.9629], 4);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Ensure map renders correctly if container was hidden/resized
        setTimeout(() => {
            map.invalidateSize();
        }, 500);
    }

    function formatUptime(ticks) {
        if (!ticks) return "--";
        const seconds = Math.floor(ticks / 100);
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${d}d ${h}h ${m}m`;
    }

    function timeSince(dateString) {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        return `${Math.floor(seconds / 60)}m ago`;
    }

    async function fetchDevices() {
        try {
            const res = await fetch('/api/devices');
            if (!res.ok) throw new Error("Failed to fetch");
            const devices = await res.json();
            allDevices = devices; // Cache for modal
            renderDashboard(devices);
        } catch (e) {
            console.error(e);
            document.getElementById('device-container').innerHTML = `
                <div class="error-state">
                    <ion-icon name="warning-outline" style="font-size: 3rem; margin-bottom: 1rem;"></ion-icon>
                    <h3>Backend Offline</h3>
                    <p>Could not connect to the SNMP Bridge Backend. Ensure server.js is running.</p>
                </div>
            `;
        }
    }

    function renderDashboard(devices) {
        let onlineCount = 0;
        let offlineCount = 0;

        const container = document.getElementById('device-container');
        if (container) {
            container.innerHTML = '';
        }

        if (map) {
            markers.forEach(m => map.removeLayer(m));
            markers = [];
        }

        devices.forEach(dev => {
            if (dev.status === 'online') {
                onlineCount++;
            } else {
                offlineCount++;
            }

            let statusClass = 'status-offline';
            let statusText = 'Offline';
            if (dev.status === 'online') {
                statusClass = 'status-online';
                statusText = 'Online';
            } else if (dev.status === 'polling') {
                statusClass = 'status-polling';
                statusText = 'Polling...';
            }

            if (map && dev.lat && dev.lng) {
                let markerClass = (dev.status === 'online') ? 'green' : 'red';

                const customIcon = L.divIcon({
                    className: 'custom-leaflet-marker',
                    html: `<div class="map-dot ${markerClass}"></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });

                const marker = L.marker([dev.lat, dev.lng], { icon: customIcon }).addTo(map);
                marker.bindTooltip(`<strong>${dev.name || dev.id}</strong><br>Status: ${statusText}`, {
                    direction: 'top',
                    offset: [0, -10]
                });
                markers.push(marker);
            }

            const card = document.createElement('a');
            card.href = `system.html?id=${dev.id}`;
            card.className = 'device-card';

            card.innerHTML = `
                <div class="device-header">
                    <div class="device-title">
                        <h2>${dev.name || dev.id}</h2>
                        <p>${dev.ip}</p>
                    </div>
                    <div class="device-status ${statusClass}">
                        ${statusText}
                    </div>
                </div>
                <div class="device-meta">
                    <div class="meta-row">
                        <span>Last Updated</span>
                        <span class="meta-val">${timeSince(dev.lastUpdate)}</span>
                    </div>
                    <div class="meta-row">
                        <span>System Uptime</span>
                        <span class="meta-val">${formatUptime(dev.sysUpTime)}</span>
                    </div>
                    <div class="sys-descr" title="${dev.sysDescr || 'No description available'}">
                        ${dev.sysDescr || 'Waiting for metadata...'}
                    </div>
                </div>
            `;
            if (container) {
                container.appendChild(card);
            }
        });

        if (document.getElementById('sum-total')) {
            document.getElementById('sum-total').textContent = devices.length;
        }
        if (document.getElementById('sum-online')) {
            document.getElementById('sum-online').textContent = onlineCount;
        }
        if (document.getElementById('sum-offline')) {
            document.getElementById('sum-offline').textContent = offlineCount;
        }

        // --- Power Utilization Bar Chart Logic ---
        let totalPwrMppt = 0;
        let totalPwrGrid = 0;
        let totalPwrPoe = 0;
        let totalPwrBatt = 0;

        devices.forEach(dev => {
            if (dev.status === "offline") return; // Skip offline towers for live power aggregation

            const busV = parseFloat(dev.totalVoltageBms || "0") / 100;

            // MPPT Power
            if (dev.mpptLive) {
                totalPwrMppt += parseFloat(dev.outputPowerMppt || "0");
            }

            // Grid Power
            if (dev.rectifierLive) {
                totalPwrGrid += parseFloat(dev.outputPowerRect || "0");
            }

            // PoE Power (roughly 3A * Bus Voltage)
            if (dev.poeLive) {
                totalPwrPoe += (3.0 * busV);
            }

            // Battery Power
            const rawDischarge = parseInt(dev.dischargingCurrent || "0", 10);
            let signed = rawDischarge > 32767 ? rawDischarge - 65536 : rawDischarge;
            let dischargeA = 0;
            if (signed < 0) {
                dischargeA = (0.0115 * signed) + 23.25;
            } else if (rawDischarge > 0) {
                dischargeA = rawDischarge / 100;
            }

            const isCharging = parseInt(dev.chargingCurrent || "0", 10) > 0;
            if (!isCharging && dischargeA > 0) {
                totalPwrBatt += (dischargeA * busV);
            }
        });

        // Find max
        const maxAggPwr = Math.max(100, totalPwrMppt, totalPwrGrid, totalPwrPoe, totalPwrBatt);

        const setText = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };

        const setHeight = (id, pct) => {
            const el = document.getElementById(id);
            if (el) el.style.height = `${Math.min(100, Math.max(0, pct))}%`;
        };

        // Format to kW if large, otherwise W
        const formatPower = (w) => {
            if (w >= 1000) return (w / 1000).toFixed(1) + ' kW';
            return Math.round(w) + ' W';
        };

        // Update Text
        setText('agg-bar-val-mppt', formatPower(totalPwrMppt));
        setText('agg-bar-val-grid', formatPower(totalPwrGrid));
        setText('agg-bar-val-poe', formatPower(totalPwrPoe));
        setText('agg-bar-val-batt', formatPower(totalPwrBatt));

        // Update Heights
        setHeight('agg-bar-mppt', (totalPwrMppt / maxAggPwr) * 100);
        setHeight('agg-bar-grid', (totalPwrGrid / maxAggPwr) * 100);
        setHeight('agg-bar-poe', (totalPwrPoe / maxAggPwr) * 100);
        setHeight('agg-bar-batt', (totalPwrBatt / maxAggPwr) * 100);

        // Update Labels
        setText('agg-y-axis-100', formatPower(maxAggPwr));
        setText('agg-y-axis-75', formatPower(maxAggPwr * 0.75));
        setText('agg-y-axis-50', formatPower(maxAggPwr * 0.50));
        setText('agg-y-axis-25', formatPower(maxAggPwr * 0.25));

        // Auto-zoom to fit all markers
        if (map && markers.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 8 });
        }
    }

    // Modal Logic
    const systemsModal = document.getElementById('systems-modal');
    const closeSystemsBtn = document.getElementById('close-systems-modal');
    const totalSystemsBtn = document.getElementById('total-systems-btn');
    const systemsTableBody = document.querySelector('#systems-list-table tbody');

    if (totalSystemsBtn) {
        totalSystemsBtn.addEventListener('click', () => {
            renderModalList();
            if (systemsModal) systemsModal.classList.remove('hidden');
        });
    }

    if (closeSystemsBtn) {
        closeSystemsBtn.addEventListener('click', () => {
            if (systemsModal) systemsModal.classList.add('hidden');
        });
    }

    // Add New System Modal Logic
    const addSystemModal = document.getElementById('add-system-modal');
    const openAddSystemBtn = document.getElementById('open-add-system-btn');
    const closeAddSystemBtn = document.getElementById('close-add-system-modal');
    const addSystemForm = document.getElementById('add-system-form');

    if (openAddSystemBtn) {
        openAddSystemBtn.addEventListener('click', () => {
            if (addSystemModal) addSystemModal.classList.remove('hidden');
        });
    }

    if (closeAddSystemBtn) {
        closeAddSystemBtn.addEventListener('click', () => {
            if (addSystemModal) addSystemModal.classList.add('hidden');
        });
    }

    if (addSystemForm) {
        addSystemForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('new-dev-name').value;
            const ip = document.getElementById('new-dev-ip').value;
            const lat = document.getElementById('new-dev-lat').value;
            const lng = document.getElementById('new-dev-lng').value;

            try {
                const res = await fetch('/api/devices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, ip, lat, lng })
                });

                if (res.ok) {
                    if (addSystemModal) addSystemModal.classList.add('hidden');
                    addSystemForm.reset();
                    fetchDevices(); // Refresh list immediately
                } else {
                    const data = await res.json();
                    alert("Error adding system: " + data.error);
                }
            } catch (err) {
                console.error("Failed to add system:", err);
                alert("Failed to connect to backend");
            }
        });
    }

    // Sidebar Navigation Logic
    const toggleChatBtn = document.getElementById('toggle-chat-btn');
    const sidebarChat = document.querySelector('.sidebar-chat');

    const navSystems = document.getElementById('nav-systems');
    const navChat = document.getElementById('nav-chat');
    const navDetails = document.getElementById('nav-details');
    const navWarnings = document.getElementById('nav-warnings');

    const detailsModal = document.getElementById('project-details-modal');
    const warningsLogModal = document.getElementById('warnings-log-modal');

    const closeDetailsBtn = document.getElementById('close-details-modal');
    const closeWarningsBtn = document.getElementById('close-warnings-modal');

    if (toggleChatBtn && sidebarChat) {
        toggleChatBtn.addEventListener('click', () => {
            sidebarChat.classList.toggle('collapsed');
        });
    }

    if (navSystems) {
        navSystems.addEventListener('click', () => {
            renderModalList();
            if (systemsModal) systemsModal.classList.remove('hidden');
        });
    }

    if (navChat) {
        navChat.addEventListener('click', () => {
            if (sidebarChat) sidebarChat.classList.remove('collapsed');
        });
    }

    if (navDetails) {
        navDetails.addEventListener('click', () => {
            if (detailsModal) detailsModal.classList.remove('hidden');
        });
    }

    if (navWarnings) {
        navWarnings.addEventListener('click', () => {
            if (warningsLogModal) warningsLogModal.classList.remove('hidden');
        });
    }

    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', () => {
            if (detailsModal) detailsModal.classList.add('hidden');
        });
    }

    if (closeWarningsBtn) {
        closeWarningsBtn.addEventListener('click', () => {
            if (warningsLogModal) warningsLogModal.classList.add('hidden');
        });
    }

    // Chat Disable Logic (Demo Mode)
    const chatButtons = [
        'chat-attach-btn',
        'chat-camera-btn',
        'chat-location-btn',
        'chat-send-btn'
    ];

    chatButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showToast("In demo product, this function disabled please contact administrator");
            });
        }
    });

    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <ion-icon name="alert-circle-outline"></ion-icon>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto-remove after animation finishes (5s total in CSS)
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    function renderModalList() {
        if (!systemsTableBody) return;
        systemsTableBody.innerHTML = '';
        allDevices.forEach(dev => {
            let statusBadge = '';
            if (dev.status === 'online') {
                statusBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3);">Online</span>';
            } else if (dev.status === 'polling') {
                statusBadge = '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3);">Polling</span>';
            } else {
                statusBadge = '<span class="badge critical">Offline</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                  <td>${dev.name || dev.id}</td>
                  <td>${dev.ip}</td>
                  <td>${statusBadge}</td>
                  <td><a href="system.html?id=${dev.id}" class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; text-decoration: none; display: inline-block;">View</a></td>
              `;
            systemsTableBody.appendChild(tr);
        });
    }

    // Poll every 5 seconds
    fetchDevices();
    setInterval(fetchDevices, 5000);
});
