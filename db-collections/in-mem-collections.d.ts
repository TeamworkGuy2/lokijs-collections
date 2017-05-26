/// <reference types="q" />
/// <reference path="../../definitions/lokijs/lokijs.d.ts" />
/// <reference path="../../ts-event-handlers-lite/events.d.ts" />
/// <reference path="../../ts-promises/ts-promises.d.ts" />
/// <reference path="../../ts-code-generator/code-types/ast-types.d.ts" />
/// <reference path="../../ts-code-generator/code-types/code-types.d.ts" />
/// <reference path="../../ts-code-generator/code-types/model-types.d.ts" />
/// <reference path="../../ts-code-generator/code-types/utils.d.ts" />
/// <reference path="../change-trackers/collection-changes.d.ts" />

/* lokijs-collection interfaces - Data storage/retrieval interface, specifically for storing/retrieving strongly typed data models
 * @author TeamworkGuy2
 */

interface InMemDbProvider<O> {
    getName(): string;

    addCollection<T>(name: string, options?: O): LokiCollection<T>;

    getCollection<T>(collectionName: string): LokiCollection<T>;

    listCollections(): LokiCollection<any>[];

    removeCollection(collectionName: string): void;
}


interface LokiCollection<E> {
    name: string;
    data: E[];
    isDirty: boolean;

    chain(): ResultSetLike<E>;

    clear(): void;

    find(): E[];
    find(query: any): E[];

    insert(doc: E): E;
    insert(doc: E[]): E[];

    mapReduce<T, U>(mapFunc: (value: E, index: number, array: E[]) => T, reduceFunc: (previousValue: U, currentValue: T, index: number, array: T[]) => U): U;

    remove(doc: E | E[] | number | number[]): E;

    update(doc: E): void;
}


interface ReadWritePermission {
    readAllow: boolean;
    writeAllow: boolean;
}


interface StorageFormatSettings {
    compressLocalStores: boolean;
}


/** An in-memory database interface, containing:
 * - data collections (i.e. tables)
 * - data collection management, including clearing or deleting a data collection
 * - model definitions (i.e. table schemas/meta-data)
 * - a data persister, which manages saving/restoring the database from an outside persistent storage source
 * - functions for all the basic CRUD operations, such as find(), add(), update(), updateWhere(), remove(), and removeWhere()
 */
interface InMemDb extends CollectionManager {

    getModelDefinitions(): ModelDefinitions;

    getModelKeys(): ModelKeys;

    resetDataStore(): Q.IPromise<void>;

    initializeDb(): void;

    setDataPersister(dataPersisterFactory: DataPersister.Factory): void;


    // ======== Add, Remove, Update Operations ========
    /** Query a collection and return the results as an array rather than a result set, allowing for optimizations find might not be able to make
     */
    data<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[]): T[];

    /** Query a collection, find items based on query parameters
     * @param query a Lokijs/MongoDB style query
     * @param queryProps optional list of properties from the query to use.  An optimization and/or way to apply only part of a query
     * @returns a result set of items which match the query
     */
    find<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[]): ResultSetLike<T>;

    /** Query a collection, similar to find(), except that exactly one result is expected
     * @return a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    first<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[], throwIfNone?: boolean, throwIfMultiple?: boolean): T;

    /** Add an object to the specified collection, with optional flag to not modify the model (no constraint checks), and an optional change tracker to log results to */
    add<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, docs: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T;

    addAll<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[];

    // the number of items added and the number modified
    addOrUpdateWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, query: any, obj: Partial<T>, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    addOrUpdateAll<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, keyName: keyof T, updatesArray: Partial<T>[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    update<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, doc: Partial<T> | Partial<T>[], dstMetaData?: Changes.CollectionChangeTracker): void;

    // the number of items modified
    updateWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any, obj: Partial<T>, dstMetaData?: Changes.CollectionChangeTracker): void;

    remove<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, doc: T, dstMetaData?: Changes.CollectionChangeTracker): void;

    removeWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any, dstMetaData?: Changes.CollectionChangeTracker): void;

    // Array-like
    mapReduce<T, U, R>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, map: (value: T, index: number, array: T[]) => U,
        reduce: (previousValue: R, currentValue: U, currentIndex: number, array: U[]) => R): R;

}




/** Collection management */
interface CollectionManager {

    /** Get a list of all available collections */
    getCollections(): LokiCollection<any>[];

    /** Clear all of the data from a specified collection by collection name */
    clearCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker): void;

    /** Remove a collection by name */
    removeCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker): void;

    /** Retrieve a collection by name */
    getCollection(collectionName: string, autoCreate?: boolean): LokiCollection<any>;

    /** Clear all of the data from a specified collection */
    clearCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void;

    /** Remove a collection */
    removeCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void;

}




/** A intermediate interface for empty collections and lokijs Resultset
 * @author TeamworkGuy2
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
    simplesort(propname: string, isdesc?: boolean): ResultSetLike<E>;

    /** Filter the results set by a function */
    where(func: (doc: E) => boolean): ResultSetLike<E>;

}




/** A lokijs MongoDB style query based on a data model */
type LokiQueryLike<E, K> = (Partial<E> & Partial<K>) | Partial<Record<keyof E, { [Y in keyof LokiOps]?: any }>>;




/** DataCollection class
 * Represents an in-mem, synchronous, data collection with unique keys.
 * Provides a collection like API (with add, remove, update/set functions) to make it easy to work with data from an 'InMemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @author TeamworkGuy2
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
    getEventHandler(): Events.ListenerList<Changes.CollectionChange, Changes.ChangeListener>;

    /**Get the name of this collection */
    getName(): string;


    // ======== CRUD Operations ========

    /** Performs a single search operation and returns an array of results
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return an array of objects
     */
    data(query?: LokiQueryLike<E, K>): E[];

    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @returns a result set which can be further queried
     */
    find(query?: LokiQueryLike<E, K>): ResultSetLike<E>;

    /** Get the first result matching a query, similar to find(), except that only one result is returned
     * @return a single object matching the query specified
     * @throws Error if the 'throwIfNone' or 'throwIfMultiple' flags are set and the query returns no results or more than one result
     */
    first(query: LokiQueryLike<E, K>, throwIfNone?: boolean, throwIfMultiple?: boolean): E;

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
    single(query: LokiQueryLike<E, K>): E;

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
    addOrUpdateWhere(query: LokiQueryLike<E, K>, obj: Partial<E> & K, noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the object/document is added to this collection AND no collection actions
     * are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateWhereNoModify(query: LokiQueryLike<E, K>, obj: Partial<E> & K, dstResultInfo?: Changes.CollectionChangeTracker): void;

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
    updateWhere(query: LokiQueryLike<E, K>, obj: Partial<E>, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove a document from this collection.
     */
    remove(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove documents from this collection that match a given query
     */
    removeWhere(query: LokiQueryLike<E, K>, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove all documents from this collection
     */
    clearCollection(dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove this collection from the database instance
     */
    deleteCollection(dstResultInfo?: Changes.CollectionChangeTracker): void;
}
// Work around for DataCollection.ts containing a class named 'DataCollection' and trying to implement this interface
interface _DataCollection<E extends K, K> extends DataCollection<E, K> { }




/** A DataCollection containing syncable DTOs
 * @author TeamworkGuy2
 * @template E the type of data stored in this collection
 * @template K the primary keys/required fields, this is a sub-set of required fields from type 'E'
 * @template S the server data type stored in this collection
 */
interface DtoCollection<E extends K, K, S> extends DataCollection<E, K> {

    /** Get data model helper functions associated with this collection/data model */
    getDataModelFuncs(): DtoAllFuncs<E, S>;
}




/* Adapter interface for persisting/restoring in in-memory database to/from long term* storage, (*longer than browser session or program lifetime)
 * Data persist read/write interface for InMemDb
 * @author TeamworkGuy2
 */
interface DataPersister {

    /** Get a list of collections in this data persister */
    getCollectionNames(): Q.Promise<string[]>;

    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    persist(defaultOptions?: DataPersister.WriteOptions, getCollectionSpecificOptions?: ((collName: string) => DataPersister.WriteOptions)): Q.Promise<DataPersister.PersistResult>;

    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    restore(defaultOptions?: DataPersister.ReadOptions, getCollectionSpecificOptions?: ((collName: string) => DataPersister.ReadOptions)): Q.Promise<DataPersister.RestoreResult>;

    /** Get all data from a specific collection */
    getCollectionRecords(collectionName: string, options?: DataPersister.ReadOptions): Q.Promise<any[]>;

    /** Add data to a specific collection */
    addCollectionRecords(collectionName: string, options: DataPersister.WriteOptions, records: any[], removeExisting?: boolean): Q.Promise<{ size: number; dataSizeBytes: number; }>;

    /** Remove all data from a specific collection */
    clearCollections(collectionNames: string[]): Q.Promise<void>;

    /** Delete all data related this database from persistent storage
     */
    clearPersistentDb(): Q.Promise<void>;
}


declare module DataPersister {

    /** Information about a set of collections */
    interface CollectionData {
        collections: {
            [index: string]: {
                size: number;
                dataSizeBytes: number;
            }
        };
    }


    export interface PersistResult extends CollectionData {
    }


    export interface RestoreResult extends CollectionData {
    }


    export interface ReadOptions {
        decompress?: boolean;
    }


    export interface WriteOptions {
        maxObjectsPerChunk?: number;
        compress?: boolean;
    }


    export interface Factory {
        /**
         * @param dbInst: the in-memory database that the persister pulls data from
         * @param getCollections: returns a list of data collections that contain the data to persist/restore to
         * @param saveItemTransformation: a conversion function to pass items from getDataCollections() through before persisting them
         * @param restoreItemTransformation: a conversion function to pass items through
         * after restoring them and before storing them in getDataCollections()
         */
        (dbInst: InMemDb, getCollections: () => LokiCollection<any>[],
            getSaveItemTransformFunc?: (collName: string) => ((item: any) => any),
            getRestoreItemTransformFunc?: (collName: string) => ((item: any) => any)): DataPersister;
    }

}




/** Retrival/query functions for items in a collection
 * @since 2016-3-11
 */
interface DtoFuncs<E> {
    /** an optional function that copies a model, if none is provided, implementations should fall back on a default clone function */
    copyFunc: (obj: E) => E;
}


/** Conversion functions for items from a local to/from a server collection
 * @since 2016-3-11
 */
interface DtoSvcFuncs<E, S> {
    /** Convert a server data model to a client data model */
    convertToLocalObjectFunc: (item: S) => E;
    /** Convert a client data model to a server data model */
    convertToSvcObjectFunc: (item: E) => S;
}


/** All functions retrival, querying, and conversion of items from a local collection to/from a server collection
 * @since 2016-3-11
 */
interface DtoAllFuncs<E, S> extends DtoFuncs<E>, DtoSvcFuncs<E, S> {
}



/** Represents meta-data about the items in a collection
 * @since 2015-12-15
 */
interface DataCollectionModel<E> {
    /** all the top level property names of the model */
    fieldNames: (keyof E)[];
    /** the names of all the properties which together uniquely represent each model instance */
    primaryKeys: (keyof E)[];
    /** the names of the properties which are auto generated (i.e. auto-increment ID keys) */
    autoGeneratedKeys: (keyof E)[];
}




/** ModelDefinitions - defines a set of data model meta-definitions
 * @author TeamworkGuy2
 */
interface ModelDefinitions {
    /** Default data type attributes, these can be overridden by specifying custom attributes on individual model properties.
     * For example, strings have a default value of 'null', you can change this to an empty string "" by adding a 'defaultValue: ""' attribute to a model property definition:
     * model: {
     *   properties: {
     *     userName: { type: "string", defaultValue: "", toService: "$var$ || \"\"" }
     *   }
     * }
     */
    dataTypes: { [id: string]: ModelDefinitions.DataTypeDefault };
    /** model names in the order they should be read/generated */
    modelNames: string[];
    /** models by name (all the names can be found in 'modelNames') */
    models: { [name: string]: DtoModelNamed };

    /** Add a data model to this set of definitions, the data model is split into two pieces:
     * a model (containing the properties)
     * and a set of functions for working with that model (functions for copying, converting to/from service DTOs, etc.)
     */
    addModel<U, W>(modelName: string, model: DtoModel, modelFuncs?: DtoFuncs<U> | DtoAllFuncs<U, W>): { modelDef: DataCollectionModel<U>, modelFuncs: DtoAllFuncs<U, W> };

    getPrimaryKeyNames(modelName: string): string[];

    getAutoGeneratedKeyNames(modelName: string): string[];

    getFieldNames(modelName: string): string[];

    getCopyFunc(modelName: string): (obj: any) => any;

    getDataModel(modelName: string): DataCollectionModel<any>;

    /** May return null if the model has no associated functions
     */
    getDataModelFuncs(modelName: string): DtoAllFuncs<any, any>;
}


declare module ModelDefinitions {

    /** Default values for a data type
     */
    export interface DataTypeDefault {
        defaultValue?: any;
        toService?: string;
        toLocal?: string;
    }

}



/** ModelKeys - helper for ModelDefinitions
 * For managing the primary and auto-generated keys from data models
 * @author TeamworkGuy2
 */
interface ModelKeys {

    //constructor(modelDefs: ModelDefinitions)

    /** add missing IDs that should be auto-generated
     * @param autoGenKeys: in the format { name: "...", largestKey: 45678 }
     */
    addGeneratedIds(autoGenKeys: { name: string; largestKey: number }[], doc: any): void;

    /** track auto-generated IDs
     * @param autoGenKeys: in the format { name: "...", largestKey: 45678 }
     */
    trackGeneratedIds(autoGenKeys: { name: string; largestKey: number }[], doc: any): void;

    /** Given a query object, check its validity based on these constraints
     */
    validateQuery(collectionName: string, query: any, obj: any): any;


    /** Constrains the value of a field
     */
    //interface Constraint {
    //    public static NON_NULL: Constraint;
    //    public static UNIQUE: Constraint;
    //}


    /** How to handle auto generated fields (i.e. primary keys)
     */
    //interface Generated {
    //    public static AUTO_GENERATE: Generated;
    //    public static PRESERVE_EXISTING: Generated;
    //
    //}
}
