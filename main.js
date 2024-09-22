'use strict';

const utils = require('@iobroker/adapter-core');
const request = require('request');
const axios = require('axios');
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
		const username = this.config.username;
		const password = this.config.password;
		const interval = this.config.interval || 60;


		this.username  			= username;
		

        // Wenn Einstellungen fehlen, Fehlermeldung ausgeben
        if (!username || !password) {
            this.log.error('Benutzername und Passwort sind erforderlich.');
            return;
        }


	
	
	try {
				// API-Login und Abruf der API-Daten
				
				const { apiToken, idUser } = await this.getApiToken(username, password);
				const  installations = await this.getInstallationId(apiToken, idUser);
				
			
			if (installations.length > 0) {
					
				// Speichern der API-Daten in der Adapterkonfiguration
				this.apiKey				= apiKey;
				this.idUser 			= idUser;
				this.installationIds 	= installations;
				
				
				this.log.info('Successfully fetched API token and installation ID.');
		 }
			
			} catch (error) {
				this.log.error('Error fetching API token or installation ID:', error);
			}
	
	
	// Starte den API-Polling-Prozess
    await   this.startPolling(apiKey, this.installationIds, (interval*1000));
    
	
		
		
	this.setObjectNotExistsAsync('info.alive', {
    type: 'state',
    common: {
        name: 'Alive',
        type: 'boolean',
        role: 'indicator.connected',
        read: true,
        write: false,
        def: false
    },
    native: {}
}).then(() => {
    // Lebenszeichen setzen
    setInterval(() => {
        this.setState('info.alive', { val: true, ack: true }); // true = Adapter ist am Leben
    }, 60000); // Jede Minute das Lebenszeichen setzen
});




	}





async onMessage(obj) {
   
}






async getApiToken(username, password) {
    return new Promise((resolve, reject) => {
        request.post({
            url: 'https://vrmapi.victronenergy.com/v2/auth/login',
            json: true,
            body: { 
					username: username, 
					password: password 
		},
            headers: { 'Content-Type': 'application/json' }
        }, (error, response, body) => {
            if (error) {
                this.log.error('Fehler beim API-Token-Abruf: ' + error.message);
                return reject(error);
            }

            if (response.statusCode === 200 && body.token && body.idUser) {
                const apiToken = body.token;  // Der Bearer-Token
                const idUser   = body.idUser; //idUser für urls
				// Speichern des Tokens in den Einstellungen
                this.apiKey			= apiToken;
				this.setState('info.connection', true, true);
				this.log.info('API Token erfolgreich geholt');
                // Erfolgreich den API-Token und idUser zurückgeben
                resolve({ apiToken, idUser });
            } else {
                this.log.error('Fehler beim Abrufen des API-Tokens: ' + response.statusCode);
                reject(new Error('Invalid response'));
            }
        });
    });
}







// async getLongTermApiToken(bearerToken, idUser) {
    // return new Promise((resolve, reject) => {
        // // request.post({
            // // url: `https://vrmapi.victronenergy.com/v2/users/${idUser}/accesstokens/create`,
            // // headers: {
                // // 'Authorization': `Bearer ${bearerToken}`,
                // // 'Content-Type': 'application/json'
            // // },
            // // json: true,
            // // body: {
                // // "name": "ioBrokerAPIToken" // Du kannst einen spezifischen Label für den Token setzen
            // // }
        // // }, (error, response, body) => {
            // // if (error) {
                // // this.log.error('Fehler beim Erstellen des Langzeit-API-Tokens: ' + error.message);
                // // return reject(error);
            // // }


			

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







async getInstallationId(apiToken, idUser) {
    return new Promise((resolve, reject) => {
        request.get({
            url: `https://vrmapi.victronenergy.com/v2/users/${idUser}/installations`,
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
                    const installations = data.records.map(record => ({
                        id: record.idSite,
                        name: record.name
                    }));

                    this.log.info(`Installationen erfolgreich abgerufen: ${installations.map(i => `${i.id}: ${i.name}`).join(', ')}`);
                    
                    resolve(installations);
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


    













   // Abfrage der API-Daten und Verarbeitung
startPolling(apiKey, installationIds, interval) {
    const pollData = (installationId, installationName) => {
        const url = `https://vrmapi.victronenergy.com/v2/installations/${installationId}/diagnostics?count=1000`;

        const options = {
            url: url,
            headers: {
                'x-authorization': `Bearer ${this.apiKey}`
            }
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
                        this.processVictronRecords(data.records, installationName); // Name mitgeben

                        // Setze den Verbindungsstatus auf true bei erfolgreichem Request
                        this.setState('info.connection', true, true);
                    } else {
                        this.log.error('Unerwartetes Datenformat.');
                    }
                } catch (err) {
                    this.log.error('Fehler beim Verarbeiten der API-Daten: ' + err);
                }
            } else {
			    this.log.error('Fehlerhafte Antwort von der API: ' + response.statusCode + url + ' ' + installationId);
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
            pollData(id, name); // ID und Name übergeben
        });
    };

    // Daten in regelmäßigen Abständen abfragen
    this.log.info(`Starte API-Abfragen alle ${interval / 1000} Sekunden.`);
    this.pollingInterval = setInterval(pollAllData, (interval));

    // Initiale API-Abfrage für alle Installationen starten
    pollAllData();
}







processVictronRecords(records,installationName) {
    records.forEach(record => {
        const dbusServiceType = record.dbusServiceType;
        const description = record.description.replace(/[^a-zA-Z0-9-]/g, '_');
        const rootnode    = installationName.replace(/[^a-zA-Z0-9-]/g, '_');
		const basePath = `${rootnode}.${dbusServiceType}.${description}`;
        
        this.createDataPoints(record, basePath);
    });
}

// Rekursive Methode zur Verarbeitung von Objekten
createDataPoints(record, basePath) {
    for (let key in record) {
        if (key !== 'dbusServiceType' && key !== 'description') {
            const dataPointName = `${basePath}.${key}`;
            const value = record[key];

            if (typeof value === 'object' && value !== null) {
                // Falls der Wert ein Objekt ist, rufe die Funktion rekursiv auf
                this.createDataPoints(value, dataPointName);
            } else {
                // Ansonsten den Datenpunkt erstellen
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
    }
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
