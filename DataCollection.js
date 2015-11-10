/// <reference path="./definitions/lib/lokijs.d.ts" />
/// <reference path="./in-mem-collections.d.ts" />
var EventListenerListImpl = require("./lib/ts-mortar/events/EventListenerListImpl");
var ChangeTrackersImpl = require("./change-trackers/ChangeTrackersImpl");
/** DataCollection interface
 * Represents an in-mem, synchronous, data collection with unique keys.
 * Provides a collection like (add, remove, update/set) API to make it easy to work with data from an 'InMemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @author TeamworkGuy2
 * @param <E> the type of data stored in this data collection
 * @param <O> the filter/query type, this is normally type {@code E} with all properties optional
 */
var DataCollection = (function () {
    /** Create a new document collection backed by a provided 'InMemDb' instance.
     * @param {String} collectionName: the name of this collection
     * @param dbInst: the 'InMemDb' containing this collection's actual data
     * @param {Boolean} trackChanges: flag to initialize an event handler and change tracker for this collection or not.
     * The event handler allows outside code to add listeners for collection changes (documents added, removed, updated),
     * and the change tracker keeps a maximum size limited FIFO queue of collection changes that have occured
     */
    function DataCollection(collectionName, dbInst, trackChanges) {
        if (trackChanges === void 0) { trackChanges = false; }
        this.dbInst = dbInst;
        this.collectionName = collectionName.toLowerCase();
        this.collection = dbInst._getCollection(collectionName, true);
        this.primaryKeyFieldNames = dbInst.getModelKeys().getUniqueIdNames(collectionName);
        if (trackChanges) {
            this.initializeEventHandler();
        }
    }
    DataCollection.prototype.initializeEventHandler = function () {
        this.changes = new ChangeTrackersImpl.ChangeTracker(16);
        this.eventHandler = new EventListenerListImpl();
    };
    DataCollection.prototype.destroyEventHandler = function () {
        if (this.changes) {
            this.changes = null;
            this.eventHandler.reset();
            this.eventHandler = null;
        }
    };
    DataCollection.prototype.getCollectionEventHandler = function () {
        return this.eventHandler;
    };
    /**
     * @return {String} the name of this collection of data models
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
        return (this.changes != null || secondaryResultInfo != null) ? new ChangeTrackersImpl.CompoundCollectionChange() : null;
    };
    // Crud Operations =========================
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
    DataCollection.prototype._add = function (docs, noModify, dstResultInfo) {
        if (docs == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._addToCollection(this.collection, docs, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
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
    DataCollection.prototype._addAll = function (docs, noModify, dstResultInfo) {
        if (docs == null || docs.length === 0) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._addToCollectionAll(this.collection, docs, noModify, change);
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
        var res = this.dbInst._update(this.collection, doc, change);
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
        var res = this.dbInst._update(this.collection, docs, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Performs a single search operation and returns an array of results
     * @param {Object} query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return {E[]} of objects
     */
    DataCollection.prototype.data = function (query) {
        var queryProps = query ? Object.keys(query) : null;
        if (queryProps && queryProps.length === 1) {
            return this.dbInst._findSinglePropQueryData(this.collection, query, queryProps);
        }
        return this.dbInst._find(this.collection, query, queryProps).data();
    };
    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     */
    DataCollection.prototype.find = function (query) {
        return this.dbInst._find(this.collection, query);
    };
    /** Starts a chained filter operation and returns a search result set which can be further refined
     * @param func: a javascript {@link Array#filter} style function that accepts an object
     * and returns a flag indicating whether the object is a match or not
     */
    DataCollection.prototype.where = function (func) {
        return this.dbInst._find(this.collection).where(func);
    };
    /** Remove a document from this collection.
     */
    DataCollection.prototype.remove = function (doc, dstResultInfo) {
        if (doc == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._remove(this.collection, doc, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    DataCollection.prototype.findOne = function (query) {
        return this.dbInst._findOne(this.collection, query);
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
        var res = this.dbInst._updateWhere(this.collection, query, obj, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in {@link #updateWhere()},
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
        var res = this.dbInst._addOrUpdateWhere(this.collection, query, obj, true, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found, then the object/document is added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    DataCollection.prototype.addOrUpdateWhere = function (query, obj, noModify, dstResultInfo) {
        if (obj == null) {
            return;
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._addOrUpdateWhere(this.collection, query, obj, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Remove documents from this collection that match a given query
     */
    DataCollection.prototype.removeWhere = function (query, dstResultInfo) {
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._removeWhere(this.collection, query, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Queries this collection based on the primary key of each of the input documents,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in {@link #updateWhere()},
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
     * with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found, then the documents are added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    DataCollection.prototype.addOrUpdateAll = function (updatesArray, noModify, dstResultInfo) {
        if (updatesArray == null || updatesArray.length === 0) {
            return;
        }
        var keyNames = this.primaryKeyFieldNames;
        if (keyNames.length !== 1) {
            throw new Error("cannot addOrUpdateAll() on '" + this.collectionName + "' it does not have exactly one primary key, primaryKeys=[" + keyNames + "]");
        }
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._addOrUpdateAll(this.collection, keyNames[0], updatesArray, noModify, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    // Utility methods =========================================
    /** Remove all documents from this collection
     */
    DataCollection.prototype.clearCollection = function (dstResultInfo) {
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._clearCollection(this.collection, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    /** Remove this collection from the database instance
     */
    DataCollection.prototype.deleteCollection = function (dstResultInfo) {
        var change = this.createCollChange(dstResultInfo);
        var res = this.dbInst._removeCollection(this.collection, change);
        this.collChange(change, dstResultInfo);
        return res;
    };
    return DataCollection;
})();
module.exports = DataCollection;
