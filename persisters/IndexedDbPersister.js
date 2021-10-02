"use strict";
var Arrays = require("ts-mortar/utils/Arrays");
var DbUtil = require("./DbUtil");
/* IndexedDbPersister class which implements 'DataPersister' for saving data to IndexedDB for long-term browser data storage.
 * Exports 'IndexedDbSpi' interface which has two methods: getTables() and executeQueries(), which is the link between this 'IndexedDbPersister' class and the underlying IndexedDB database.
 * @author TeamworkGuy2
 */
var IndexedDbPersister = /** @class */ (function () {
    /** Create a DataPersister based on an IndexedDB instance and some additional functions to control the behavior of this persister.
     * @param persistenceInterface the underlying database to persist to
     * @param trace the object with functions for logging debug messages and errors
     * @param getDataCollections returns a list of data collections that contain the data to persist/restore to
     * @param addCollection when restoring a database, call this function with each table name found and restored documents
     * @param saveItemTransformation optional conversion function to pass items from 'getDataCollections()' through before persisting them
     * @param restoreItemTransformation optional conversion function to pass items through after restoring them and before storing them in 'getDataCollections()'
     * @param storageFailureCallback callback for handling/logging storage errors
     * @param tablesToNotClear optional array of collection names to not clear when 'clearPersistentDb()' is called
     * @param tablesToNotLoad optional array of collection names to not load when 'restore()' is called
     */
    function IndexedDbPersister(persistenceInterface, trace, getDataCollections, addCollection, saveItemTransformation, restoreItemTransformation, storageFailureCallback, tablesToNotClear, tablesToNotLoad) {
        this.tablesToNotClear = [];
        this.tablesToNotLoad = [];
        this.persistenceInterface = persistenceInterface;
        this.logger = trace;
        this.itemSaveConverter = saveItemTransformation;
        this.itemLoadConverter = restoreItemTransformation;
        this.getDataCollections = getDataCollections;
        this.addCollection = addCollection;
        this.storageFailureCallback = storageFailureCallback;
        this.tablesToNotClear = tablesToNotClear || [];
        this.tablesToNotLoad = tablesToNotLoad || [];
    }
    /** Get a list of collection names in this data persister
     */
    IndexedDbPersister.prototype.getCollectionNames = function () {
        return this.persistenceInterface.getTables();
    };
    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    IndexedDbPersister.prototype.persist = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var colls = that.getDataCollections();
        var persistCount = 0;
        return this.persistenceInterface.getTables().then(function (collNames) {
            var tableAdds = [];
            var tableDels = [];
            var tableInserts = [];
            colls.forEach(function (coll) {
                var opts = DbUtil.getWriteOptionsOrDefault(getCollectionOptions != null ? getCollectionOptions(coll.name) : null, defaultOptions);
                var exists = collNames.indexOf(coll.name) !== -1;
                var keyCol = opts.keyColumn != null ? (typeof opts.keyColumn === "string" ? opts.keyColumn : opts.keyColumn.name) : null;
                var autoIncrement = opts.keyAutoGenerate;
                if (opts.deleteIfExists && exists) {
                    tableDels.push({ name: coll.name });
                    tableAdds.push({ name: coll.name, keyPath: keyCol, autoIncrement: autoIncrement });
                }
                if (!exists) {
                    tableAdds.push({ name: coll.name, keyPath: keyCol, autoIncrement: autoIncrement });
                }
                if (coll.dirty) {
                    persistCount++;
                    if (coll.data.length > 0) {
                        var collData = that.prepDataForSave(coll.data, opts.maxObjectsPerChunk, opts.groupByKey, opts.keyGetter);
                        tableInserts.push({ name: coll.name, clear: exists, records: collData });
                    }
                    else {
                        tableInserts.push({ name: coll.name, clear: exists });
                    }
                }
            });
            return that.persistenceInterface.modifyDatabase(tableDels, tableAdds, tableInserts);
        }).then(function (rs) {
            var persistRes = {
                collections: {}
            };
            rs.inserts.forEach(function (insert) {
                // reset collection 'dirty' flag after data successfully saved
                var coll = colls.find(function (x) { return x.name === insert.name; });
                if (coll != null) {
                    coll.dirty = false;
                }
                persistRes.collections[insert.name] = {
                    size: insert.added,
                    dataSizeBytes: null
                };
            });
            return persistRes;
        });
    };
    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    IndexedDbPersister.prototype.restore = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var restoreRes = {
            collections: {}
        };
        return this.persistenceInterface.getTables().then(function (tables) {
            var tablesToLoad = tables.filter(function (tbl) { return that.tablesToNotLoad.indexOf(tbl) === -1; }).map(function (tbl) { return ({ name: tbl }); });
            return that.getCollectionsRecords(tablesToLoad);
        }).then(function (results) {
            results.forEach(function (result) {
                var rows = result.records;
                var docs = [];
                if (rows.length > 0) {
                    var opts = DbUtil.getReadOptionsOrDefault(getCollectionOptions != null ? getCollectionOptions(result.name) : null, defaultOptions);
                    var expectArrayRes = (opts == null || opts.isChunks);
                    docs = that.readRecords(result.records, expectArrayRes);
                }
                else {
                    //if (that.logger != null) that.logger.log("skip restoring table: " + tableName + " (0 items)");
                }
                restoreRes.collections[result.name] = {
                    size: docs.length,
                    dataSizeBytes: null
                };
                that.addCollection(result.name, docs);
            });
            return restoreRes;
        }, function (err) {
            throw err;
        });
    };
    /** Get all data from a specific collection
     */
    IndexedDbPersister.prototype.getCollectionRecords = function (collectionName, options) {
        return this.getCollectionsRecords([{ name: collectionName, options: options }]).then(function (r) { return r[0].records; });
    };
    IndexedDbPersister.prototype.getCollectionsRecords = function (collections) {
        var collectionNames = Arrays.pluck(collections, "name");
        var xact = this.persistenceInterface.db.transaction(collectionNames, "readonly");
        var recordsXacts = collections.map(function (coll) { return ({ name: coll.name, getAll: xact.objectStore(coll.name).getAll() }); });
        var dfd = this.persistenceInterface.util.defer();
        xact.oncomplete = function onIdbSuccess(evt) {
            var notDoneXacts = recordsXacts.filter(function (x) { return x.getAll.readyState !== "done"; });
            if (notDoneXacts.length > 0) {
                throw new Error(notDoneXacts.length + " transactions are not done in 'oncomplete' callback");
            }
            var results = recordsXacts.map(function (x) { return ({ name: x.name, records: x.getAll.result }); });
            dfd.resolve(results);
        };
        function onIdbError(evt) {
            dfd.reject(xact.error);
        }
        xact.onerror = onIdbError;
        xact.onabort = onIdbError;
        return dfd.promise;
    };
    /** Add data to a specific collection
     */
    IndexedDbPersister.prototype.addCollectionRecords = function (collectionName, options, records, removeExisting) {
        var data = this.prepDataForSave(records, options.maxObjectsPerChunk, options.groupByKey, options.keyGetter);
        return this.persistenceInterface.insertMultiple([{
                name: collectionName,
                clear: removeExisting,
                records: data
            }]).then(function (rs) { return ({ size: rs.inserts[0].added, dataSizeBytes: null }); });
    };
    /** Remove all data from the specificed collections
     */
    IndexedDbPersister.prototype.clearCollections = function (collectionNames) {
        var clearColls = collectionNames.map(function (collName) { return ({ name: collName, clear: true }); });
        return this.persistenceInterface.insertMultiple(clearColls);
    };
    /** Delete all data related this database from persistent storage
     */
    IndexedDbPersister.prototype.clearPersistentDb = function () {
        var _this = this;
        return this.persistenceInterface.getTables().then(function (tables) {
            var delColls = tables
                .filter(function (tbl) { return _this.tablesToNotClear.indexOf(tbl) === -1; })
                .map(function (tbl) { return ({ name: tbl }); });
            return _this.persistenceInterface.modifyDatabase(delColls, null, null);
        });
    };
    IndexedDbPersister.prototype.readRecords = function (rows, expectArrayRes) {
        var convertFunc = this.itemLoadConverter;
        var docs = [];
        for (var i = 0, size = rows.length; i < size; i++) {
            var dataBlob = rows[i];
            var resChunks = [];
            if (convertFunc != null) {
                if (expectArrayRes && Array.isArray(dataBlob)) {
                    for (var j = 0, sizeJ = dataBlob.length; j < sizeJ; j++) {
                        resChunks.push(convertFunc(dataBlob[j]));
                    }
                }
                else {
                    resChunks.push(convertFunc(dataBlob));
                }
            }
            else {
                if (expectArrayRes && Array.isArray(dataBlob)) {
                    resChunks = dataBlob;
                }
                else {
                    resChunks.push(dataBlob);
                }
            }
            Array.prototype.push.apply(docs, resChunks);
        }
        return docs;
    };
    IndexedDbPersister.prototype.prepDataForSave = function (items, chunkSize, groupByKey, keyGetter) {
        var resItems = items;
        if (this.itemSaveConverter != null) {
            var convertFunc = this.itemSaveConverter;
            resItems = [];
            for (var j = 0, sizeJ = items.length; j < sizeJ; j++) {
                resItems.push(convertFunc(items[j]));
            }
        }
        var data = [];
        // records by chunks
        if (chunkSize > 0) {
            for (var i = 0, size = resItems.length; i < size; i += chunkSize) {
                data.push(resItems.slice(i, i + chunkSize > size ? size : i + chunkSize));
            }
        }
        // records by group-by
        else if (groupByKey != null && keyGetter != null) {
            var groups;
            if (typeof keyGetter === "string") {
                groups = resItems.reduce(function (grps, rec) {
                    var key = rec[keyGetter];
                    var grp = grps[key] || (grps[key] = []);
                    grp.push(rec);
                    return grps;
                }, {});
            }
            else {
                groups = resItems.reduce(function (grps, rec) {
                    var key = keyGetter(rec);
                    var grp = grps[key] || (grps[key] = []);
                    grp.push(rec);
                    return grps;
                }, {});
            }
            data = Object.keys(groups).map(function (k) { return groups[k]; });
        }
        // records as-is from collection.data array
        else {
            Array.prototype.push.apply(data, resItems);
        }
        return data;
    };
    return IndexedDbPersister;
}());
module.exports = IndexedDbPersister;
