/// <reference path="../definitions/lib/Q.d.ts" />
/// <reference path="../definitions/lib/lokijs.d.ts" />
var _ = require("lodash");
var Q = require("q");
var Loki = require("lokijs");
var Arrays = require("../lib/ts-mortar/utils/Arrays");
var ChangeTrackersImpl = require("../change-trackers/ChangeTrackersImpl");
var ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
var PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
var NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
var PermissionedDataPersisterAdapter = require("./PermissionedDataPersisterAdapter");
function stripMetaData(obj, doCloneDeep) {
    var returnValue = _.clone(obj, doCloneDeep);
    delete returnValue.$loki;
    delete returnValue.meta;
    return returnValue;
}
function stripMetaDataCloneDeep(obj) {
    var returnValue = _.cloneDeep(obj);
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
/** An implementation of InMemDb that wraps a LokiJS database
 */
var InMemDbImpl = (function () {
    function InMemDbImpl(dbName, settings, storeSettings, metaDataStorageCollectionName, modelDefinitions, dataPersisterFactory) {
        this.dbName = dbName;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.dataPersisterFactory = dataPersisterFactory;
        this.metaDataStorageCollectionName = metaDataStorageCollectionName;
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
        var persistAdapter = new PermissionedDataPersisterAdapter(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
        dbDataInst.setDataPersister(persistAdapter);
        return persistAdapter;
    };
    InMemDbImpl.prototype.getPrimaryKeyMaintainer = function () {
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataStorageCollectionName, this, this.modelKeys);
        }
        return this.primaryKeyMaintainer;
    };
    InMemDbImpl.prototype.getNonNullKeyMaintainer = function () {
        if (this.nonNullKeyMaintainer == null) {
            this.nonNullKeyMaintainer = new NonNullKeyMaintainer(this.modelKeys);
        }
        return this.nonNullKeyMaintainer;
    };
    // ==== Meta-data Getters/Setters ====
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
    // ==== Database CRUD Operations ====
    InMemDbImpl.prototype.add = function (collection, doc, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, [doc], dstMetaData);
    };
    InMemDbImpl.prototype.addAll = function (collection, docs, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    };
    InMemDbImpl.prototype._addHandlePrimaryAndGeneratedKeys = function (collection, primaryConstraint, generateOption, docs, dstMetaData) {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return;
        }
        // generate auto-generated keys if requested before checking unique IDs since the auto-generated keys may be unique IDs
        this.getPrimaryKeyMaintainer().manageKeys(collection.name, docs, generateOption === ModelKeysImpl.Generated.AUTO_GENERATE);
        //Ensure a legacy uniqueId field is present
        if (primaryConstraint === ModelKeysImpl.Constraint.NON_NULL) {
            this.getNonNullKeyMaintainer().manageKeys(collection.name, docs, true);
        }
        else if (primaryConstraint === ModelKeysImpl.Constraint.UNIQUE) {
            throw new Error("ModelKeysImpl.Constraint.UNIQUE is not yet supported");
        }
        if (dstMetaData) {
            dstMetaData.addChangeItemsAdded(docs);
        }
        collection.isDirty = true;
        this.dataAdded(collection, docs, null, dstMetaData);
        return collection.insert(docs);
    };
    InMemDbImpl.prototype.update = function (collection, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }
        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    };
    InMemDbImpl.prototype.find = function (collection, query, queryProps) {
        // Check for empty collection
        // TODO remove, users should never request non-existent collections..?
        if (!collection) {
            return new ResultsetMock();
        }
        else if (collection.data.length === 0) {
            return collection.chain();
        }
        var results = this._findMultiProp(collection.chain(), query, queryProps);
        return results;
    };
    InMemDbImpl.prototype.findSinglePropQuery = function (collection, query, queryProps) {
        if (!collection) {
            throw new Error("null collection with query: " + query);
        }
        else if (collection.data.length === 0) {
            return [];
        }
        //Get all results
        var queryProps = queryProps ? queryProps : (query ? Object.keys(query) : null);
        if (queryProps && queryProps.length > 1) {
            throw new Error("query '" + query + "' has more than 1 prop, findSinglePropQueryData() only accepts 1 prop");
        }
        var results = collection.find(query);
        return results;
    };
    InMemDbImpl.prototype.remove = function (collection, doc, dstMetaData) {
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
    InMemDbImpl.prototype.getCollections = function () {
        return this.db.collections;
    };
    InMemDbImpl.prototype.getCollection = function (collectionName, autoCreate) {
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
    InMemDbImpl.prototype.clearCollection = function (collection, dstMetaData) {
        var coll = typeof collection === "string" ? this.getCollection(collection) : collection;
        if (coll) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }
            coll.isDirty = true;
            coll.clear();
        }
    };
    InMemDbImpl.prototype.removeCollection = function (collection, dstMetaData) {
        var coll = typeof collection === "string" ? this.getCollection(collection) : collection;
        if (dstMetaData) {
            var collRes = this.db.getCollection(coll.name);
            if (collRes) {
                dstMetaData.addChangeItemsRemoved(collRes.data.length);
            }
        }
        if (coll) {
            this.db.removeCollection(coll.name);
        }
    };
    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    InMemDbImpl.prototype.findOne = function (collection, query) {
        return this._findNResults(collection, 1, 1, query);
    };
    InMemDbImpl.prototype._findOneOrNull = function (collection, query) {
        return this._findNResults(collection, 0, 1, query);
    };
    InMemDbImpl.prototype._findNResults = function (collection, min, max, query) {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }
        var res = this.find(collection, query).data();
        if (res.length < min || res.length > max) {
            throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + "matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
        }
        return max === 1 ? res[0] : res;
    };
    /** Query with multiple criteria
     */
    InMemDbImpl.prototype._findMultiProp = function (resSet, query, queryProps) {
        var results = resSet;
        if (!queryProps) {
            for (var prop in query) {
                var localQuery = {};
                localQuery[prop] = query[prop];
                results = results.find(localQuery);
            }
        }
        else {
            for (var i = 0, size = queryProps.length; i < size; i++) {
                var propI = queryProps[i];
                var localQuery = {};
                localQuery[propI] = query[propI];
                results = results.find(localQuery);
            }
        }
        return results;
    };
    InMemDbImpl.prototype.updateWhere = function (collection, query, obj, dstMetaData) {
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var results = this._findMultiProp(collection.chain(), query);
        var resData = results.data();
        if (dstMetaData && resData.length > 0) {
            dstMetaData.addChangeItemsModified(resData.length);
        }
        // get obj props, except the lokijs specific ones
        var updateKeys = Object.keys(obj);
        Arrays.fastRemove(updateKeys, "$loki");
        Arrays.fastRemove(updateKeys, "meta");
        var updateKeysLen = updateKeys.length;
        for (var i = 0, size = resData.length; i < size; i++) {
            var doc = resData[i];
            // assign obj props -> doc
            var idx = -1;
            while (idx++ < updateKeysLen) {
                var key = updateKeys[idx];
                doc[key] = obj[key];
            }
            this.update(collection, doc);
        }
    };
    InMemDbImpl.prototype.addOrUpdateWhere = function (collection, query, obj, noModify, dstMetaData) {
        //remove loki information so not to overwrite it.
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var results = this._findMultiProp(this.find(collection), query);
        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }
        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                compoundDstMetaData.addChangeItemsModified(toUpdate.map(stripMetaDataCloneDeep));
            }
            // get obj props, except the lokijs specific ones
            var updateKeys = Object.keys(obj);
            Arrays.fastRemove(updateKeys, "$loki");
            Arrays.fastRemove(updateKeys, "meta");
            var updateKeysLen = updateKeys.length;
            //update
            for (var i = 0, size = toUpdate.length; i < size; i++) {
                var doc = toUpdate[i];
                // assign obj props -> doc
                var idx = -1;
                while (idx++ < updateKeysLen) {
                    var key = updateKeys[idx];
                    doc[key] = obj[key];
                }
                this.update(collection, doc);
            }
        }
        else {
            // assign query props -> obj
            // This ensures that search keys information is present before inserting
            var queryKeys = Object.keys(query);
            var idx = -1;
            var len = queryKeys.length;
            while (idx++ < len) {
                var key = queryKeys[idx];
                obj[key] = query[key];
            }
            this.add(collection, obj, noModify, compoundDstMetaData);
        }
    };
    InMemDbImpl.prototype.removeWhere = function (collection, query, dstMetaData) {
        var docs = this.find(collection, query).data();
        for (var i = 0, size = docs.length; i < size; i++) {
            var doc = docs[i];
            this.remove(collection, doc, dstMetaData);
        }
    };
    InMemDbImpl.prototype.addOrUpdateAll = function (collection, keyName, updatesArray, noModify, dstMetaData) {
        var existingData = this.find(collection).data();
        // pluck keys from existing data
        var existingDataKeys = [];
        for (var ii = 0, sizeI = existingData.length; ii < sizeI; ii++) {
            var prop = existingData[i][keyName];
            existingDataKeys.push(prop);
        }
        var toAdd = [];
        var toUpdate = [];
        for (var i = 0, size = updatesArray.length; i < size; i++) {
            var update = updatesArray[i];
            var idx = existingDataKeys.indexOf(update[keyName]);
            if (idx === -1) {
                toAdd.push(stripMetaDataCloneDeep(update));
            }
            else {
                toUpdate.push(update);
            }
        }
        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }
        this.addAll(collection, toAdd, noModify, compoundDstMetaData);
        if (compoundDstMetaData && toUpdate.length > 0) {
            compoundDstMetaData.addChangeItemsModified(toUpdate.map(stripMetaDataCloneDeep));
        }
        for (var i = 0, size = toUpdate.length; i < size; i++) {
            var item = toUpdate[i];
            var query = {};
            query[keyName] = item[keyName];
            this.updateWhere(collection, query, item);
        }
    };
    // Array-like
    InMemDbImpl.prototype.mapReduce = function (collection, map, reduce) {
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
