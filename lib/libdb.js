// libdb.js

'use strict';

const sqlite3 = require('sqlite3').verbose();

class SQLiteDB {
    constructor(adapter, options = {}) {
        this.adapter = adapter;
        this.dbPath = options.dbPath || './db/sqlite.db'; // Pfad zur Datenbank
        this.log = adapter.log || options.log || console;

        // Öffne die SQLite-Datenbank
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                this.log.error(`Fehler beim Öffnen der Datenbank unter ${this.dbPath}: ${err.message}`);
            } else {
                this.log.info(`Verbunden mit der SQLite-Datenbank unter ${this.dbPath}`);
            }
        });
    }

    // Methode zum Schließen der Datenbankverbindung
    close() {
        this.db.close((err) => {
            if (err) {
                this.log.error(`Fehler beim Schließen der Datenbank: ${err.message}`);
            } else {
                this.log.info('Datenbankverbindung geschlossen.');
            }
        });
    }

    // Methode zum Ausführen von Abfragen (SQL-Statements)
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    this.log.error(`Fehler beim Ausführen der SQL-Abfrage: ${err.message}`);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Weitere Methoden für spezifische Datenbankoperationen können hier hinzugefügt werden
}

module.exports = SQLiteDB;
