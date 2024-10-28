'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;
const ModbusRTU = require('modbus-serial');
const VRM = require('./lib/libvrm.js');
const TOOLS = require('./lib/vrmutils.js');
const SQLiteDB = require('./lib/libdb.js'); // Import SQLiteDB class
const ModbusClient = require('./lib/libmodbus');
const WebhookClient = require('./lib/libWebhook');
const ModbusDataManager = require('./lib/libModbusDataManager.js');

// Hauptadapter-Klasse
class VictronVrmAdapter extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: 'victronvrm',
        });

        // Initialize the SQLite database
        this.sqliteDB = new SQLiteDB(this, { dbPath: './db/victronDBV02.db' });

        // Bind functions
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this)); 

        // Other initializations
        this.modbusPollingInterval = null; // Will hold the polling interval ID

        // Objects
        this.vrm = new VRM(this); // Create VRM instance
        this.tools = new TOOLS(this); // Create VRM-utils
        this.modbusClient = new ModbusClient(this);
        this.webhookClient = new WebhookClient(this); // New instance of WebhookClient

        this.modbusDataManager = new ModbusDataManager(this); // For xlsx Register update to sqlite3 db

        // Initialize enabledDatapoints
        this.enabledDatapoints = new Set();

        // Initialize heartbeat interval
        this.heartbeatInterval = null;
    }

    async onReady() {
        // Log adapter start
        this.log.info('Victron VRM Adapter gestartet.');

        // Prüfe und aktualisiere die XLSX-Datei und die SQLite-Datenbank
        await this.modbusDataManager.checkAndUpdateXlsxFile();

        // Immediately set the connection state to true
        await this.setState('info.connection', { val: true, ack: true });
        this.log.info('Victron VRM Adapter started and connection state set to true.');

        // Start the heartbeat
        this.startHeartbeat();

        // Set Alive (if this method is essential)
        await this.tools.setAlive();

        // Read configuration settings
        let VrmApiToken = this.config.VrmApiToken;
        const username = this.config.username;
        const password = this.config.password;
        const interval = this.config.interval || 240;
        const interval2 = this.config.interval2 || 10;
        const interval3 = this.config.interval3 || 30;

        let idUser = this.config.idUser;
        let BearerToken = this.config.BearerToken;

        this.username = username;
        this.password = password;
        this.VrmApiToken = VrmApiToken;
        this.idUser = idUser;
        this.BearerToken = BearerToken;

        // Validate configuration
        if (!username && !password && !VrmApiToken) {
            this.log.error('Benutzername und Passwort oder VrmApiToken sind erforderlich.');
            return;
        }

        if (!idUser || idUser === 0) {
            // Fetch idUser from VRM API
            idUser = await this.vrm.getUserId();
            this.updateConfig({ idUser: idUser });
            this.log.warn('idUser geholt: ' + idUser);
        }

        // Fetch installations based on BearerToken and idUser
        this.installations = await this.vrm.getInstallationId(BearerToken, idUser);

        // Start the API polling process
        await this.vrm.startPolling(BearerToken, this.installations, interval * 1000);


        // Introduce a 80-second delay before calling getObjectView
        setTimeout(() => {
            this.getObjectView('system', 'custom', {}, (err, doc) => {
                if (!err && doc && doc.rows) {
                    doc.rows.forEach(row => {
                        const obj = row.value;

                        // Check if the object contains custom settings for this adapter
                        if (obj && obj[this.namespace]) {
                            const customSettings = obj[this.namespace];
                            const isEnabled = !!customSettings.enabled;

                            if (isEnabled) {
                                this.enabledDatapoints.add(row.id);

                                // Check if Modbus is enabled via the new checkbox (enableModbus)
                                const isModbusEnabled = !!customSettings.enableModbus;
                                const modbusInterval = (customSettings.modbusInterval || 60) * 1000;

                                if (isModbusEnabled) {
                                    // Start the Modbus polling only if the Modbus checkbox is enabled
                                    this.modbusClient.startPollingForDatapoint(row.id, customSettings, modbusInterval);
                                    this.log.debug(`${row.id} Modbus-Abfrage aktiviert`);
                                }

                                // Start Webhook polling if needed
                                let webhookInterval = customSettings.webhookInterval > 0 ? customSettings.webhookInterval : this.config.interval3 || 30;
								webhookInterval = webhookInterval * 1000;
                                this.webhookClient.startPollingWebhook(row.id, customSettings, webhookInterval);

                                this.log.debug(`${row.id} aktiviert in den Einstellungen`);
                            }
                        }
                    });
                } else {
                    this.log.error(`Fehler beim Abrufen der Objekte: ${err}`);
                }
            });
        }, 80000); // 120,000 ms = 120 seconds

        // Subscribe to all objects
        this.subscribeObjects('*');
    }

    startHeartbeat() {
        // Send heartbeat every minute
        this.heartbeatInterval = setInterval(() => {
            this.setStateAsync('info.connection', { val: true, ack: true })
                .then(() => this.log.debug('Heartbeat sent: Connection state set to true.'))
                .catch(err => this.log.error(`Heartbeat error: ${err.message}`));
        }, 60000); // 60,000 ms = 1 minute
    }

    async onUnload(callback) {
        try {
            this.log.info('Adapter wird beendet...');

            // Clear heartbeat interval
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }

            // Set connection state to false
            await this.setStateAsync('info.connection', { val: false, ack: true });

            // Stop Modbus polling
            if (this.modbusClient) {
                await this.modbusClient.stopAllPolling();
                this.log.info('Alle Modbus-Polling-Intervalle wurden gestoppt.');
            }

            // Stop Webhook polling
            if (this.webhookClient) {
                await this.webhookClient.stopAllWebhookPolling();
                this.log.info('Alle Webhook-Polling-Intervalle wurden gestoppt.');
            }

            // Stop VRM polling
            if (this.vrm) {
                await this.vrm.stopAllPolling();
                this.log.info('Alle VRM-Polling-Intervalle wurden gestoppt.');
            }

            // Close database connection
            if (this.sqliteDB) {
                await this.sqliteDB.close();
                this.log.info('Datenbankverbindung wurde geschlossen.');
            }

            this.log.info('Adapter wurde erfolgreich entladen.');
            callback();
        } catch (e) {
            this.log.error(`Fehler beim Entladen des Adapters: ${e.message}`);
            callback();
        }
    }

    onObjectChange(id, obj) {
        if (obj) {
            if (id.startsWith(`${this.namespace}.`)) {
                this.log.info(`Objekt ${id} wurde geändert oder hinzugefügt`);

                if (obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                    const customSettings = obj.common.custom[this.namespace];
                    const isEnabled = !!customSettings.enabled;

                    this.log.debug(`isEnabled für ${id}: ${isEnabled}`);
                    this.log.debug(`enabledDatapoints.has(${id}): ${this.enabledDatapoints.has(id)}`);

                    if (customSettings.useWebhook === false) {
                        this.webhookClient.stopWebhookPolling(id);
                    }

                    if (customSettings.useWebhook === true) {
                        const webhookInterval = (customSettings.webhookInterval || 300) * 1000;
                        this.webhookClient.startPollingWebhook(id, customSettings, webhookInterval);
                    }

                    if (isEnabled) {
                        const isModbusEnabled = !!customSettings.enableModbus;
                        const modbusInterval = (customSettings.modbusInterval || 60) * 1000;

                        if (!this.enabledDatapoints.has(id)) {
                            this.enabledDatapoints.add(id);

                            if (isModbusEnabled) {
                                this.modbusClient.startPollingForDatapoint(id, customSettings, modbusInterval);
                                this.log.info(`Modbus-Polling für ${id} gestartet.`);
                            }

                            
                            
                        }
                    } else {
                        this.enabledDatapoints.delete(id);
                        this.modbusClient.stopPolling(id);
                        this.webhookClient.stopWebhookPolling(id);
                        this.log.info(`Polling für ${id} gestoppt.`);
                    }
                } else {
                    // Falls benutzerdefinierte Einstellungen entfernt wurden, stoppe das Polling
                    this.log.info(`Keine benutzerdefinierten Einstellungen für ${id} vorhanden. Stoppe Polling.`);
                    this.enabledDatapoints.delete(id);
                    this.modbusClient.stopPolling(id);
                    this.webhookClient.stopWebhookPolling(id);
                }
            }
        } else {
            this.log.info(`Objekt ${id} wurde gelöscht`);

            // Überprüfen, ob das Objekt zu diesem Adapter gehört
            if (id.startsWith(`${this.namespace}.`)) {
                // Stoppe das Polling für diesen Datenpunkt
                this.enabledDatapoints.delete(id);
                this.modbusClient.stopPolling(id);
                this.webhookClient.stopWebhookPolling(id);
                this.log.info(`Polling für ${id} gestoppt (Objekt gelöscht).`);
            }
        }
    }

    async onMessage(obj) {
        // Handle incoming messages if necessary
    }

    updateConfig(newConfig) {
        // Update adapter configuration
        this.extendForeignObject('system.adapter.' + this.namespace, {
            native: {
                ...this.config,
                ...newConfig
            }
        });
    }
}

if (module.parent) {
    module.exports = (options) => new VictronVrmAdapter(options);
} else {
    new VictronVrmAdapter();
}
