"use strict";
var Arrays = require("ts-mortar/utils/Arrays");
var Objects = require("ts-mortar/utils/Objects");
var ChangeTrackers = require("../change-trackers/ChangeTrackers");
var ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
var PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");
var NonNullKeyMaintainer = require("../key-constraints/NonNullKeyMaintainer");
var Collection = require("./Collection");
var EventEmitter = require("./TsEventEmitter");
/** A MemDb implementation that wraps a MemDbProvider database
 */
var MemDbImpl = /** @class */ (function () {
    /** Create an in-memory database instance using the following parameters.
     * @param dbName the name of the in-memory database
     * @param settings permissions for the underlying data persister, this doesn't enable/disable the read/writing to this in-memory database,
     * this only affects the underlying data persister created from the 'dataPersisterFactory'
     * @param storeSettings settings used for the data persister
     * @param cloneType the type of clone operation to use when copying elements
     * @param metaDataCollectionName the name of the collection to store collection meta-data in
     * @param reloadMetaData whether to recalculate meta-data from collections and data models or re-use existing saved meta-data
     * @param modelDefinitions a set of model definitions defining all the models in this data base
     * @param databaseInitializer a function which creates the underlying MemDbProvider used by this MemDb
     * @param dataPersisterFactory a factory for creating a data persister
     * @param createCollectionSettingsFunc a function which returns collection initialization settings for a given collection name
     * @param modelKeysFunc option function to retrieve the property names for a given data model object
     */
    function MemDbImpl(dbName, options, cloneType, metaDataCollectionName, reloadMetaData, modelDefinitions, createCollectionSettingsFunc, modelKeysFunc) {
        var _this = this;
        this.changeTracker = null;
        this.nonNullKeyMaintainer = null;
        this.primaryKeyMaintainer = null;
        this.name = dbName;
        this.collections = [];
        this.databaseVersion = 1.2; // persist version of code which created the database
        this.settings = options;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.metaDataCollectionName = metaDataCollectionName;
        this.reloadMetaData = reloadMetaData;
        this.cloneFunc = (cloneType === "for-in-if" ? MemDbImpl.cloneForInIf :
            (cloneType === "keys-for-if" ? MemDbImpl.cloneKeysForIf :
                (cloneType === "keys-excluding-for" ? MemDbImpl.cloneKeysExcludingFor :
                    (cloneType === "clone-delete" ? MemDbImpl.cloneCloneDelete : null))));
        if (this.cloneFunc == null) {
            throw new Error("cloneType '" + cloneType + "' is not a recognized clone type");
        }
        this.getCreateCollectionSettings = createCollectionSettingsFunc;
        this.getModelObjKeys = modelKeysFunc;
        this.events = new EventEmitter({
            "init": [],
            "flushChanges": [],
            "close": [],
            "changes": [],
            "warning": []
        });
        function getEnvironment() {
            if (typeof window === "undefined") {
                return "NODEJS";
            }
            if (typeof global !== "undefined" && global["window"]) {
                return "NODEJS"; //node-webkit
            }
            if (typeof document !== "undefined") {
                if (document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
                    return "CORDOVA";
                }
                return "BROWSER";
            }
            return "CORDOVA";
        }
        // if no options.env provided, detect environment (browser vs node vs cordova).
        // two properties used for similar thing (options.env and options.persistenceMethod)
        //   might want to review whether we can consolidate.
        if (options && options.env != null) {
            this.environment = options.env;
        }
        else {
            this.environment = getEnvironment();
        }
        this.events.on("init", function () { if (_this.changeTracker != null)
            _this.changeTracker.clearChanges(); });
    }
    MemDbImpl.prototype.getName = function () {
        return this.name;
    };
    // ======== Data Collection manipulation ========
    MemDbImpl.prototype.listCollections = function () {
        return this.collections;
    };
    MemDbImpl.prototype.getCollection = function (collectionName, autoCreate) {
        if (autoCreate === void 0) { autoCreate = true; }
        var coll = null;
        for (var i = 0, len = this.collections.length; i < len; i++) {
            if (this.collections[i].name === collectionName) {
                coll = this.collections[i];
            }
        }
        if (coll == null) {
            if (!autoCreate) {
                // no such collection
                this.events.emit("warning", "collection " + collectionName + " not found");
                return null;
            }
            else {
                var settings = this.getCreateCollectionSettings != null ? this.getCreateCollectionSettings(collectionName) : null;
                coll = this.addCollection(collectionName, settings);
                coll.dirty = true;
            }
        }
        return coll;
    };
    MemDbImpl.prototype.addCollection = function (name, options) {
        var collection = new Collection(name, options);
        this.collections.push(collection);
        return collection;
    };
    MemDbImpl.prototype.loadCollection = function (collection) {
        if (!collection.name) {
            throw new Error("Collection must be have a name property to be loaded");
        }
        this.collections.push(collection);
    };
    MemDbImpl.prototype.clearCollection = function (collection, dstMetaData) {
        var coll = typeof collection === "string" ? this.getCollection(collection) : collection;
        if (coll != null) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }
            coll.dirty = true;
            coll.clear();
        }
    };
    MemDbImpl.prototype.removeCollection = function (collection, dstMetaData) {
        var coll = typeof collection === "string" ? this.getCollection(collection, false) : collection;
        if (coll != null) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(coll.data.length);
            }
            for (var i = 0, len = this.collections.length; i < len; i++) {
                if (this.collections[i].name === coll.name) {
                    this.collections.splice(i, 1);
                    break;
                }
            }
        }
    };
    // ==== Meta-data Getters/Setters ====
    MemDbImpl.prototype.getModelDefinitions = function () {
        return this.modelDefinitions;
    };
    MemDbImpl.prototype.getModelKeys = function () {
        return this.modelKeys;
    };
    // ======== Database CRUD Operations ========
    MemDbImpl.prototype.data = function (collection, dataModel, query, queryProps) {
        return this._findNResults(collection, dataModel, 0, Infinity, query, queryProps, false, false);
    };
    MemDbImpl.prototype.find = function (collection, dataModel, query, queryProps) {
        if (query == null || collection.data.length === 0) {
            return collection.chain();
        }
        return this._findMultiProp(collection, query, queryProps);
    };
    MemDbImpl.prototype.first = function (collection, dataModel, query, queryProps, throwIfNone, throwIfMultiple) {
        return this._findNResults(collection, dataModel, 1, 1, query, queryProps, throwIfNone, throwIfMultiple);
    };
    MemDbImpl.prototype.add = function (collection, dataModel, doc, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, [doc], dstMetaData);
    };
    MemDbImpl.prototype.addAll = function (collection, dataModel, docs, noModify, dstMetaData) {
        return this._addHandlePrimaryAndGeneratedKeys(collection, dataModel, ModelKeysImpl.Constraint.NON_NULL, noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    };
    MemDbImpl.prototype.addOrUpdateWhere = function (collection, dataModel, dataModelFuncs, query, obj, noModify, dstMetaData) {
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
                var cloneFunc = (dataModelFuncs && dataModelFuncs.copyFunc) || (function (obj) { return MemDbImpl.cloneDeepWithoutMetaData(obj, undefined, _this.cloneFunc); });
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
    MemDbImpl.prototype.addOrUpdateAll = function (collection, dataModel, dataModelFuncs, keyName, updatesArray, noModify, dstMetaData) {
        var _this = this;
        var cloneFunc = (dataModelFuncs && dataModelFuncs.copyFunc) || (function (obj) { return MemDbImpl.cloneDeepWithoutMetaData(obj, undefined, _this.cloneFunc); });
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
    MemDbImpl.prototype.update = function (collection, dataModel, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }
        collection.dirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    };
    MemDbImpl.prototype.updateWhere = function (collection, dataModel, query, obj, dstMetaData) {
        query = this.modelKeys.validateQuery(collection.name, query, obj);
        var resData = this._findMultiProp(collection, query).data();
        if (dstMetaData && resData.length > 0) {
            dstMetaData.addChangeItemsModified(resData.length);
        }
        // get obj props, except the MemDb specific ones
        var updateKeys = this.getModelObjKeys(obj, collection, dataModel);
        var updateKeysLen = updateKeys.length;
        for (var i = 0, size = resData.length; i < size; i++) {
            var doc = resData[i];
            // assign obj props -> doc
            var idx = -1;
            while (++idx < updateKeysLen) {
                var key = updateKeys[idx];
                doc[key] = obj[key];
            }
            this.update(collection, dataModel, doc);
        }
    };
    MemDbImpl.prototype.remove = function (collection, dataModel, doc, dstMetaData) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }
        collection.dirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        collection.remove(doc);
    };
    MemDbImpl.prototype.removeWhere = function (collection, dataModel, query, dstMetaData) {
        var docs = this.find(collection, dataModel, query).data();
        for (var i = docs.length - 1; i > -1; i--) {
            var doc = docs[i];
            this.remove(collection, dataModel, doc, dstMetaData);
        }
    };
    // ======== query and insert implementations ========
    MemDbImpl.prototype._addHandlePrimaryAndGeneratedKeys = function (collection, dataModel, primaryConstraint, generateOption, docs, dstMetaData) {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return null;
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
        collection.dirty = true;
        this.dataAdded(collection, docs, null, dstMetaData);
        return collection.insert(docs);
    };
    // ======== private methods ========
    MemDbImpl.prototype.getPrimaryKeyMaintainer = function () {
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataCollectionName, this.reloadMetaData, this, this.modelDefinitions, this.modelKeys);
        }
        return this.primaryKeyMaintainer;
    };
    MemDbImpl.prototype.getNonNullKeyMaintainer = function () {
        if (this.nonNullKeyMaintainer == null) {
            this.nonNullKeyMaintainer = new NonNullKeyMaintainer(this.modelDefinitions);
        }
        return this.nonNullKeyMaintainer;
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
    MemDbImpl.prototype._findNResults = function (collection, dataModel, min, max, query, queryProps, throwIfLess, throwIfMore) {
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
            var queryValue = query[queryProps[0]];
            if (queryValue == null) {
                return null;
            }
            var itm = collection.by(queryProps[0], queryValue);
            if (throwIfLess && itm == null) {
                throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + " matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found 0 results");
            }
            return itm;
        }
        // search by regular multi-property query
        else {
            var res = this._findMultiProp(collection, query, queryProps, max === 1).data();
            if ((throwIfLess && res.length < min) || (throwIfMore && res.length > max)) {
                throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + " matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
            }
            return max === 1 ? res[0] : res;
        }
    };
    MemDbImpl.prototype._findMultiProp = function (coll, query, queryProps, firstOnly) {
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
    // ======== event loggers ========
    MemDbImpl.prototype.dataAdded = function (coll, newDocs, query, dstMetaData) {
        // events not yet implemented
    };
    MemDbImpl.prototype.dataModified = function (coll, changeDoc, query, dstMetaData) {
        // events not yet implemented
    };
    MemDbImpl.prototype.dataRemoved = function (coll, removedDoc, query, dstMetaData) {
        // events not yet implemented
    };
    // ======== Utility functions ========
    MemDbImpl.prototype.cloneWithoutMetaData = function (obj, cloneDeep) {
        return this.cloneFunc(obj, cloneDeep);
    };
    MemDbImpl.cloneForInIf = function (obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? cloneDeep : Objects.clone);
        var copy = {};
        for (var key in obj) {
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    };
    MemDbImpl.cloneKeysForIf = function (obj, cloneDeep) {
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
    MemDbImpl.cloneKeysExcludingFor = function (obj, cloneDeep) {
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
    MemDbImpl.cloneCloneDelete = function (obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? cloneDeep : Objects.clone);
        var copy = cloneFunc(obj);
        delete copy.$loki;
        delete copy.meta;
        return copy;
    };
    MemDbImpl.cloneDeepWithoutMetaData = function (obj, cloneDeep, type) {
        if (cloneDeep === void 0) { cloneDeep = Objects.cloneDeep; }
        return type(obj, cloneDeep);
    };
    return MemDbImpl;
}());
/**-------------------------+
| Changes API               |
+--------------------------*/
/** The Changes API enables the tracking the changes occurred in the collections since the beginning of the session,
 * so it's possible to create a differential dataset for synchronization purposes (possibly to a remote db)
 */
var DbChanges = /** @class */ (function () {
    function DbChanges(getCollections) {
        this.getCollections = getCollections;
    }
    /** takes all the changes stored in each
     * collection and creates a single array for the entire database. If an array of names
     * of collections is passed then only the included collections will be tracked.
     *
     * @param collectionNames optional array of collection names. null returns changes for all collections.
     * @returns array of changes
     * @see private method createChange() in Collection
     */
    DbChanges.prototype.generateChangesNotification = function (collectionNames) {
        var changes = [];
        this.getCollections().forEach(function (coll) {
            if (collectionNames == null || collectionNames.indexOf(coll.name) !== -1) {
                changes = changes.concat(coll.getChanges());
            }
        });
        return changes;
    };
    /** stringify changes for network transmission
     * @param collectionNames optional array of collection names. null returns serialized changes for all collections.
     * @returns string representation of the changes
     */
    DbChanges.prototype.serializeChanges = function (collectionNames) {
        return JSON.stringify(this.generateChangesNotification(collectionNames));
    };
    /** clears all the changes in all collections.
     */
    DbChanges.prototype.clearChanges = function () {
        this.getCollections().forEach(function (coll) {
            if (coll.flushChanges) {
                coll.flushChanges();
            }
        });
    };
    return DbChanges;
}());
module.exports = MemDbImpl;
