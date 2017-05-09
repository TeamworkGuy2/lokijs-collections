﻿/// <reference types="q" />
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

    mapReduce<T, U>(mapFunction: (value: E, index: number, array: E[]) => T, reduceFunction: (previousValue: U, currentValue: T, index: number, array: T[]) => U): U;

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
interface InMemDb {

    getModelDefinitions(): ModelDefinitions;

    getModelKeys(): ModelKeys;

    resetDataStore(): Q.IPromise<void>;

    initializeDb(): void;

    setDataPersister(dataPersisterFactory: DataPersister.Factory): void;


    // ======== Add, Remove, Update Operations ========
    /** Query a collection, similar to find(), except that exactly one result is expected
     * @return a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    findOne<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any);

    find<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query?: any, queryProps?: string[]): ResultSetLike<T>;

    findSinglePropQuery<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query?: any, queryProps?: string[]): T[];

    add<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, docs: any, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T;

    addAll<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker);

    // the number of items added and the number modified
    addOrUpdateWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, query: any, obj: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    addOrUpdateAll<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, keyName: string, updatesArray: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    update<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, doc: any, dstMetaData?: Changes.CollectionChangeTracker);

    // the number of items modified
    updateWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any, obj: any, dstMetaData?: Changes.CollectionChangeTracker): void;

    remove<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, doc: T, dstMetaData?: Changes.CollectionChangeTracker): void;

    removeWhere<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, query: any, dstMetaData?: Changes.CollectionChangeTracker): void;

    // Array-like
    mapReduce<T>(collection: LokiCollection<T>, dataModel: DataCollectionModel<T>, map: (value: T, index: number, array: T[]) => any,
        reduce: (previousValue, currentValue, currentIndex: number, array: any[]) => any);


    // ======== Collection manipulation ========
    getCollections(): LokiCollection<any>[];

    clearCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker): void;

    removeCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker): void;

    getCollection(collectionName: string, autoCreate?: boolean): LokiCollection<any>;

    clearCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker);

    removeCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void;

}




/** A intermediate interface for empty collections and lokijs Resultset
 * @author TeamworkGuy2
 */
interface ResultSetLike<E> {

    data(): E[];

    find(query?, firstOnly?): ResultSetLike<E>;

    offset(index: number): ResultSetLike<E>;

    limit(qty: number): ResultSetLike<E>;

    simplesort(propname, isdesc?: boolean): ResultSetLike<E>;

    where(func: (doc: E) => boolean): ResultSetLike<E>;

}




/** DataCollection class
 * Represents an in-mem, synchronous, data collection with unique keys.
 * Provides a collection like API (with add, remove, update/set functions) to make it easy to work with data from an 'InMemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @author TeamworkGuy2
 * @template E the type of data stored in this collection
 * @template O the filter/query type, this is normally type 'E' with all properties optional
 */
interface DataCollection<E, O> {

    initializeEventHandler(): void;

    getDataModel(): DataCollectionModel<E>;

    getDataModelFuncs(): DtoFuncs<E>;

    destroyEventHandler(): void;

    getEventHandler(): Events.ListenerList<Changes.CollectionChange, Changes.ChangeListener>;

    /**
     * @return the name of this collection of data models
     */
    getName(): string;

    // ======== CRUD Operations ========
    /** Add a document to this collection
     */
    add(docs: E, dstResultInfo?: Changes.CollectionChangeTracker): E;

    /** Add a document to this collection AND do not run any collection actions on the document,
     * such as generating primary keys
     */
    addNoModify(docs: E, dstResultInfo?: Changes.CollectionChangeTracker): E;

    /** Add multiple documents to this collection
     */
    addAll(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Add multiple documents to this collection AND do not run any collection actions on the documents,
     * such as generating primary keys
     */
    addAllNoModify(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Mark an existing document in this collection modified.
     * The document specified must already exist in the collection
     */
    update(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Mark multiple existing documents in this collection modified.
     * The documents specified must all already exist in the collection
     */
    updateAll(docs: E[], dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Performs a single search operation and returns an array of results
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return of objects
     */
    data(query?: O): E[];

    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     */
    find(query?: O): ResultSetLike<E>;

    /** Starts a chained filter operation and returns a search result set which can be further refined
     * @param func: a javascript Array.filter() style function that accepts an object
     * and returns a flag indicating whether the object is a match or not
     */
    where(func: (doc: E) => boolean): ResultSetLike<E>;

    /** Remove a document from this collection.
     */
    remove(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Query a collection, similar to find(), except that exactly one result is expected
     * @return a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    findOne(query: O): E;

    /** Update documents matching a query with properties from a provided update object
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    updateWhere(query: O, obj: O, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the object/document is added to this collection AND no collection actions
     * are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateWhereNoModify(query: O, obj: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the object/document is added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateWhere(query: O, obj: E, noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove documents from this collection that match a given query
     */
    removeWhere(query: O, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection based on the primary key of each of the input documents,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found for a given doucment, then the document is added to this collection
     * AND no collection actions are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateAllNoModify(updatesArray: E[], dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection based on the primary key of each of the input document,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in updateWhere(),
     * if not matches are found, then the documents are added to this collection.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateAll(updatesArray: E[], noModify?: boolean, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove all documents from this collection
     */
    clearCollection(dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Remove this collection from the database instance
     */
    deleteCollection(dstResultInfo?: Changes.CollectionChangeTracker): void;
}
// Work around for DataCollection.ts containing a class named 'DataCollection' and trying to implement this interface
interface _DataCollection<E, O> extends DataCollection<E, O> { }




/** A DataCollection containing syncable DTOs
 * @author TeamworkGuy2
 * @template E the type of data stored in this collection
 * @template F the filter/query type, this is normally type 'E' with all properties optional
 * @template S the server data type stored in this collection
 */
interface DtoCollection<E, F, S> extends DataCollection<E, F> {

    getDataModelFuncs(): DtoAllFuncs<E, S>;
}




/* Adapter interface for persisting/restoring in in-memory database to/from long term* storage, (*longer than browser session or program lifetime)
 * Data persist read/write interface for InMemDb
 * @author TeamworkGuy2
 */
interface DataPersister {

    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    persist(options?: { maxObjectsPerChunk?: number; compress?: boolean; }): Q.Promise<DataPersister.PersistResult>;

    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    restore(options?: { decompress?: boolean; }): Q.Promise<DataPersister.RestoreResult>;

    /** Delete all data related this database from persistent storage
     */
    clearPersistentDb(): Q.Promise<void>;
}


declare module DataPersister {

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
    convertToLocalObjectFunc: (item: S) => E;
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
    addGeneratedIds(autoGenKeys: { name: string; largestKey: number }[], doc): void;

    /** track auto-generated IDs
     * @param autoGenKeys: in the format { name: "...", largestKey: 45678 }
     */
    trackGeneratedIds(autoGenKeys: { name: string; largestKey: number }[], doc): void;

    /** Given a query object, check its validity based on these constraints
     */
    validateQuery(collectionName: string, query, obj): any;


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
