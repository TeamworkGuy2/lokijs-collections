/// <reference types="q" />
/// <reference path="../../ts-event-handlers-lite/events.d.ts" />
/// <reference path="../../@twg2/ts-twg-ast-codegen/code-types/ast-types.d.ts" />
/// <reference path="../../@twg2/ts-twg-ast-codegen/code-types/model-types.d.ts" />
/// <reference path="../../@twg2/ts-twg-ast-codegen/code-types/utils.d.ts" />
/// <reference path="../change-trackers/collection-changes.d.ts" />

/* mem-collection interfaces - Data storage/retrieval interface, specifically for storing/retrieving strongly typed data models
 */


/** A intermediate interface for empty collections and lokijs Resultset
 * @template E the type of data stored in this result set
 */
interface ResultSetLike<E> {

    /** Finish the result set and return matching data */
    data(): E[];

    /** Filter the result set and return the new result set to allow for further queries */
    find(query?: any, firstOnly?: boolean): ResultSetLike<E>;

    /** set an offset constraint on the result set which causes 'offset' number of results to be skipped from the results returned by 'data()' */
    offset(offset: number): ResultSetLike<E>;

    /** set a limit constraint on the result set which causes the first 'qty' number of results to be returned by 'data()' */
    limit(qty: number): ResultSetLike<E>;

    /** Apply a simple property name sort to the result set */
    simplesort(propname: keyof E & string, isdesc?: boolean): ResultSetLike<E>;

    /** Filter the results set by a function */
    where(func: (doc: E) => boolean): ResultSetLike<E>;
}


/** A lokijs MongoDB style query based on a data model */
type PartialModelRecord<E, T> = {
    [P in keyof E]?: T | E[P];
};

type MemDbQueryLike<E, K> = PartialModelRecord<E, {[Y in keyof MemDbOps]?: any }>;


/** Collection class that handles documents of same type
 * @template E the type of data stored in this collection
 */
interface MemDbCollection<E> {
    // the name of the collection
    name: string;
    // the data held by the collection
    data: (E & MemDbObj)[];
    binaryIndices: {[P in keyof E]: MemDbCollectionIndex }; // user defined indexes
    constraints: {
        unique: {[P in keyof E]: MemDbUniqueIndex<E & MemDbObj> };
        exact: {[P in keyof E]: MemDbExactIndex<E> };
    };
    events: TsEventEmitter<{
        'insert': any[];
        'update': any[];
        'pre-insert': any[];
        'pre-update': any[];
        'error': any[];
        'delete': any[];
        'warning': any[];
    }>;
    dynamicViews: MemDbDynamicView<E>[];
    idIndex: number[]; // index of id
    // in autosave scenarios we will use collection level dirty flags to determine whether save is needed.
    // currently, if any collection is dirty we will autosave the whole database if autosave is configured.
    // defaulting to true since this is called from addCollection and adding a collection should trigger save
    dirty: boolean;
    // private holders for cached data
    cachedIndex: number[] | null;
    cachedBinaryIndex: {[P in keyof E]: MemDbCollectionIndex } | null;
    cachedData: (E & MemDbObj)[] | null;
    // currentMaxId - change manually at your own peril!
    maxId: number;
    // changes are tracked by collection and aggregated by the db
    changes: MemDbCollectionChange[];
    // options
    transactional: boolean;
    cloneObjects: boolean;
    disableChangesApi: boolean;

    setChangesApi: (enabled: boolean) => void;
    getChanges: () => MemDbCollectionChange[];
    flushChanges: () => void;


    /*----------------------------+
    | INDEXING                    |
    +----------------------------*/

    /** Ensure binary index on a certain field */
    ensureIndex(property: keyof E & string, force?: boolean): void;

    ensureUniqueIndex(field: keyof E & string): void;

    /** Ensure all binary indices */
    ensureAllIndexes(force?: boolean): void;

    flagBinaryIndexesDirty(objKeys?: string[] | null): void;

    count(): number;

    /** Rebuild idIndex */
    ensureId(): void;

    /** Rebuild idIndex async with callback - useful for background syncing with a remote server */
    ensureIdAsync(callback: () => void): void;

    /** Each collection maintains a list of DynamicViews associated with it */
    addDynamicView(dv: MemDbDynamicView<E>): MemDbDynamicView<E>;

    removeDynamicView(name: string): MemDbDynamicView<E> | null;

    getDynamicView(name: string): MemDbDynamicView<E> | null;

    /** find and update: pass a filtering function to select elements to be updated
     * and apply the updatefunctino to those elements iteratively
     */
    findAndUpdate(filterFunc: (obj: E) => boolean, updateFunc: (obj: E) => E): void;

    /** insert document method - ensure objects have id and meta properties
     * @param doc the document to be inserted (or an array of objects)
     * @returns document or documents (if passed an array of objects)
     */
    insert(doc: E): E;
    insert(doc: E[]): E[];

    clear(): void;

    /** Update method */
    update(doc: E & MemDbObj): void;

    /** Add object to collection */
    add(obj: E & MemDbObj): (E & MemDbObj) | null;

    removeWhere(query: ((obj: E) => boolean) | MemDbQuery): void;

    removeDataOnly(): void;

    /** delete wrapped */
    remove(doc: E | E[] | number | number[]): E | null;


    /*---------------------+
    | Finding methods     |
    +----------------------*/

    /** Get by Id - faster than other methods because of the searching algorithm */
    get(id: number): E & MemDbObj;
    get(id: number, returnPos: true): [E & MemDbObj, number];
    get(id: number, returnPos?: boolean): (E & MemDbObj) | [E & MemDbObj, number];

    by(field: keyof E): (value: any) => E | null;
    by(field: keyof E, value?: string): E | null;

    /** Chain method, used for beginning a series of chained find() and/or view() operations
     * on a collection.
     */
    chain(): MemDbResultset<E>;

    /** Find one object by index property, by property equal to value */
    findOne(query: MemDbQuery): (E & MemDbObj) | null;

    /** Find method, api is similar to mongodb except for now it only supports one search parameter.
     * for more complex queries use view() and storeView()
     */
    find(query?: MemDbQuery): (E & MemDbObj)[];

    /** Find object by unindexed field by property equal to value,
     * simply iterates and returns the first element matching the query
     */
    findOneUnindexed(prop: string, value: any): (E & MemDbObj) | null;


    /** -------- Transaction methods -------- */

    /** start the transation */
    startTransaction(): void;

    /** commit the transation */
    commit(): void;

    /** roll back the transation */
    rollback(): void;

    // async executor. This is only to enable callbacks at the end of the execution.
    async(func: () => void, callback: () => void): void;

    /** Create view function - filter */
    where(): MemDbResultset<E>;
    where(func: (obj: E) => boolean): (E & MemDbObj)[];


    /* -------- STAGING API -------- */
    /** stages: a map of uniquely identified 'stages', which hold copies of objects to be
     * manipulated without affecting the data in the original collection
     */
    stages: { [id: string]: any };

    /** create a stage and/or retrieve it */
    getStage(name: string): any;

    /** a collection of objects recording the changes applied through a commmitStage */
    commitLog: { timestamp: number; message: any; data: any; }[];

    /** create a copy of an object and insert it into a stage */
    stage(stageName: string, obj: E & MemDbObj): E & MemDbObj;

    /** re-attach all objects to the original collection, so indexes and views can be rebuilt
     * then create a message to be inserted in the commitlog
     */
    commitStage(stageName: string, message: any): void;

    extract<K extends keyof E>(field: K): E[K][];

    max<K extends keyof E>(field: K): E[K];

    min<K extends keyof E>(field: K): E[K];

    maxRecord<K extends keyof E>(field: K): { index: number; value: E[K] | undefined; };

    minRecord<K extends keyof E>(field: K): { index: number; value: E[K] | undefined; };

    extractNumerical<K extends keyof E>(field: K): number[];

    avg<K extends keyof E>(field: K): number;

    stdDev<K extends keyof E>(field: K): number;

    mode<K extends keyof E>(field: K): string | undefined;

    median<K extends keyof E>(field: K): number | undefined;
}


/** DataCollection class
 * Represents an in-mem, synchronous, data collection with unique keys.
 * Provides a collection like API (with add, remove, update/set functions) to make it easy to work with data from a 'MemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @template E the type of data stored in this collection
 * @template K the primary keys/required fields, this is a sub-set of required fields from type 'E'
 */
interface DataCollection<E extends K, K> {

    /** Get the data model associated with this collection */
    getDataModel(): DataCollectionModel<E>;

    /** Get data model helper functions associated with this collection/data model */
    getDataModelFuncs(): DtoFuncs<E>;

    /** Initialize this collection's event handler, subsequent calls to getEventHandler() will return an event handler */
    initializeEventHandler(): void;

    /** Destroy this collection's event handler, subsequent calls to getEventHandler() will return null */
    destroyEventHandler(): void;

    /** Get the (possibly null) event handler for this collection which handles data addition/update/removal events */
    getEventHandler(): Events.ListenerList<Changes.CollectionChange, Changes.ChangeListener> | null;

    /**Get the name of this collection */
    getName(): string;


    // ======== CRUD Operations ========

    /** Performs a single search operation and returns an array of results
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return an array of objects
     */
    data(query?: MemDbQueryLike<E, K>): E[];

    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @returns a result set which can be further queried
     */
    find(query?: MemDbQueryLike<E, K>): ResultSetLike<E>;

    /** Get the first result matching a query, similar to find(), except that only one result is returned
     * @return a single object matching the query specified
     * @throws Error if the 'throwIfNone' or 'throwIfMultiple' flags are set and the query returns no results or more than one result
     */
    first(query: MemDbQueryLike<E, K>, throwIfNone?: boolean, throwIfMultiple?: boolean): E;

    /** Lookup an object by primary key
     * @param value the primary key value to lookup
     * @param throwIfNotFound an optional flag which controls whether an error is throw if no result is found (default: true)
     * @returns matching object
     */
    lookup<P extends keyof K>(value: K[P], throwIfNotFound?: boolean): E;

    /** Get the first result, except that exactly one result is expected (equivalent to first(query, true, true))
     * @returns a single object matching the query specified
     * @throws Error if the query returns no results or more than one result
     */
    single(query: MemDbQueryLike<E, K>): E;

    /** Starts a chained filter operation and returns a search result set which can be further refined
     * @param func: a javascript Array.filter() style function that accepts an object
     * and returns a flag indicating whether the object is a match or not
     */
    where(func: (doc: E) => boolean): ResultSetLike<E>;

    /** Add a document to this collection
     */
    add(docs: E, dstResultInfo?: Changes.CollectionChangeTracker): E;

    /** Add a document to this collection AND do not run any collection actions on the document,
     * such as generating primary keys
     */
    addNoModify(docs: E, dstResultInfo?: Changes.CollectionChangeTracker): E;

    /** Add multiple documents to this collection
     */
    addAll(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): E[];

    /** Add multiple documents to this collection AND do not run any collection actions on the documents,
     * such as generating primary keys
     */
    addAllNoModify(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): E[];

    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the object/document is added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateWhere(query: MemDbQueryLike<E, K>, obj: Partial<E> & K, noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the object/document is added to this collection AND no collection actions
     * are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateWhereNoModify(query: MemDbQueryLike<E, K>, obj: Partial<E> & K, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection based on the primary key of each of the input document,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the documents are added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateAll(updatesArray: (Partial<E> & K)[], noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection based on the primary key of each of the input documents,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found for a given doucment, then the document is added to this collection
     * AND no collection actions are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateAllNoModify(updatesArray: (Partial<E> & K)[], dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Mark an existing document in this collection modified.
     * The document specified must already exist in the collection
     */
    update(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Mark multiple existing documents in this collection modified.
     * The documents specified must all already exist in the collection
     */
    updateAll(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Update documents matching a query with properties from a provided update object
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    updateWhere(query: MemDbQueryLike<E, K>, obj: Partial<E>, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove a document from this collection.
     */
    remove(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove documents from this collection that match a given query
     */
    removeWhere(query: MemDbQueryLike<E, K>, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove all documents from this collection
     */
    clearCollection(dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove this collection from the database instance
     */
    deleteCollection(dstResultInfo?: Changes.CollectionChangeTracker): void;
}

// Work around for DataCollection.ts containing a class named 'DataCollection' and trying to implement this interface
interface _DataCollection<E extends K, K> extends DataCollection<E, K> { }


/** Resultset allows for chainable queries.  Intended to be instanced internally.
 * Collection.find(), Collection.where(), and Collection.chain() instantiate this.
 * Example:
 *   mycollection.chain()
 *     .find({ 'doors' : 4 })
 *     .where(function(obj) { return obj.name === 'Toyota' })
 *     .data();
 * @template E the type of data stored in this result set
 */
interface MemDbResultset<E> {
    /** The collection which this Resultset will query against */
    collection: MemDbCollection<E>;
    searchIsChained: boolean;
    filteredrows: number[]; // technically number[] (e.g. = Object.keys(this.collection.data))
    filterInitialized: boolean;

    /** Override of toJSON to avoid circular references */
    toJSON(): MemDbResultset<E>;

    /** Allows you to limit the number of documents passed to next chain operation.
     *   A resultset copy() is made to avoid altering original resultset.
     * @param qty The number of documents to return.
     * @returns Returns a copy of the resultset, limited by qty, for subsequent chain ops.
     */
    limit(qty: number): MemDbResultset<E>;

    /** Used for skipping 'pos' number of documents in the resultset.
     * @param pos Number of documents to skip; all preceding documents are filtered out.
     * @returns Returns a copy of the resultset, containing docs starting at 'pos' for subsequent chain ops.
     */
    offset(pos: number): MemDbResultset<E>;

    /** To support reuse of resultset in branched query situations.
     * @returns Returns a copy of the resultset (set) but the underlying document references will be the same.
     */
    copy(): MemDbResultset<E>;

    // add branch() as alias of copy()
    branch(): MemDbResultset<E>;

    /** User supplied compare function is provided two documents to compare. (chainable)
     *   Example:
     *     rslt.sort(function(obj1, obj2) {
     *       if (obj1.name === obj2.name) return 0;
     *       if (obj1.name > obj2.name) return 1;
     *       if (obj1.name < obj2.name) return -1;
     *     });
     * @param compareFunc A javascript compare function used for sorting.
     * @returns Reference to this resultset, sorted, for future chain operations.
     */
    sort(compareFunc: (a: E, b: E) => number): MemDbResultset<E>;

    /** Simpler, loose evaluation for user to sort based on a property name. (chainable)
     * @param propname name of property to sort by.
     * @param isdesc (Optional) If true, the property will be sorted in descending order
     * @returns Reference to this resultset, sorted, for future chain operations.
     */
    simplesort(propname: keyof E & string, isdesc?: boolean): MemDbResultset<E>;

    /** helper method for compoundsort(), performing individual object comparisons
     * @param properties array of property names, in order, by which to evaluate sort order
     * @param obj1 first object to compare
     * @param obj2 second object to compare
     * @returns 0, -1, or 1 to designate if identical (sortwise) or which should be first
     */
    compoundeval(properties: (keyof E | [keyof E, boolean])[], obj1: E & MemDbObj, obj2: E & MemDbObj): -1 | 0 | 1;

    /** Allows sorting a resultset based on multiple columns.
     *   Example : rs.compoundsort(['age', 'name']); to sort by age and then name (both ascending)
     *   Example : rs.compoundsort(['age', ['name', true]); to sort by age (ascending) and then by name (descending)
     * @param properties array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns Reference to this resultset, sorted, for future chain operations.
     */
    compoundsort(properties: (keyof E | [keyof E, boolean])[]): MemDbResultset<E>;

    /** oversee the operation of OR'ed query expressions.
     *   OR'ed expression evaluation runs each expression individually against the full collection,
     *   and finally does a set OR on each expression's results.
     *   Each evaluation can utilize a binary index to prevent multiple linear array scans.
     * @param expressionArray array of expressions
     * @returns this resultset for further chain ops.
     */
    findOr(expressionArray: MemDbQuery[]): MemDbResultset<E>;

    /** oversee the operation of AND'ed query expressions.
     *   AND'ed expression evaluation runs each expression progressively against the full collection,
     *   internally utilizing existing chained resultset functionality.
     *   Only the first filter can utilize a binary index.
     * @param expressionArray array of expressions
     * @returns this resultset for further chain ops.
     */
    findAnd(expressionArray: MemDbQuery[]): MemDbResultset<E>;

    /** Used for querying via a mongo-style query object.
     * @param query A mongo-style query object used for filtering current results.
     * @param firstOnly (Optional) Used by collection.findOne()
     * @returns this resultset for further chain ops.
     */
    find(query: MemDbQuery | null | undefined): MemDbResultset<E>;
    find(query: MemDbQuery | null | undefined, firstOnly: true): E & MemDbObj;
    find(query: MemDbQuery | null | undefined, firstOnly?: boolean): (E & MemDbObj) | MemDbResultset<E>;

    /** Used for filtering via a javascript filter function.
     * @param searchFunc A javascript function used for filtering current results by.
     * @returns this resultset for further chain ops.
     */
    where(searchFunc: (obj: E) => boolean): MemDbResultset<E>;

    /** Terminates the chain and returns array of filtered documents
     * @returns Array of documents in the resultset
     */
    data(): (E & MemDbObj)[];

    /** used to run an update operation on all documents currently in the resultset.
     * @param updateFunc User supplied updateFunction(obj) will be executed for each document object.
     * @returns this resultset for further chain ops.
     */
    update<U>(updateFunc: (obj: E) => U): MemDbResultset<U>;

    /** removes all document objects which are currently in resultset from collection (as well as resultset)
     * @returns this (empty) resultset for further chain ops.
     */
    remove(): MemDbResultset<E>;

    /** transform this result set via user supplied mapping functions
     * @param mapFun - this function transforms a single document
     * @returns A new result set transformed from this result set's data using the mapFun
     */
    map<U>(mapFun: (currentValue: E, index: number, array: E[]) => U): MemDbResultset<U>;
}


/** DynamicView class is a versatile 'live' view class which can have filters and sorts applied.
 * Collection.addDynamicView(name) instantiates this DynamicView object and notifies it
 * whenever documents are add/updated/removed so it can remain up-to-date. (chainable)
 * Examples:
 *   var mydv = mycollection.addDynamicView('test');  // default is non-persistent
 *   mydv.applyWhere(function(obj) { return obj.name === 'Toyota'; });
 *   mydv.applyFind({ 'doors' : 4 });
 *   var results = mydv.data();
 * @template E the type of data stored in this dynamic view
 */
interface MemDbDynamicView<E> {
    cachedresultset: MemDbResultset<E> | null;
    /** A reference to the collection to work against */
    collection: MemDbCollection<E>;
    /** keep ordered filter pipeline */
    filterPipeline: ({ type: "find"; val: MemDbQuery } | { type: "where"; val: (obj: E) => boolean })[];
    /** The name of this dynamic view */
    name: string;
    /** (Optional) If true, the results will be copied into an internal array for read efficiency or binding to. */
    persistent: boolean;
    resultdata: E[];
    resultsdirty: boolean;
    resultset: MemDbResultset<E>;
    // sorting member variables - we only support one active search, applied using applySort() or applySimpleSort()
    sortCriteria: [keyof E, boolean][] | null;
    sortDirty: boolean;
    sortFunction: ((a: E, b: E) => number) | null;
    // for now just 1 event for when we rebuilt lazy view
    events: TsEventEmitter<{
        'rebuild': any[];
    }>;

    /** intended for use immediately after deserialization (loading)
     *   This will clear out and reapply filterPipeline ops, recreating the view.
     *   Since where filters do not persist correctly, this method allows
     *   restoring the view to state where user can re-apply those where filters.
     * @param options (Optional) allows specification of 'removeWhereFilters' option
     * @returns This dynamic view for further chained ops.
     */
    rematerialize(options?: { removeWhereFilters?: boolean; }): MemDbDynamicView<E>;

    /** Makes a copy of the internal resultset for branched queries.
     *   Unlike this dynamic view, the branched resultset will not be 'live' updated,
     *   so your branched query should be immediately resolved and not held for future evaluation.
     * @returns A copy of the internal resultset for branched queries.
     */
    branchResultset(): MemDbResultset<E>;

    /** Override of toJSON to avoid circular references */
    toJSON(): MemDbDynamicView<E>;

    /** Used to apply a sort to the dynamic view
     * @param compareFunc a javascript compare function used for sorting
     * @returns this DynamicView object, for further chain ops.
     */
    applySort(compareFunc: ((a: E, b: E) => number) | null): MemDbDynamicView<E>;

    /** Used to specify a property used for view translation.
     * @param propname Name of property by which to sort.
     * @param isdesc (Optional) If true, the sort will be in descending order.
     * @returns this DynamicView object, for further chain ops.
     */
    applySimpleSort(propname: keyof E & string, isdesc?: boolean): MemDbDynamicView<E>;

    /** Allows sorting a resultset based on multiple columns.
     *   Example: dv.applySortCriteria(['age', 'name']); to sort by age and then name (both ascending)
     *   Example: dv.applySortCriteria(['age', ['name', true]); to sort by age (ascending) and then by name (descending)
     *   Example: dv.applySortCriteria(['age', true], ['name', true]); to sort by age (descending) and then by name (descending)
     * @param properties array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns Reference to this DynamicView, sorted, for future chain operations.
     */
    applySortCriteria(criteria: [keyof E, boolean][] | null): MemDbDynamicView<E>;

    /** marks the beginning of a transaction.
     * @returns this DynamicView object, for further chain ops.
     */
    startTransaction(): MemDbDynamicView<E>;

    /** commits a transaction.
     * @returns this DynamicView object, for further chain ops.
     */
    commit(): MemDbDynamicView<E>;

    /** rolls back a transaction.
     * @returns this DynamicView object, for further chain ops.
     */
    rollback(): MemDbDynamicView<E>;

    /** Adds a mongo-style query option to the DynamicView filter pipeline
     * @param query - A mongo-style query object to apply to pipeline
     * @returns this DynamicView object, for further chain ops.
     */
    applyFind(query: MemDbQuery): MemDbDynamicView<E>;

    /** Adds a javascript filter function to the DynamicView filter pipeline
     * @param fun A javascript filter function to apply to pipeline
     * @returns this DynamicView object, for further chain ops.
     */
    applyWhere(fun: (obj: E) => boolean): MemDbDynamicView<E>;

    /** resolves and pending filtering and sorting, then returns document array as result.
     * @returns An array of documents representing the current DynamicView contents.
     */
    data(): E[];

    /** */
    queueSortPhase(): void;

    /** invoked synchronously or asynchronously to perform final sort phase (if needed) */
    performSortPhase(): void;

    /** internal method for (re)evaluating document inclusion.
     *   Called by : collection.insert() and collection.update().
     * @param objIndex - index of document to (re)run through filter pipeline.
     */
    evaluateDocument(objIndex: number): void;

    /** internal function called on collection.delete() */
    removeDocument(objIndex: number): void;
}
