"use strict";
/// <reference path="./in-mem-collections.d.ts" />
var EventListenerList = require("../../ts-event-handlers-lite/EventListenerList");
var ChangeTrackers = require("../change-trackers/ChangeTrackers");
var ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
/** DataCollection class
 * Represents an in-memory, synchronous, data collection with unique keys.
 * Provides a collection like (add, remove, update/set) API to make it easy to work with data from an 'InMemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @author TeamworkGuy2
 * @template E the type of data stored in this data collection
 * @template P the primary keys/required fields, this is normally type 'E' with all but one or two properties optional
 */
var DataCollection = (function () {
    /** Create a new document collection backed by a provided 'InMemDb' instance.
     * @param collectionName: the name of this collection
     * @param dataModel: the data model used to determine primary key constraints, object validity, syncing behavior, etc.
     * @param dataModelFuncs: functions used to manipulate the types of items stored in this collection,
     * currently contains a copy function for creating deep copies of objects stored in this collection
     * @param dbInst: the 'InMemDb' containing this collection's actual data
     * @param trackChanges: flag to initialize an event handler and change tracker for this collection or not.
     * The event handler allows outside code to add listeners for collection changes (documents added, removed, updated),
     * and the change tracker keeps a maximum size limited FIFO queue of collection changes that have occured
     */
    function DataCollection(collectionName, dataModel, dataModelFuncs, dbInst, trackChanges) {
        if (trackChanges === void 0) { trackChanges = false; }
        this.dbInst = dbInst;
        this.collectionName = collectionName;
        this.collection = dbInst.getCollection(collectionName, true);
        this.dataModel = dataModel || {};
        this.dataModelFuncs = dataModelFuncs || {};
        if (trackChanges) {
            this.initializeEventHandler();
        }
    }
    /** Setup the event handler for this collection.
     * NOTE: Must call this before calling getCollectionEventHandler().
     */
    DataCollection.prototype.initializeEventHandler = function () {
        this.changes = new ChangeTrackers.ChangeTracker(16);
        this.eventHandler = new EventListenerList();
    };
    /** Deregister event listeners and destroy the event handler for this collection.
     * NOTE: After calling this method getCollectionEventHandler() will return null
     */
    DataCollection.prototype.destroyEventHandler = function () {
        if (this.changes) {
            this.changes = null;
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
    /**
     * @return the name of this collection of data models
     */
    DataCollection.prototype.getName = function () {
        return this.collectionName;
    };
    DataCollection.prototype.collChange = function (change, secondaryResultInfo) {
        if (this.changes != null) {
            this.changes.addChange(change);
            this.eventHandler.fireEvent(change);
        }
        if (secondaryResultInfo != null) {
            secondaryResultInfo.addChange(change);
        }
    };
    DataCollection.prototype.createCollChange = function (secondaryResultInfo) {
        return (this.changes != null || secondaryResultInfo != null) ? new ChangeTrackers.CompoundCollectionChange() : null;
    };
    DataCollection.prototype._add = function (docs, noModify, dstResultInfo) {
        if (docs == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.add(this.collection, this.dataModel, docs, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    DataCollection.prototype._addAll = function (docs, noModify, dstResultInfo) {
        if (docs == null || docs.length === 0) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.addAll(this.collection, this.dataModel, docs, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    // ======== CRUD Operations ========
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
    /** Mark an existing document in this collection modified.
     * The document specified must already exist in the collection
     */
    DataCollection.prototype.update = function (doc, dstResultInfo) {
        if (doc == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.update(this.collection, this.dataModel, doc, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Mark multiple existing documents in this collection modified.
     * The documents specified must all already exist in the collection
     */
    DataCollection.prototype.updateAll = function (docs, dstResultInfo) {
        if (docs == null || docs.length === 0) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.update(this.collection, this.dataModel, docs, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Performs a single search operation and returns an array of results
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return array of objects matching the query
     */
    DataCollection.prototype.data = function (query) {
        var queryProps = query ? Object.keys(query) : null;
        if (queryProps != null && queryProps.length === 1) {
            return this.dbInst.findSinglePropQuery(this.collection, this.dataModel, query, queryProps);
        }
        return this.dbInst.find(this.collection, this.dataModel, query, queryProps).data();
    };
    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     */
    DataCollection.prototype.find = function (query) {
        return this.dbInst.find(this.collection, this.dataModel, query);
    };
    /** Query a collection, similar to find(), except that exactly one result is expected
     * @return a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    DataCollection.prototype.findOne = function (query) {
        return this.dbInst.findOne(this.collection, this.dataModel, query);
    };
    /** Starts a chained filter operation and returns a search result set which can be further refined
     * @param func: a javascript Array.filter() style function that accepts an object
     * and returns a flag indicating whether the object is a match or not
     */
    DataCollection.prototype.where = function (func) {
        return this.dbInst.find(this.collection, this.dataModel).where(func);
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
        var res = this.dbInst.updateWhere(this.collection, this.dataModel, query, obj, change);
        this.collChange(change, dstResultInfo);
        return res;
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
    /** Remove a document from this collection.
     */
    DataCollection.prototype.remove = function (doc, dstResultInfo) {
        if (doc == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.remove(this.collection, this.dataModel, doc, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Remove documents from this collection that match a given query
     */
    DataCollection.prototype.removeWhere = function (query, dstResultInfo) {
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst.removeWhere(this.collection, this.dataModel, query, change);
        this.collChange(change, dstResultInfo);
        return res;
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
