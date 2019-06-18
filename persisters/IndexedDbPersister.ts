import Q = require("q");
import Arrays = require("ts-mortar/utils/Arrays");
import DbUtil = require("./DbUtil");
import IndexedDbSpi = require("./IndexedDbSpi");

type SimpleDataCollection = DataPersister.SimpleDataCollection;


/* IndexedDbPersister class which implements 'DataPersister' for saving data to IndexedDB for long-term browser data storage.
 * Exports 'IndexedDbSpi' interface which has two methods: getTables() and executeQueries(), which is the link between this 'IndexedDbPersister' class and the underlying IndexedDB database.
 * @author TeamworkGuy2
 */
class IndexedDbPersister implements DataPersister {
    private persistenceInterface: IndexedDbPersister.IndexedDbSpi;
    private logger: DataPersister.DbLogger;
    private getDataCollections: () => SimpleDataCollection[];
    private addCollection: (collName: string, initialData: any[]) => SimpleDataCollection;
    private itemSaveConverter: ((item: any) => any) | null | undefined;
    private itemLoadConverter: ((item: any) => any) | null | undefined;
    private storageFailureCallback: (error: any) => void;
    private tablesToNotClear: string[] = [];
    private tablesToNotLoad: string[] = [];


    /** Create a DataPersister based on an IndexedDB instance and some additional functions to control the behavior of this persister.
     * @param persistenceInterface the underlying database to persist to
     * @param trace the object with functions for logging debug messages and errors
     * @param getDataCollections returns a list of data collections that contain the data to persist/restore to
     * @param addCollection when restoring a database, call this function with each table name found and restored documents
     * @param saveItemTransformation optional conversion function to pass items from 'getDataCollections()' through before persisting them
     * @param restoreItemTransformation optional conversion function to pass items through after restoring them and before storing them in 'getDataCollections()'
     * @param storageFailureCallback callback for handling/logging storage errors
     * @param tablesToNotClear optional array of collection names to not clear when 'clearPersistentDb()' is called
     * @param tablesToNotLoad optional array of collection names to not load when 'restore()' is called
     */
    constructor(
        persistenceInterface: IndexedDbPersister.IndexedDbSpi,
        trace: DataPersister.DbLogger,
        getDataCollections: () => SimpleDataCollection[],
        addCollection: (collName: string, initialData: any[]) => SimpleDataCollection,
        saveItemTransformation: ((item: any) => any) | null | undefined,
        restoreItemTransformation: ((item: any) => any) | null | undefined,
        storageFailureCallback: (error: any) => void,
        tablesToNotClear: string[] | null | undefined,
        tablesToNotLoad: string[] | null | undefined
    ) {
        this.persistenceInterface = persistenceInterface;
        this.logger = trace;
        this.itemSaveConverter = saveItemTransformation;
        this.itemLoadConverter = restoreItemTransformation;
        this.getDataCollections = getDataCollections;
        this.addCollection = addCollection;
        this.storageFailureCallback = storageFailureCallback;
        this.tablesToNotClear = tablesToNotClear || [];
        this.tablesToNotLoad = tablesToNotLoad || [];
    }


    /** Get a list of collection names in this data persister
     */
    public getCollectionNames(): Q.Promise<string[]> {
        return this.persistenceInterface.getTables();
    }


    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    public persist(defaultOptions?: DataPersister.WriteOptions, getCollectionOptions?: ((collName: string) => DataPersister.WriteOptions)): Q.Promise<DataPersister.PersistResult> {
        var that = this;
        var colls = that.getDataCollections();
        var persistCount = 0;

        return <Q.Promise<any>>this.persistenceInterface.getTables().then((collNames) => {
            var tableAdds: IndexedDbSpi.CreateStoreRequest[] = [];
            var tableDels: IndexedDbSpi.DeleteStoreRequest[] = [];
            var tableInserts: IndexedDbSpi.InsertRequest[] = [];

            colls.forEach((coll) => {
                var opts = DbUtil.getOptionsOrDefault(getCollectionOptions != null ? getCollectionOptions(coll.name) : null, defaultOptions);
                var exists = collNames.indexOf(coll.name) !== -1;
                var keyCol = opts.keyColumn != null ? (typeof opts.keyColumn === "string" ? opts.keyColumn : opts.keyColumn.name) : null;
                var autoIncrement = opts.keyAutoGenerate;

                if (opts.deleteIfExists && exists) {
                    tableDels.push({ name: coll.name });
                    tableAdds.push({ name: coll.name, keyPath: keyCol, autoIncrement });
                }
                if (!exists) {
                    tableAdds.push({ name: coll.name, keyPath: keyCol, autoIncrement });
                }
                if (coll.dirty) {
                    persistCount++;
                    if (coll.data.length > 0) {
                        var collData = that.prepDataForSave(coll.data, <number>opts.maxObjectsPerChunk, opts.groupByKey, opts.keyGetter);
                        tableInserts.push({ name: coll.name, clear: exists, records: collData });
                    }
                    else {
                        tableInserts.push({ name: coll.name, clear: exists });
                    }
                }
            });

            return that.persistenceInterface.modifyDatabase(tableDels, tableAdds, tableInserts);
        }).then((rs) => {
            var persistRes: DataPersister.PersistResult = {
                collections: {}
            };

            rs.inserts.forEach((insert) => {
                // reset collection 'dirty' flag after data successfully saved
                var coll = colls.find((x) => x.name === insert.name);
                if (coll != null) {
                    coll.dirty = false;
                }

                persistRes.collections[insert.name] = {
                    size: insert.added,
                    dataSizeBytes: null
                };
            });

            return persistRes;
        });
    }


    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    public restore(defaultOptions?: DataPersister.ReadOptions, getCollectionOptions?: ((collName: string) => DataPersister.ReadOptions)): Q.Promise<DataPersister.RestoreResult> {
        var that = this;
        var restoreRes: DataPersister.RestoreResult = {
            collections: {}
        };

        return this.persistenceInterface.getTables().then((tables) => {
            var tablesToLoad = tables.filter((tbl) => that.tablesToNotLoad.indexOf(tbl) === -1).map((tbl) => ({ name: tbl }));
            return that.getCollectionsRecords(tablesToLoad);
        }).then((results) => {
            results.forEach((result) => {
                var rows = result.records;
                var docs: any[] = [];

                if (rows.length > 0) {
                    var opts = getCollectionOptions != null ? getCollectionOptions(result.name) : null;
                    var expectArrayRes = (opts == null || opts.isChunks);
                    docs = that.readRecords(result.records, expectArrayRes);
                }
                else {
                    //if (that.logger != null) that.logger.log("skip restoring table: " + tableName + " (0 items)");
                }

                restoreRes.collections[result.name] = {
                    size: docs.length,
                    dataSizeBytes: null
                };
                that.addCollection(result.name, docs);
            });

            return restoreRes;
        }, (err) => {
            throw err;
        });
    }


    /** Get all data from a specific collection
     */
    public getCollectionRecords(collectionName: string, options?: DataPersister.ReadOptions): Q.Promise<any[]> {
        return this.getCollectionsRecords([{ name: collectionName, options: options }]).then((r) => r[0].records);
    }


    private getCollectionsRecords(collections: { name: string, options?: DataPersister.ReadOptions }[]): Q.Promise<{ name: string; records: any[] }[]> {
        var collectionNames = Arrays.pluck(collections, "name");

        var xact = this.persistenceInterface.db.transaction(collectionNames, "readonly");

        var recordsXacts = collections.map((coll) => ({ name: coll.name, getAll: xact.objectStore(coll.name).getAll() }));

        var dfd = this.persistenceInterface.util.defer<any[]>();

        xact.oncomplete = function onIdbSuccess(this: IDBTransaction, evt: Event) {
            var notDoneXacts = recordsXacts.filter((x) => x.getAll.readyState !== "done");
            if (notDoneXacts.length > 0) {
                throw new Error(notDoneXacts.length + " transactions are not done in 'oncomplete' callback");
            }

            var results = recordsXacts.map((x) => ({ name: x.name, records: x.getAll.result }));
            dfd.resolve(results);
        };
        function onIdbError(this: IDBTransaction, evt: Event) {
            dfd.reject(xact.error)
        }
        xact.onerror = onIdbError;
        xact.onabort = onIdbError;

        return dfd.promise;
    }


    /** Add data to a specific collection
     */
    public addCollectionRecords(collectionName: string, options: DataPersister.WriteOptions, records: any[], removeExisting?: boolean): Q.Promise<DataPersister.CollectionRawStats> {
        var data = this.prepDataForSave(records, <number>options.maxObjectsPerChunk, options.groupByKey, options.keyGetter);

        return this.persistenceInterface.insertMultiple([{
            name: collectionName,
            clear: removeExisting,
            records: data
        }]).then((rs) => ({ size: rs.inserts[0].added, dataSizeBytes: null }));
    }


    /** Remove all data from the specificed collections
     */
    public clearCollections(collectionNames: string[]): Q.Promise<void> {
        var clearColls: IndexedDbSpi.InsertRequest[] = collectionNames.map((collName) => ({ name: collName, clear: true }));
        return <Q.Promise<any>>this.persistenceInterface.insertMultiple(clearColls);
    }


    /** Delete all data related this database from persistent storage
     */
    public clearPersistentDb(): Q.Promise<void> {
        return <Q.Promise<any>>this.persistenceInterface.getTables().then((tables) => {
            var delColls: IndexedDbSpi.InsertRequest[] = tables
                .filter((tbl) => this.tablesToNotClear.indexOf(tbl) === -1)
                .map((tbl) => ({ name: tbl }));
            return this.persistenceInterface.modifyDatabase(delColls, null, null);
        });
    }


    private readRecords(rows: any[], expectArrayRes: boolean | undefined): any[] {
        var convertFunc = this.itemLoadConverter;
        var docs: any[] = [];

        for (var i = 0, size = rows.length; i < size; i++) {
            var dataBlob = rows[i];
            var resChunks: any[] = [];

            if (convertFunc != null) {
                if (expectArrayRes && Array.isArray(dataBlob)) {
                    for (var j = 0, sizeJ = dataBlob.length; j < sizeJ; j++) {
                        resChunks.push(convertFunc(dataBlob[j]));
                    }
                }
                else {
                    resChunks.push(convertFunc(dataBlob));
                }
            }
            else {
                if (expectArrayRes && Array.isArray(dataBlob)) {
                    resChunks = dataBlob;
                }
                else {
                    resChunks.push(dataBlob);
                }
            }
            Array.prototype.push.apply(docs, resChunks);
        }

        return docs;
    }


    private prepDataForSave<T>(items: T[], chunkSize: number, groupByKey: boolean | undefined, keyGetter: string | ((obj: T) => string) | undefined): any[] {
        var resItems = items;
        if (this.itemSaveConverter != null) {
            var convertFunc = this.itemSaveConverter;
            resItems = [];
            for (var j = 0, sizeJ = items.length; j < sizeJ; j++) {
                resItems.push(convertFunc(items[j]));
            }
        }

        var data: any[] = [];

        // records by chunks
        if (chunkSize > 0) {
            for (var i = 0, size = resItems.length; i < size; i += chunkSize) {
                data.push(resItems.slice(i, i + chunkSize > size ? size : i + chunkSize));
            }
        }
        // records by group-by
        else if (groupByKey != null && keyGetter != null) {
            var groups: StringMap<any[]>;
            if (typeof keyGetter === "string") {
                groups = resItems.reduce((grps, rec) => {
                    var key = (<any>rec)[keyGetter];
                    var grp = grps[key] || (grps[key] = []);
                    grp.push(rec);
                    return grps;
                }, <StringMap<any[]>>{});
            }
            else {
                groups = resItems.reduce((grps, rec) => {
                    var key = (<(obj: any) => string>keyGetter)(rec);
                    var grp = grps[key] || (grps[key] = []);
                    grp.push(rec);
                    return grps;
                }, <StringMap<any[]>>{});
            }
            data = Object.keys(groups).map((k) => groups[k]);
        }
        // records as-is from collection.data array
        else {
            Array.prototype.push.apply(data, resItems);
        }

        return data;
    }

}

module IndexedDbPersister {

    export interface IndexedDbSpi {
        readonly db: IDBDatabase;
        readonly util: DataPersister.UtilConfig;

        getTables(): Q.Promise<string[]>;

        insertMultiple(collectionInserts: IndexedDbSpi.InsertRequest[]): Q.Promise<{ inserts: IndexedDbSpi.InsertResult[]; insertErrors: IndexedDbSpi.InsertExceptions[] }>;

        modifyDatabase(
            tableDels: IndexedDbSpi.DeleteStoreRequest[] | null | undefined,
            tableAdds: IndexedDbSpi.CreateStoreRequest[] | null | undefined,
            tableInserts: IndexedDbSpi.InsertRequest[] | null | undefined
        ): Q.Promise<IndexedDbSpi.DbChangeResults>;

        destroyDatabase(): Q.Promise<void>;
    }

}

export = IndexedDbPersister;