"use strict";
var DbUtil = require("./DbUtil");
var IndexedDbSpi = /** @class */ (function () {
    function IndexedDbSpi(db, util) {
        this.db = db;
        this.util = util;
    }
    IndexedDbSpi.prototype.getDatabase = function () {
        return this.db;
    };
    IndexedDbSpi.prototype.getTables = function () {
        var names = [];
        Array.prototype.push.apply(names, this.db.objectStoreNames);
        var dfd = this.util.defer();
        dfd.resolve(names);
        return dfd.promise;
    };
    IndexedDbSpi.prototype.insertMultiple = function (collectionInserts) {
        var res = {
            inserts: [],
            insertErrors: []
        };
        return IndexedDbSpi.inserts(this.db, this.util, collectionInserts, res);
    };
    /** All-in-one function to remove IndexedDB stores, add new stores, and insert records into stores.
     * This function handles bumping the DB version to trigger an 'onupgrade' callback to add and remove stores.
     * @param tableDels optional list of stores to remove from the DB, these run first
     * @param tableAdds optional list of stores to add to the DB, these run second
     * @param tableInserts optional list of data insertions to run against the DB, these run third (after table deletes/creates)
     */
    IndexedDbSpi.prototype.modifyDatabase = function (tableDels, tableAdds, tableInserts) {
        var inst = this;
        var name = this.db.name;
        var version = this.db.version;
        this.db.close();
        var res = {
            createdStores: [],
            createErrors: [],
            deletedStores: [],
            deleteErrors: [],
            inserts: [],
            insertErrors: []
        };
        var hasSchemaChanges = (tableAdds != null && tableAdds.length > 0) || (tableDels != null && tableDels.length > 0);
        // upgrade the DB version to trigger an 'onupgradeneeded' call so we can create and/or delete object stores
        return IndexedDbSpi.openDatabase(this.util, name, hasSchemaChanges ? version + 1 : version, function versionUpgrade(evt) {
            // Database modifications must be performed within 'onupgrade' callback
            var db = this.result;
            inst.db = db;
            // delete stores (first so that create stores can re-create stores)
            (tableDels || []).forEach(function (tbl) {
                try {
                    db.deleteObjectStore(tbl.name);
                    res.deletedStores.push(tbl);
                }
                catch (err) {
                    res.deleteErrors.push({ name: tbl.name, error: err });
                }
            });
            // create stores
            (tableAdds || []).forEach(function (tbl) {
                try {
                    var createRes = db.createObjectStore(tbl.name, tbl);
                    res.createdStores.push(createRes);
                }
                catch (err) {
                    res.createErrors.push({ name: tbl.name, error: err });
                }
            });
        }).then(function () { return IndexedDbSpi.inserts(inst.db, inst.util, tableInserts, res); });
    };
    IndexedDbSpi.prototype.destroyDatabase = function () {
        var dfd = this.util.defer();
        var dbDelReq = self.indexedDB.deleteDatabase(this.db.name);
        wrapRequest(dbDelReq, function destroyDbSuccess(evt) {
            dfd.resolve(null);
        }, function destroyDbError(evt) {
            dfd.reject(dbDelReq.error);
        });
        return dfd.promise;
    };
    IndexedDbSpi.addOrPut = function (dbColl, tbl) {
        if (tbl.records == null) {
            return;
        }
        // TODO for now just calling put()/add() in a loop and not waiting on the resulting request to complete before inserting the next
        if (tbl.overwrite) {
            if (tbl.keyGetter != null) {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.put(tbl.records[i], tbl.keyGetter(tbl.records[i]));
                }
            }
            else {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.put(tbl.records[i]);
                }
            }
        }
        else {
            if (tbl.keyGetter != null) {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.add(tbl.records[i], tbl.keyGetter(tbl.records[i]));
                }
            }
            else {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.add(tbl.records[i]);
                }
            }
        }
    };
    IndexedDbSpi.inserts = function (db, util, tableInserts, res) {
        if (tableInserts == null) {
            return res;
        }
        var pInserts = util.defer();
        var insertCount = tableInserts.length;
        var insertsDone = 0;
        // insert records into stores
        tableInserts.forEach(function (tbl) {
            var insertErrors = [];
            var xact = db.transaction(tbl.name, "readwrite");
            var dbColl = xact.objectStore(tbl.name);
            var clearedCount = 0;
            if (tbl.clear) {
                // get record count and clear the store
                var countReq = dbColl.count();
                countReq.onsuccess = function onIdbSuccess(evt) {
                    var clearReq = dbColl.clear();
                    clearReq.onsuccess = function onIdbSuccess(evt) {
                        clearedCount = countReq.result;
                        // add new records
                        IndexedDbSpi.addOrPut(dbColl, tbl);
                    };
                    clearReq.onerror = function onIdbSuccess(evt) {
                        insertErrors.push(clearReq.error);
                        xact.abort();
                    };
                };
                countReq.onerror = function onIdbSuccess(evt) {
                    insertErrors.push(countReq.error);
                    xact.abort();
                };
            }
            else {
                // add new records
                IndexedDbSpi.addOrPut(dbColl, tbl);
            }
            xact.oncomplete = function onIdbSuccess(evt) {
                res.inserts.push({ name: tbl.name, added: tbl.records != null ? tbl.records.length : 0, removed: clearedCount });
                insertsDone++;
                if (insertsDone >= insertCount) {
                    pInserts.resolve(res);
                }
            };
            function onIdbError(evt) {
                insertErrors.push(xact.error);
                res.insertErrors.push({ name: tbl.name, errors: insertErrors });
                insertsDone++;
                pInserts.reject(xact.error);
            }
            xact.onerror = onIdbError;
            xact.onabort = onIdbError;
        });
        return pInserts.promise;
    };
    IndexedDbSpi.openDatabase = function (util, name, version, onupgradeneeded) {
        util.log(util.DEBUG, "openDatabase", name, version);
        var dfd = util.defer();
        var pUpgrade;
        try {
            if (typeof self === "undefined" || !self.indexedDB) {
                util.rejectError(dfd, "IndexedDB not implemented");
            }
            else {
                var dbOpenReq = (version != null ? self.indexedDB.open(name, version) : self.indexedDB.open(name));
                wrapRequest(dbOpenReq, function openDbSuccess(evt) {
                    if (pUpgrade != null) {
                        pUpgrade.then(function (r) { return dfd.resolve(dbOpenReq.result); }, function (err) { return util.rejectError(dfd, "onupgradeneeded handler failed", { exception: err }); });
                    }
                    else {
                        dfd.resolve(dbOpenReq.result);
                    }
                }, function openDbError(evt) {
                    util.rejectError(dfd, "Failed to open database", { exception: dbOpenReq.error });
                }, function dbUpgradeNeeded(evt) {
                    // triggered when opening a new DB or an existing DB with a higher version number than last time it was opened
                    util.log(util.DEBUG, "upgradeNeeded", name, version);
                    if (onupgradeneeded != null) {
                        var onUpgradeRes = onupgradeneeded.call(this, evt);
                        if (util.isPromise(onUpgradeRes)) {
                            pUpgrade = onUpgradeRes;
                        }
                    }
                });
            }
        }
        catch (ex) {
            util.rejectError(dfd, "Failed to open database " + name, { exception: ex });
        }
        return dfd.promise;
    };
    IndexedDbSpi.newIndexedDb = function (name, version, utilSettings) {
        var util = new DbUtil("IndexedDB", "[object IDBDatabase]", utilSettings);
        // Create IndexedDB wrapper from native Database or by opening 'name' DB
        var pOpen;
        if (util.isDatabase(name)) {
            var dfd = util.defer();
            dfd.resolve(name);
            pOpen = dfd.promise;
        }
        else {
            pOpen = IndexedDbSpi.openDatabase(util, name, version);
        }
        return pOpen.then(function (dbInst) { return new IndexedDbSpi(dbInst, util); });
    };
    return IndexedDbSpi;
}());
function isOpenDbRequest(dbReq) {
    return "onupgradeneeded" in dbReq;
}
function wrapRequest(dbReq, onsuccess, onerror, onupgradeneeded) {
    dbReq.onsuccess = onsuccess;
    dbReq.onerror = onerror;
    if (isOpenDbRequest(dbReq)) {
        if (onupgradeneeded == null) {
            throw new Error("must provide an onupgradeneeded handler for open DB requests");
        }
        dbReq.onupgradeneeded = onupgradeneeded;
        dbReq.onblocked = onerror;
    }
    return dbReq;
}
module.exports = IndexedDbSpi;
