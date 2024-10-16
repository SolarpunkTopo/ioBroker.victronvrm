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
    } //ende startPolling
	
	
	
	
	/**
     * Schreibt einen Wert in ein Modbus-Register
     * @param {number} slaveId - Die Slave-ID (100)
     * @param {number} registerAddress - Die Registeradresse
     * @param {number|string} value - Der Wert, der geschrieben werden soll
     * @param {string} dataType - Der Datentyp (z.B. 'int16', 'float32')
     */
    async writeRegister(slaveId, registerAddress, value, dataType) {
        if (!this.connected) {
            this.adapter.log.warn('Modbus-Client ist nicht verbunden. Versuche, erneut zu verbinden.');
            await this.connect();
            if (!this.connected) {
                throw new Error('Modbus-Client konnte nicht verbunden werden.');
            }
        }

        try {
            // Konvertiere den Wert basierend auf dem Datentyp
            let buffer;
            switch (dataType) {
                case 'int16':
                    buffer = Buffer.alloc(2);
                    buffer.writeInt16BE(value, 0);
                    break;
                case 'uint16':
                    buffer = Buffer.alloc(2);
                    buffer.writeUInt16BE(value, 0);
                    break;
                case 'float32':
                    buffer = Buffer.alloc(4);
                    buffer.writeFloatBE(value, 0);
                    break;
                // Füge weitere Datentypen nach Bedarf hinzu
                default:
                    throw new Error(`Unbekannter Datentyp: ${dataType}`);
            }

            // Schreibe die Bytes in das Register
            await this.client.writeRegisters(registerAddress, Array.from(buffer));
            this.adapter.log.info(`Wert ${value} (${dataType}) erfolgreich in Register ${registerAddress} (Slave ${slaveId}) geschrieben.`);
        } catch (error) {
            this.adapter.log.error(`Fehler beim Schreiben in Register ${registerAddress} (Slave ${slaveId}): ${error.message}`);
            throw error;
        }
    }
	
	
	
	
	
async fetchAndSaveModbusData(id) {
    // Extrahiere datapoint aus der ID
    const datapoint = id.replace(`${this.adapter.namespace}.`, '');

    // Extrahiere basePath und key aus dem aktuellen Datenpunkt
    const idParts = datapoint.split('.');
    if (idParts.length < 2) {
        this.adapter.log.error(`Ungültige Datenpunkt-ID: ${datapoint}`);
        return;
    }

    // Bestimme basePath und key
    const basePath = idParts.slice(0, -1).join('.'); // Alles außer dem letzten Teil
    const key = idParts[idParts.length - 1]; // Letzter Teil der ID

    // Konstruktion des Datenpunkts, von dem wir den Wert von dbusPath erhalten
    const dbusPathDataPointId = `${this.adapter.namespace}.${basePath}.dbusPath`;

    // Wert von dbusPath aus dem entsprechenden Datenpunkt lesen
    let stateDbusPath;
    try {
        stateDbusPath = await this.adapter.getStateAsync(dbusPathDataPointId);
    } catch (error) {
        this.adapter.log.error(`Fehler beim Lesen des Zustands von ${dbusPathDataPointId}: ${error.message}`);
        return;
    }

    if (!stateDbusPath || stateDbusPath.val == null) {
        this.adapter.log.error(`dbusPath für Datenpunkt ${datapoint} nicht gefunden oder ungültig.`);
        return;
    }

    const dbusPath = stateDbusPath.val.trim().toLowerCase();

    // Vor der SQL-Abfrage: Tabellen in der Datenbank auflisten und ins Log schreiben
    try {
        const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table';";
        const tablesResult = await this.adapter.sqliteDB.query(tablesQuery);
        this.adapter.log.debug(`Liste der Tabellen in der Datenbank: ${JSON.stringify(tablesResult)}`);
    } catch (error) {
        this.adapter.log.error(`Fehler beim Abfragen der Tabellennamen: ${error.message}`);
    }

    // Datenbankabfrage mit dbusPath
    const sql = 'SELECT Address, Type, Scalefactor, writable, "dbus_unit" as dbusunit FROM dbusdata WHERE lower("dbus_obj_path") like ? limit 1';
    let dbResult;

    try {
        dbResult = await this.adapter.sqliteDB.query(sql, [dbusPath]);
    } catch (error) {
        this.adapter.log.error(`Fehler beim Abfragen der Datenbank für dbusPath ${dbusPath}: ${error.message}`);
        return;
    }

    if (!dbResult || dbResult.length === 0) {
        this.adapter.log.error(`Keine Daten in der Datenbank für dbus-obj-path ${dbusPath} gefunden.`);
        return;
    }

    const registerAddress = dbResult[0].Address;
    const dataType = dbResult[0].Type;
    const Scalefactor = dbResult[0].Scalefactor;
    const writable = dbResult[0].writable;
    const dbusunit = dbResult[0].dbusunit;

    if (registerAddress == null || dataType == null) {
        this.adapter.log.error(`Ungültige Daten aus der Datenbank für dbusPath ${dbusPath}.`);
        return;
    }

    // Speichern von registerAddress und dataType in den customSettings
    try {
        const obj = await this.adapter.getObjectAsync(id);
        if (obj && obj.common && obj.common.custom && obj.common.custom[this.adapter.namespace]) {
            obj.common.custom[this.adapter.namespace].registerAddress = registerAddress;
            obj.common.custom[this.adapter.namespace].dataType = dataType;
            obj.common.custom[this.adapter.namespace].dbusPath = dbusPath;
            obj.common.custom[this.adapter.namespace].Scalefactor = Scalefactor;
            obj.common.custom[this.adapter.namespace].writable = writable;
            obj.common.custom[this.adapter.namespace].dbusunit = dbusunit;

            await this.adapter.setObjectAsync(id, obj);
            this.adapter.log.debug(`Daten für ${id} erfolgreich in customSettings gespeichert.`);
        }
    } catch (error) {
        this.adapter.log.error(`Fehler beim Speichern der Daten in customSettings für ${id}: ${error.message}`);
    }
}
	
	
	
	

   async startPollingForDatapoint(id, customSettings) {
    // Überprüfen, ob der Datenpunkt mit 'rawValue' endet
    if (!id.endsWith('rawValue')) {
        this.adapter.log.warn(`Modbus-Polling wurde für Datenpunkt ${id} nicht gestartet, da er nicht mit 'rawValue' endet.`);
        return;
    }

    const ip = this.adapter.config.VenusIP || '192.168.2.88'; // IP-Adresse aus den globalen Einstellungen
    const port = 502; // Standard-Modbus-Port
    const slaveId = customSettings.slaveId || 100;
    const interval2 = (this.adapter.config.interval2 || 60) * 1000; // Intervall in Millisekunden
    const datapoint = id.replace(`${this.adapter.namespace}.`, '');

    // Aufruf der neuen Methode zum Abrufen und Speichern der Modbus-Daten
    await this.fetchAndSaveModbusData(id);

    // Aktualisierte customSettings abrufen
    const obj = await this.adapter.getObjectAsync(id);
    if (obj && obj.common && obj.common.custom && obj.common.custom[this.adapter.namespace]) {
        customSettings = obj.common.custom[this.adapter.namespace];
    } else {
        this.adapter.log.error(`CustomSettings für ${id} konnten nicht gelesen werden.`);
        return;
    }

    const registerAddress = customSettings.registerAddress;
    const dataType = customSettings.dataType;

    if (registerAddress == null || dataType == null) {
        this.adapter.log.error(`registerAddress oder dataType für ${id} nicht in customSettings gefunden.`);
        return;
    }

    this.adapter.log.debug(`startPollingForDatapoint ${datapoint} ${ip}:${port} RegisterAddress: ${registerAddress}, DataType: ${dataType}`);

    this.startPolling(
        ip,
        port,
        slaveId,
        registerAddress,
        interval2,
        datapoint,
        dataType,
        'BE' // Endianess
    );
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
	
	
	
stopAllPolling() {
    for (const datapoint in this.pollingIntervals) {
        clearInterval(this.pollingIntervals[datapoint]);
        delete this.pollingIntervals[datapoint];
        this.adapter.log.info(`Modbus-Polling für Datenpunkt ${datapoint} gestoppt.`);
    }
}



}

module.exports = ModbusClient;
