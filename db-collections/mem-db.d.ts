/// <reference path="./mem-collections.d.ts" />
/// <reference path="./mem-models.d.ts" />

/** Based on 'LokiJS - A lightweight document oriented javascript database' by Joe Minichino <joe.minichino@gmail.com>
 * retrieved 2015-06-08 from https://github.com/borisyankov/DefinitelyTyped/tree/master/lokijs
 * based on Type definitions for lokijs v1.2.5 (https://github.com/techfort/LokiJS)
 */


/** Collection management
 */
interface MemDbCollectionSet {

    /** Get a list of all available collections */
    listCollections(): MemDbCollection<any>[];

    /** add a new collection */
    addCollection<T>(name: string, options?: MemDbCollectionOptions<T>): MemDbCollection<T>;

    /** Clear all of the data from a specified collection by collection name */
    clearCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker): void;

    /** Remove a collection by name */
    removeCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker): void;

    /** Retrieve a collection by name */
    getCollection(collectionName: string, autoCreate: true): MemDbCollection<any>;
    getCollection(collectionName: string, autoCreate?: boolean): MemDbCollection<any> | null;

    /** Clear all of the data from a specified collection */
    clearCollection(collection: MemDbCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void;

    /** Remove a collection */
    removeCollection(collection: MemDbCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void;
}


/** An in-memory database interface, containing:
 * - data collections (i.e. tables)
 * - data collection management, including clearing or deleting a data collection
 * - model definitions (i.e. table schemas/meta-data)
 * - functions for all the basic CRUD operations, such as find(), add(), update(), updateWhere(), remove(), and removeWhere()
 */
interface MemDb extends MemDbCollectionSet, MemDbCollectionProxy {
    name: string;
    collections: MemDbCollection<any>[];
    databaseVersion: number;
    environment: string;
    readonly settings: ReadWritePermission & StorageFormatSettings;
    events: TsEventEmitter<{
        'init': any[];
        'flushChanges': any[];
        'close': any[];
        'changes': any[];
        'warning': any[];
    }>;

    getName(): string;

    listCollections(): MemDbCollection<any>[];

    getCollection<T>(collectionName: string, autoCreate: true): MemDbCollection<T>;
    getCollection<T>(collectionName: string, autoCreate?: boolean): MemDbCollection<T> | null;

    addCollection<T>(name: string, options?: MemDbCollectionOptions<T>): MemDbCollection<T>;

    loadCollection(collection: MemDbCollection<any>): void;

    removeCollection(collectionName: string | MemDbCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void;

    getModelDefinitions(): ModelDefinitions;

    getModelKeys(): ModelKeys;
}


/** Add, Remove, Update operations for collections
 */
interface MemDbCollectionProxy {

    /** Query a collection and return the results as an array rather than a result set, allowing for optimizations find might not be able to make
     */
    data<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[]): T[];

    /** Query a collection, find items based on query parameters
     * @param query a Lokijs/MongoDB style query
     * @param queryProps optional list of properties from the query to use.  An optimization and/or way to apply only part of a query
     * @returns a result set of items which match the query
     */
    find<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[]): ResultSetLike<T>;

    /** Query a collection, similar to find(), except that exactly one result is expected
     * @return a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    first<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, queryProps?: string[], throwIfNone?: boolean, throwIfMultiple?: boolean): T;

    /** Add an object to the specified collection, with optional flag to not modify the model (no constraint checks), and an optional change tracker to log results to */
    add<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, docs: T, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T;

    addAll<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[];

    // the number of items added and the number modified
    addOrUpdateWhere<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, query: any, obj: Partial<T>, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    addOrUpdateAll<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, dataModelFuncs: DtoFuncs<T>, keyName: keyof T, updatesArray: Partial<T>[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): void;

    update<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, doc: Partial<T> | Partial<T>[], dstMetaData?: Changes.CollectionChangeTracker): void;

    // the number of items modified
    updateWhere<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, obj: Partial<T>, dstMetaData?: Changes.CollectionChangeTracker): void;

    remove<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, doc: T, dstMetaData?: Changes.CollectionChangeTracker): void;

    removeWhere<T>(collection: MemDbCollection<T>, dataModel: DataCollectionModel<T>, query: any, dstMetaData?: Changes.CollectionChangeTracker): void;
}


/**-------------------------+
| Changes API               |
+---------------------------*
 * The Changes API enables the tracking the changes occurred in the collections since the beginning of the session,
 * so it's possible to create a differential dataset for synchronization purposes (possibly to a remote db)
 */
interface MemDbChanges {

    /** takes all the changes stored in each
     *   collection and creates a single array for the entire database. If an array of names
     *   of collections is passed then only the included collections will be tracked.
     * @param collectionNames optional array of collection names. No arg means all collections are processed.
     * @returns array of changes
     * @see private method createChange() in Collection
     */
    generateChangesNotification(collectionNames?: string[]): MemDbCollectionChange[];

    /** stringify changes for network transmission
     * @returns string representation of the changes
     */
    serializeChanges(collectionNames?: string[]): string;

    /** clears all the changes in all collections. */
    clearChanges(): void;
}


/** TsEventEmitter is a minimalist version of EventEmitter. It enables any
 * constructor that inherits EventEmitter to emit events and trigger
 * listeners that have been added to the event through the on(event, callback) method
 * @template T a map associating event names with arrays of the listener function type handled by each event
 */
interface TsEventEmitter<T extends { [eventName: string]: any[] }> {
    /** @prop Events property is a hashmap, with each property being an array of callbacks */
    events: T;

    /** adds a listener to the queue of callbacks associated to an event
     * @returns the index of the callback in the array of listeners for a particular event
     */
    on(eventName: keyof T, listener: (...args: any[]) => void): (...args: any[]) => void;

    /** removes the listener at position 'index' from the event 'eventName' */
    removeListener(eventName: keyof T, listener: (...args: any[]) => void): void;

    /** emits a particular event
     * with the option of passing optional parameters which are going to be processed by the callback
     * provided signatures match (i.e. if passing emit(event, arg0, arg1) the listener should take two parameters)
     * @param eventName - the name of the event
     * @param data - optional object passed with the event
     */
    emit(eventName: keyof T, data?: any): void;
}


/* Adapter interface for persisting/restoring an in-memory database to/from long-term* storage, (*longer than browser session or program lifetime)
 * Data persist read/write interface for MemDb
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
    addCollectionRecords(collectionName: string, options: DataPersister.WriteOptions, records: any[], removeExisting?: boolean): Q.Promise<DataPersister.CollectionRawStats>;

    /** Remove all data from a specific collection */
    clearCollections(collectionNames: string[]): Q.Promise<void>;

    /** Delete all data related this database from persistent storage
     */
    clearPersistentDb(): Q.Promise<void>;
}

declare module DataPersister {

    interface CollectionRawStats {
        /** The number of objects in the collection */
        size: number;
        /** The total size in bytes of all the objects in the collection */
        dataSizeBytes: number | null;
    }


    /** Information about a set of collections
     */
    interface CollectionData {
        collections: {
            [index: string]: CollectionRawStats;
        };
    }


    export interface PersistResult extends CollectionData {
    }


    export interface RestoreResult extends CollectionData {
    }


    export interface ReadOptions {
        /** name of the persistent column where stringified object data is stored in each row */
        dataColumnName?: string;
        /** (currently unsupported) whether to decompress stringified object data */
        decompress?: boolean;
        /** whether 'WriteOptions.groupByKey' or 'WriteOptions.maxObjectsPerChunk' were provided when the collection was 'persist()'ed */
        isChunks?: boolean;
    }


    /** Most basic fields needed to persist and restore a full 'DataCollection'
     */
    export interface SimpleDataCollection {
        name: string;
        data: any[];
        dirty?: boolean;
    }


    export interface SimpleDeferred<T> {
        promise: Q.Promise<T>;
        resolve(value?: Q.IWhenable<T>): void;
        reject(reason: any): void;
    }


    export interface DbLogger {
        log(...args: any[]): any;
        error?(...args: any[]): any;
        text?(...args: any[]): any;
    }


    export interface UtilConfig {
        defer<T = any>(): SimpleDeferred<T>;
        whenAll<T = any>(promises: ArrayLike<PromiseLike<T>>): Q.Promise<T[]>;
        trace?: DbLogger;
        verbosity?: number;
        logTimings?: boolean;
    }


    export interface WriteOptions {
        /** whether to auto-generate the 'keyColumn' */
        keyAutoGenerate?: boolean;
        /** property name of data model primary key, or a function which takes an object and returns a primary key string */
        keyGetter?: string | ((obj: any) => string);
        /** name of the persistent key column to store value from 'keyGetter', or null to not include key column */
        keyColumn?: { name: string; type: string; };
        /** flag indicating whether 'keyGetter' may have the same value for two objects and whether those objects should be grouped together */
        groupByKey?: boolean;
        /** name of the persistent column where stringified object data is stored in each row */
        dataColumnName?: string;
        /** if 'keyGetter' is null, this is the number of objects to store in each persistent data row */
        maxObjectsPerChunk?: number;
        /** (currently unsupported) whether to compress stringified object data */
        compress?: boolean;
        /** whether to delete existing table and recreate it */
        deleteIfExists?: boolean;
    }


    export interface Factory {
        /**
         * @param dbInst the in-memory database that the persister pulls data from
         * @param getCollections returns a list of data collections that contain the data to persist/restore to
         * @param saveItemTransformation a conversion function to pass items from getDataCollections() through before persisting them
         * @param restoreItemTransformation a conversion function to pass items through after restoring them and
         * before storing them in getDataCollections()
         */
        (dbInst: MemDb, getCollections: () => MemDbCollection<any>[],
            getSaveItemTransformFunc?: (collName: string) => ((item: any) => any) | null,
            getRestoreItemTransformFunc?: (collName: string) => ((item: any) => any) | null): DataPersister;
    }

}


interface MemDbOps {
    // comparison operators
    $eq: (a: any, b: any) => boolean;
    $gt: (a: any, b: any) => boolean;
    $gte: (a: any, b: any) => boolean;
    $lt: (a: any, b: any) => boolean;
    $lte: (a: any, b: any) => boolean;
    $ne: (a: any, b: any) => boolean;
    $regex: (a: string, b: { test(string: string): boolean }) => boolean;
    $in: (a: any, b: { indexOf(value: any): number }) => boolean;
    $containsAny: (a: any, b: any[] | any) => boolean;
    $contains: (a: any, b: any[] | any) => boolean;
}


interface MemDbUniqueIndex<E> {
    field: keyof E;
    keyMap: { [id: string]: E | undefined };
    lokiMap: { [id: number]: any }; // 'field' map

    set(obj: E): void;

    get(key: string): E | null;

    byId(id: number): E;

    update(obj: E): void;

    remove(key: string): void;

    clear(): void;
}


interface MemDbExactIndex<E> {
    index: { [id: string]: E[] | undefined };
    field: string;

    /** add the value you want returned to the key in the index */
    set(key: string, val: E): void;

    /** remove the value from the index, if the value was the last one, remove the key */
    remove(key: string, val: E): void;

    /** get the values related to the key, could be more than one */
    get(key: string): E[] | null;

    /** clear will zap the index */
    clear(): void;
}


interface ReadWritePermission {
    readAllow: boolean;
    writeAllow: boolean;
}


interface StorageFormatSettings {
    compressLocalStores: boolean;
}


interface MemDbPersistenceInterface {
    loadDatabase: (fileName: string, func: (dbString: string) => void) => void;
    saveDatabase: (fileName: string, content: string, func: () => void) => void;
}


interface MemDbCollectionChange {
    name: string;
    operation: ("I"/*Insert*/ | "U"/*Update*/ | "R"/*Remove*/);
    obj: any;
}


interface MemDbCollectionIndex {
    name: string;
    dirty: boolean;
    values: number[];
}


interface MemDbCollectionOptions<T> {
    transactional?: boolean;
    clone?: boolean;
    disableChangesApi?: boolean;
    indices?: (keyof T & string)[];
    exact?: (keyof T & string)[];
    unique?: (keyof T & string)[];
}


interface MemDbObj {
    $loki: number;
    meta: {
        /** timestamp */
        created: number;
        /** number that gets incremented each time the object is updated */
        revision: number;
        /** timestamp */
        updated?: number;
    };
}


interface MemDbQuery {
}
