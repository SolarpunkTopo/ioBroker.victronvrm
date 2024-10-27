'use strict';


class TOOLS {
    constructor(pAdapter, pOptions = {}) {
        this.adapter = pAdapter;
       
		// Sicherstellen, dass log existiert, entweder vom Adapter oder manuell übergeben
        this.log = pAdapter.log || pOptions.log || console;
     
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




async determineDataType(value) {
    // Prüfen, ob der Wert eine Ganzzahl oder Gleitkommazahl ist
    if (!isNaN(value) && value !== null && value !== '') {
        // Prüfen, ob der Wert eine Gleitkommazahl ist (enthält einen Dezimalpunkt)
        if (typeof value === 'string' && value.includes('.')) {
            return 'number';
        }
        // Andernfalls handelt es sich um eine Ganzzahl
        return 'number';
    } else {
        // Wenn der Wert kein gültiges Zahlformat ist, handelt es sich um einen String
        return 'string';
    }
}




// Rekursive Methode zur Verarbeitung von Objekten
async createDataPoints(record, basePath) {
    let countDataPoint=0;
	let dataType;
	
	for (let key in record) {
        if (key !== 'dbusServiceType' && key !== 'description') {
            const dataPointName = `${basePath}.${key}`;
            const value = record[key];

            if (typeof value === 'object' && value !== null) {
                // Falls der Wert ein Objekt ist, rufe die Funktion rekursiv auf
             await this.createDataPoints(value, dataPointName);
            } else {
                
			
			
		
            	dataType = typeof value;
				
				
				// Ansonsten den Datenpunkt erstellen
             await this.adapter.setObjectNotExistsAsync(dataPointName, {
                    type: 'state',
                    common: {
                        name: key,
                        type: dataType,
                        role: 'value',
                        read: true,
                        write: false
                    },
                    native: {}
                });

		
		
		
		let valueToSet = value;
		
		
		// Überprüfe den erwarteten Datentyp des Datenpunkts
		const obj = this.adapter.getObjectAsync(dataPointName);
		if (obj && obj.common && obj.common.type) {
			const expectedType = obj.common.type;
        

        if (expectedType === 'string') {
            // Konvertiere den numerischen Wert in einen String
            valueToSet = value.toString();
        } else if (expectedType === 'number') {
            valueToSet = Number(value);
        } else {
            this.adapter.log.error(`Unbekannter erwarteter Typ '${expectedType}' für Datenpunkt ${datapoint}`);
            return;
        }
		
	}
		
		
		
		
		
		
		
          this.adapter.setState(dataPointName, { val: valueToSet, ack: true });
        
		
		
			
			
			
		if(countDataPoint>200){	
			this.adapter.setState('info.alive', { val: true, ack: true }); // true = Adapter ist am Leben
			countDataPoint=0;
		}	
		countDataPoint++;
			
			
			
			}
        }
    }
}
 
  
async setAlive(){
			
	this.adapter.setObjectNotExistsAsync('info.alive', {
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
			this.adapter.setState('info.alive', { val: true, ack: true }); // true = Adapter ist am Leben
		}, 20000); //  Lebenszeichen setzen
	});

	
	
} 
 
 
 
 
 
 
}

module.exports = TOOLS;