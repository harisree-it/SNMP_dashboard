const snmp = require('net-snmp');

console.log('--- Delta Rectifier SNMP Diagnostic Tool ---');
console.log('Target: 192.168.100.11');

const SNMP_COMMUNITY = 'read'; // The community string that succeeded earlier
const OID_SYS_DESCR = '1.3.6.1.2.1.1.1.0';

const session = snmp.createSession('192.168.100.11', SNMP_COMMUNITY, {
    port: 161,
    retries: 2,
    timeout: 3000,
    version: snmp.Version2c
});

console.log('Sending SNMP Request to 192.168.100.11:161...');

session.get([OID_SYS_DESCR], (error, varbinds) => {
    if (error) {
        console.error('\n[ERROR] Request Failed:', error.message);
        console.log('\nDIAGNOSIS: Your computer is physically blocking Node.js from sending UDP Port 161 packets.');
        console.log('This is usually caused by an Antivirus (McAfee, Symantec) or a strict IT network policy.');
    } else {
        console.log('\n[SUCCESS] Connected to Delta Agent!');
        for (let i = 0; i < varbinds.length; i++) {
            if (snmp.isVarbindError(varbinds[i])) {
                console.error(snmp.varbindError(varbinds[i]));
            } else {
                console.log('Response: ' + varbinds[i].oid + ' = ' + varbinds[i].value);
            }
        }
        console.log('\nDIAGNOSIS: Everything works perfectly in this environment. You can run server.js from here.');
    }
    session.close();
});
