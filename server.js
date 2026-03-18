const express = require('express');
const cors = require('cors');
const snmp = require('net-snmp');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// SNMP Configuration (Multiple Devices)
const DEVICES = [
    { id: 'site_alpha', name: 'Site Alpha', ip: '192.168.100.12', lat: 12.8237366, lng: 77.6826408 },
    { id: 'site_beta', name: 'Site Beta', ip: '192.168.100.11', lat: 19.0760, lng: 72.8777 },
    // Add additional devices here, e.g.,
    // { id: 'site_beta', name: 'Site Beta', ip: '192.168.100.12' }
];

const SNMP_COMMUNITY = 'read'; // community string
const SNMP_WRITE_COMMUNITY = 'write'; // write community

// MIB OID Mappings (Same for all devices)
const OIDS = {
    // Basic System Info
    sysDescr: '1.3.6.1.4.1.2254.2.51.1.1.1.1.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    // Delta specific identifying values
    deltaProduct0: '1.3.6.1.4.1.2254.2.51.1.1.1.1.0', // MPPT with Rectifier
    deltaProduct1: '1.3.6.1.4.1.2254.2.51.1.1.1.2.0', // v1.0
    deltaProduct2: '1.3.6.1.4.1.2254.2.51.1.1.1.3.0', // Date

    // BMS - Re-aligned to .1 (pdcMBoard) based on testing
    totalVoltageBms: '1.3.6.1.4.1.2254.2.51.1.1.7.1.0',
    chargingCurrent: '1.3.6.1.4.1.2254.2.51.1.1.7.2.0',
    dischargingCurrent: '1.3.6.1.4.1.2254.2.51.1.1.7.3.0',
    remainingCapacity: '1.3.6.1.4.1.2254.2.51.1.1.7.4.0',
    totalCapacity: '1.3.6.1.4.1.2254.2.51.1.1.7.5.0',
    dischargeCycle: '1.3.6.1.4.1.2254.2.51.1.1.7.6.0',
    remainingSoc: '1.3.6.1.4.1.2254.2.51.1.1.7.7.0',
    protectionStatus: '1.3.6.1.4.1.2254.2.51.1.1.7.8.0',
    mosfetControlStatus: '1.3.6.1.4.1.2254.2.51.1.1.7.24.0',
    productionDate: '1.3.6.1.4.1.2254.2.51.1.1.7.25.0',
    softwareVersion: '1.3.6.1.4.1.2254.2.51.1.1.7.26.0',
    numberOfBattery: '1.3.6.1.4.1.2254.2.51.1.1.7.27.0',
    numberOfNtc: '1.3.6.1.4.1.2254.2.51.1.1.7.28.0',


    // Rectifier
    dcOpVoltageRect: '1.3.6.1.4.1.2254.2.51.1.1.8.1.0',
    dcOpCurRect: '1.3.6.1.4.1.2254.2.51.1.1.8.2.0',
    acIpVoltageRect: '1.3.6.1.4.1.2254.2.51.1.1.8.3.0',
    busVoltage: '1.3.6.1.4.1.2254.2.51.1.1.8.4.0',
    outputPowerRect: '1.3.6.1.4.1.2254.2.51.1.1.8.5.0',
    ambientTempRect: '1.3.6.1.4.1.2254.2.51.1.1.8.6.0',
    srTemp: '1.3.6.1.4.1.2254.2.51.1.1.8.7.0',
    llcTemp: '1.3.6.1.4.1.2254.2.51.1.1.8.8.0',
    pfcTemp: '1.3.6.1.4.1.2254.2.51.1.1.8.9.0',
    rectifierOnStatus: '1.3.6.1.4.1.2254.2.51.1.1.8.10.0',
    rectifierAlarmStatus: '1.3.6.1.4.1.2254.2.51.1.1.8.11.0',


    // MPPT
    dcOpVoltageMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.1.0',
    dcOpCurMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.2.0',
    acIpVoltageMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.3.0',
    acIpCurMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.4.0',
    outputPowerMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.5.0',
    mpptLimitPower: '1.3.6.1.4.1.2254.2.51.1.1.9.12.0',
    ambientTempMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.6.0',
    srTempMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.7.0',
    llcTempMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.8.0',
    pfcTempMppt: '1.3.6.1.4.1.2254.2.51.1.1.9.9.0',
    mpptOnStatus: '1.3.6.1.4.1.2254.2.51.1.1.9.10.0',
    mpptAlarmStatus: '1.3.6.1.4.1.2254.2.51.1.1.9.11.0',


    // Status
    bmsLive: '1.3.6.1.4.1.2254.2.51.1.1.12.1.0',
    rectifierLive: '1.3.6.1.4.1.2254.2.51.1.1.12.2.0',
    mpptLive: '1.3.6.1.4.1.2254.2.51.1.1.12.3.0',
    poeLive: '1.3.6.1.4.1.2254.2.51.1.1.12.4.0'
};

// Add OIDs for 15 BMS cells and 5 NTCs
for (let i = 1; i <= 15; i++) {
    OIDS[`cellBalanceStatusFlag${i}`] = `1.3.6.1.4.1.2254.2.51.1.1.7.${8 + i}.0`;
    OIDS[`voltageValueCell${i}`] = `1.3.6.1.4.1.2254.2.51.1.1.7.${33 + i}.0`;
}
for (let i = 1; i <= 5; i++) {
    OIDS[`temperatureValueNtc${i}`] = `1.3.6.1.4.1.2254.2.51.1.1.7.${28 + i}.0`;
}

// Global state caches mapped by Device ID
let deviceStates = {};

// Initialize state cache for each configured device
function initDefaultState(device) {
    return {
        id: device.id,
        name: device.name,
        ip: device.ip,
        version: "v2.1.0",
        date: "2025-08-27",
        bmsLive: 0, rectifierLive: 0, mpptLive: 0, poeLive: 0,
        totalVoltageBms: 0, chargingCurrent: 0, dischargingCurrent: 0,
        remainingCapacity: 0, totalCapacity: 0, dischargeCycle: 0,
        remainingSoc: 0, protectionStatus: 0, mosfetControlStatus: 0,
        cellVoltages: new Array(15).fill(0),
        cellBalances: new Array(15).fill(0),
        ntcTemps: new Array(5).fill(0),
        dcOpVoltageRect: 0, dcOpCurRect: 0, acIpVoltageRect: 0, busVoltage: 0, outputPowerRect: 0,
        ambientTempRect: 0, srTemp: 0, llcTemp: 0, pfcTemp: 0, rectifierOnStatus: 0, rectifierAlarmStatus: 0,
        dcOpVoltageMppt: 0, dcOpCurMppt: 0, acIpVoltageMppt: 0, acIpCurMppt: 0, outputPowerMppt: 0, mpptLimitPower: 0,
        ambientTempMppt: 0, srTempMppt: 0, llcTempMppt: 0, pfcTempMppt: 0, mpptOnStatus: 0, mpptAlarmStatus: 0,
        ledD5: 0, ledD6: 0, ledD7: 0, pushButton: 0, analogPot0: 0, analogPot1: 0, statVar: "", lcdDisplay: "",
        lastUpdate: null,
        status: "offline" // online, offline, polling
    };
}

DEVICES.forEach(dev => {
    deviceStates[dev.id] = initDefaultState(dev);
});

function createSession(ip) {
    return snmp.createSession(ip, SNMP_COMMUNITY, {
        port: 161,
        retries: 0, // No retries to speed up the loop when skipping invalid OIDs
        timeout: 1000,
        version: snmp.Version2c
    });
}

let isPolling = false;

function pollAllDevices() {
    if (isPolling) return;
    isPolling = true;

    // We process devices concurrently, but OIDs sequentially per device
    let pendingDevices = DEVICES.length;

    if (pendingDevices === 0) {
        isPolling = false;
        return;
    }

    DEVICES.forEach(device => {
        let state = deviceStates[device.id];
        state.status = "polling";
        pollSingleDevice(device, state, () => {
            pendingDevices--;
            if (pendingDevices === 0) {
                isPolling = false;
            }
        });
    });
}

function pollSingleDevice(device, stateCache, onComplete) {
    const session = createSession(device.ip);
    const keys = Object.keys(OIDS);
    let currentIndex = 0;
    let successCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3; // Stop polling early if we get this many timeouts in a row

    // Track original polling start time to determine if it timed out totally
    let hasAnySuccess = false;

    function fetchNextSingleOid() {
        if (currentIndex >= keys.length || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            stateCache.lastUpdate = new Date().toISOString();

            if (hasAnySuccess) {
                stateCache.status = "online";
                console.log(`[${device.id}] Cycle Complete: Found ${successCount}/${keys.length} valid variables.`);
            } else {
                stateCache.status = "offline";
                console.log(`[${device.id}] Cycle Complete: Offline (No variables responding).`);
            }

            session.close();
            onComplete();
            return;
        }

        const key = keys[currentIndex];
        const oid = OIDS[key];
        currentIndex++;

        session.get([oid], (error, varbinds) => {
            if (!error && varbinds.length > 0 && !snmp.isVarbindError(varbinds[0])) {
                successCount++;
                consecutiveFailures = 0; // Reset failures on success
                hasAnySuccess = true;
                let val = varbinds[0].value;
                if (Buffer.isBuffer(val)) {
                    val = val.toString('utf8');
                }

                if (key.startsWith('voltageValueCell')) {
                    const idx = parseInt(key.replace('voltageValueCell', '')) - 1;
                    stateCache.cellVoltages[idx] = val;
                } else if (key.startsWith('cellBalanceStatusFlag')) {
                    const idx = parseInt(key.replace('cellBalanceStatusFlag', '')) - 1;
                    stateCache.cellBalances[idx] = val;
                } else if (key.startsWith('temperatureValueNtc')) {
                    const idx = parseInt(key.replace('temperatureValueNtc', '')) - 1;
                    stateCache.ntcTemps[idx] = val;
                } else {
                    stateCache[key] = val;
                }
            } else {
                if (error && error.message === 'Request timed out') {
                    consecutiveFailures++;
                }
                if (key === 'sysDescr') {
                    stateCache[key] = null;
                }
            }
            // Proceed to the next OID immediately (ignoring timeouts / errors from missing OIDs)
            fetchNextSingleOid();
        });
    }

    fetchNextSingleOid();
}

// Start Background Polling every 5 seconds (to allow the loops to finish)
setInterval(pollAllDevices, 2000);
pollAllDevices();

// --- API Endpoints ---

// Get Overview (List of devices + status)
app.get('/api/devices', (req, res) => {
    const summary = DEVICES.map(dev => {
        const state = deviceStates[dev.id];
        return {
            id: dev.id,
            name: dev.name,
            ip: dev.ip,
            lat: dev.lat,
            lng: dev.lng,
            status: state.status,
            lastUpdate: state.lastUpdate,
            sysDescr: state.sysDescr,
            sysUpTime: state.sysUpTime
        };
    });
    res.json(summary);
});

// Add a new device
app.post('/api/devices', (req, res) => {
    const { name, ip, lat, lng } = req.body;

    if (!name || !ip) {
        return res.status(400).json({ error: "Name and IP are required" });
    }

    // Simple ID generator based on name
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);

    const newDevice = {
        id,
        name,
        ip,
        lat: parseFloat(lat) || null,
        lng: parseFloat(lng) || null
    };

    // Initialize state FULLY before adding to DEVICES to prevent race condition crashes
    deviceStates[id] = initDefaultState(newDevice);

    DEVICES.push(newDevice);

    res.json({ success: true, device: newDevice });
});

// Get detailed data for a specific device
app.get('/api/data/:id', (req, res) => {
    const deviceId = req.params.id;
    if (deviceStates[deviceId]) {
        res.json(deviceStates[deviceId]);
    } else {
        res.status(404).json({ error: "Device not found" });
    }
});

// Write to a specific device
app.post('/api/set/:id', (req, res) => {
    const deviceId = req.params.id;
    const deviceConfig = DEVICES.find(d => d.id === deviceId);

    if (!deviceConfig) return res.status(404).json({ error: "Device not found" });

    const { key, value, type } = req.body;
    const oid = OIDS[key];
    if (!oid) return res.status(400).json({ error: "Unknown key" });

    let snmpType = snmp.ObjectType.Integer;
    if (type === 'string') snmpType = snmp.ObjectType.OctetString;

    const varbinds = [
        {
            oid: oid,
            type: snmpType,
            value: value
        }
    ];

    const writeSession = snmp.createSession(deviceConfig.ip, SNMP_WRITE_COMMUNITY, { port: 161, version: snmp.Version2c });

    writeSession.set(varbinds, (error, varbindsOut) => {
        writeSession.close();
        if (error) {
            console.error(`Set error for ${key} on ${deviceConfig.id}:`, error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`SNMP Bridge Backend running on http://localhost:${PORT}`);
    console.log(`Configured Devices: ${DEVICES.map(d => `${d.name} (${d.ip})`).join(', ')}`);
});