'use strict';

const Axios = require('axios').default;


class VRM {
    constructor(pAdapter, pOptions = {}) {
        this.adapter = pAdapter;
       
		// Sicherstellen, dass log existiert, entweder vom Adapter oder manuell übergeben
        this.log = pAdapter.log || pOptions.log || console;
		this.url = pOptions.url || 'https://vrmapi.victronenergy.com';
		
        this.axios = Axios.create({
            withCredentials: true,
            timeout:  (30 * 1000),
        });
    }
	
	




getApiToken(username, password) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await this.axios.post('https://vrmapi.victronenergy.com/v2/auth/login', {
                username: username,
                password: password
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.status === 200 && response.data.token && response.data.idUser) {
                const BearerToken = response.data.token;  // Der Bearer-Token
                const idUser = response.data.idUser; // idUser für URLs
                
                // Speichern des Tokens in den Einstellungen
               
                this.log.info('BearerToken erfolgreich geholt');
                
                // Erfolgreich den API-Token und idUser zurückgeben
                resolve({ BearerToken, idUser });
            } else {
                this.log.error('Fehler beim Abrufen des BearerToken: ' + response.status);
                reject(new Error('Invalid response'));
            }
        } catch (error) {
            this.log.error('Fehler beim API-Token-Abruf: ' + error.message);
            reject(error);
        }
    });
 }




/**
     * Holt die idUser aus der VRM API unter Verwendung des API-Tokens
     * @returns {Promise<string>} - Die idUser
     */
    async getUserId() {
        try {
           

            // Endpunkt für Benutzerinformationen. Dies kann je nach API-Dokumentation variieren.
            const url = `https://vrmapi.victronenergy.com/v2/users/me`;

            

            this.adapter.log.debug(`Sende Anfrage an VRM API: ${url}`);

            const response = await this.axios.get(url, {  headers: this.getAuthorizationHeader(), });

            if (response.status === 200 && response.data) {
                const data = response.data;

                // Überprüfe, ob die idUser im Antwortobjekt vorhanden ist
                if (data.user.id) {
                    this.idUser = data.user.id;
                    this.adapter.log.info(`idUser erfolgreich abgerufen: ${this.idUser}`);
                    await this.adapter.updateConfig({idUser: this.idUser });
					return this.idUser;
                } else {
                    this.adapter.log.error('id nicht in der Antwort enthalten.');
                    throw new Error('idUser nicht gefunden.');
                }
            } else {
                this.adapter.log.error(`Unerwartete Antwort von der VRM API: Status ${response.status}`);
                throw new Error(`Unerwarteter Statuscode: ${response.status}`);
            }
        } catch (error) {
            this.adapter.log.error(`Fehler beim Abrufen der idUser: ${error.message}`);
            throw error;
        }
    }

    




async getInstallationId(BearerToken, idUser) {
        try {
            const response = await this.axios.get(`https://vrmapi.victronenergy.com/v2/users/${idUser}/installations`, {
                headers: this.getAuthorizationHeader(),
            });

            const data = response.data;
            if (data.records && data.records.length > 0) {
                const installations = data.records.map(record => ({
                    id: record.idSite,
                    name: record.name
                }));

                this.log.info(`Installationen erfolgreich abgerufen: ${installations.map(i => `${i.id}: ${i.name}`).join(', ')}`);
                return installations;
            } else {
                this.log.error('Keine Installationen gefunden');
                throw new Error('No installations found');
            }
        } catch (error) {
            this.log.error(`Fehler beim Abrufen der Installation-ID: ${error.message}`);
			this.log.error(`Fehler beim Abrufen der Installation-ID: ${error.message}`);
            throw error;
        }
    }


async getLongTermApiToken(BearerToken, idUser) {
    var options = {
  method: 'POST',
  url: 'https://vrmapi.victronenergy.com/v2/users/idUser/accesstokens/create',
  headers: {
    'Content-Type': 'application/json',
    'x-authorization': `Bearer ${BearerToken}`
  },
	data: {name: 'iobrokerapitoken'}
};

	await axios.request(options).then(function (response) {
		  this.log.warn(response.data.token);
				revoke(response.data.token);
		}).catch(function (error) {
		  this.log.warn(error);
		});



}


getAuthorizationHeader() {
    const headers = {};

    if (this.adapter.config.VrmApiToken) {
        headers['x-authorization'] = `Token ${this.adapter.config.VrmApiToken}`;
    this.adapter.log.debug('ApiToken wird verwendet');
	} else if (this.BearerToken) {
        headers['x-authorization'] = `Bearer ${this.adatper.config.BearerToken}`;
		this.adapter.log.debug('BearerToken wird verwendet');
	} else {
        this.adapter.log.error('Weder VrmApiToken noch BearerToken sind verfügbar. Authentifizierung fehlgeschlagen.');
        // Optional: Fehler werfen oder Standard-Header zurückgeben
    }

    return headers;
}

/**
     * Startet das Polling für die angegebenen Installationen.
     * @param {string} BearerToken - Der Bearer-Token zur Authentifizierung.
     * @param {Array} installationIds - Die IDs und Namen der Installationen.
     * @param {number} interval - Das Polling-Intervall in Millisekunden.
     */
    startPolling(BearerToken, installationIds, interval) {
        const pollData = async (installationId, installationName) => {
            const url = `https://vrmapi.victronenergy.com/v2/installations/${installationId}/diagnostics?count=1000`;

            try {
                const response = await this.axios.get(url, {
                    headers: this.getAuthorizationHeader(),
                });

                if (response.status === 200) {
                    this.adapter.log.info(`Request erfolgreich für Installation ID: ${installationId}`);
                    const data = response.data;
                    if (data.records && Array.isArray(data.records)) {
                        this.adapter.tools.processVictronRecords(data.records, installationName); // Name mitgeben
                        // Setze den Verbindungsstatus auf true bei erfolgreichem Request
                        this.adapter.setState('info.connection', true, true);
                    } else {
                        this.adapter.log.error('Unerwartetes Datenformat.');
                    }
                } else if (response.status === 401) {
                    // Authentifizierung fehlgeschlagen, Token erneuern
                    await this.adapter.vrm.getApiToken(this.adapter.config.username, this.adapter.config.password);
                    this.adapter.log.info('BearerToken erneuert.');
                } else {
                    this.adapter.log.error(`Fehlerhafte Antwort von der API: ${response.status} ${url} ${installationId}`);
                    this.adapter.log.info('Antwort des API-Requests: ' + JSON.stringify(response.data));
                }
            } catch (error) {
                this.adapter.log.error('Fehler bei der API-Abfrage: ' + error.message);
            }
        };

        // Funktion zur Abfrage für alle Installationen
        const pollAllData = () => {
            if (!Array.isArray(installationIds) || installationIds.length === 0) {
                this.adapter.log.warn('Keine gültigen Installation IDs zum Abfragen.');
                return;
            }

            installationIds.forEach(({ id, name }) => {
                pollData(id, name); // ID und Name übergeben
            });
        };

        // Daten in regelmäßigen Abständen abfragen
        this.adapter.log.info(`Starte API-Abfragen alle ${interval / 1000} Sekunden.`);
        this.pollingInterval = setInterval(() => pollAllData(), interval);

        // Initiale API-Abfrage für alle Installationen starten
        pollAllData();
    }














    /**
     * Stoppt das Polling.
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            this.adapter.log.info('Polling gestoppt.');
        }
    }



stopAllPolling() {
    if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        this.adapter.log.info('VRM-Polling-Intervall wurde gestoppt.');
    }
}

}

module.exports = VRM;