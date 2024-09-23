'use strict';

const Axios = require('axios');


class VRM {
    constructor(pAdapter, pOptions) {
        this.adapter = pAdapter;
        this.url = pOptions?.url || 'https://www.victronenergy.com';

        this.cookies = null;
        this.log = pOptions?.log || false;

        this.axios = Axios.create({
            withCredentials: true,
            timeout: (pOptions?.timeout || 30) * 1000,
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
               
                this.setState('info.connection', true, true);
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

}

module.exports = VRM;