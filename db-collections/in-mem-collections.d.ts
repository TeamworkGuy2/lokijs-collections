/// <reference path="../definitions/lib/lokijs.d.ts" />
/// <reference path="../lib/ts-code-generator/code-types/model-types.d.ts" />

/* lokijs-collection interfaces - Data storage/retrieval interface, specifically for storing/retrieving strongly typed data models
 * @author TeamworkGuy2
 */

interface LokiCollection<E> {
    isDirty: boolean;
}


interface ReadWritePermission {
    readAllow: boolean;
    writeAllow: boolean;
}


interface StorageFormatSettings {
    compressLocalStores: boolean;
}


interface InMemDb {

    getModelDefinitions(): ModelDefinitions;

    getModelKeys(): ModelKeys;

    resetDataStore(): Q.IPromise<void>;

    initializeLokijsDb(options: LokiConfigureOptions): void;

    setDataPersister(dataPersisterFactory: DataPersister.AdapterFactory): void;


    // ======== Add, Remove, Update Operations ========
    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    findOne<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, query: any);

    find<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, query?: any, queryProps?: string[]): ResultSetLike<T>;

    findSinglePropQuery<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, query?: any, queryProps?: string[]): T[];

    add<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, docs: any, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T;

    addAll<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker);

    // the number of items added and the number modified
    addOrUpdateWhere<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, query: any, obj: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    addOrUpdateAll<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, keyName: string, updatesArray: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    update<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, doc: any, dstMetaData?: Changes.CollectionChangeTracker);

    // the number of items modified
    updateWhere<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, query: any, obj: any, dstMetaData?: Changes.CollectionChangeTracker): void;

    remove<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, doc: T, dstMetaData?: Changes.CollectionChangeTracker): void;

    removeWhere<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, query: any, dstMetaData?: Changes.CollectionChangeTracker): void;

    // Array-like
    mapReduce<T>(collection: LokiCollection<T>, dataModel: CollectionDataModel<T>, map: (value: T, index: number, array: T[]) => any,
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
 * Provides a collection like (add, remove, update/set) API to make it easy to work with data from an 'InMemDb' instance.
 *
 * Note: many of the methods in this class have an optional last parameter of 'dstResultInfo?: Changes.CollectionChangeTracker',
 * if non-null, the called method passes any collection changes (added, removed, modified document info) to this parameter
 *
 * @author TeamworkGuy2
 * @param <E> the type of data stored in this data collection
 * @param <O> the filter/query type, this is normally type {@code E} with all properties optional
 */
interface DataCollection<E, O> {

    initializeEventHandler(): void;

    getDataModel(): CollectionDataModel<E>;

    destroyEventHandler(): void;

    getCollectionEventHandler(): Events.ListenerList<Changes.CollectionChange, Changes.ChangeListener>;

    /**
     * @return {string} the name of this collection of data models
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
     * @param {Object} query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @return {E[]} of objects
     */
    data(query?: O): E[];

    /** Starts a chained search operation and returns a search result set which can be further refined
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     */
    find(query?: O): ResultSetLike<E>;

    /** Starts a chained filter operation and returns a search result set which can be further refined
     * @param func: a javascript {@link Array#filter} style function that accepts an object
     * and returns a flag indicating whether the object is a match or not
     */
    where(func: (doc: E) => boolean): ResultSetLike<E>;

    /** Remove a document from this collection.
     */
    remove(doc: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    findOne(query: O): E;

    /** Update documents matching a query with properties from a provided update object
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    updateWhere(query: O, obj: O, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found, then the object/document is added to this collection AND no collection actions
     * are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateWhereNoModify(query: O, obj: E, dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection, if one or more matches are found, those documents are updated with the properties from 'obj' as defined in {@link #updateWhere()},
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
     * with the properties from 'obj' as defined in {@link #updateWhere()},
     * if not matches are found for a given doucment, then the document is added to this collection
     * AND no collection actions are applied to the added document, such as generating primary keys.
     * @param query: a mongo style query object, supports query fields like '$le', '$eq', '$ne', etc.
     * @param obj: the properties to overwrite onto each document matching the provided query
     */
    addOrUpdateAllNoModify(updatesArray: E[], dstResultInfo?: Changes.CollectionChangeTracker): void;

    /** Queries this collection based on the primary key of each of the input document,
     * if one or more matches are found for a given document, then those matching documents are updated
     * with the properties from 'obj' as defined in {@link #updateWhere()},
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




/* DataPersister interface - for persisting data to a long term* storage medium, (*longer than the browser session)
 * Data persist read/write interface for InMemDb
 * @author TeamworkGuy2
 */
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


    export interface Adapter {

        // Save this in-memory database to some form of persistent storage
        // Removes tables from store that don't exist in in-memory db
        persist(options?: { maxObjectsPerChunk?: number; compress?: boolean; }): Q.Promise<PersistResult>;

        // Restore in-memory database from persistent store
        // All in memory tables are dropped and re-added
        restore(options?: { decompress?: boolean; }): Q.Promise<RestoreResult>;

        clearPersistenceDb(): Q.Promise<void>;
    }


    export interface AdapterFactory {
        /**
         * @param dbInst: the in-memory database that the persister pulls data from
         * @param getDataCollections: returns a list of data collections that contain the data to persist/restore to
         * @param saveItemTransformation: a conversion function to pass items from {@code #getDataCollections()}
         * through before persisting them
         * @param restoreItemTransformation: a conversion function to pass items through
         * after restoring them and before storing them in {@code #getDataCollections()}
         */
        (dbInst: InMemDb, getDataCollections: () => LokiCollection<any>[],
            getSaveItemTransformFunc?: (collName: string) => ((item: any) => any),
            getRestoreItemTransformFunc?: (collName: string) => ((item: any) => any)): DataPersister.Adapter;
    }

}




/** Represents meta-data about the items in a collection
 * @since 2015-12-15
 */
interface CollectionDataModel<E> {
    /** all the top level property names of the model */
    fieldNames: string[];
    /** the names of all the properties which together uniquely represent each model instance */
    primaryKeys: string[];
    /** the names of the properties which are auto generated (i.e. auto-increment ID keys) */
    autoGeneratedKeys: string[];
    /** an optional function that copies a model, if none is provided, implementations should fall back on a default clone function */
    copyFunc?: (obj: E) => E;
}




interface CollectionModelDef<E> extends DtoModelTemplate {
    copyFunc(obj: E): E;
}




/** ModelDefinitions - defines a set of data model meta-definitions
 * @author TeamworkGuy2
 */
interface ModelDefinitions {
    // default data type attributes, these can be overridden by specifying custom attributes on individual model properties
    // for example, strings have a default value of 'null', you can change this to an empty string {@code ""} by adding a 'value: ""' attribute to a model property definition:
    // model: {
    //   properties: {
    //     userName: { type: "string", value: "", toService: "$var$ || \"\"" }
    //   }
    // }
    dataTypes: { [id: string]: { value: any; toService?: string; toLocal?: string } };
    models: { [name: string]: DtoModelTemplate };

    addModel<U>(modelName: string, model: DtoModelTemplate | CollectionModelDef<U>): CollectionDataModel<U>;

    getPrimaryKeyNames(modelName: string): string[];

    getAutoGeneratedKeyNames(modelName: string): string[];

    getFieldNames(modelName: string): string[];

    getCopyFunc(modelName: string): (obj: any) => any;

    getDataModel(modelName: string): CollectionDataModel<any>;
}




/** ModelKeys - helper for {@link ModelDefinitions}
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
