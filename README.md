# Delta Power SNMP Dashboard

A real-time, responsive web dashboard built in Node.js, Express, and Vanilla JS for monitoring and managing Delta Rectifier systems via the SNMP protocol. The application queries system metrics, battery statuses, rectifiers, MPPT converters, and thermals in real-time.

## Features

- **Real-Time Data Polling**: Constantly polls SNMP data (every 2 seconds) to keep the dashboard up to date.
- **Glassmorphism Design**: Premium, visually striking user interface using frosted glass effects and dynamic glowing elements with a cohesive dark aesthetics layout.
- **Dynamic Energy Topology**: SVG-based animated visual representation mapping out power flows between the MPPT converter, Rectifier, PoE, System Load, and the Battery (showing live charging/discharging states).
- **Extensive Metrics Monitoring**: Track metrics under various comprehensive dashboard tabs:
  - **Dashboard Overview**: Topology mapping, Overall Output Power, Battery SOC percentage, Bus (Output) Voltage, and Ambient Temperature.
  - **BMS (Battery Management System)**: Total capacity, SOC, Discharge cycles, Cell-by-cell level Voltages, NTC Temperatures, and MOSFET statuses.
  - **Rectifiers**: Detailed overview of AC Input Voltage, DC Output Voltage, DC Output Current, and various thermal readings (SR Temp, LLC Temp, PFC Temp).
  - **MPPT Converters**: Overview of MPPT converter status including inputs and relevant temperatures.
  - **Control & I/O Modules**: Live status indicators alongside toggle switches for LEDs, analog pots measurements, and LCD display data.
- **Connection Diagnostics**: Graceful connection tracking featuring automatic loss detection popup models and component-level status checks displayed on a side navigation bar.

## Libraries & Technologies Used

### Backend Stack
- **Node.js**: Asynchronous JavaScript runtime environment.
- **Express.js (`express: ^5.2.1`)**: Fast, unopinionated web framework for serving the API configuration and static frontend files.
- **CORS (`cors: ^2.8.6`)**: Middleware for providing Cross-Origin Resource Sharing.
- **Net-SNMP (`net-snmp: ^3.26.1`)**: Native JavaScript SNMP implementation used to interface the backend network session polling directly with the Delta SNMP Agent module.

### Frontend Stack
- **Vanilla JavaScript**: Fetching operations, cached data representation mapping, DOM manipulation, SVG line animations, and custom modal handling.
- **Vanilla CSS3 / Flexbox / Grid**: Extensively used Custom CSS properties providing responsive, glowing component styling without external CSS frameworks. 
- **Ionicons**: Imported web components (`ionicons`) to inject clean and scalable icons.
- **Google Fonts**: Custom sleek typography rendering using `Inter` and `Fira Code`.

## Version History

- **v1.0.0** (Initial Release)
  - SNMP architecture mapped and modeled using `net-snmp` wrapper to communicate with `192.168.100.11` via `community: read` configuration.
  - Implementation of sequential SNMP Polling cycles to avoid network timeouts globally fetching over 70+ custom `.1.3.6.1.4.1.2254` Delta OID nodes.
  - Introduction of the premium glassmorphism animated frontend with dynamic widget swapping.
  - SVG dynamic line animation map routing mapping out system sources based on real-world states.
  - Active detection for connection timeouts handling error popups effectively natively utilizing `window.appData.connected` truth states.

## Setup and Installation

### Prerequisites
- Node.js running on locally on your workstation.
- Network routing access to the target IP configured (`192.168.100.11:161`)

1. Clone the repository down to your local machine:
```shell
git clone <repository_url>
cd SNMP_dashboard
```

2. Install Node Dependencies:
```shell
npm install
```

3. Boot up the backend API/UI Server:
```shell
npm start
# OR
node server.js
```

4. Navigate to your local server on the target port via an internet browser:
```
http://localhost:3000
```
