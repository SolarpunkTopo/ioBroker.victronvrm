'use strict';

const axios = require('axios');

class WebhookClient {
    constructor(adapter) {
        this.adapter = adapter;
        this.webhookIntervals = {};
    }

    startPollingWebhook(id, customSettings, interval) {
        // Überprüfen, ob der Webhook für diesen Datenpunkt aktiviert ist
        if (!customSettings.useWebhook) {
            this.adapter.log.debug(`Webhook ist für Datenpunkt ${id} nicht aktiviert.`);
            return;
        }

        
        const webhookUrl = this.adapter.config.webhookUrl;
        const getVariableName = customSettings.getVariableName || 'value';

        if (!webhookUrl) {
            this.adapter.log.error('Webhook-URL ist nicht in den Adapter-Einstellungen konfiguriert.');
            return;
        }

        // Falls bereits ein Intervall für diesen Datenpunkt läuft, stoppen wir es zuerst
        if (this.webhookIntervals[id]) {
            clearInterval(this.webhookIntervals[id]);
        }

        // Erstelle das Intervall für das Webhook-Polling
        this.webhookIntervals[id] = setInterval(async () => {
            try {
                const state = await this.adapter.getStateAsync(id);
                if (state && state.val != null) {
                    const url = `${webhookUrl}?${getVariableName}=${encodeURIComponent(state.val)}`;
                    this.adapter.log.debug(`Führe HTTP GET-Request aus: ${url}`);

                    const response = await axios.get(url);
                    this.adapter.log.debug(`Webhook-Request erfolgreich für ${id}: ${response.status}`);
                } else {
                    this.adapter.log.warn(`Kein gültiger Wert für Datenpunkt ${id}`);
                }
            } catch (error) {
                this.adapter.log.error(`Fehler beim Webhook-Request für ${id}: ${error.message}`);
            }
        }, interval);
    }


    stopWebhookPolling(id) {
        if (this.webhookIntervals[id]) {
            clearInterval(this.webhookIntervals[id]);
            delete this.webhookIntervals[id];
            this.adapter.log.info(`Webhook-Polling für Datenpunkt ${id} gestoppt.`);
        } else {
            this.adapter.log.warn(`Kein Webhook-Polling für Datenpunkt ${id} gefunden.`);
        }
    }

    // Methode zum Stoppen aller Webhook-Intervalle
    stopAllWebhookPolling() {
        for (const id in this.webhookIntervals) {
            clearInterval(this.webhookIntervals[id]);
            this.adapter.log.info(`Webhook-Polling für Datenpunkt ${id} gestoppt.`);
        }
        this.webhookIntervals = {};
    }
}

module.exports = WebhookClient;
