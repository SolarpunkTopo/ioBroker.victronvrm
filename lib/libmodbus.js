// libmodbus.js

'use strict';

const ModbusRTU = require('modbus-serial');

class ModbusClient {
    constructor(adapter) {
        this.adapter = adapter;
        this.pollingIntervals = {}; // Speichert Intervalle für verschiedene Datenpunkte
        this.modbusClients = {};    // Speichert Modbus-Clients für verschiedene Datenpunkte
    }

    /**
     * Startet das Polling für einen spezifischen Datenpunkt mit den gegebenen Einstellungen.
     * @param {string} ip - IP-Adresse des Modbus-Geräts.
     * @param {number} port - Portnummer.
     * @param {number} slaveId - Slave-ID des Modbus-Geräts.
     * @param {number} registerAddress - Registeradresse zum Lesen.
     * @param {number} interval - Polling-Intervall in Millisekunden.
     * @param {string} datapoint - Der Datenpunkt-ID in ioBroker.
     * @param {string} dataType - Datentyp (z.B. 'uint16', 'float32', 'string8').
     * @param {string} [endian='BE'] - Byte-Reihenfolge ('BE' für Big Endian oder 'LE' für Little Endian).
     */
    startPolling(ip, port, slaveId, registerAddress, interval, datapoint, dataType, endian = 'BE') {
        const key = datapoint;

        // Prüfe, ob bereits ein Polling für diesen Datenpunkt existiert
        if (this.pollingIntervals[key]) {
            this.adapter.log.warn(`Polling für Datenpunkt ${datapoint} läuft bereits.`);
            return;
        }

        const modbusClient = new ModbusRTU();
        this.modbusClients[key] = modbusClient;

        const fullDatapoint = `${this.adapter.namespace}.${datapoint}`;

        // Bestimme den Datenpunkttyp basierend auf dataType
        let objectType = 'number';
        if (dataType.startsWith('string')) {
            objectType = 'string';
        }

        // Stelle sicher, dass der Datenpunkt existiert
        this.adapter.setObjectNotExists(fullDatapoint, {
            type: 'state',
            common: {
                name: datapoint.split('.').pop(),
                type: objectType,
                role: 'value',
                read: true,
                write: false,
                unit: '' // Optionale Einheit
            },
            native: {}
        });

        const connectModbus = () => {
            modbusClient.connectTCP(ip, { port: port })
                .then(() => {
                    this.adapter.log.info(`Verbunden mit Modbus-Gerät bei ${ip}:${port} für Datenpunkt ${datapoint}`);
                    modbusClient.setID(slaveId);

                    // Bestimme die Anzahl der zu lesenden Register basierend auf dataType
                    let readLength = 1;
                    if (['uint32', 'int32', 'float32'].includes(dataType)) {
                        readLength = 2;
                    } else if (['uint64', 'int64', 'double', 'float64'].includes(dataType)) {
                        readLength = 4;
                    } else if (dataType.startsWith('string')) {
                        const length = parseInt(dataType.replace('string', ''), 10);
                        readLength = Math.ceil(length / 2); // 2 Zeichen pro Register
                    }

                    // Starte das Polling
                    this.pollingIntervals[key] = setInterval(() => {
                        modbusClient.readHoldingRegisters(registerAddress, readLength)
                            .then(data => {
                                let value;
                                const buffer = Buffer.from(data.buffer);

                                switch (dataType) {
                                    case 'uint16':
                                        value = endian === 'LE' ? buffer.readUInt16LE(0) : buffer.readUInt16BE(0);
                                        break;
                                    case 'int16':
                                        value = endian === 'LE' ? buffer.readInt16LE(0) : buffer.readInt16BE(0);
                                        break;
                                    case 'uint32':
                                        value = endian === 'LE' ? buffer.readUInt32LE(0) : buffer.readUInt32BE(0);
                                        break;
                                    case 'int32':
                                        value = endian === 'LE' ? buffer.readInt32LE(0) : buffer.readInt32BE(0);
                                        break;
                                    case 'float32':
                                        value = endian === 'LE' ? buffer.readFloatLE(0) : buffer.readFloatBE(0);
                                        break;
                                    case 'double':
                                    case 'float64':
                                        value = endian === 'LE' ? buffer.readDoubleLE(0) : buffer.readDoubleBE(0);
                                        break;
                                    default:
                                        if (dataType.startsWith('string')) {
                                            const length = parseInt(dataType.replace('string', ''), 10);
                                            value = buffer.toString('ascii', 0, length);
                                        } else {
                                            this.adapter.log.error(`Unbekannter Datentyp: ${dataType} für Datenpunkt ${datapoint}`);
                                            return;
                                        }
                                }

                                this.adapter.log.debug(`Modbus-Wert von Adresse ${registerAddress} für Datenpunkt ${datapoint} gelesen: ${value}`);
                                // Schreibe den Wert in den Datenpunkt
                                this.adapter.setState(fullDatapoint, { val: value, ack: true });
                            })
                            .catch(err => {
                                this.adapter.log.error(`Fehler beim Lesen des Modbus-Registers für Datenpunkt ${datapoint}: ${err.message}`);
                                // Optional: Bei Fehler erneut verbinden
                                modbusClient.close();
                                connectModbus();
                            });
                    }, interval);
                })
                .catch(err => {
                    this.adapter.log.error(`Fehler beim Verbinden mit dem Modbus-Gerät für Datenpunkt ${datapoint}: ${err.message}`);
                    // Erneuter Verbindungsversuch nach einer Verzögerung
                    setTimeout(connectModbus, 5000);
                });
        };

        // Starte die initiale Verbindung
        connectModbus();
    }

    

    /**
     * Stoppt alle Polling-Aktivitäten.
     */
    stopPolling() {
        // Stoppe alle Intervalle
        for (const key in this.pollingIntervals) {
            clearInterval(this.pollingIntervals[key]);
            delete this.pollingIntervals[key];
        }

        // Schließe alle Modbus-Clients
        for (const key in this.modbusClients) {
            this.modbusClients[key].close(() => {
                this.adapter.log.info(`Modbus-Client für Datenpunkt ${key} geschlossen.`);
            });
            delete this.modbusClients[key];
        }
    }
}

module.exports = ModbusClient;
