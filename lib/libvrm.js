'use strict';

const Axios = require('axios').default;


class VRM {
    constructor(pAdapter, pOptions = {}) {
        this.adapter = pAdapter;
       
		// Sicherstellen, dass log existiert, entweder vom Adapter oder manuell übergeben
        this.log = pAdapter.log || pOptions.log || console;
		this.url = pOptions.url || 'https://www.victronenergy.com';
		
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



async getInstallationId(BearerToken, idUser) {
        try {
            const response = await this.axios.get(`https://vrmapi.victronenergy.com/v2/users/${idUser}/installations`, {
                headers: {
                    'x-authorization': `Bearer ${BearerToken}`,
                    'Content-Type': 'application/json'
                }
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



}

module.exports = VRM;