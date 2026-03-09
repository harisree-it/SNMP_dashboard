const snmp = require('net-snmp');
const OIDS = [
    '1.3.6.1.2.1.1.1.0', // sysDescr standard
    '1.3.6.1.4.1.2254.2.51.1.1.1.1.0', // delta sysdescr
];

const ips = ['192.168.100.12', '192.168.100.11'];

ips.forEach(ip => {
    console.log(`Testing ${ip}...`);
    const session = snmp.createSession(ip, 'read', {
        port: 161,
        retries: 1,
        timeout: 2000,
        version: snmp.Version2c
    });

    session.get(OIDS, (error, varbinds) => {
        if (error) {
            console.error(`[${ip}] Error: ${error.message}`);
        } else {
            console.log(`[${ip}] Success!`);
            for (let i = 0; i < varbinds.length; i++) {
                if (snmp.isVarbindError(varbinds[i])) {
                    console.error(`[${ip}] Varbind error: ${snmp.varbindError(varbinds[i])}`);
                } else {
                    console.log(`[${ip}] Response: ${varbinds[i].oid} = ${varbinds[i].value}`);
                }
            }
        }
        session.close();
    });
});
