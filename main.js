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
    }

    async onReady() {
        // Adapter ist bereit und startet
        this.log.info('Victron VRM Adapter gestartet.');

        // API-Key und andere Einstellungen aus den Konfigurationen lesen
        // Initialisiere die Konfiguration
		const apiKey = this.config.apiKey || '6b332d3fa2e2f2a7e0ff45100696df8af0e06c70b65bdb0d1c00417cf325973a';
		const installationId = this.config.installationId || '425938';
		const username = this.config.username || 'Christoph';
		this.username= username;
		const password = this.config.password || 'default_password';
		const interval = this.config.interval || 60000;

        // Wenn Einstellungen fehlen, Fehlermeldung ausgeben
        if (!apiKey || !installationId || !username || !password) {
            this.log.error('API-Key, Anlagen-ID, Benutzername und Passwort sind erforderlich.');
            return;
        }

        // Starte den API-Polling-Prozess
        this.startPolling(apiKey, installationId, interval);
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
            const description = record.description.replace(/\s+/g, '_');
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
