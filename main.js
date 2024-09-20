'use strict';

const utils = require('@iobroker/adapter-core');
const request = require('request');

// Hauptadapter-Klasse
class VictronVrmAdapter extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: 'victronvrm',
        });

        // Bindung der Funktionen
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
		this.on('message', this.onMessage.bind(this));
    

	}


 async onReady() {
        // Adapter ist bereit und startet
        this.log.info('Victron VRM Adapter gestartet.');

        // API-Key und andere Einstellungen aus den Konfigurationen lesen
        // Initialisiere die Konfiguration
		const apiKey = this.config.apiKey;
		const installationId = this.config.installationId;
		const username = this.config.username;
			this.username= username;
		const password = this.config.password;
		const interval = this.config.interval || 60000;

        // Wenn Einstellungen fehlen, Fehlermeldung ausgeben
        if (!apiKey || !installationId || !username || !password) {
            this.log.error('API-Key, Anlagen-ID, Benutzername und Passwort sind erforderlich.');
            return;
        }

        // Starte den API-Polling-Prozess
        this.startPolling(apiKey, installationId, interval);
    
	
		
		
		// Lebenszeichen (alive) setzen
	setInterval(() => {
		this.setState('info.alive', { val: true, ack: true }); // true = Adapter ist am Leben
	}, 10000); // Jede Minute das Lebenszeichen setzen
	
	
	}





onMessage(obj) {
        if (obj && obj.command === 'fetchApiDetails' && obj.message) {
            this.log.info('API Token erfolgreich abgerufen');
        } else if (obj && obj.command === 'glances' && obj.message) {
            
        } else {
            obj.callback && this.sendTo(obj.from, 'fetchApiDetails', { error: 'Unsupported' }, obj.callback);
        }
    }






getApiToken(username, password) {
    return new Promise((resolve, reject) => {
        request.post({
            url: 'https://vrmapi.victronenergy.com/v2/auth/login',
            json: true,
            body: { username, password },
            headers: { 'Content-Type': 'application/json' }
        }, (error, response, body) => {
            if (error) {
                this.log.error('Fehler beim API-Token-Abruf: ' + error.message);
                return reject(error);
            }

            if (response.statusCode === 200 && body.token) {
                const apiToken = body.token;  // Der Bearer-Token
                this.log.info('API Token erfolgreich abgerufen');
                
                // Speichern des Tokens in den Einstellungen
                this.config.apiKey = apiToken;
                this.setState('info.connection', true, true);

                resolve(apiToken);  // Erfolgreich zurückgeben
            } else {
                this.log.error('Fehler beim Abrufen des API-Tokens: ' + response.statusCode);
                reject(new Error('Invalid response'));
            }
        });
    });
}


 getInstallationId(apiToken) {
    return new Promise((resolve, reject) => {
        request.get({
            url: 'https://vrmapi.victronenergy.com/v2/installations',
            headers: {
                'x-authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        }, (error, response, body) => {
            if (error) {
                this.log.error('Fehler beim Abrufen der Installation-ID: ' + error.message);
                return reject(error);
            }

            if (response.statusCode === 200) {
                const data = JSON.parse(body);
                if (data.records && data.records.length > 0) {
                    const installationId = data.records[0].id;
                    this.log.info('Installation-ID erfolgreich abgerufen: ' + installationId);
                    resolve(installationId);
                } else {
                    this.log.error('Keine Installationen gefunden');
                    reject(new Error('No installations found'));
                }
            } else {
                this.log.error('Fehlerhafte Antwort von der API: ' + response.statusCode);
                reject(new Error('Invalid response'));
            }
        });
    });
}


    







	async onFetchApiDetails() {
			const username = this.config.username;
			const password = this.config.password;

			if (!username || !password) {
				this.log.error('Username or password is missing.');
				return;
			}

			try {
				// API-Login und Abruf der API-Daten
				const apiToken = await this.getApiToken(username, password);
				const installationId = await this.getInstallationId(apiToken);

				// Speichern der API-Daten in der Adapterkonfiguration
				this.updateConfig({ apiKey: apiToken, installationId: installationId });

				this.log.info('Successfully fetched API token and installation ID.');
			} catch (error) {
				this.log.error('Error fetching API token or installation ID:', error);
			}
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








   

    // Funktion zur Abfrage der API-Daten und Verarbeitung
    startPolling(apiKey, installationId, interval) {
        const url = `https://vrmapi.victronenergy.com/v2/installations/${installationId}/diagnostics?count=1000`;

        const options = {
            url: url,
            headers: {
                'x-authorization': `Token ${apiKey}`
            }
        };

        const pollData = () => {
            request.get(options, (error, response, body) => {
                if (error) {
                    this.log.error('Fehler bei der API-Abfrage: ' + error);
                    return;
                }

                if (response.statusCode === 200) {
                    try {
						this.log.info('Request ok... ');
                        const data = JSON.parse(body);
                        if (data.records && Array.isArray(data.records)) {
                            this.processVictronRecords(data.records);
							
							// Setze den Verbindungsstatus auf true bei erfolgreichem Request
							this.setState('info.connection', true, true);
						
						
						} else {
                            this.log.error('Unerwartetes Datenformat.');
                        }
                    } catch (err) {
                        this.log.error('Fehler beim Verarbeiten der API-Daten: ' + err);
                    }
                } else {
                    this.log.error('Fehlerhafte Antwort von der API: ' + response.statusCode);
                }
            });
        };

        // Daten in regelmäßigen Abständen abfragen
        this.log.info(`Starte API-Abfragen alle ${interval / 1000} Sekunden.`);
        this.pollingInterval = setInterval(pollData, interval);

        // Initiale API-Abfrage starten
        pollData();
    }

    // Verarbeite die API-Daten und lege Datenpunkte an
    processVictronRecords(records) {
        records.forEach(record => {
            const dbusServiceType = record.dbusServiceType;
            const description = record.description.replace(/[^a-zA-Z0-9-]/g, '_');
            const basePath = `${this.username}.${dbusServiceType}.${description}`;
			
            for (let key in record) {
                if (key !== 'dbusServiceType' && key !== 'description') {
                    const dataPointName = `${basePath}.${key}`;
                    const value = record[key];

                    this.setObjectNotExistsAsync(dataPointName, {
                        type: 'state',
                        common: {
                            name: key,
                            type: typeof value,
                            role: 'value',
                            read: true,
                            write: false
                        },
                        native: {}
                    });

                    this.setState(dataPointName, { val: value, ack: true });
					
				}
            }
        });
    }

    onUnload(callback) {
        try {
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
