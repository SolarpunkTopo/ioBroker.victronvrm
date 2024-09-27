'use strict';

const utils 		= require('@iobroker/adapter-core');
const request 		= require('request');
const axios 		= require('axios').default;
const ModbusRTU 	= require('modbus-serial');

const VRM 			= require('./lib/libvrm.js');
const TOOLS 		= require('./lib/vrmutils.js');
const SQLiteDB 		= require('./lib/libdb.js'); // Importiere die SQLiteDB-Klasse
const ModbusClient 	= require('./lib/libmodbus');


// Hauptadapter-Klasse
class VictronVrmAdapter extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: 'victronvrm',
        });

        
		// Initialisiere die SQLite-Datenbank
        this.sqliteDB = new SQLiteDB(this, { dbPath: './db/victronDB.db' });
		
		// Bindung der Funktionen
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('objectChange', this.onObjectChange.bind(this)); 
	
	// Other initializations
        this.modbusPollingInterval = null; // Will hold the polling interval ID
		
	   //Objects
	   this.vrm = new VRM(this); // VRM-Instanz erstellen
	   this.tools = new TOOLS(this); // VRM-utils erstellen
	   this.modbusClient = new ModbusClient(this);
	    // **Hier initialisieren wir enabledDatapoints**
        this.enabledDatapoints = new Set();
	}


 async onReady() {
        // Adapter ist bereit und startet
        this.log.info('Victron VRM Adapter gestartet.');

        // API-Key und andere Einstellungen aus den Konfigurationen lesen
        // Initialisiere die Konfiguration
		const VrmApiToken = this.config.VrmApiToken;
		const username = this.config.username;
		const password = this.config.password;
		const interval = this.config.interval || 240;
		const interval2 = this.config.interval2 || 10;
		const interval3 = this.config.interval2 || 30;
		
		const idUser	= this.config.idUser;
		const installations = this.config.installations;
		const BearerToken  = this.config.BearerToken;
		
		this.username  			= username;
		this.password  			= password;
		this.VrmApiToken		= VrmApiToken;
		this.installations		= installations;
		this.idUser				= idUser;

        // Wenn Einstellungen fehlen, Fehlermeldung ausgeben
        if (!username || !password) {
				this.log.error('Benutzername und Passwort sind erforderlich.');
            return;
        }
	
	try {
				// API-Login und Abruf der API-Daten
			if(!VrmApiToken || !idUser || !installations){	
				const { BearerToken, idUser } = await this.vrm.getApiToken(username, password);
				const  installations = await this.vrm.getInstallationId(BearerToken, idUser);
			}
				
				
				// Speichern der API-Daten in der Adapterkonfiguration
				this.BearerToken		= BearerToken;
				this.idUser 			= idUser;
				this.installationIds 	= installations;
					this.log.info('Successfully fetched API token and installation ID.');
					this.log.warn('Successfully fetched log term API token' + longTermApiToken);
					
			} catch (error) {
					this.log.error('Error fetching API token or installation ID:', error);
			}
	
	
	// Starte den API-Polling-Prozess
    await   this.vrm.startPolling(BearerToken, this.installationIds, (interval*1000));
    await	this.tools.setAlive();




// Definiere den Datenpunkt, in den der Modbus-Wert gespeichert werden soll
        // const datapoint = 'TorstenPunk.battery.State_of_health.rawValue';
    	// this.modbusClient.startPolling(
            // '192.168.2.88', // IP-Adresse
            // 502,            // Port
            // 100,            // Slave-ID
            // 843,            // Registeradresse
            // 2000,          // Intervall in Millisekunden
            // datapoint,      // Datenpunkt
            // 'uint16'        // Datentyp
            // Optional: Endianness, Standard ist 'BE' (Big Endian)
        // );








 // Lade alle Objekte mit benutzerdefinierten Einstellungen für diesen Adapter
    this.getObjectView('system', 'custom', {}, (err, doc) => {
        if (!err && doc && doc.rows) {
            doc.rows.forEach(row => {
                const obj = row.value;
               
				if (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                    const customSettings = obj.common.custom[this.namespace];
                    const isEnabled = !!customSettings.enabled; // Standardmäßige "aktiviert"-Checkbox

                    if (isEnabled) {
                        this.enabledDatapoints.add(row.id);
                        this.startPollingForDatapoint(row.id, customSettings);
                    this.log.debug(id+ 'aktiviert in den settings');
					}
                }
            });
        }
    });


this.subscribeObjects('*');
} //ende onready
















onObjectChange(id, obj) {
    this.log.info(`onObjectChange wurde aufgerufen für Objekt ${id}`);

    if (obj) {
        // Überprüfen, ob das Objekt zu unserem Adapter gehört
        if (id.startsWith(`${this.namespace}.`)) {
            this.log.info(`Objekt ${id} wurde geändert oder hinzugefügt`);

            if (obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                const customSettings = obj.common.custom[this.namespace];
                const isEnabled = !!customSettings.enabled; // Verwende customSettings.enabled

                this.log.debug(`isEnabled für ${id}: ${isEnabled}`);
                this.log.debug(`enabledDatapoints.has(${id}): ${this.enabledDatapoints.has(id)}`);
					
					
					
                if (isEnabled) {
                    // Polling für den Datenpunkt starten
                    if (!this.enabledDatapoints.has(id)) {
                        this.enabledDatapoints.add(id);
                        this.startPollingForDatapoint(id, customSettings);
                        this.startPollingWebhook(id, customSettings); // Falls erforderlich
                        this.log.info(`Polling für ${id} gestartet.`);
                    }
                } else {
                    // Polling für den Datenpunkt stoppen
                    this.enabledDatapoints.delete(id);
                    this.modbusClient.stopPolling();
                    this.stopWebhookPolling(id); // Falls erforderlich
                    this.log.info(`Polling für ${id} gestoppt.`);
                }
            } else {
                // Falls die benutzerdefinierten Einstellungen entfernt wurden, das Polling stoppen
                this.log.info(`Keine benutzerdefinierten Einstellungen für ${id} vorhanden. Stoppe Polling.`);
                this.enabledDatapoints.delete(id);
                this.modbusClient.stopPolling();
                this.stopWebhookPolling(id); // Falls erforderlich
            }
        }
    } else {
        this.log.info(`Objekt ${id} wurde gelöscht`);

        // Überprüfen, ob das Objekt zu unserem Adapter gehört
        if (id.startsWith(`${this.namespace}.`)) {
            // Polling für den Datenpunkt stoppen
            this.enabledDatapoints.delete(id);
            this.modbusClient.stopPolling();
            this.stopWebhookPolling(id); // Falls erforderlich
            this.log.info(`Polling für ${id} gestoppt (Objekt gelöscht).`);
        }
    }
}

























async startPollingForDatapoint(id, customSettings) {
    
	
	// Überprüfen, ob der Datenpunkt mit 'rawValue' endet
    if (!id.endsWith('rawValue')) {
        this.log.warn(`Modbus-Polling wurde für Datenpunkt ${id} nicht gestartet, da er nicht mit 'rawValue' endet.`);
        return;
    }
	
	
	
	const ip = this.config.VenusIP || '192.168.2.88'; // IP-Adresse aus den globalen Einstellungen
    const port = 502; // Standard-Modbus-Port
    const slaveId = customSettings.slaveId || 100;
    const interval2 = (this.config.interval2 || 60) * 1000; // Intervall in Millisekunden
    const datapoint = id.replace(`${this.namespace}.`, '');

    // Extrahiere basePath und key aus dem aktuellen Datenpunkt
    const idParts = datapoint.split('.');
    if (idParts.length < 2) {
        this.log.error(`Ungültige Datenpunkt-ID: ${datapoint}`);
        return;
    }

    // Angenommen, die Struktur ist victronvrm.0.basePath.key
    const basePath = idParts.slice(0, -1).join('.'); // Alles außer dem letzten Teil
    const key = idParts[idParts.length - 1]; // Letzter Teil der ID

    // Konstruktion des Datenpunkts, von dem wir den Wert von dbusPath erhalten
    const dbusPathDataPointId = `${this.namespace}.${basePath}.dbusPath`;

    // Wert von dbusPath aus dem entsprechenden Datenpunkt lesen
    let stateDbusPath;
    try {
        stateDbusPath = await this.getStateAsync(dbusPathDataPointId);
    } catch (error) {
        this.log.error(`Fehler beim Lesen des Zustands von ${dbusPathDataPointId}: ${error.message}`);
        return;
    }

    if (!stateDbusPath || stateDbusPath.val == null) {
        this.log.error(`dbusPath für Datenpunkt ${datapoint} nicht gefunden oder ungültig.`);
        return;
    }

    const dbusPath = stateDbusPath.val;

    // Vor der SQL-Abfrage: Tabellen in der Datenbank auflisten und ins Log schreiben
    try {
        const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table';";
        const tablesResult = await this.sqliteDB.query(tablesQuery);
        this.log.debug(`Liste der Tabellen in der Datenbank: ${JSON.stringify(tablesResult)}`);
    } catch (error) {
        this.log.error(`Fehler beim Abfragen der Tabellennamen: ${error.message}`);
    }

    // Datenbankabfrage mit dbusPath
    const sql = 'SELECT Address, Type FROM dbusdata WHERE "dbus-obj-path" = ?';
    let dbResult;

    try {
        dbResult = await this.sqliteDB.query(sql, [dbusPath]);
    } catch (error) {
        this.log.error(`Fehler beim Abfragen der Datenbank für dbusPath ${dbusPath}: ${error.message}`);
        return;
    }

    if (!dbResult || dbResult.length === 0) {
        this.log.error(`Keine Daten in der Datenbank für dbus-obj-path ${dbusPath} gefunden.`);
        return;
    }

    const registerAddress = dbResult[0].Address;
    const dataType = dbResult[0].Type;

    if (registerAddress == null || dataType == null) {
        this.log.error(`Ungültige Daten aus der Datenbank für dbusPath ${dbusPath}.`);
        return;
    }


// Speichern von registerAddress und dataType in den customSettings
    try {
        const obj = await this.getObjectAsync(id);
        if (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
            obj.common.custom[this.namespace].registerAddress = registerAddress;
            obj.common.custom[this.namespace].dataType = dataType;
			obj.common.custom[this.namespace].dbusPath = dbusPath;
            await this.setObjectAsync(id, obj);
            this.log.debug(`registerAddress (${registerAddress}) und dataType (${dataType}) in customSettings für ${id} gespeichert.`);
        }
    } catch (error) {
        this.log.error(`Fehler beim Speichern von registerAddress und dataType in customSettings für ${id}: ${error.message}`);
    }



    this.log.debug(`startPollingForDatapoint ${datapoint} ${ip}:${port} RegisterAddress: ${registerAddress}, DataType: ${dataType}`);

    this.modbusClient.startPolling(
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













startPollingWebhook(id, customSettings) {
    const useWebhook = customSettings.useWebhook || false;
    const getVariableName = customSettings.getVariableName || '';
    const webhookUrl = this.config.webhookUrl || '';
    const interval3 = (this.config.interval3 || 60) * 1000; // Intervall in Millisekunden
    const datapoint = id;

    if (!useWebhook) {
        this.log.debug(`Webhook für Datenpunkt ${datapoint} ist deaktiviert.`);
        return;
    }

    // Prüfen, ob die erforderlichen Parameter vorhanden sind
    if (!webhookUrl || !getVariableName) {
        this.log.warn(`Webhook-URL oder Variablenname für Datenpunkt ${datapoint} nicht gesetzt.`);
        return;
    }

    // Überprüfen, ob bereits ein Polling für diesen Webhook läuft
    if (this.webhookIntervals && this.webhookIntervals[datapoint]) {
        this.log.debug(`Webhook-Polling für Datenpunkt ${datapoint} läuft bereits.`);
        return;
    }

    // Funktion zur Durchführung des Webhook-Aufrufs
    const webhookFunction = async () => {
        try {
            // Aktuellen Wert des Datenpunkts lesen
            const state = await this.getStateAsync(datapoint);
            if (!state || state.val === null || state.val === undefined) {
                this.log.warn(`Kein gültiger Wert für Datenpunkt ${datapoint} vorhanden.`);
                return;
            }

            // Webhook-URL mit Query-Parameter erstellen
            const url = `${webhookUrl}?${encodeURIComponent(getVariableName)}=${encodeURIComponent(state.val)}`;

            // HTTP GET-Request ausführen
            const response = await axios.get(url);

            this.log.debug(`Webhook für Datenpunkt ${datapoint} aufgerufen. Antwortstatus: ${response.status}`);
        } catch (error) {
            this.log.error(`Fehler beim Aufrufen des Webhooks für Datenpunkt ${datapoint}: ${error.message}`);
        }
    };

    // Intervall für den Webhook-Aufruf starten
    if (!this.webhookIntervals) {
        this.webhookIntervals = {};
    }
    this.webhookIntervals[datapoint] = setInterval(webhookFunction, interval3);

    // Sofortigen ersten Aufruf durchführen
    webhookFunction();
}



stopWebhookPolling(datapoint) {
    if (this.webhookIntervals && this.webhookIntervals[datapoint]) {
        clearInterval(this.webhookIntervals[datapoint]);
        delete this.webhookIntervals[datapoint];
        this.log.info(`Webhook-Polling für Datenpunkt ${datapoint} gestoppt.`);
    }
}




async onMessage(obj) {
   
}






onUnload(callback) {
    try {
        // Stoppe das API-Polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        // Stoppe Modbus-Polling für Datenpunkte
        if (this.enabledDatapoints) {
            this.enabledDatapoints.forEach(id => {
                this.modbusClient.stopPollingForDatapoint(id);
                this.stopWebhookPolling(id);
            });
            this.enabledDatapoints.clear();
        }

        // Weitere Bereinigungen...

        callback();
    } catch (e) {
        this.log.error(`Fehler beim Entladen: ${e}`);
        callback();
    }
}

}

if (module.parent) {
    module.exports = (options) => new VictronVrmAdapter(options);
} else {
    new VictronVrmAdapter();
}
