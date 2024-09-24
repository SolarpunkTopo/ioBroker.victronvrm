'use strict';

const utils = require('@iobroker/adapter-core');
const request = require('request');
const axios = require('axios').default;


const VRM = require('./lib/libvrm.js');
const TOOLS = require('./lib/vrmutils.js');

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
    
	   this.vrm = new VRM(this); // VRM-Instanz erstellen
	   this.tools = new TOOLS(this); // VRM-utils erstellen
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
		const installations = this.config.installations;
		const BearerToken  = this.config.BearerToken;
		
		this.username  			= username;
		this.password  			= password;
		this.apiKey				= apiKey;
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
}






async onMessage(obj) {
   
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
            headers: {
                'x-authorization': `Bearer ${this.BearerToken}`
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
