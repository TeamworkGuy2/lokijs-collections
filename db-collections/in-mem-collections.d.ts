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

    setDataPersister(dataPersister: DataPersister.Adapter): Q.IPromise<void>;


    // Add, Remove, Update Operations
    add(collectionName: string, docs: any, dstMetaData?: Changes.CollectionChangeTracker): any;

    addNoModify(collectionName: string, docs: any, dstMetaData?: Changes.CollectionChangeTracker);

    addAll(collectionName: string, docs: any[], dstMetaData?: Changes.CollectionChangeTracker);

    update(collectionName: string, doc: any, dstMetaData?: Changes.CollectionChangeTracker);

    find(collectionName: string, query?: any): ResultSetLike<any>;

    remove(collectionName: string, doc: any, dstMetaData?: Changes.CollectionChangeTracker);


    _addToCollection(collection: LokiCollection<any>, docs: any, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): any;

    _addToCollectionAll(collection: LokiCollection<any>, docs: any[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker);

    _update(collection: LokiCollection<any>, doc: any, dstMetaData?: Changes.CollectionChangeTracker);

    _find<T>(collection: LokiCollection<T>, query?: any, queryProps?: string[]): ResultSetLike<T>;

    _findSinglePropQueryData<T>(collection: LokiCollection<T>, query?: any, queryProps?: string[]): T[];

    _remove(collection: LokiCollection<any>, doc: any, dstMetaData?: Changes.CollectionChangeTracker);


    // Utility methods =====================================
    getCollections(): LokiCollection<any>[];

    clearCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker);

    removeCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker): void;


    _getCollection(collectionName: string, autoCreate?: boolean): LokiCollection<any>;

    _clearCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker);

    _removeCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker): void;


    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    findOne(collectionName: string, query: any);


    _findOne(collection: LokiCollection<any>, query: any);


    // KeyValue store ==========================================
    getItem(key: string);

    setItem(key: string, value: any);

    removeItem(key: string);


    updateWhere(collectionName: string, query: any, obj: any, dstMetaData?: Changes.CollectionChangeTracker);

    addOrUpdateWhere(collectionName: string, query: any, obj: any, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker);

    removeWhere(collectionName: string, query: any, dstMetaData?: Changes.CollectionChangeTracker);

    addOrUpdateAll(collectionName: string, keyName: string, updatesArray: any[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker);


    // the number of items modified
    _updateWhere(collection: LokiCollection<any>, query: any, obj: any, dstMetaData?: Changes.CollectionChangeTracker): void;

    // the number of items added and the number modified
    _addOrUpdateWhere(collection: LokiCollection<any>, query: any, obj: any, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker);

    _removeWhere(collection: LokiCollection<any>, query: any, dstMetaData?: Changes.CollectionChangeTracker);

    _addOrUpdateAll(collection: LokiCollection<any>, keyName: string, updatesArray: any[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker);


    // Array-like
    mapReduce(collectionName: string, map, reduce);

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
        /**
         * @param getDataStore: get the current data store, if this
         * function returns null, then {@code setDataStore} is called with a new data store instance
         * @param setDataStore: set a new data store, which will be returned by the next call to {@code getDataStore}
         * @param createDataStore: create a new data store with the specified parameters
         */
        setDataStoreInterface(getDataStore: () => Loki, setDataStore: (newStore: Loki) => void, createDataStore: (options: LokiConfigureOptions) => Loki);

        /**
         * @param getDataSources: returns a list of data collections that contain the data to persist/restore to
         */
        setDataSources(getDataSources: () => LokiCollection<any>[]);

        /**
         * @param saveItemTransformation: a conversion function to pass items from {@code #getDataSources()}
         * through before persisting them
         * @param restoreItemTransformation: a conversion function to pass items through
         * after restoring them and before storing them in {@code #getDataSources()}
         */
        setDataConverters(saveItemTransformation?: (item) => any, restoreItemTransformation?: (item) => any);


        // Persistence methods =================
        save(callback?: (err) => void);

        load(options, callback?: (err) => void);

        // Persist in-memory database to disk
        // Removes tables from store that don't exist in in-memory db
        persist(options?: { maxObjectsPerChunk?: number; compress?: boolean; }): Q.Promise<PersistResult>;

        // Restore in-memory database from persistent store
        // All in memory tables are dropped and re-added
        restore(options?: { decompress?: boolean; }): Q.Promise<RestoreResult>;

        clearPersistenceDb(): Q.Promise<void>;
    }

}




/** ModelDefinitions - defines a set of data model meta-definitions
 * @author TeamworkGuy2
 */
interface ModelDefinitions {
    models: { [name: string]: WebServiceModelDef };

    getUniqueIdNames(modelName: string): string[];

    getAutoGeneratedKeyNames(modelName: string): string[];

    getModelName(collectionName: string): string;

    // default data type attributes, these can be overridden by specifying custom attributes on individual model properties
    // for example, strings have a default value of 'null', you can change this to an empty string {@code ""} by adding a 'value: ""' attribute to a model property definition:
    // model: {
    //   properties: {
    //     userName: { type: "string", value: "", toService: "$var$ || \"\"" }
    //   }
    // }
    dataTypes: { [id: string]: { value: any; toService?: string; toLocal?: string } };

    // can customize the strings that mark the start/end of a template variable
    templateStartMark: string;
    templateEndMark: string;

    // the key names in this map are the variables that are provided by the parent code when this template is generated.
    // the key names cannot be modified without modifying the code that uses this template file
    // the value strings can be modified to be any template variable name you want, these are used by the 'templateVariables' map
    templateInputLinks: { [name: string]: string };

    /** associates template variables (used by template-type-props) with expressions containing 'templateInputLinks' values
     * when a model template is generated, template-type-props (e.g. 'toLocal', 'toService') get expanded recursively from the keys in this map to thir values until no templateStart/End marks remain
     */
    templateVariables: { [name: string]: string };
}




/** ModelKeys - helper for {@link ModelDefinitions}
 * For managing the primary and auto-generated keys from data models
 * @author TeamworkGuy2
 */
interface ModelKeys {
    modelDefs: ModelDefinitions;

    //constructor(modelDefs: ModelDefinitions)

    //Get names of unique id fields per collection
    getUniqueIdNames(collectionName: string): string[];

    // Get names of auto-generated id fields per collection
    getGeneratedIdNames(collectionName: string): string[];

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
