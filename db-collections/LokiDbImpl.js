/// <reference path="../definitions/lib/Q.d.ts" />
/// <reference path="../definitions/lib/lokijs.d.ts" />
var _ = require("lodash");
var Q = require("q");
var Loki = require("lokijs");
var ChangeTrackersImpl = require("../change-trackers/ChangeTrackersImpl");
var ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
var PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
function stripMetaData(obj) {
    var returnValue = _.clone(obj);
    delete returnValue.$loki;
    delete returnValue.meta;
    return returnValue;
}
/** A {@link ResultSetLike} implementation for an empty collection
 * @author TeamworkGuy2
 */
var ResultsetMock = (function () {
    function ResultsetMock() {
    }
    ResultsetMock.prototype.data = function () {
        return [];
    };
    ResultsetMock.prototype.find = function () {
        return this;
    };
    ResultsetMock.prototype.offset = function () {
        return this;
    };
    ResultsetMock.prototype.limit = function () {
        return this;
    };
    ResultsetMock.prototype.simplesort = function () {
        return this;
    };
    ResultsetMock.prototype.where = function () {
        return this;
    };
    return ResultsetMock;
})();
/** {@link DataPersister.Adapter} wrapper that checks permissions before reading/writing data
 * @author TeamworkGuy2
 */
var PermissionedDataPersistAdapter = (function () {
    function PermissionedDataPersistAdapter(persister, syncSettings, storeSettings) {
        this.syncSettings = syncSettings;
        this.storeSettings = storeSettings;
        this.persister = persister;
    }
    PermissionedDataPersistAdapter.prototype.setDataStoreInterface = function (getDataStore, setDataStore, createDataStore) {
        this.persister.setDataStoreInterface(getDataStore, setDataStore, createDataStore);
    };
    PermissionedDataPersistAdapter.prototype.setDataSources = function (getDataSources) {
        this.persister.setDataSources(getDataSources);
    };
    PermissionedDataPersistAdapter.prototype.setDataConverters = function (saveItemTransformation, restoreItemTransformation) {
        this.persister.setDataConverters(saveItemTransformation, restoreItemTransformation);
    };
    PermissionedDataPersistAdapter.prototype.save = function (callback) {
        if (this.syncSettings.writeAllow) {
            this.persister.save(callback);
        }
    };
    PermissionedDataPersistAdapter.prototype.load = function (options, callback) {
        if (this.syncSettings.readAllow) {
            this.persister.save(callback);
        }
    };
    PermissionedDataPersistAdapter.prototype.persist = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    };
    PermissionedDataPersistAdapter.prototype.restore = function () {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister read permission denied due to settings");
            return dfd.promise;
        }
    };
    PermissionedDataPersistAdapter.prototype.clearPersistenceDb = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistenceDb();
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    };
    return PermissionedDataPersistAdapter;
})();
var InMemDbImpl = (function () {
    function InMemDbImpl(dbName, settings, storeSettings, metaDataStorageCollectionName, modelDefinitions, dataPersisterFactory) {
        this.dbName = dbName;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.dataPersisterFactory = dataPersisterFactory;
        this.metaDataStorageCollectionName = metaDataStorageCollectionName;
        this.cache = {};
        this.getCollections = this.getCollections.bind(this);
        this.saveRestore = InMemDbImpl.createDefaultDataPersister(this, dataPersisterFactory);
    }
    // ==== private methods ====
    InMemDbImpl.prototype._createNewDb = function (dbName, options) {
        return new Loki(dbName, options);
    };
    InMemDbImpl.prototype._setNewDb = function (dataStore) {
        this.db = dataStore;
    };
    InMemDbImpl.createDefaultDataPersister = function (dbDataInst, dataPersisterFactory) {
        var dataPersister = dataPersisterFactory(dbDataInst);
        var persistAdapter = new PermissionedDataPersistAdapter(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
        dbDataInst.setDataPersister(persistAdapter);
        return persistAdapter;
    };
    InMemDbImpl.prototype.getModelDefinitions = function () {
        return this.modelDefinitions;
    };
    InMemDbImpl.prototype.getModelKeys = function () {
        return this.modelKeys;
    };
    InMemDbImpl.prototype.resetDataStore = function () {
        var dfd = Q.defer();
        this.db = null;
        this.saveRestore = InMemDbImpl.createDefaultDataPersister(this, this.dataPersisterFactory);
        dfd.resolve(null);
        return dfd.promise;
    };
    InMemDbImpl.prototype.setDataPersister = function (dataPersister) {
        var _this = this;
        var dfd = Q.defer();
        this.db = null;
        this.saveRestore = dataPersister;
        // link the data persister to this objects data collections and data store instances
        dataPersister.setDataStoreInterface(function () { return _this.db; }, function (dataStore) { return _this._setNewDb(dataStore); }, function (options) { return _this._createNewDb(_this.dbName, options); });
        dataPersister.setDataSources(this.getCollections);
        dataPersister.setDataConverters(stripMetaData, null);
        dfd.resolve(null);
        return dfd.promise;
    };
    InMemDbImpl.prototype.getDataPersister = function () {
        return this.saveRestore;
    };
    InMemDbImpl.prototype._removeCollection = function (collection, dstMetaData) {
        if (dstMetaData) {
            var collection = this.db.getCollection(collection.name);
            if (collection) {
                dstMetaData.addChangeItemsRemoved(collection.data.length);
            }
        }
        if (collection) {
            this.db.removeCollection(collection.name);
        }
    };
    InMemDbImpl.prototype.getCollections = function () {
        return this.db.collections;
    };
    InMemDbImpl.prototype._getCollection = function (collectionName, autoCreate) {
        autoCreate = true;
        collectionName = collectionName.toLowerCase();
        var coll = this.db.getCollection(collectionName);
        if (!coll) {
            if (!autoCreate) {
                return;
            }
            else {
                coll = this.db.addCollection(collectionName, { asyncListeners: false }); // async listeners cause performance issues (2015-1)
                coll.isDirty = true;
            }
        }
        return coll;
    };
    InMemDbImpl.prototype.add = function (collectionName, docs, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collectionName, ModelKeysImpl.Constraint.NON_NULL, ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    };
    InMemDbImpl.prototype.addAll = function (collectionName, docs, dstMetaData) {
        return this.add(collectionName, docs, dstMetaData);
    };
    InMemDbImpl.prototype.addNoModify = function (collectionName, docs, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collectionName, ModelKeysImpl.Constraint.NON_NULL, ModelKeysImpl.Generated.PRESERVE_EXISTING, docs, dstMetaData);
    };
    InMemDbImpl.prototype._addToCollection = function (collection, docs, noModify, dstMetaData) {
        return this._addToCollectionHandlePrimaryAndGeneratedKeys(collection, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    };
    InMemDbImpl.prototype._addToCollectionAll = function (collection, docs, noModify, dstMetaData) {
        return this._addToCollection(collection, docs, noModify, dstMetaData);
    };
    InMemDbImpl.prototype._addHandlePrimaryAndGeneratedKeys = function (collectionName, primaryConstraint, generateOption, docs, dstMetaData) {
        var collection = this._getCollection(collectionName, true);
        return this._addToCollectionHandlePrimaryAndGeneratedKeys(collection, primaryConstraint, generateOption, docs, dstMetaData);
    };
    InMemDbImpl.prototype._addToCollectionHandlePrimaryAndGeneratedKeys = function (collection, primaryConstraint, generateOption, docs, dstMetaData) {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return;
        }
        var docsIsAry = Array.isArray(docs);
        // generate auto-generated keys if requested before checking unique IDs since the auto-generated keys may be unique IDs
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataStorageCollectionName, this, this.modelKeys);
        }
        this.primaryKeyMaintainer.manageKeys(collection.name, docs, generateOption === ModelKeysImpl.Generated.AUTO_GENERATE);
        //Ensure a legacy uniqueId field is present
        if (primaryConstraint === ModelKeysImpl.Constraint.NON_NULL) {
            var keyNames = this.modelKeys.getUniqueIdNames(collection.name);
            if (keyNames.length > 0) {
                var checkKeys = function (doc) {
                    for (var ii = 0, sizeI = keyNames.length; ii < sizeI; ii++) {
                        if (doc[keyNames[ii]] == null) {
                            throw new Error("Attempting to insert object into " + collection.name + " without valid unique keys: [" + keyNames + "]");
                        }
                    }
                };
                if (docsIsAry) {
                    docs.forEach(checkKeys);
                }
                else {
                    checkKeys(docs);
                }
            }
        }
        else if (primaryConstraint === ModelKeysImpl.Constraint.UNIQUE) {
            throw new Error("ModelKeysImpl.Constraint.UNIQUE is not yet supported");
        }
        if (dstMetaData) {
            dstMetaData.addChangeItemsAdded(docsIsAry);
        }
        collection.isDirty = true;
        this.dataAdded(collection, docs, null, dstMetaData);
        return collection.insert(docs);
    };
    InMemDbImpl.prototype.update = function (collectionName, doc, dstMetaData) {
        var collection = this._getCollection(collectionName, true);
        return this._update(collection, doc, dstMetaData);
    };
    InMemDbImpl.prototype._update = function (collection, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }
        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    };
    InMemDbImpl.prototype.find = function (collectionName, query) {
        var collection = this._getCollection(collectionName, false);
        return this._find(collection, query);
    };
    InMemDbImpl.prototype._find = function (collection, query, queryProps) {
        //Check for empty collection
        // TODO remove, users should never request non-existent collections
        if (!collection) {
            return new ResultsetMock();
        }
        else if (collection.data.length === 0) {
            return collection.chain();
        }
        //Get all results
        var queryProps = queryProps ? queryProps : (query ? Object.keys(query) : null);
        var results = collection.chain().find();
        //Support for multiple criteria in one query
        for (var i = 0, size = (queryProps ? queryProps.length : 0); i < size; i++) {
            var prop = queryProps[i];
            var localQuery = {};
            localQuery[prop] = query[prop];
            results = results.find(localQuery);
        }
        return results;
    };
    InMemDbImpl.prototype._findSinglePropQueryData = function (collection, query, queryProps) {
        if (!collection) {
            throw new Error("null collection with query: " + query);
        }
        else if (collection.data.length === 0) {
            return [];
        }
        //Get all results
        var queryProps = queryProps ? queryProps : (query ? Object.keys(query) : null);
        if (queryProps && queryProps.length > 1) {
            throw new Error("query '" + query + "' has more than 1 prop, _findSinglePropQueryData() only accepts 1 prop");
        }
        var results = collection.find(query);
        return results;
    };
    InMemDbImpl.prototype.remove = function (collectionName, doc, dstMetaData) {
        var collection = this._getCollection(collectionName);
        return this._remove(collection, doc, dstMetaData);
    };
    InMemDbImpl.prototype._remove = function (collection, doc, dstMetaData) {
        if (!collection) {
            return;
        }
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }
        collection.isDirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        return collection.remove(doc);
    };
    // Utility methods =========================
    InMemDbImpl.prototype.clearCollection = function (collectionName, dstMetaData) {
        var col = this._getCollection(collectionName);
        this._clearCollection(col, dstMetaData);
    };
    InMemDbImpl.prototype._clearCollection = function (collection, dstMetaData) {
        if (collection) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(collection.data.length);
            }
            collection.isDirty = true;
            collection.clear();
        }
    };
    InMemDbImpl.prototype.removeCollection = function (collectionName, dstMetaData) {
        var col = this._getCollection(collectionName);
        this._removeCollection(col, dstMetaData);
    };
    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    InMemDbImpl.prototype.findOne = function (collectionName, query) {
        var collection = this._getCollection(collectionName, false);
        return this._findOne(collection, query);
    };
    InMemDbImpl.prototype._findOne = function (collection, query) {
        return this._findNResults(collection, 1, 1, query);
    };
    InMemDbImpl.prototype._findOneOrNull = function (collection, query) {
        return this._findNResults(collection, 0, 1, query);
    };
    InMemDbImpl.prototype._findNResults = function (collection, min, max, query) {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }
        var res = this._find(collection, query).data();
        if (res.length < min || res.length > max) {
            throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + "matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
        }
        return res[0];
    };
    // KeyValue store ==========================================
    InMemDbImpl.prototype.getItem = function (key) {
        if (!key) {
            return;
        }
        key = key.trim().toLowerCase();
        return this.cache[key];
    };
    InMemDbImpl.prototype.setItem = function (key, value) {
        if (!key) {
            return;
        }
        key = key.trim().toLowerCase();
        this.cache[key] = value;
    };
    InMemDbImpl.prototype.removeItem = function (key) {
        if (!key) {
            return;
        }
        key = key.trim().toLowerCase();
        delete this.cache[key];
    };
    InMemDbImpl.prototype.updateWhere = function (collectionName, query, obj, dstMetaData) {
        var collection = this._getCollection(collectionName, false);
        return this._updateWhere(collection, query, obj, dstMetaData);
    };
    InMemDbImpl.prototype._updateWhere = function (collection, query, obj, dstMetaData) {
        var self = this;
        var updateProperties = stripMetaData(obj);
        query = self.modelKeys.validateQuery(collection.name, query, updateProperties);
        var results = this._find(collection);
        for (var prop in query) {
            var localQuery = {};
            localQuery[prop] = query[prop];
            results = results.find(localQuery);
        }
        var resData = results.data();
        if (dstMetaData && resData.length > 0) {
            dstMetaData.addChangeItemsModified(resData.length);
        }
        for (var i = 0, size = resData.length; i < size; i++) {
            var doc = resData[i];
            _.assign(doc, updateProperties);
            self._update(collection, doc);
        }
    };
    InMemDbImpl.prototype.addOrUpdateWhere = function (collectionName, query, obj, noModify, dstMetaData) {
        var collection = this._getCollection(collectionName, false);
        return this._addOrUpdateWhere(collection, query, obj, noModify, dstMetaData);
    };
    InMemDbImpl.prototype._addOrUpdateWhere = function (collection, query, obj, noModify, dstMetaData) {
        var self = this;
        //remove loki information so not to overwrite it.
        var updateProperties = stripMetaData(obj);
        query = self.modelKeys.validateQuery(collection.name, query, updateProperties);
        var results = this._find(collection);
        for (var prop in query) {
            var localQuery = {};
            localQuery[prop] = query[prop];
            results = results.find(localQuery);
        }
        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }
        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                compoundDstMetaData.addChangeItemsModified(toUpdate.length);
            }
            //update
            for (var i = 0, size = toUpdate.length; i < size; i++) {
                var doc = toUpdate[i];
                _.assign(doc, updateProperties);
                self._update(collection, doc);
            }
        }
        else {
            //Ensure key information is present before inserting
            var toAdd = _.assign(obj, query);
            self._addToCollection(collection, toAdd, noModify, compoundDstMetaData);
        }
    };
    InMemDbImpl.prototype.removeWhere = function (collectionName, query, dstMetaData) {
        var collection = this._getCollection(collectionName, false);
        return this._removeWhere(collection, query, dstMetaData);
    };
    InMemDbImpl.prototype._removeWhere = function (collection, query, dstMetaData) {
        var docs = this._find(collection, query).data();
        for (var i = 0, size = docs.length; i < size; i++) {
            var doc = docs[i];
            this._remove(collection, doc, dstMetaData);
        }
    };
    InMemDbImpl.prototype.addOrUpdateAll = function (collectionName, keyName, updatesArray, noModify, dstMetaData) {
        var collection = this._getCollection(collectionName, false);
        return this._addOrUpdateAll(collection, keyName, updatesArray, noModify, dstMetaData);
    };
    InMemDbImpl.prototype._addOrUpdateAll = function (collection, keyName, updatesArray, noModify, dstMetaData) {
        var existingData = this._find(collection).data();
        var existingDataKeys = _.pluck(existingData, keyName);
        updatesArray = _.cloneDeep(updatesArray).map(stripMetaData);
        var toAdd = updatesArray.filter(function (update) {
            return existingDataKeys.indexOf(update[keyName]) === -1;
        });
        var toUpdate = updatesArray.filter(function (update) {
            return existingDataKeys.indexOf(update[keyName]) !== -1;
        });
        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }
        this._addToCollection(collection, toAdd, noModify, compoundDstMetaData);
        if (compoundDstMetaData) {
            compoundDstMetaData.addChangeItemsModified(toUpdate.length);
        }
        for (var i = 0, size = toUpdate.length; i < size; i++) {
            var item = toUpdate[i];
            var query = {};
            query[keyName] = item[keyName];
            this._updateWhere(collection, query, item);
        }
    };
    // Array-like
    InMemDbImpl.prototype.mapReduce = function (collectionName, map, reduce) {
        var collection = this._getCollection(collectionName);
        if (!collection) {
            return;
        }
        return collection.mapReduce(map, reduce);
    };
    // ==== event loggers ====
    InMemDbImpl.prototype.dataAdded = function (coll, newDoc, query, dstMetaData) {
        // events not yet implemented
    };
    InMemDbImpl.prototype.dataModified = function (coll, changeDoc, query, dstMetaData) {
        // events not yet implemented
    };
    InMemDbImpl.prototype.dataRemoved = function (coll, removedDoc, query, dstMetaData) {
        // events not yet implemented
    };
    // Utility functions =======================
    InMemDbImpl.prototype.stripMetaData = function (obj) {
        return stripMetaData(obj);
    };
    InMemDbImpl.stripMetaData = function (obj) {
        return stripMetaData(obj);
    };
    return InMemDbImpl;
})();
module.exports = InMemDbImpl;
