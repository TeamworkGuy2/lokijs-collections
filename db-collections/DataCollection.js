"use strict";
/// <reference path="./mem-collections.d.ts" />
/// <reference path="./mem-db.d.ts" />
var ListenerList = require("ts-event-handlers-lite/ListenerList");
var ChangeTrackers = require("../change-trackers/ChangeTrackers");
var ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
/** DataCollection class
 * Represents an in-memory, synchronous, data collection with unique keys.
 * Provides a collection API (add, remove, update/set) to make it easy to work with data from a 'MemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @author TeamworkGuy2
 * @template E the type of data stored in this data collection
 * @template K the primary keys/required fields, this is a sub-set of required fields from type 'E'
 */
var DataCollection = /** @class */ (function () {
    /** Create a new document collection backed by a provided 'MemDb' instance.
     * @param name the name of this collection
     * @param dataModel the data model used to determine primary key constraints, object validity, syncing behavior, etc.
     * @param dataModelFuncs functions used to manipulate the types of items stored in this collection,
     * currently contains a copy function for creating deep copies of objects stored in this collection
     * @param dbInst the 'MemDb' containing this collection's actual data
     * @param trackChanges flag to initialize an event handler and change tracker for this collection or not.
     * The event handler allows outside code to add listeners for collection changes (documents added, removed, updated),
     * and the change tracker keeps a maximum size limited FIFO queue of collection changes that have occured
     */
    function DataCollection(name, dataModel, dataModelFuncs, dbInst, trackChanges) {
        if (trackChanges === void 0) { trackChanges = false; }
        this.dbInst = dbInst;
        this.collectionName = name;
        this.collection = dbInst.getCollection(name, true);
        this.changes = null;
        this.eventHandler = null;
        this.dataModel = dataModel || {};
        this.dataModelFuncs = dataModelFuncs || {};
        if (trackChanges) {
            this.initializeEventHandler();
        }
    }
    /**
     * @return the name of this collection of data models
     */
    DataCollection.prototype.getName = function () {
        return this.collectionName;
    };
    /**
     * @return the data model associated with the elements stored in this collection
     */
    DataCollection.prototype.getDataModel = function () {
        return this.dataModel;
    };
    /**
     * @return the data model manipulation functions associated with the elements stored in this collection
     */
    DataCollection.prototype.getDataModelFuncs = function () {
        return this.dataModelFuncs;
    };
    /** Setup the event handler for this collection.
     * NOTE: Must call this before calling getCollectionEventHandler().
     */
    DataCollection.prototype.initializeEventHandler = function () {
        this.changes = new ChangeTrackers.ChangeTracker(16);
        this.eventHandler = new ListenerList();
    };
    /** Deregister event listeners and destroy the event handler for this collection.
     * NOTE: After calling this method getCollectionEventHandler() will return null
     */
    DataCollection.prototype.destroyEventHandler = function () {
        if (this.changes) {
            this.changes = null;
        }
        if (this.eventHandler) {
            this.eventHandler.reset();
            this.eventHandler = null;
        }
    };
    /**
     * @return the event handler for this collection.  Fires events when items in this collection are added, removed, or modified
     * @see #initializeEventHandler()
     * @see #destroyEventHandler()
     */
    DataCollection.prototype.getEventHandler = function () {
        return this.eventHandler;
    };
    // ======== CRUD Operations ========
    /** Performs a single search operation and returns an array of results
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return an array of objects
     */
    DataCollection.prototype.data = function (query) {
        return this.dbInst.data(this.collection, this.dataModel, query);
    };
    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @returns a result set which can be further queried
     */
    DataCollection.prototype.find = function (query) {
        return this.dbInst.find(this.collection, this.dataModel, query);
    };
    /** Get the first result matching a query, similar to find(), except that only one result is returned
     * @return a single object matching the query specified
     * @throws Error if the 'throwIfNone' or 'throwIfMultiple' flags are set and the query returns no results or more than one result
     */
    DataCollection.prototype.first = function (query, throwIfNone, throwIfMultiple) {
        if (throwIfNone === void 0) { throwIfNone = false; }
        if (throwIfMultiple === void 0) { throwIfMultiple = false; }
        return this.dbInst.first(this.collection, this.dataModel, query, null, throwIfNone, throwIfMultiple);
    };
    /** Lookup an object by primary key
     * @param value the primary key value to lookup
     * @param throwIfNotFound an optional flag which controls whether an error is throw if no result is found (default: true)
     * @returns matching object
     */
    DataCollection.prototype.lookup = function (value, throwIfNotFound) {
        if (throwIfNotFound === void 0) { throwIfNotFound = true; }
        var primaryKey = this.dataModel.primaryKeys[0];
        var query = {};
        query[primaryKey] = value;
        return this.dbInst.first(this.collection, this.dataModel, query, [primaryKey], throwIfNotFound);
    };
    /** Get the first result, except that exactly one result is expected (equivalent to first(query, true, true))
     * @returns a single object matching the query specified
     * @throws Error if the query returns no results or more than one result
     */
    DataCollection.prototype.single = function (query) {
        return this.dbInst.first(this.collection, this.dataModel, query, null, true, true);
    };
    /** Starts a chained filter operation and returns a search result set which can be further refined
     * @param func: a javascript Array.filter() style function that accepts an object
     * and returns a flag indicating whether the object is a match or not
     */
    DataCollection.prototype.where = function (func) {
        return this.dbInst.find(this.collection, this.dataModel, null).where(func);
    };
    /** Add a document to this collection
     */
    DataCollection.prototype.add = function (docs, dstResultInfo) {
        return this._add(docs, false, dstResultInfo);
    };
    /** Add a document to this collection AND do not run any collection actions on the document,
     * such as generating primary keys
     */
    DataCollection.prototype.addNoModify = function (docs, dstResultInfo) {
        return this._add(docs, true, dstResultInfo);
    };
    /** Add multiple documents to this collection
     */
    DataCollection.prototype.addAll = function (docs, dstResultInfo) {
        return this._addAll(docs, false, dstResultInfo);
    };
    /** Add multiple documents to this collection AND do not run any collection actions on the documents,
     * such as generating primary keys
     */
    DataCollection.prototype.addAllNoModify = function (docs, dstResultInfo) {
        return this._addAll(docs, true, dstResultInfo);
    };
    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the object/document is added to this collection AND no collection actions
     * are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    DataCollection.prototype.addOrUpdateWhereNoModify = function (query, obj, dstResultInfo) {
        if (obj == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.addOrUpdateWhere(this.collection, this.dataModel, this.dataModelFuncs, query, obj, true, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the object/document is added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    DataCollection.prototype.addOrUpdateWhere = function (query, obj, noModify, dstResultInfo) {
        if (obj == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.addOrUpdateWhere(this.collection, this.dataModel, this.dataModelFuncs, query, obj, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Queries this collection based on the primary key of each of the input documents,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found for a given doucment, then the document is added to this collection
     * AND no collection actions are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    DataCollection.prototype.addOrUpdateAllNoModify = function (updatesArray, dstResultInfo) {
        return this.addOrUpdateAll(updatesArray, true, dstResultInfo);
    };
    /** Queries this collection based on the primary key of each of the input document,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the documents are added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    DataCollection.prototype.addOrUpdateAll = function (updatesArray, noModify, dstResultInfo) {
        if (updatesArray == null || updatesArray.length === 0) {
            return;
        }
        var keyNames = this.dataModel.primaryKeys;
        if (keyNames.length !== 1) {
            throw new Error("cannot addOrUpdateAll() on '" + this.collectionName + "' it does not have exactly one primary key, primaryKeys=[" + keyNames + "]");
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.addOrUpdateAll(this.collection, this.dataModel, this.dataModelFuncs, keyNames[0], updatesArray, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Mark an existing document in this collection modified.
     * The document specified must already exist in the collection
     */
    DataCollection.prototype.update = function (doc, dstResultInfo) {
        if (doc == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        this.dbInst.update(this.collection, this.dataModel, doc, change);
        this.collChange(change, dstResultInfo);
    };
    /** Mark multiple existing documents in this collection modified.
     * The documents specified must all already exist in the collection
     */
    DataCollection.prototype.updateAll = function (docs, dstResultInfo) {
        if (docs == null || docs.length === 0) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        this.dbInst.update(this.collection, this.dataModel, docs, change);
        this.collChange(change, dstResultInfo);
    };
    /** Update documents matching a query with properties from a provided update object
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    DataCollection.prototype.updateWhere = function (query, obj, dstResultInfo) {
        if (obj == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        this.dbInst.updateWhere(this.collection, this.dataModel, query, obj, change);
        this.collChange(change, dstResultInfo);
    };
    /** Remove a document from this collection.
     */
    DataCollection.prototype.remove = function (doc, dstResultInfo) {
        if (doc == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        this.dbInst.remove(this.collection, this.dataModel, doc, change);
        this.collChange(change, dstResultInfo);
    };
    /** Remove documents from this collection that match a given query
     */
    DataCollection.prototype.removeWhere = function (query, dstResultInfo) {
        var change = this.createCollChange(dstResultInfo);
        this.dbInst.removeWhere(this.collection, this.dataModel, query, change);
        this.collChange(change, dstResultInfo);
    };
    /** Remove all documents from this collection
     */
    DataCollection.prototype.clearCollection = function (dstResultInfo) {
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.clearCollection(this.collection, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Remove this collection from the database instance
     */
    DataCollection.prototype.deleteCollection = function (dstResultInfo) {
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.removeCollection(this.collection, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    // ==== helper/implementation methods ====
    DataCollection.prototype.collChange = function (change, secondaryResultInfo) {
        if (change != null) {
            if (this.changes != null && this.eventHandler != null) {
                this.changes.addChange(change);
                this.eventHandler.fireEvent(change);
            }
            if (secondaryResultInfo != null) {
                secondaryResultInfo.addChange(change);
            }
        }
    };
    DataCollection.prototype.createCollChange = function (secondaryResultInfo) {
        return (this.changes != null || secondaryResultInfo != null) ? new ChangeTrackers.CompoundCollectionChange() : null;
    };
    DataCollection.prototype._add = function (docs, noModify, dstResultInfo) {
        if (docs == null) {
            return null;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.add(this.collection, this.dataModel, docs, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    DataCollection.prototype._addAll = function (docs, noModify, dstResultInfo) {
        if (docs == null || docs.length === 0) {
            return [];
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.addAll(this.collection, this.dataModel, docs, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    DataCollection.fromDataModel = function (collectionName, dataModel, dbInst, trackChanges) {
        if (trackChanges === void 0) { trackChanges = false; }
        var model = ModelDefinitionsSet.modelDefToCollectionModelDef(collectionName, dataModel, null);
        var inst = new DataCollection(collectionName, model.modelDef, model.modelFuncs, dbInst, trackChanges);
        return inst;
    };
    DataCollection.fromDtoModel = function (collectionName, dataModel, modelFuncs, dbInst, trackChanges) {
        if (trackChanges === void 0) { trackChanges = false; }
        var model = ModelDefinitionsSet.modelDefToCollectionModelDef(collectionName, dataModel, modelFuncs);
        var inst = new DataCollection(collectionName, model.modelDef, model.modelFuncs, dbInst, trackChanges);
        return inst;
    };
    return DataCollection;
}());
module.exports = DataCollection;
