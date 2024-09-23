
async function updateInstallationOptions(apiToken, idUser) {
    try {
        const installations = await getInstallationId(apiToken, idUser);

        const options = installations.map(installation => {
            return {
                value: installation.id,
                text: installation.name
            };
        });

        // Sende die Optionen ins Admin-Panel
        sendTo('victronvrm.0', 'updateSelectField', { field: 'installationId', options });
    } catch (error) {
        this.log.error('Fehler beim Aktualisieren der Installationsoptionen: ' + error.message);
    }
}

socket.on('message', function (msg) {
    if (msg.command === 'updateSelectField') {
        const selectField = document.getElementById('select_installation_id');
        selectField.innerHTML = '';  // Leere die alten Optionen

        msg.options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.innerHTML = option.text;
            selectField.appendChild(opt);
        });
    }
});
