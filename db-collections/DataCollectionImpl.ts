/// <reference path="../../definitions/lib/lokijs.d.ts" />
/// <reference path="./in-mem-collections.d.ts" />
import EventListenerListImpl = require("../../ts-mortar/events/EventListenerListImpl");
import ChangeTrackersImpl = require("../change-trackers/ChangeTrackersImpl");
import ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");

/** DataCollectionImpl class
 * Represents an in-memory, synchronous, data collection with unique keys.
 * Provides a collection like (add, remove, update/set) API to make it easy to work with data from an 'InMemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @author TeamworkGuy2
 * @param <E> the type of data stored in this data collection
 * @param <O> the filter/query type, this is normally type {@code E} with all most or all properties optional
 */
class DataCollectionImpl<E, O> implements DataCollection<E, O> {
    private collectionName: string;
    private dbInst: InMemDb;
    private collection: LokiCollection<E>;
    //private addCb: (added: E | E[]) => void;
    //private removeCb: (removed: E | E[]) => void;
    //private modifyCb: (modified: E | E[]) => void;
    private changes: ChangeTrackersImpl.ChangeTracker;
    private eventHandler: EventListenerListImpl<Changes.CollectionChange, Changes.ChangeListener>;
    private dataModel: DataCollectionModel<E>;
    private dataModelFuncs: DataCollectionModelFuncs<E>;


    /** Create a new document collection backed by a provided 'InMemDb' instance.
     * @param {string} collectionName: the name of this collection
     * @param dbInst: the 'InMemDb' containing this collection's actual data
     * @param {boolean} trackChanges: flag to initialize an event handler and change tracker for this collection or not.
     * The event handler allows outside code to add listeners for collection changes (documents added, removed, updated),
     * and the change tracker keeps a maximum size limited FIFO queue of collection changes that have occured
     */
    constructor(collectionName: string, dataModel: DataCollectionModel<E>, dataModelFuncs: DataCollectionModelFuncs<E>, dbInst: InMemDb, trackChanges: boolean = false) {
        this.dbInst = dbInst;
        this.collectionName = collectionName;
        this.collection = dbInst.getCollection(collectionName, true);
        this.dataModel = dataModel || <any>{};
        this.dataModelFuncs = dataModelFuncs || <any>{};
        if (trackChanges) {
            this.initializeEventHandler();
        }
    }


    /** Setup the event handler for this collection.
     * NOTE: Must call this before calling {@link #getCollectionEventHandler()}.
     */
    public initializeEventHandler() {
        this.changes = new ChangeTrackersImpl.ChangeTracker(16);
        this.eventHandler = new EventListenerListImpl();
    }


    /** Deregister event listeners and destroy the event handler for this collection.
     * NOTE: After calling this method {@link #getCollectionEventHandler()} will return null
     */
    public destroyEventHandler() {
        if (this.changes) {
            this.changes = null;
            this.eventHandler.reset();
            this.eventHandler = null;
        }
    }


    /**
     * @return the event handler for this collection.  Fires events when items in this collection are added, removed, or modified
     * @see #initializeEventHandler()
     * @see #destroyEventHandler()
     */
    public getCollectionEventHandler() {
        return this.eventHandler;
    }


    /**
     * @return the data model associated with the elements stored in this collection
     */
    public getDataModel() {
        return this.dataModel;
    }


    /**
     * @return the data model manipulation functions associated with the elements stored in this collection
     */
    public getDataModelFuncs() {
        return this.dataModelFuncs;
    }


    /**
     * @return {string} the name of this collection of data models
     */
    public getName(): string {
        return this.collectionName;
    }


    private collChange(change: Changes.CollectionChange, secondaryResultInfo?: Changes.CollectionChangeTracker) {
        if (this.changes != null) {
            this.changes.addChange(change);
            this.eventHandler.fireEvent(change);
        }
        if (secondaryResultInfo != null) {
            secondaryResultInfo.addChange(change);
        }
    }


    private createCollChange(secondaryResultInfo?: Changes.CollectionChangeTracker): ChangeTrackersImpl.CompoundCollectionChange {
        return (this.changes != null || secondaryResultInfo != null) ? new ChangeTrackersImpl.CompoundCollectionChange() : null;
    }


    private _add(docs: E, noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker) {
        if (docs == null) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.add(this.collection, this.dataModel, docs, noModify, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    private _addAll(docs: E[], noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker) {
        if (docs == null || docs.length === 0) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.addAll(this.collection, this.dataModel, docs, noModify, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    // ======== CRUD Operations ========
    /** Add a document to this collection
     */
    public add(docs: E, dstResultInfo?: Changes.CollectionChangeTracker): E {
        return this._add(docs, false, dstResultInfo);
    }


    /** Add a document to this collection AND do not run any collection actions on the document,
     * such as generating primary keys
     */
    public addNoModify(docs: E, dstResultInfo?: Changes.CollectionChangeTracker): E {
        return this._add(docs, true, dstResultInfo);
    }


    /** Add multiple documents to this collection
     */
    public addAll(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): void {
        return this._addAll(docs, false, dstResultInfo);
    }


    /** Add multiple documents to this collection AND do not run any collection actions on the documents,
     * such as generating primary keys
     */
    public addAllNoModify(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): void {
        return this._addAll(docs, true, dstResultInfo);
    }


    /** Mark an existing document in this collection modified.
     * The document specified must already exist in the collection
     */
    public update(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void {
        if (doc == null) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.update(this.collection, this.dataModel, doc, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Mark multiple existing documents in this collection modified.
     * The documents specified must all already exist in the collection
     */
    public updateAll(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): void {
        if (docs == null || docs.length === 0) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.update(this.collection, this.dataModel, docs, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Performs a single search operation and returns an array of results
     * @param {Object} query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return {E[]} of objects
     */
    public data(query?: O): E[] {
        var queryProps = query ? Object.keys(query) : null;
        if (queryProps && queryProps.length === 1) {
            return this.dbInst.findSinglePropQuery(this.collection, this.dataModel, query, queryProps);
        }
        return this.dbInst.find(this.collection, this.dataModel, query, queryProps).data();
    }


    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     */
    public find(query?: O): ResultSetLike<E> {
        return this.dbInst.find(this.collection, this.dataModel, query);
    }


    /** Starts a chained filter operation and returns a search result set which can be further refined
     * @param func: a javascript {@link Array#filter} style function that accepts an object
     * and returns a flag indicating whether the object is a match or not
     */
    public where(func: (doc: E) => boolean): ResultSetLike<E> {
        return this.dbInst.find(this.collection, this.dataModel).where(func);
    }


    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    public findOne(query: O): E {
        return this.dbInst.findOne(this.collection, this.dataModel, query);
    }


    /** Update documents matching a query with properties from a provided update object
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    public updateWhere(query: O, obj: O, dstResultInfo?: Changes.CollectionChangeTracker): void {
        if (obj == null) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.updateWhere(this.collection, this.dataModel, query, obj, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found, then the object/document is added to this collection AND no collection actions
     * are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    public addOrUpdateWhereNoModify(query: O, obj: E, dstResultInfo?: Changes.CollectionChangeTracker): void {
        if (obj == null) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.addOrUpdateWhere(this.collection, this.dataModel, this.dataModelFuncs, query, obj, true, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found, then the object/document is added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    public addOrUpdateWhere(query: O, obj: E, noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker): void {
        if (obj == null) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.addOrUpdateWhere(this.collection, this.dataModel, this.dataModelFuncs, query, obj, noModify, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Queries this collection based on the primary key of each of the input documents,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found for a given doucment, then the document is added to this collection
     * AND no collection actions are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    public addOrUpdateAllNoModify(updatesArray: E[], dstResultInfo?: Changes.CollectionChangeTracker): void {
        return this.addOrUpdateAll(updatesArray, true, dstResultInfo);
    }


    /** Queries this collection based on the primary key of each of the input document,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found, then the documents are added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    public addOrUpdateAll(updatesArray: E[], noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker): void {
        if (updatesArray == null || updatesArray.length === 0) { return; }
        var keyNames = this.dataModel.primaryKeys;

        if (keyNames.length !== 1) {
            throw new Error("cannot addOrUpdateAll() on '" + this.collectionName + "' it does not have exactly one primary key, primaryKeys=[" + keyNames + "]");
        }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.addOrUpdateAll(this.collection, this.dataModel, this.dataModelFuncs, keyNames[0], updatesArray, noModify, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Remove a document from this collection.
     */
    public remove(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void {
        if (doc == null) { return; }

        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.remove(this.collection, this.dataModel, doc, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Remove documents from this collection that match a given query
     */
    public removeWhere(query: O, dstResultInfo?: Changes.CollectionChangeTracker): void {
        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.removeWhere(this.collection, this.dataModel, query, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Remove all documents from this collection
     */
    public clearCollection(dstResultInfo?: Changes.CollectionChangeTracker): void {
        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.clearCollection(this.collection, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    /** Remove this collection from the database instance
     */
    public deleteCollection(dstResultInfo?: Changes.CollectionChangeTracker): void {
        var change = this.createCollChange(dstResultInfo);

        var res = this.dbInst.removeCollection(this.collection, change);

        this.collChange(change, dstResultInfo);
        return res;
    }


    public static fromWebServiceModel<U, V, W>(collectionName: string, dataModel: DtoModel | DtoCollectionModel<U> | DtoCollectionSvcModel<U, W>, dbInst: InMemDb, trackChanges: boolean = false) {
        var model = ModelDefinitionsSet.modelDefToCollectionModelDef(collectionName, dataModel);
        var inst = new DataCollectionImpl<U, V>(collectionName, model.modelDef, model.modelFuncs, dbInst, trackChanges);
        return inst;
    }

}

export = DataCollectionImpl;
