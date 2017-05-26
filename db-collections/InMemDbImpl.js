"use strict";
var Q = require("q");
var Arrays = require("../../ts-mortar/utils/Arrays");
var Objects = require("../../ts-mortar/utils/Objects");
var ChangeTrackers = require("../change-trackers/ChangeTrackers");
var ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
var PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
var NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
var PermissionedDataPersister = require("./PermissionedDataPersister");
/** An InMemDb implementation that wraps a InMemDbProvider database
 */
var InMemDbImpl = (function () {
    /**
     * @param dbName the name of the in-memory database
     * @param settings permissions for the underlying data persister, this doesn't enable/disable the read/writing to this in-memory database,
     * this only affects the underlying data persister created from the 'dataPersisterFactory'
     * @param storeSettings settings used for the data persister
     * @param cloneType the type of clone operation to use when copying elements
     * @param metaDataCollectionName the name of the collection to store collection meta-data in
     * @param reloadMetaData whether to recalculate meta-data from collections and data models or re-use existing saved meta-data
     * @param modelDefinitions a set of model definitions defining all the models in this data base
     * @param databaseInitializer a function which creates the underlying InMemDbProvider used by this InMemDb
     * @param dataPersisterFactory a factory for creating a data persister
     * @param createCollectionSettingsFunc a function which returns collection initialization settings for a given collection name
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
    // ======== Database CRUD Operations ========
    InMemDbImpl.prototype.data = function (collection, dataModel, query, queryProps) {
        return this._findNResults(collection, dataModel, 0, Infinity, query, queryProps, false, false);
    };
    InMemDbImpl.prototype.find = function (collection, dataModel, query, queryProps) {
        if (query == null || collection.data.length === 0) {
            return collection.chain();
        }
        return this._findMultiProp(collection, query, queryProps);
    };
    InMemDbImpl.prototype.first = function (collection, dataModel, query, queryProps, throwIfNone, throwIfMultiple) {
        return this._findNResults(collection, dataModel, 1, 1, query, queryProps, throwIfNone, throwIfMultiple);
    };
    InMemDbImpl.prototype.add = function (collection, dataModel, doc, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, [doc], dstMetaData);
    };
    InMemDbImpl.prototype.addAll = function (collection, dataModel, docs, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    };
    InMemDbImpl.prototype.addOrUpdateWhere = function (collection, dataModel, dataModelFuncs, query, obj, noModify, dstMetaData) {
        var _this = this;
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var results = this.find(collection, dataModel, query);
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
    InMemDbImpl.prototype.addOrUpdateAll = function (collection, dataModel, dataModelFuncs, keyName, updatesArray, noModify, dstMetaData) {
        var _this = this;
        var cloneFunc = (dataModelFuncs && dataModelFuncs.copyFunc) || (function (obj) { return InMemDbImpl.cloneDeepWithoutMetaData(obj, undefined, _this.cloneFunc); });
        var existingData = this.find(collection, dataModel, null).data();
        // pluck keys from existing data
        var existingDataKeys = [];
        for (var i = 0, size = existingData.length; i < size; i++) {
            var prop = existingData[i][keyName];
            existingDataKeys.push(prop);
        }
        var toAdd = [];
        var toUpdate = [];
        for (var j = 0, sz = updatesArray.length; j < sz; j++) {
            var update = updatesArray[j];
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
    InMemDbImpl.prototype.update = function (collection, dataModel, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }
        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    };
    InMemDbImpl.prototype.updateWhere = function (collection, dataModel, query, obj, dstMetaData) {
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var resData = this._findMultiProp(collection, query).data();
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
    InMemDbImpl.prototype.remove = function (collection, dataModel, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }
        collection.isDirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        collection.remove(doc);
    };
    InMemDbImpl.prototype.removeWhere = function (collection, dataModel, query, dstMetaData) {
        var docs = this.find(collection, dataModel, query).data();
        for (var i = docs.length - 1; i > -1; i--) {
            var doc = docs[i];
            this.remove(collection, dataModel, doc, dstMetaData);
        }
    };
    // Array-like
    InMemDbImpl.prototype.mapReduce = function (collection, dataModel, map, reduce) {
        return collection.mapReduce(map, reduce);
    };
    // ======== query and insert implementations ========
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
    /** Execute a query (including optimizations and additional flags for various use cases)
     * @param collection the collection to query
     * @param dataModel the collection's data model
     * @param min the minimum number of results expected
     * @param max the maximum number of results expected
     * @param query the query to run
     * @param queryProps optional sub-set of query properties from the query
     * @param queryPropLimit a limit on the number of query props to use
     * @param throwIfLess whether to throw an error if less than 'min' results are found by the query
     * @param throwIfMore whether to throw an error if more than 'max' results are found by the query
     */
    InMemDbImpl.prototype._findNResults = function (collection, dataModel, min, max, query, queryProps, throwIfLess, throwIfMore) {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }
        // null query or empty collection
        if (collection.data.length === 0) {
            return max === 1 ? null : [];
        }
        if (query == null) {
            return max === 1 ? collection.data[0] : collection.data;
        }
        // single item lookups are probably based on a strong key, perhaps a primary key, so get the query properties to see if it's a single primary key query
        if (max === 1 && queryProps == null) {
            queryProps = Object.keys(query);
        }
        // search by primary key
        if (queryProps != null && queryProps.length === 1 && collection.constraints.unique[queryProps[0]] != null) {
            return collection.by(queryProps[0], query[queryProps[0]]);
        }
        var res = this._findMultiProp(collection, query, queryProps, max === 1).data();
        if ((throwIfLess && res.length < min) || (throwIfMore && res.length > max)) {
            throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + "matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
        }
        return max === 1 ? res[0] : res;
    };
    InMemDbImpl.prototype._findMultiProp = function (coll, query, queryProps, firstOnly) {
        var results = coll.chain();
        if (!queryProps) {
            for (var prop in query) {
                var localQuery = {};
                localQuery[prop] = query[prop];
                results = results.find(localQuery, firstOnly);
            }
        }
        else {
            for (var i = 0, size = queryProps.length; i < size; i++) {
                var propI = queryProps[i];
                var localQuery = {};
                localQuery[propI] = query[propI];
                results = results.find(localQuery, firstOnly);
            }
        }
        return results;
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
        if (coll != null) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }
            coll.isDirty = true;
            coll.clear();
        }
    };
    InMemDbImpl.prototype.removeCollection = function (collection, dstMetaData) {
        var coll = typeof collection === "string" ? this.db.getCollection(collection) : this.db.getCollection(collection.name);
        if (coll != null) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }
            this.db.removeCollection(coll.name);
        }
    };
    // ======== event loggers ========
    InMemDbImpl.prototype.dataAdded = function (coll, newDocs, query, dstMetaData) {
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
            var permissionedAdapter = new PermissionedDataPersister(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
            return permissionedAdapter;
        });
        return dbDataInst.getDataPersister();
    };
    return InMemDbImpl;
}());
module.exports = InMemDbImpl;
