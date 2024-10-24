const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs'); // Verwende exceljs für das Lesen von XLSX-Dateien
const sqlite3 = require('sqlite3').verbose();

class ModbusDataManager {
    constructor(adapter) {
        this.adapter = adapter;
        this.xlsxUrl = 'https://raw.githubusercontent.com/victronenergy/dbus_modbustcp/master/CCGX-Modbus-TCP-register-list.xlsx';
        this.dbDir = './db';
        this.previewDbPath = path.join(this.dbDir, 'victronDBVpreview.db');
        this.finalDbPath = path.join(this.dbDir, 'victronDBV02.db');
        this.localXlsxPath = path.join(this.dbDir, 'CCGX-Modbus-TCP-register-list.xlsx');
    }

    async checkAndUpdateXlsxFile() {
        try {
            // Erstelle das Verzeichnis ./db, falls es nicht existiert
            if (!fs.existsSync(this.dbDir)) {
                fs.mkdirSync(this.dbDir, { recursive: true });
            }

            // Lade die aktuelle Version der Datei von GitHub herunter
            const response = await axios.get(this.xlsxUrl, { responseType: 'arraybuffer' });
            const remoteFileBuffer = Buffer.from(response.data);
            const remoteFileHash = crypto.createHash('md5').update(remoteFileBuffer).digest('hex');

            let localFileHash = null;

            // Prüfe, ob die lokale Datei existiert
            if (fs.existsSync(this.localXlsxPath)) {
                const localFileBuffer = fs.readFileSync(this.localXlsxPath);
                localFileHash = crypto.createHash('md5').update(localFileBuffer).digest('hex');
            }

            // Vergleiche die Hashes
            if (localFileHash !== remoteFileHash) {
                this.adapter.log.info('Neue Version der XLSX-Datei gefunden. Aktualisiere lokale Datei.');
                // Speichere die neue Datei
                fs.writeFileSync(this.localXlsxPath, remoteFileBuffer);
                // Konvertiere die XLSX-Datei in die SQLite-Datenbank
                await this.convertXlsxToSqlite();
            } else {
                this.adapter.log.info('Die lokale XLSX-Datei ist auf dem neuesten Stand.');
            }
        } catch (error) {
            this.adapter.log.error(`Fehler beim Herunterladen oder Verarbeiten der XLSX-Datei: ${error.message}`);
        }
    }

    async convertXlsxToSqlite() {
        try {
            this.adapter.log.info('Konvertiere XLSX-Datei in SQLite-Datenbank mit ExcelJS...');

            // Lösche die alte Vorschau-Datenbank, falls vorhanden
            if (fs.existsSync(this.previewDbPath)) {
                fs.unlinkSync(this.previewDbPath);
            }

            // Erstelle eine neue SQLite-Datenbank
            const db = new sqlite3.Database(this.previewDbPath);

            // Lese die XLSX-Datei mit exceljs
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(this.localXlsxPath);
            const worksheet = workbook.getWorksheet('Field list'); // Wähle das Worksheet "Field list"
            
            if (!worksheet) {
                throw new Error('Worksheet "Field list" nicht gefunden.');
            }

            this.adapter.log.info(`Verarbeite ${worksheet.rowCount} Zeilen aus dem Worksheet...`);

            // Erstelle die Tabelle dbusdata in der SQLite-Datenbank
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS dbusdata (
                        "dbus_service_name" TEXT,
                        "description" TEXT,
                        "Address" INTEGER,
                        "Type" TEXT,
                        "Scalefactor" INTEGER,
                        "Range" TEXT,
                        "dbus_obj_path" TEXT,
                        "writable" TEXT,
                        "dbus_unit" TEXT,
                        "Remarks" TEXT
                    )
                `);

                const insertStmt = db.prepare(`
                    INSERT INTO dbusdata (dbus_service_name, description, Address, Type, Scalefactor, Range, dbus_obj_path, writable, dbus_unit, Remarks)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                // Überspringe die ersten zwei Zeilen (1. Zeile: Überschrift, 2. Zeile: Spaltenüberschriften)
                worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                    if (rowNumber > 2) {
                        const rowData = row.values.slice(1); // ExcelJS verwendet 1-basierte Indizes, erste Spalte ignorieren
                        const isEmptyRow = rowData.every(cell => !cell); // Überprüfe, ob alle Zellen leer sind
                        if (isEmptyRow) {
                            this.adapter.log.info('Leere Zeile gefunden, Beende das Einfügen.');
                            return;
                        }

                        // Füge die nicht-leeren Datensätze in die SQLite-Datenbank ein
                        insertStmt.run(
                            rowData[0], // dbus-service-name
                            rowData[1], // description
                            rowData[2], // Address
                            rowData[3], // Type
                            rowData[4], // Scalefactor
                            rowData[5], // Range
                            rowData[6], // dbus-obj-path
                            rowData[7], // writable
                            rowData[8], // dbus-unit
                            rowData[9]  // Remarks
                        );
                    }
                });

                insertStmt.finalize();
            });

            db.close((err) => {
                if (err) {
                    this.adapter.log.error(`Fehler beim Schließen der Datenbank: ${err.message}`);
                } else {
                    this.adapter.log.info('Datenbank erfolgreich erstellt.');
                    this.adapter.log.info('Die Vorschau-Datenbank wurde unter ./db/victronDBVpreview.db gespeichert.');
                    // Test erfolgreich, benenne die Vorschau-Datenbank um
                    this.renamePreviewToFinal();
                }
            });
        } catch (error) {
            this.adapter.log.error(`Fehler bei der Konvertierung der XLSX-Datei: ${error.message}`);
        }
    }

    renamePreviewToFinal() {
        try {
            // Überprüfen, ob die Vorschau-Datenbank existiert
            if (fs.existsSync(this.previewDbPath)) {
                // Löschen der alten finalen DB, falls vorhanden
                if (fs.existsSync(this.finalDbPath)) {
                    fs.unlinkSync(this.finalDbPath);
                }
                // Umbenennen der Vorschau-Datenbank in die finale DB
                fs.renameSync(this.previewDbPath, this.finalDbPath);
                this.adapter.log.info('Vorschau-Datenbank erfolgreich in die finale Datenbank umbenannt: victronDBV02.db');
            }
        } catch (error) {
            this.adapter.log.error(`Fehler beim Umbenennen der Vorschau-Datenbank: ${error.message}`);
        }
    }

    // Beispielmethode zum Abfragen der Datenbank
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.finalDbPath);
            db.all(sql, params, (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

module.exports = ModbusDataManager;
