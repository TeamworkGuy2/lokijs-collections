/// <reference path="../definitions/lib/Q.d.ts" />
/// <reference path="../definitions/lib/lokijs.d.ts" />
var _ = require("lodash");
var Q = require("q");
var Loki = require("lokijs");
var Arrays = require("../lib/ts-mortar/utils/Arrays");
var Objects = require("../lib/ts-mortar/utils/Objects");
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
var LokiDbImpl = (function () {
    function LokiDbImpl(dbName, settings, storeSettings, metaDataStorageCollectionName, modelDefinitions, dataPersisterFactory) {
        this.dbName = dbName;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.metaDataStorageCollectionName = metaDataStorageCollectionName;
        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersisterInst = LokiDbImpl.createDefaultDataPersister(this, dataPersisterFactory);
    }
    // ======== static methods ========
    LokiDbImpl._createNewDb = function (dbName, options) {
        return new Loki(dbName, options);
    };
    LokiDbImpl.createDefaultDataPersister = function (dbDataInst, dataPersisterFactory) {
        dbDataInst.setDataPersister(function (dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc) {
            var dataPersister = dataPersisterFactory(dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc);
            var persistAdapter = new PermissionedDataPersisterAdapter(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
            return persistAdapter;
        });
        return dbDataInst.getDataPersister();
    };
    // ======== private methods ========
    LokiDbImpl.prototype._setNewDb = function (dataStore) {
        this.db = dataStore;
    };
    LokiDbImpl.prototype.getPrimaryKeyMaintainer = function () {
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataStorageCollectionName, this, this.modelDefinitions, this.modelKeys);
        }
        return this.primaryKeyMaintainer;
    };
    LokiDbImpl.prototype.getNonNullKeyMaintainer = function () {
        if (this.nonNullKeyMaintainer == null) {
            this.nonNullKeyMaintainer = new NonNullKeyMaintainer(this.modelDefinitions);
        }
        return this.nonNullKeyMaintainer;
    };
    // ==== Meta-data Getters/Setters ====
    LokiDbImpl.prototype.getModelDefinitions = function () {
        return this.modelDefinitions;
    };
    LokiDbImpl.prototype.getModelKeys = function () {
        return this.modelKeys;
    };
    LokiDbImpl.prototype.initializeLokijsDb = function (options) {
        this._setNewDb(LokiDbImpl._createNewDb(this.dbName, options));
    };
    LokiDbImpl.prototype.resetDataStore = function () {
        var dfd = Q.defer();
        this.db = null;
        this.dataPersisterInst = LokiDbImpl.createDefaultDataPersister(this, this.dataPersisterFactory);
        dfd.resolve(null);
        return dfd.promise;
    };
    LokiDbImpl.prototype.setDataPersister = function (dataPersisterFactory) {
        var _this = this;
        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersisterInst = dataPersisterFactory(this, function () { return _this.getCollections(); }, function (collName) { return stripMetaData; }, function (collName) { return null; });
    };
    LokiDbImpl.prototype.getDataPersister = function () {
        return this.dataPersisterInst;
    };
    LokiDbImpl.prototype._addHandlePrimaryAndGeneratedKeys = function (collection, dataModel, primaryConstraint, generateOption, docs, dstMetaData) {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return;
        }
        // Generate auto-generated keys if requested before checking unique IDs since the auto-generated keys may be unique IDs
        this.getPrimaryKeyMaintainer().manageKeys(collection.name, docs, generateOption === ModelKeysImpl.Generated.AUTO_GENERATE);
        // Ensure a legacy uniqueId field is present
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
    LokiDbImpl.prototype._findOneOrNull = function (collection, dataModel, query) {
        return this._findNResults(collection, dataModel, 0, 1, query);
    };
    LokiDbImpl.prototype._findNResults = function (collection, dataModel, min, max, query) {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }
        var res = this.find(collection, dataModel, query).data();
        if (res.length < min || res.length > max) {
            throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + "matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
        }
        return max === 1 ? res[0] : res;
    };
    /** Query with multiple criteria
     */
    LokiDbImpl.prototype._findMultiProp = function (resSet, query, queryProps) {
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
    // ======== Database CRUD Operations ========
    LokiDbImpl.prototype.add = function (collection, dataModel, doc, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, [doc], dstMetaData);
    };
    LokiDbImpl.prototype.addAll = function (collection, dataModel, docs, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    };
    LokiDbImpl.prototype.update = function (collection, dataModel, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }
        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    };
    LokiDbImpl.prototype.find = function (collection, dataModel, query, queryProps) {
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
    LokiDbImpl.prototype.findSinglePropQuery = function (collection, dataModel, query, queryProps) {
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
    LokiDbImpl.prototype.remove = function (collection, dataModel, doc, dstMetaData) {
        if (!collection) {
            return;
        }
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }
        collection.isDirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        collection.remove(doc);
    };
    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    LokiDbImpl.prototype.findOne = function (collection, dataModel, query) {
        return this._findNResults(collection, dataModel, 1, 1, query);
    };
    LokiDbImpl.prototype.updateWhere = function (collection, dataModel, query, obj, dstMetaData) {
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
            this.update(collection, dataModel, doc);
        }
    };
    LokiDbImpl.prototype.addOrUpdateWhere = function (collection, dataModel, dataModelFuncs, query, obj, noModify, dstMetaData) {
        var cloneFunc = (dataModelFuncs && dataModelFuncs.copyFunc) || stripMetaDataCloneDeep;
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var results = this._findMultiProp(this.find(collection, dataModel), query);
        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }
        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                compoundDstMetaData.addChangeItemsModified(toUpdate.map(cloneFunc));
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
                this.update(collection, dataModel, doc);
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
            this.add(collection, dataModel, obj, noModify, compoundDstMetaData);
        }
    };
    LokiDbImpl.prototype.removeWhere = function (collection, dataModel, query, dstMetaData) {
        var docs = this.find(collection, dataModel, query).data();
        for (var i = docs.length - 1; i > -1; i--) {
            var doc = docs[i];
            this.remove(collection, dataModel, doc, dstMetaData);
        }
    };
    LokiDbImpl.prototype.addOrUpdateAll = function (collection, dataModel, dataModelFuncs, keyName, updatesArray, noModify, dstMetaData) {
        var cloneFunc = (dataModelFuncs && dataModelFuncs.copyFunc) || stripMetaDataCloneDeep;
        var existingData = this.find(collection, dataModel).data();
        // pluck keys from existing data
        var existingDataKeys = [];
        for (var ii = 0, sizeI = existingData.length; ii < sizeI; ii++) {
            var prop = existingData[ii][keyName];
            existingDataKeys.push(prop);
        }
        var toAdd = [];
        var toUpdate = [];
        for (var i = 0, size = updatesArray.length; i < size; i++) {
            var update = updatesArray[i];
            var idx = existingDataKeys.indexOf(update[keyName]);
            if (idx === -1) {
                toAdd.push(cloneFunc(update));
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
        this.addAll(collection, dataModel, toAdd, noModify, compoundDstMetaData);
        if (compoundDstMetaData && toUpdate.length > 0) {
            compoundDstMetaData.addChangeItemsModified(toUpdate.map(cloneFunc));
        }
        for (var i = 0, size = toUpdate.length; i < size; i++) {
            var item = toUpdate[i];
            var query = {};
            query[keyName] = item[keyName];
            this.updateWhere(collection, dataModel, query, item);
        }
    };
    // Array-like
    LokiDbImpl.prototype.mapReduce = function (collection, dataModel, map, reduce) {
        return collection.mapReduce(map, reduce);
    };
    // ======== Data Collection manipulation ========
    LokiDbImpl.prototype.getCollections = function () {
        return this.db.collections;
    };
    LokiDbImpl.prototype.getCollection = function (collectionName, autoCreate, settings) {
        if (settings === void 0) { settings = {}; }
        autoCreate = true;
        collectionName = collectionName;
        var coll = this.db.getCollection(collectionName);
        if (!coll) {
            if (!autoCreate) {
                return;
            }
            else {
                settings = Objects.assign({ asyncListeners: false }, settings);
                coll = this.db.addCollection(collectionName, settings); // async listeners cause performance issues (2015-1)
                coll.isDirty = true;
            }
        }
        return coll;
    };
    LokiDbImpl.prototype.clearCollection = function (collection, dstMetaData) {
        var coll = typeof collection === "string" ? this.getCollection(collection) : collection;
        if (coll) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }
            coll.isDirty = true;
            coll.clear();
        }
    };
    LokiDbImpl.prototype.removeCollection = function (collection, dstMetaData) {
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
    // ======== event loggers ========
    LokiDbImpl.prototype.dataAdded = function (coll, newDoc, query, dstMetaData) {
        // events not yet implemented
    };
    LokiDbImpl.prototype.dataModified = function (coll, changeDoc, query, dstMetaData) {
        // events not yet implemented
    };
    LokiDbImpl.prototype.dataRemoved = function (coll, removedDoc, query, dstMetaData) {
        // events not yet implemented
    };
    // ======== Utility functions ========
    LokiDbImpl.prototype.stripMetaData = function (obj) {
        return stripMetaData(obj);
    };
    LokiDbImpl.stripMetaData = function (obj) {
        return stripMetaData(obj);
    };
    return LokiDbImpl;
})();
module.exports = LokiDbImpl;
