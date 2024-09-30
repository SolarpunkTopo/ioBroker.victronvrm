'use strict';

const utils 		= require('@iobroker/adapter-core');
const request 		= require('request');
const axios 		= require('axios').default;
const ModbusRTU 	= require('modbus-serial');

const VRM 			= require('./lib/libvrm.js');
const TOOLS 		= require('./lib/vrmutils.js');
const SQLiteDB 		= require('./lib/libdb.js'); // Importiere die SQLiteDB-Klasse
const ModbusClient 	= require('./lib/libmodbus');
const WebhookClient = require('./lib/libWebhook');


// Hauptadapter-Klasse
class VictronVrmAdapter extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: 'victronvrm',
        });

        
		// Initialisiere die SQLite-Datenbank
        this.sqliteDB = new SQLiteDB(this, { dbPath: './db/victronDBV02.db' });
		
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
	   this.webhookClient = new WebhookClient(this); // Neue Instanz von WebhookClient
	   
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
		
		const BearerToken  = this.config.BearerToken;
		
		this.username  			= username;
		this.password  			= password;
		this.VrmApiToken		= VrmApiToken;
		
		this.idUser				= idUser;

        // Wenn Einstellungen fehlen, Fehlermeldung ausgeben
        if (!username && !password && !VrmApiToken) {
				this.log.error('Benutzername und Passwort oder VrmApiToken sind erforderlich.');
            return;
        }
	
	try {
				
				
				
		if((idUser==0 || !idUser) && !VrmApiToken) {			
				// API-Login und Abruf der API-Daten
				const { BearerToken, idUser } = await this.vrm.getApiToken(username, password);
		} else {
			
		if((idUser==0 || !idUser)) {	
			idUser  = await this.vrm.getUserId();
		}
		
		}
			
			
				
			
			
				
			
				this.BearerToken		= BearerToken;
				this.idUser 			= idUser;
					
				this.updateConfig({ idUser: idUser, BearerToken: BearerToken });
			
			
				const  installations = await this.vrm.getInstallationId(BearerToken, idUser);
				this.installations 	= installations;
				
				this.updateConfig({ installations: installations });
								
					
			} catch (error) {
					this.log.error('Error fetching API token or installation ID:', error);
			}
	
	
	// Starte den API-Polling-Prozess
    await   this.vrm.startPolling(BearerToken, this.installations, (interval*1000));
    await	this.tools.setAlive();









// Lade alle Objekte mit benutzerdefinierten Einstellungen für diesen Adapter
this.getObjectView('system', 'custom', {}, (err, doc) => {
    if (!err && doc && doc.rows) {
        doc.rows.forEach(row => {
            const obj = row.value;
            this.log.debug(`Verarbeite Objekt: ${row.id} - ${JSON.stringify(obj)} aktiviert in den settings`);
            
            // Prüfe, ob das Objekt direkt die benutzerdefinierten Einstellungen enthält
            if (obj && obj[this.namespace]) {
                const customSettings = obj[this.namespace];
                const isEnabled = !!customSettings.enabled; // Standardmäßige "aktiviert"-Checkbox

                if (isEnabled) {
                    this.enabledDatapoints.add(row.id);
                    this.modbusClient.startPollingForDatapoint(row.id, customSettings);
                    this.webhookClient.startPollingWebhook(row.id, customSettings); // Falls erforderlich
					this.log.debug(`${row.id} aktiviert in den settings`);
                }
            }
            // // Alternative Struktur: Custom Settings direkt unter dem Objekt
            // else if (obj && obj.enabled) { // Direktes 'enabled' Feld
                // const isEnabled = !!obj.enabled;

                // if (isEnabled) {
                    // this.enabledDatapoints.add(row.id);
                    // // Entferne die Custom Settings aus dem Objekt
                    // const { enabled, ...customSettings } = obj;
                    // this.modbusClient.startPollingForDatapoint(row.id, customSettings);
                    // this.log.debug(`${row.id} aktiviert in den settings (direkt unter dem Objekt)`);
                // }
            // }
        });
    } else {
        this.log.error(`Fehler beim Abrufen der Objekte: ${err}`);
    }
});


this.subscribeObjects('*');
} //ende onready
















onObjectChange(id, obj) {
    
		
    if (obj) {
        // Überprüfen, ob das Objekt zu unserem Adapter gehört
        if (id.startsWith(`${this.namespace}.`)) {
            this.log.info(`Objekt ${id} wurde geändert oder hinzugefügt`);

            if (obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                const customSettings = obj.common.custom[this.namespace];
                const isEnabled = !!customSettings.enabled; // Verwende customSettings.enabled

                this.log.debug(`isEnabled für ${id}: ${isEnabled}`);
                this.log.debug(`enabledDatapoints.has(${id}): ${this.enabledDatapoints.has(id)}`);
					
					
					if(customSettings.useWebhook===false) {
							this.webhookClient.stopWebhookPolling(id); // Falls erforderlich
					}
					
					if(customSettings.useWebhook===true) {
							this.webhookClient.startPollingWebhook(id, customSettings);  // Falls erforderlich
					}					
						
						
                if (isEnabled) {
                    // Polling für den Datenpunkt starten
                    if (!this.enabledDatapoints.has(id)) {
                        this.enabledDatapoints.add(id);
                        this.modbusClient.startPollingForDatapoint(id, customSettings);
                        this.webhookClient.startPollingWebhook(id, customSettings); // Falls erforderlich
                        this.log.info(`Polling für ${id} gestartet.`);
						
						
						
						
                    }
                } else {
                    // Polling für den Datenpunkt stoppen
                    this.enabledDatapoints.delete(id);
                    this.modbusClient.stopPolling();
                    this.webhookClient.stopWebhookPolling(id); // Falls erforderlich
                    this.log.info(`Polling für ${id} gestoppt.`);
                }
            } else {
                // Falls die benutzerdefinierten Einstellungen entfernt wurden, das Polling stoppen
                this.log.info(`Keine benutzerdefinierten Einstellungen für ${id} vorhanden. Stoppe Polling.`);
                this.enabledDatapoints.delete(id);
                this.modbusClient.stopPolling();
                this.webhookClient.stopWebhookPolling(id); // Falls erforderlich
            }
        }
    } else {
        this.log.info(`Objekt ${id} wurde gelöscht`);

        // Überprüfen, ob das Objekt zu unserem Adapter gehört
        if (id.startsWith(`${this.namespace}.`)) {
            // Polling für den Datenpunkt stoppen
            this.enabledDatapoints.delete(id);
            this.modbusClient.stopPolling();
            this.webhookClient.stopWebhookPolling(id); // Falls erforderlich
            this.log.info(`Polling für ${id} gestoppt (Objekt gelöscht).`);
        }
    }
}














async onMessage(obj) {
   
}


updateConfig(newConfig) {
        // Aktualisiere die Adapterkonfiguration
        this.extendForeignObject('system.adapter.' + this.namespace, {
            native: {
                ...this.config,
                ...newConfig
            }
        });
    }



onUnload(callback) {
    try {
        this.log.info('Adapter wird beendet...');

        // Modbus-Polling stoppen
        if (this.modbusClient) {
            this.modbusClient.stopAllPolling();
            this.log.info('Alle Modbus-Polling-Intervalle wurden gestoppt.');
        }

        // Webhook-Polling stoppen
        if (this.webhookClient) {
            this.webhookClient.stopAllWebhookPolling();
            this.log.info('Alle Webhook-Polling-Intervalle wurden gestoppt.');
        }

        // VRM-Polling stoppen (falls verwendet)
        if (this.vrmClient) {
            this.vrmClient.stopAllPolling();
            this.log.info('Alle VRM-Polling-Intervalle wurden gestoppt.');
        }

        // Datenbankverbindung schließen
        if (this.sqliteDB) {
            this.sqliteDB.close();
            this.log.info('Datenbankverbindung wurde geschlossen.');
        }

        this.log.info('Adapter wurde erfolgreich entladen.');
        callback();
    } catch (e) {
        this.log.error(`Fehler beim Entladen des Adapters: ${e.message}`);
        callback();
    }
}

}

if (module.parent) {
    module.exports = (options) => new VictronVrmAdapter(options);
} else {
    new VictronVrmAdapter();
}
