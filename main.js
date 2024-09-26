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
        this.sqliteDB = new SQLiteDB(this, { dbPath: './db/sqlite.db' });
		
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
		const interval = this.config.interval || 120;
		const interval2 = this.config.interval2 || 10;
		
		const installations = this.config.installations;
		const BearerToken  = this.config.BearerToken;
		
		this.username  			= username;
		this.password  			= password;
		this.VrmApiToken		= VrmApiToken;
		this.installations		= installations;


        // Wenn Einstellungen fehlen, Fehlermeldung ausgeben
        if (!username || !password) {
				this.log.error('Benutzername und Passwort sind erforderlich.');
            return;
        }
	
	try {
				// API-Login und Abruf der API-Daten
				
				const { BearerToken, idUser } = await this.vrm.getApiToken(username, password);
				const  installations = await this.vrm.getInstallationId(BearerToken, idUser);
				// const  longTermApiToken = await this.vrm.getLongTermApiToken(BearerToken, idUser);			
				
				
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
    await   this.startPolling(BearerToken, this.installationIds, (interval*1000));
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
		 this.log.info(`Objekt ${id} wurde geändert oder hinzugefügt`);
        // Objekt wurde geändert oder hinzugefügt
        if (obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
            const customSettings = obj.common.custom[this.namespace];
            const isEnabled = !!customSettings.enabled; // Standardmäßige "aktiviert"-Checkbox

            if (isEnabled) {
                // Starten des Pollings für den Datenpunkt
                if (!this.enabledDatapoints.has(id)) {
                    this.enabledDatapoints.add(id);
                    this.startPollingForDatapoint(id, customSettings);
                }
            } else {
                // Polling für den Datenpunkt stoppen
                if (this.enabledDatapoints.has(id)) {
                    this.enabledDatapoints.delete(id);
                    this.modbusClient.stopPollingForDatapoint(id);
                }
            }
        }
    } else {
        this.log.info(`Objekt ${id} wurde gelöscht`);
        if (this.enabledDatapoints.has(id)) {
            this.enabledDatapoints.delete(id);
            this.modbusClient.stopPollingForDatapoint(id);
        }
    }
}




startPollingForDatapoint(id, customSettings) {
    const ip = this.config.VenusIP || '192.168.2.88'; // IP-Adresse aus den globalen Einstellungen
    const port = 502; // Standard-Modbus-Port

    const slaveId = customSettings.slaveId || 100;
    const registerAddress = customSettings.registerAddress || 0;
    const dataType = customSettings.dataType || 'uint16';
    const interval2 = (this.config.interval2 || 60) * 1000; // Intervall in Millisekunden
    const datapoint = id.replace(`${this.namespace}.`, '');

    const useWebhook = customSettings.useWebhook || false;
    const getVariableName = customSettings.getVariableName || '';
    const webhookUrl = this.config.webhookUrl || '';

	this.log.debug('startPollingForDatapoint '+ datapoint + ip+ ':' +port+ ' '+registerAddress+ ' ');

    this.modbusClient.startPolling(
        ip,
        port,
        slaveId,
        registerAddress,
        interval2,
        datapoint,
        dataType,
        'BE', // Endianess
        useWebhook,
        getVariableName,
        webhookUrl
    );
}





async onMessage(obj) {
   
}




getAuthorizationHeader() {
    const headers = {};

    if (this.config.VrmApiToken) {
        headers['x-authorization'] = `Token ${this.config.VrmApiToken}`;
    this.log.debug('ApiToken wird verwendet');
	} else if (this.BearerToken) {
        headers['x-authorization'] = `Bearer ${this.BearerToken}`;
		this.log.debug('BearerToken wird verwendet');
	} else {
        this.log.error('Weder VrmApiToken noch BearerToken sind verfügbar. Authentifizierung fehlgeschlagen.');
        // Optional: Fehler werfen oder Standard-Header zurückgeben
    }

    return headers;
}







// async getLongTermApiToken(bearerToken, idUser) {
    // return new Promise((resolve, reject) => {
        // request.post({
            // url: `https://vrmapi.victronenergy.com/v2/users/${idUser}/accesstokens/create`,
            // headers: {
                // 'Authorization': `Bearer ${bearerToken}`,
                // 'Content-Type': 'application/json'
            // },
            // json: true,
            // body: {
                // "name": "ioBrokerAPIToken" // Du kannst einen spezifischen Label für den Token setzen
            // }
        // }, (error, response, body) => {
            // if (error) {
                // this.log.error('Fehler beim Erstellen des Langzeit-API-Tokens: ' + error.message);
                // return reject(error);
            // }
		

            // if (response.statusCode === 200 && body.token) {
                // const longTermApiToken = body.token; // Der Langzeit-API-Token
                // this.log.info('Langzeit-API-Token erfolgreich erstellt');
                // resolve(bearerToken); // Erfolgreich zurückgeben
            // } else {
                // this.log.error('Fehler beim Erstellen des Langzeit-API-Tokens: ' + response.statusCode);
                // reject(new Error('Invalid response for long-term token'));
            // }
        // });
    // });
// }




startPolling(BearerToken, installationIds, interval) {
    const pollData = (BearerToken, installationId, installationName) => {
        const url = `https://vrmapi.victronenergy.com/v2/installations/${installationId}/diagnostics?count=1000`;

        const options = {
            url: url,
             headers: this.getAuthorizationHeader()
        };

        request.get(options, (error, response, body) => {
            if (error) {
                this.log.error('Fehler bei der API-Abfrage: ' + error);
                return;
            }

            if (response.statusCode === 200) {
                try {
                    this.log.info(`Request ok für Installation ID: ${installationId}`);
                    const data = JSON.parse(body);
                    if (data.records && Array.isArray(data.records)) {
                        this.tools.processVictronRecords(data.records, installationName); // Name mitgeben
                        // Setze den Verbindungsstatus auf true bei erfolgreichem Request
                        this.setState('info.connection', true, true);
                    } else {
                        this.log.error('Unerwartetes Datenformat.');
                    }
                } catch (err) {
                    this.log.error('Fehler beim Verarbeiten der API-Daten: ' + err);
                }
            } else if (response.statusCode === 401) {
                
			
		//#################################################################################	
			const { BearerToken, idUser } =  this.vrm.getApiToken(this.username, this.password);
				// Speichern der API-Daten in der Adapterkonfiguration
				this.BearerToken				= BearerToken;
				this.idUser 			= idUser;
				
				this.log.info('Successfully fetched RENEW API token !!!');
		
		//###########################################################################	
		
			
			} else {
                this.log.error('Fehlerhafte Antwort von der API: ' + response.statusCode + ' ' + url + ' ' + installationId);
              // Logge die gesamte Antwort, um zu sehen, was zurückgegeben wird
                this.log.info('Antwort des Langzeit-API-Token Requests: ' + JSON.stringify(response));
                this.log.info('Response Body: ' + JSON.stringify(body));
            }
        });
    };


    // Funktion zur Abfrage für alle Installationen
    const pollAllData = () => {
        if (!Array.isArray(installationIds) || installationIds.length === 0) {
            this.log.warn('Keine gültigen Installation IDs zum Abfragen.');
            return;
        }

        installationIds.forEach(({ id, name }) => {
            pollData(this.BearerToken, id, name); // ID und Name übergeben
        });
    };

    // Daten in regelmäßigen Abständen abfragen
    this.log.info(`Starte API-Abfragen alle ${interval / 1000} Sekunden.`);
    this.pollingInterval = setInterval(() => pollAllData(this.BearerToken), interval);

    // Initiale API-Abfrage für alle Installationen starten
    pollAllData(this.BearerToken);
}


onUnload(callback) {
        try {
            
			// Stoppe alle Modbus-Pollings
        if (this.modbusClient) {
            this.modbusClient.stopPolling();
        }
		if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
            callback();
        } catch (e) {
            callback();
        }
    }
}

if (module.parent) {
    module.exports = (options) => new VictronVrmAdapter(options);
} else {
    new VictronVrmAdapter();
}
