const snmp = require('net-snmp');
const OIDS = [
    '1.3.6.1.4.1.2254.2.51.1.1.1.1.0', // delta sysdescr
    '1.3.6.1.4.1.2254.2.51.1.2.2.0', // Bad OID
    '1.3.6.1.4.1.2254.2.51.1.1.7.1.0', // totalVoltageBms
];

const ip = '192.168.100.12';

console.log(`Testing sequence on ${ip}...`);
const session = snmp.createSession(ip, 'read', {
    port: 161,
    retries: 0,
    timeout: 1000,
    version: snmp.Version2c
});

let currentIndex = 0;
let successCount = 0;

function fetchNext() {
    if (currentIndex >= OIDS.length) {
        console.log(`Finished. Found ${successCount}/${OIDS.length}.`);
        session.close();
        return;
    }

    const oid = OIDS[currentIndex];
    console.log(`Requesting ${oid}`);
    currentIndex++;

    session.get([oid], (error, varbinds) => {
        if (!error && varbinds.length > 0 && !snmp.isVarbindError(varbinds[0])) {
            successCount++;
            console.log(`Response for ${oid}: ${varbinds[0].value}`);
        } else {
            console.error(`Error for ${oid}: ${error ? error.message : 'varbind error'}`);
        }
        fetchNext();
    });
}

fetchNext();
