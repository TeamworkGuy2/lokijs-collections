"use strict";
var Arrays = require("ts-mortar/utils/Arrays");
var DbUtil = require("./DbUtil");
/** WebSqlPersister class which implements 'DataPersister' for saving data to WebSQL for long-term browser data storage.
 * Exports 'WebSqlSpi' interface which has two methods: getTables() and executeQueries(), which is the link between this 'WebSqlPersister' class and the underlying WebSQL database.
 * @author TeamworkGuy2
 */
var WebSqlPersister = /** @class */ (function () {
    /** Create a DataPersister based on a WebSqlSpi instance and some additional functions to control the behavior of this persister.
     * @param persistenceInterface the underlying database to persist to
     * @param trace the object with functions for logging debug messages and errors
     * @param getDataCollections returns a list of data collections that contain the data to persist/restore to
     * @param addCollection when restoring a database, call this function with each table name found and restored documents
     * @param saveItemTransformation optional conversion function to pass items from 'getDataCollections()' through before persisting them
     * @param postSaveTransformKeyValueFilter optional JSON.stringify() 'replacer', second parameter, function which is called for each object stringified by calls to persist()
     * @param restoreItemTransformation optional conversion function to pass items through after restoring them and before storing them in 'getDataCollections()'
     * @param storageFailureCallback callback for handling/logging storage errors
     * @param tablesToNotClear optional array of collection names to not clear when 'clearPersistentDb()' is called
     * @param tablesToNotLoad optional array of collection names to not load when 'restore()' is called
     */
    function WebSqlPersister(persistenceInterface, trace, getDataCollections, addCollection, saveItemTransformation, postSaveTransformKeyValueFilter, restoreItemTransformation, storageFailureCallback, tablesToNotClear, tablesToNotLoad) {
        this.tablesToNotClear = [];
        this.tablesToNotLoad = [];
        this.persistenceInterface = persistenceInterface;
        this.logger = trace;
        this.itemSaveConverter = saveItemTransformation;
        this.itemKeyValueFilter = postSaveTransformKeyValueFilter;
        this.itemLoadConverter = restoreItemTransformation;
        this.getDataCollections = getDataCollections;
        this.addCollection = addCollection;
        this.storageFailureCallback = storageFailureCallback;
        this.tablesToNotClear = tablesToNotClear || [];
        this.tablesToNotLoad = tablesToNotLoad || [];
    }
    /** Persist in-memory database to disk
     * Removes tables from store that don't exist in in-memory db
     */
    WebSqlPersister.prototype.persist = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var timerId = DbUtil.newTimer("persist");
        var dfd = this.persistenceInterface.util.defer();
        var persistCount = 0;
        var persistData = {
            collections: {}
        };
        function addOrUpdatePersistInfo(collName, addSize, addDataSizeBytes) {
            if (persistData.collections[collName] == null) {
                persistData.collections[collName] = {
                    size: addSize,
                    dataSizeBytes: addDataSizeBytes
                };
            }
            else {
                var collPersistInfo = persistData.collections[collName];
                collPersistInfo.size = collPersistInfo.size + addSize;
                collPersistInfo.dataSizeBytes = collPersistInfo.dataSizeBytes + addDataSizeBytes;
            }
        }
        // add new tables and remove tables that do not have collections
        this.persistenceInterface.getTables().then(function (tables) {
            var tableNames = Arrays.pluck(tables, "name");
            var promises = [];
            var colls = that.getDataCollections();
            colls.forEach(function (coll) {
                var sqls = [];
                var opts = DbUtil.getOptionsOrDefault(getCollectionOptions != null ? getCollectionOptions(coll.name) : null, defaultOptions);
                var exists = tableNames.indexOf(coll.name) !== -1;
                if (opts.deleteIfExists && exists) {
                    sqls.push({ sql: "DROP TABLE " + coll.name, args: [] });
                    sqls.push({ sql: "CREATE TABLE " + coll.name + " (" + (opts.keyColumn != null ? opts.keyColumn.name + " " + opts.keyColumn.type + ", " : "") + opts.dataColumnName + " blob)", args: [] });
                }
                if (!exists) {
                    sqls.push({ sql: "CREATE TABLE IF NOT EXISTS " + coll.name + " (" + (opts.keyColumn != null ? opts.keyColumn.name + " " + opts.keyColumn.type + ", " : "") + opts.dataColumnName + " blob)", args: [] });
                }
                if (coll.dirty) {
                    if (exists) {
                        sqls.push({ sql: "DELETE FROM " + coll.name, args: [] });
                    }
                    persistCount++;
                    // create the sql statements
                    if (coll.data.length > 0) {
                        var res = that.createInsertStatements(coll.name, coll.data, opts.keyGetter, opts.keyColumn && opts.keyColumn.name, opts.groupByKey, opts.maxObjectsPerChunk, opts.compress);
                        addOrUpdatePersistInfo(coll.name, res.itemCount, res.jsonSize);
                        sqls.push({ sql: res.sql, args: res.args });
                    }
                    coll.dirty = false;
                }
                if (sqls.length > 0) {
                    var collPromise = that.persistenceInterface.executeQueries(sqls);
                    promises.push(collPromise);
                }
            });
            return that.persistenceInterface.util.whenAll(promises);
        }).done(function (results) {
            if (persistCount > 0) {
                var timeMs = timerId.measure();
                var totalWriteSize = Object.keys(persistData.collections).reduce(function (prev, collName) { return prev + persistData.collections[collName].dataSizeBytes; }, 0);
                if (that.logger != null)
                    that.logger.log("Data saved: ", Math.floor(timeMs), "(ms), ", totalWriteSize, "(bytes), meta-info: ", persistData.collections);
            }
            dfd.resolve(persistData);
        }, function (error) {
            if (error.sqlError && error.sqlError.message && error.sqlError.message.indexOf("there was not enough remaining storage space") > -1) {
                if (that.storageFailureCallback) {
                    that.storageFailureCallback(error);
                }
            }
            dfd.reject(error);
        });
        return dfd.promise;
    };
    /** Restore in-memory database from persistent storage.
     * All in memory tables are dropped and re-added
     */
    WebSqlPersister.prototype.restore = function (defaultOptions, getCollectionOptions) {
        var that = this;
        var timerId = DbUtil.newTimer("restore");
        var defaultDecompress = (defaultOptions != null && defaultOptions.decompress) || false;
        var dfd = this.persistenceInterface.util.defer();
        var restoreRes = {
            collections: {}
        };
        var tableNames = [];
        this.persistenceInterface.getTables().then(function (tables) {
            tableNames = Arrays.pluck(tables, "name").filter(function (n) { return that.tablesToNotLoad.indexOf(n) === -1; });
            var sqls = tables.filter(function (t) { return that.tablesToNotLoad.indexOf(t.name) === -1; })
                .map(function (table) { return ({ sql: "SELECT * FROM " + table.name, args: [] }); });
            return that.persistenceInterface.executeQueries(sqls);
        }).done(function (results) {
            results.forEach(function (result, tableIndex) {
                var tableName = tableNames[tableIndex];
                var docs = [];
                var res = {
                    size: 0,
                    dataSizeBytes: 0
                };
                if (result.rows.length > 0) {
                    var opts = getCollectionOptions != null ? getCollectionOptions(tableName) : null;
                    var decompress = opts != null ? opts.decompress || defaultDecompress : defaultDecompress;
                    var dataColumnName = opts != null ? opts.dataColumnName || WebSqlPersister.defaultDataColumnName : WebSqlPersister.defaultDataColumnName;
                    // check whether the row format has our required column
                    if (result.rows.item(0)[dataColumnName]) {
                        docs = that.readRecords(result.rows, dataColumnName, decompress, opts == null || opts.isChunks, res);
                    }
                    else {
                        if (that.logger != null && that.logger.error != null)
                            that.logger.error("skip restoring table: " + tableName + " (unrecognized data format)");
                    }
                }
                else {
                    //if (that.logger != null) that.logger.log("skip restoring table: " + tableName + " (0 items)");
                }
                res.size = docs.length;
                restoreRes.collections[tableName] = res;
                that.addCollection(tableName, docs);
            });
            var timeMs = timerId.measure();
            if (that.logger != null)
                that.logger.log("Data loaded", Math.floor(timeMs), "(ms)");
            dfd.resolve(restoreRes);
        }, function (err) {
            dfd.reject(err);
        });
        return dfd.promise;
    };
    /** Get a list of collection names in this data persister
     */
    WebSqlPersister.prototype.getCollectionNames = function () {
        return this.persistenceInterface.getTables().then(function (tbls) { return tbls.map(function (t) { return t.name; }); });
    };
    /** Get all data from a specific collection
     */
    WebSqlPersister.prototype.getCollectionRecords = function (collectionName, options) {
        var that = this;
        var sqls = [{ sql: "SELECT * FROM " + collectionName, args: [] }];
        return this.persistenceInterface.executeQueries(sqls).then(function (_a) {
            var result = _a[0];
            var docs = [];
            if (result.rows.length > 0) {
                var decompress = options != null ? options.decompress || false : false;
                var dataColumnName = options != null ? options.dataColumnName || WebSqlPersister.defaultDataColumnName : WebSqlPersister.defaultDataColumnName;
                // check whether the row formats has our required column
                if (result.rows.item(0)[dataColumnName]) {
                    docs = that.readRecords(result.rows, dataColumnName, decompress, options == null || options.isChunks);
                }
                else {
                    if (that.logger != null && that.logger.error != null)
                        that.logger.error("skip restoring table: " + collectionName + " (unrecognized data format)");
                }
            }
            return docs;
        });
    };
    /** Add data to a specific collection
     */
    WebSqlPersister.prototype.addCollectionRecords = function (collectionName, options, records, removeExisting) {
        var opts = DbUtil.getOptionsOrDefault(options, { compress: false, maxObjectsPerChunk: WebSqlPersister.MAX_OBJECTS_PER_PERSIST_RECORD });
        var res = records.length > 0 ? this.createInsertStatements(collectionName, records, opts.keyGetter, opts.keyColumn && opts.keyColumn.name, opts.groupByKey, opts.maxObjectsPerChunk, opts.compress) : null;
        var sqls = [];
        if (removeExisting) {
            sqls.push({ sql: "DELETE FROM " + collectionName, args: [] });
        }
        if (records.length > 0) {
            sqls.push({ sql: res.sql, args: res.args });
        }
        return this.persistenceInterface.executeQueries(sqls).then(function (_a) {
            var result = _a[0];
            return (res != null ? { size: res.itemCount, dataSizeBytes: res.jsonSize } : { size: 0, dataSizeBytes: 0 });
        });
    };
    /** Remove all data from the specificed collections
     */
    WebSqlPersister.prototype.clearCollections = function (collectionNames) {
        var sqls = collectionNames.map(function (collName) { return ({ sql: "DELETE FROM " + collName, args: [] }); });
        return this.persistenceInterface.executeQueries(sqls).then(function (results) { return null; });
    };
    /** Delete all data related this database from persistent storage
     */
    WebSqlPersister.prototype.clearPersistentDb = function () {
        var _this = this;
        var timerId = DbUtil.newTimer("clear");
        var dfd = this.persistenceInterface.util.defer();
        this.persistenceInterface.getTables().then(function (tables) {
            var sqls = tables
                .filter(function (t) { return _this.tablesToNotClear.indexOf(t.name) === -1; })
                .map(function (table) { return ({ sql: "DROP TABLE " + table.name, args: [] }); });
            return _this.persistenceInterface.executeQueries(sqls);
        }).done(function (sqls) {
            var timeMs = timerId.measure();
            if (_this.logger != null)
                _this.logger.log("Data cleared", Math.floor(timeMs), "(ms)");
            dfd.resolve(null);
        }, function (err) {
            dfd.reject(err);
        });
        return dfd.promise;
    };
    /** Reads rows from a SqlResultSetRowList. First each row's 'dataColumnName' column is parsed via JSON.parse(), then the data is processed as follows:
     *  - if the parsed data is an array, assume it's an array of data models, if an 'itemLoadConverter' function was provided in the constructor, use it to convert each object, else return the array of objects
     *  - if the parsed data is not an array, assume it is a single data model, if an 'itemLoadConverter' function was provided in the constructor, use it to convert the object, else return the object
     * Note: because of this logic, using an array as a data model will not produce correct results since the array will be assumed to contain multiple individual data objects
     * @param rows the result set rows to process
     * @param dataColumnName the name of the column containing the model data
     * @param decompress (currently not supported) whether data strings should be decompressed or not
     * @param expectArrayRes whether data strings are expected to be array chunks with the actual data records inside
     * @param res optional stats object in which to store info about the rows read
     */
    WebSqlPersister.prototype.readRecords = function (rows, dataColumnName, decompress, expectArrayRes, res) {
        var convertFunc = this.itemLoadConverter;
        var docs = [];
        for (var i = 0, size = rows.length; i < size; i++) {
            var dataBlob = rows.item(i)[dataColumnName];
            if (res != null) {
                res.dataSizeBytes += dataBlob.length;
            }
            if (decompress) {
                //dataBlob = pako.inflate(dataBlob, { to: "string" });
            }
            // NOTE: may throw error
            var chunks = JSON.parse(dataBlob);
            var resChunks = [];
            if (convertFunc != null) {
                if (expectArrayRes && Array.isArray(chunks)) {
                    for (var j = 0, sizeJ = chunks.length; j < sizeJ; j++) {
                        resChunks.push(convertFunc(chunks[j]));
                    }
                }
                else {
                    resChunks.push(convertFunc(chunks));
                }
                chunks = null;
            }
            else {
                if (expectArrayRes && Array.isArray(chunks)) {
                    resChunks = chunks;
                }
                else {
                    resChunks.push(chunks);
                }
            }
            Array.prototype.push.apply(docs, resChunks);
        }
        return docs;
    };
    WebSqlPersister.prototype.createInsertStatements = function (collName, items, keyGetter, keyColumn, groupByKey, chunkSize, compress) {
        var sql;
        var sqlArgs = [];
        var resItems = items;
        if (this.itemSaveConverter != null) {
            var convertFunc = this.itemSaveConverter;
            resItems = [];
            for (var j = 0, sizeJ = items.length; j < sizeJ; j++) {
                resItems.push(convertFunc(items[j]));
            }
        }
        var itemCount = 0;
        var jsonSize = 0;
        // records by chunks
        if (keyGetter == null && chunkSize > 0) {
            sql = "INSERT INTO " + collName + " VALUES(?)";
            for (var i = 0, sz = resItems.length; i < sz; i += chunkSize) {
                var data = resItems.slice(i, i + chunkSize);
                var jsonData = JSON.stringify(data, this.itemKeyValueFilter);
                if (compress) {
                    //jsonData = <string>pako.deflate(jsonData, { to: "string" });
                }
                itemCount += data.length;
                jsonSize += jsonData.length;
                sqlArgs.push([jsonData]);
            }
        }
        // records by group-by
        else if (keyGetter != null && groupByKey != null) {
            sql = "INSERT INTO " + collName + (keyColumn != null ? " VALUES(?,?)" : " VALUES(?)");
            if (typeof keyGetter === "string") {
                var uniqueKeyLists = resItems.reduce(function (mp, itm) {
                    var value = itm[keyGetter];
                    var ary = (mp[value] || (mp[value] = []));
                    ary.push(itm);
                    return mp;
                }, {});
            }
            else {
                var uniqueKeyLists = resItems.reduce(function (mp, itm) {
                    var value = keyGetter(itm);
                    var ary = (mp[value] || (mp[value] = []));
                    ary.push(itm);
                    return mp;
                }, {});
            }
            for (var key in uniqueKeyLists) {
                var data = uniqueKeyLists[key];
                var jsonData = JSON.stringify(data, this.itemKeyValueFilter);
                itemCount += data.length;
                jsonSize += jsonData.length;
                sqlArgs.push(keyColumn != null ? [key, jsonData] : [jsonData]);
            }
        }
        // records by key
        else if (keyGetter != null) {
            sql = "INSERT INTO " + collName + (keyColumn != null ? " VALUES(?,?)" : " VALUES(?)");
            if (typeof keyGetter === "string") {
                for (var i = 0, sz = resItems.length; i < sz; i++) {
                    var datum = resItems[i];
                    var jsonData = JSON.stringify(datum, this.itemKeyValueFilter);
                    var keyVal = datum[keyGetter];
                    itemCount += 1;
                    jsonSize += jsonData.length;
                    sqlArgs.push(keyColumn != null ? [keyVal, jsonData] : [jsonData]);
                }
            }
            else {
                for (var i = 0, sz = resItems.length; i < sz; i++) {
                    var datum = resItems[i];
                    var jsonData = JSON.stringify(datum, this.itemKeyValueFilter);
                    var key = keyGetter(datum);
                    itemCount += 1;
                    jsonSize += jsonData.length;
                    sqlArgs.push(keyColumn != null ? [key, jsonData] : [jsonData]);
                }
            }
        }
        else {
            throw new Error("unsupported persist options combination: keyGetter=" + keyGetter + ", keyColumn=" + keyColumn + ", groupByKey=" + groupByKey + ", chunkSize=" + chunkSize);
        }
        return { sql: sql, args: sqlArgs, itemCount: itemCount, jsonSize: jsonSize };
    };
    WebSqlPersister.MAX_OBJECTS_PER_PERSIST_RECORD = 1000;
    WebSqlPersister.defaultDataColumnName = "bigString";
    return WebSqlPersister;
}());
module.exports = WebSqlPersister;
