"use strict";
var Q = require("q");
var Arrays = require("../../ts-mortar/utils/Arrays");
var Objects = require("../../ts-mortar/utils/Objects");
var ChangeTrackers = require("../change-trackers/ChangeTrackers");
var ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
var PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
var NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
var PermissionedDataPersister = require("./PermissionedDataPersister");
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
}());
/** An InMemDb implementation that wraps a InMemDbProvider database
 */
var InMemDbImpl = (function () {
    /**
     * @param dbName the name of the in-memory database
     * @param settings permissions for the underlying data persister, this doesn't enable/disable the read/writing to this in-memory database,
     * this only affects the underlying data persister created from teh 'dataPersisterFactory'
     * @param storeSettings settings used for the data persister
     * @param cloneType the type of clone operation to use when copying elements
     * @param metaDataCollectionName the name of the collection to store collection meta-data in
     * @param reloadMetaData whether to recalculate meta-data from collections and data models or re-use existing saved meta-data
     * @param modelDefinitions a set of model definitions defining all the models in this data base
     * @param dataPersisterFactory a factory for creating a data persister
     * @param modelKeysFunc option function to retrieve the property names for a given data model object
     */
    function InMemDbImpl(dbName, settings, storeSettings, cloneType, metaDataCollectionName, reloadMetaData, modelDefinitions, databaseInitializer, dataPersisterFactory, createCollectionSettingsFunc, modelKeysFunc) {
        this.dbName = dbName;
        this.dbInitializer = databaseInitializer;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.metaDataCollectionName = metaDataCollectionName;
        this.reloadMetaData = reloadMetaData;
        this.cloneFunc = cloneType === "for-in-if" ? InMemDbImpl.cloneForInIf :
            (cloneType === "keys-for-if" ? InMemDbImpl.cloneKeysForIf :
                (cloneType === "keys-excluding-for" ? InMemDbImpl.cloneKeysExcludingFor :
                    (cloneType === "clone-delete" ? InMemDbImpl.cloneCloneDelete : null)));
        if (this.cloneFunc == null) {
            throw new Error("cloneType '" + cloneType + "' is not a recognized clone type");
        }
        this.getCreateCollectionSettings = createCollectionSettingsFunc;
        this.getModelObjKeys = modelKeysFunc;
        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersister = InMemDbImpl.createDefaultDataPersister(this, dataPersisterFactory);
    }
    // ======== private methods ========
    InMemDbImpl.prototype.getPrimaryKeyMaintainer = function () {
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataCollectionName, this.reloadMetaData, this, this.modelDefinitions, this.modelKeys);
        }
        return this.primaryKeyMaintainer;
    };
    InMemDbImpl.prototype.getNonNullKeyMaintainer = function () {
        if (this.nonNullKeyMaintainer == null) {
            this.nonNullKeyMaintainer = new NonNullKeyMaintainer(this.modelDefinitions);
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
    InMemDbImpl.prototype.initializeDb = function () {
        this.db = this.dbInitializer(this.dbName);
    };
    InMemDbImpl.prototype.resetDataStore = function () {
        var dfd = Q.defer();
        this.db = null;
        this.dataPersister = InMemDbImpl.createDefaultDataPersister(this, this.dataPersisterFactory);
        dfd.resolve(null);
        return dfd.promise;
    };
    InMemDbImpl.prototype.setDataPersister = function (dataPersisterFactory) {
        var _this = this;
        this.dataPersisterFactory = dataPersisterFactory;
        this.dataPersister = dataPersisterFactory(this, function () { return _this.getCollections(); }, function (collName) { return _this.cloneFunc; }, function (collName) { return null; });
    };
    InMemDbImpl.prototype.getDataPersister = function () {
        return this.dataPersister;
    };
    InMemDbImpl.prototype._addHandlePrimaryAndGeneratedKeys = function (collection, dataModel, primaryConstraint, generateOption, docs, dstMetaData) {
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
    InMemDbImpl.prototype._findOneOrNull = function (collection, dataModel, query) {
        return this._findNResults(collection, dataModel, 0, 1, query);
    };
    InMemDbImpl.prototype._findNResults = function (collection, dataModel, min, max, query) {
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
    // ======== Database CRUD Operations ========
    InMemDbImpl.prototype.add = function (collection, dataModel, doc, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, [doc], dstMetaData);
    };
    InMemDbImpl.prototype.addAll = function (collection, dataModel, docs, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    };
    InMemDbImpl.prototype.update = function (collection, dataModel, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }
        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    };
    InMemDbImpl.prototype.find = function (collection, dataModel, query, queryProps) {
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
    InMemDbImpl.prototype.findSinglePropQuery = function (collection, dataModel, query, queryProps) {
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
    InMemDbImpl.prototype.remove = function (collection, dataModel, doc, dstMetaData) {
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
    InMemDbImpl.prototype.findOne = function (collection, dataModel, query) {
        return this._findNResults(collection, dataModel, 1, 1, query);
    };
    InMemDbImpl.prototype.updateWhere = function (collection, dataModel, query, obj, dstMetaData) {
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var results = this._findMultiProp(collection.chain(), query);
        var resData = results.data();
        if (dstMetaData && resData.length > 0) {
            dstMetaData.addChangeItemsModified(resData.length);
        }
        // get obj props, except the lokijs specific ones
        var updateKeys = this.getModelObjKeys(obj, collection, dataModel);
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
    InMemDbImpl.prototype.addOrUpdateWhere = function (collection, dataModel, dataModelFuncs, query, obj, noModify, dstMetaData) {
        var _this = this;
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var results = this._findMultiProp(this.find(collection, dataModel), query);
        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackers.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }
        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                var cloneFunc = (dataModelFuncs && dataModelFuncs.copyFunc) || (function (obj) { return InMemDbImpl.cloneDeepWithoutMetaData(obj, undefined, _this.cloneFunc); });
                compoundDstMetaData.addChangeItemsModified(toUpdate.map(cloneFunc));
            }
            // get obj props, except the implementation specific ones
            var updateKeys = this.getModelObjKeys(obj, collection, dataModel);
            var updateKeysLen = updateKeys.length;
            //update
            for (var i = 0, size = toUpdate.length; i < size; i++) {
                var doc = toUpdate[i];
                // assign obj props -> doc
                var idx = -1;
                while (++idx < updateKeysLen) {
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
    InMemDbImpl.prototype.removeWhere = function (collection, dataModel, query, dstMetaData) {
        var docs = this.find(collection, dataModel, query).data();
        for (var i = docs.length - 1; i > -1; i--) {
            var doc = docs[i];
            this.remove(collection, dataModel, doc, dstMetaData);
        }
    };
    InMemDbImpl.prototype.addOrUpdateAll = function (collection, dataModel, dataModelFuncs, keyName, updatesArray, noModify, dstMetaData) {
        var _this = this;
        var cloneFunc = (dataModelFuncs && dataModelFuncs.copyFunc) || (function (obj) { return InMemDbImpl.cloneDeepWithoutMetaData(obj, undefined, _this.cloneFunc); });
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
            compoundDstMetaData = new ChangeTrackers.CompoundCollectionChange();
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
    InMemDbImpl.prototype.mapReduce = function (collection, dataModel, map, reduce) {
        return collection.mapReduce(map, reduce);
    };
    // ======== Data Collection manipulation ========
    InMemDbImpl.prototype.getCollections = function () {
        return this.db.listCollections();
    };
    InMemDbImpl.prototype.getCollection = function (collectionName, autoCreate) {
        if (autoCreate === void 0) { autoCreate = true; }
        var coll = this.db.getCollection(collectionName);
        if (!coll) {
            if (!autoCreate) {
                return;
            }
            else {
                var settings = this.getCreateCollectionSettings(collectionName);
                coll = this.db.addCollection(collectionName, settings);
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
    // ======== event loggers ========
    InMemDbImpl.prototype.dataAdded = function (coll, newDoc, query, dstMetaData) {
        // events not yet implemented
    };
    InMemDbImpl.prototype.dataModified = function (coll, changeDoc, query, dstMetaData) {
        // events not yet implemented
    };
    InMemDbImpl.prototype.dataRemoved = function (coll, removedDoc, query, dstMetaData) {
        // events not yet implemented
    };
    // ======== Utility functions ========
    InMemDbImpl.prototype.cloneWithoutMetaData = function (obj, cloneDeep) {
        return this.cloneFunc(obj, cloneDeep);
    };
    InMemDbImpl.cloneForInIf = function (obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? cloneDeep : Objects.clone);
        var copy = {};
        for (var key in obj) {
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    };
    InMemDbImpl.cloneKeysForIf = function (obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? cloneDeep : Objects.clone);
        var copy = {};
        var keys = Object.keys(obj);
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    };
    InMemDbImpl.cloneKeysExcludingFor = function (obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? cloneDeep : Objects.clone);
        var copy = {};
        var keys = Object.keys(obj);
        Arrays.fastRemove(keys, "$loki");
        Arrays.fastRemove(keys, "meta");
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            copy[key] = cloneFunc(obj[key]);
        }
        return copy;
    };
    InMemDbImpl.cloneCloneDelete = function (obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? cloneDeep : Objects.clone);
        var copy = cloneFunc(obj);
        delete copy.$loki;
        delete copy.meta;
        return copy;
    };
    InMemDbImpl.cloneDeepWithoutMetaData = function (obj, cloneDeep, type) {
        if (cloneDeep === void 0) { cloneDeep = Objects.cloneDeep; }
        return type(obj, cloneDeep);
    };
    // ======== private static methods ========
    InMemDbImpl.createDefaultDataPersister = function (dbDataInst, dataPersisterFactory) {
        dbDataInst.setDataPersister(function (dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc) {
            var dataPersister = dataPersisterFactory(dbInst, getDataCollections, getSaveItemTransformFunc, getRestoreItemTransformFunc);
            var persistAdapter = new PermissionedDataPersister(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
            return persistAdapter;
        });
        return dbDataInst.getDataPersister();
    };
    return InMemDbImpl;
}());
module.exports = InMemDbImpl;