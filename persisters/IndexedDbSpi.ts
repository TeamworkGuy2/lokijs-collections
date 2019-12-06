import DbUtil = require("./DbUtil");

class IndexedDbSpi {
    public db!: IDBDatabase;
    public util!: DbUtil<IDBDatabase>;


    constructor(db: IDBDatabase, util: DbUtil<IDBDatabase>) {
        this.db = db;
        this.util = util;
    }


    public getDatabase(): IDBDatabase {
        return this.db;
    }


    public getTables(): Q.Promise<string[]> {
        var names: string[] = [];
        Array.prototype.push.apply(names, <any[]><any>this.db.objectStoreNames);
        var dfd = this.util.defer<string[]>();
        dfd.resolve(names);
        return dfd.promise;
    }


    public insertMultiple(collectionInserts: IndexedDbSpi.InsertRequest[]): Q.Promise<{ inserts: IndexedDbSpi.InsertResult[]; insertErrors: IndexedDbSpi.InsertExceptions[] }> {
        var res = {
            inserts: <IndexedDbSpi.InsertResult[]>[],
            insertErrors: <IndexedDbSpi.InsertExceptions[]>[]
        };
        return <Q.Promise<typeof res>>IndexedDbSpi.inserts(this.db, this.util, collectionInserts, res);
    }


    /** All-in-one function to remove IndexedDB stores, add new stores, and insert records into stores.
     * This function handles bumping the DB version to trigger an 'onupgrade' callback to add and remove stores.
     * @param tableDels optional list of stores to remove from the DB, these run first
     * @param tableAdds optional list of stores to add to the DB, these run second
     * @param tableInserts optional list of data insertions to run against the DB, these run third (after table deletes/creates)
     */
    public modifyDatabase(
        tableDels: IndexedDbSpi.DeleteStoreRequest[] | null | undefined,
        tableAdds: IndexedDbSpi.CreateStoreRequest[] | null | undefined,
        tableInserts: IndexedDbSpi.InsertRequest[] | null | undefined
    ): Q.Promise<IndexedDbSpi.DbChangeResults> {
        var inst = this;
        var name = this.db.name;
        var version = this.db.version;
        this.db.close();

        var res: IndexedDbSpi.DbChangeResults = {
            createdStores: [],
            createErrors: [],
            deletedStores: [],
            deleteErrors: [],
            inserts: [],
            insertErrors: []
        };

        var hasSchemaChanges = (tableAdds != null && tableAdds.length > 0) || (tableDels != null && tableDels.length > 0);

        // upgrade the DB version to trigger an 'onupgradeneeded' call so we can create and/or delete object stores
        return IndexedDbSpi.openDatabase(this.util, name, hasSchemaChanges ? version + 1 : version, function versionUpgrade(evt) {
            // Database modifications must be performed within 'onupgrade' callback
            var db = this.result;
            inst.db = db;

            // delete stores (first so that create stores can re-create stores)
            (tableDels || []).forEach((tbl) => {
                try {
                    db.deleteObjectStore(tbl.name);
                    res.deletedStores.push(tbl);
                } catch (err) {
                    res.deleteErrors.push({ name: tbl.name, error: err });
                }
            });

            // create stores
            (tableAdds || []).forEach((tbl) => {
                try {
                    var createRes = db.createObjectStore(tbl.name, tbl);
                    res.createdStores.push(createRes);
                } catch (err) {
                    res.createErrors.push({ name: tbl.name, error: err });
                }
            });
        }).then(() => IndexedDbSpi.inserts(inst.db, inst.util, tableInserts, res));
    }


    public destroyDatabase(): Q.Promise<void> {
        var dfd = this.util.defer<void>();

        var dbDelReq = self.indexedDB.deleteDatabase(this.db.name);

        wrapRequest(dbDelReq, function destroyDbSuccess(evt) {
            dfd.resolve(<void><any>null);
        }, function destroyDbError(evt) {
            dfd.reject(dbDelReq.error);
        });
        return dfd.promise;
    }


    private static addOrPut(dbColl: IDBObjectStore, tbl: IndexedDbSpi.InsertRequest) {
        if (tbl.records == null) {
            return;
        }

        // TODO for now just calling put()/add() in a loop and not waiting on the resulting request to complete before inserting the next
        if (tbl.overwrite) {
            if (tbl.keyGetter != null) {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.put(tbl.records[i], <any>tbl.keyGetter(tbl.records[i]));
                }
            }
            else {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.put(tbl.records[i]);
                }
            }
        }
        else {
            if (tbl.keyGetter != null) {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.add(tbl.records[i], <any>tbl.keyGetter(tbl.records[i]));
                }
            }
            else {
                for (var i = 0, size = tbl.records.length; i < size; i++) {
                    dbColl.add(tbl.records[i]);
                }
            }
        }
    }


    private static inserts<R extends { inserts: IndexedDbSpi.InsertResult[]; insertErrors: IndexedDbSpi.InsertExceptions[] }>(
        db: IDBDatabase, util: DbUtil<any>, tableInserts: IndexedDbSpi.InsertRequest[] | null | undefined, res: R
    ): Q.Promise<R> | R {
        if (tableInserts == null) {
            return res;
        }

        var pInserts = util.defer<R>();
        var insertCount = tableInserts.length;
        var insertsDone = 0;

        // insert records into stores
        tableInserts.forEach((tbl) => {
            var insertErrors: DOMException[] = [];

            var xact = db.transaction(tbl.name, "readwrite");
            var dbColl = xact.objectStore(tbl.name);
            var clearedCount = 0;

            if (tbl.clear) {
                // get record count and clear the store
                var countReq = dbColl.count();
                countReq.onsuccess = function onIdbSuccess(this: IDBRequest<number>, evt: Event) {
                    var clearReq = dbColl.clear();
                    clearReq.onsuccess = function onIdbSuccess(this: IDBRequest<undefined>, evt: Event) {
                        clearedCount = countReq.result;
                        // add new records
                        IndexedDbSpi.addOrPut(dbColl, tbl);
                    };
                    clearReq.onerror = function onIdbSuccess(this: IDBRequest<undefined>, evt: Event) {
                        insertErrors.push(<DOMException>clearReq.error);
                        xact.abort();
                    };
                };
                countReq.onerror = function onIdbSuccess(this: IDBRequest<number>, evt: Event) {
                    insertErrors.push(<DOMException>countReq.error);
                    xact.abort();
                };
            }
            else {
                // add new records
                IndexedDbSpi.addOrPut(dbColl, tbl);
            }

            xact.oncomplete = function onIdbSuccess(this: IDBTransaction, evt: Event) {
                res.inserts.push({ name: tbl.name, added: tbl.records != null ? tbl.records.length : 0, removed: clearedCount });
                insertsDone++;
                if (insertsDone >= insertCount) {
                    pInserts.resolve(res);
                }
            };
            function onIdbError(this: IDBTransaction, evt: Event) {
                insertErrors.push(xact.error)
                res.insertErrors.push({ name: tbl.name, errors: insertErrors });
                insertsDone++;
                pInserts.reject(xact.error);
            }
            xact.onerror = onIdbError;
            xact.onabort = onIdbError;
        });

        return pInserts.promise;
    }


    public static openDatabase(util: DbUtil<IDBDatabase>, name: string, version?: number | null, onupgradeneeded?: (this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => Q.Promise<any> | any | null | undefined): Q.Promise<IDBDatabase> {
        util.log(util.DEBUG, "openDatabase", name, version);

        var dfd = util.defer<IDBDatabase>();
        var pUpgrade: PromiseLike<any>;
        try {
            if (typeof self === "undefined" || !self.indexedDB) {
                util.rejectError(dfd, "IndexedDB not implemented");
            }
            else {
                var dbOpenReq = (version != null ? self.indexedDB.open(name, version) : self.indexedDB.open(name));
                wrapRequest(dbOpenReq, function openDbSuccess(evt) {
                    if (pUpgrade != null) {
                        pUpgrade.then((r) => dfd.resolve(dbOpenReq.result), (err) => util.rejectError(dfd, "onupgradeneeded handler failed", { exception: err }));
                    }
                    else {
                        dfd.resolve(dbOpenReq.result);
                    }
                }, function openDbError(evt) {
                    util.rejectError(dfd, "Failed to open database", { exception: dbOpenReq.error });
                }, function dbUpgradeNeeded(evt) {
                    // triggered when opening a new DB or an existing DB with a higher version number than last time it was opened
                    util.log(util.DEBUG, "upgradeNeeded", name, version);
                    if (onupgradeneeded != null) {
                        var onUpgradeRes = onupgradeneeded.call(this, evt);
                        if (util.isPromise(onUpgradeRes)) {
                            pUpgrade = onUpgradeRes;
                        }
                    }
                });
            }
        } catch (ex) {
            util.rejectError(dfd, "Failed to open database " + name, { exception: ex });
        }
        return dfd.promise;
    }


    public static newIndexedDb(name: string | IDBDatabase, version: number | null, utilSettings: DataPersister.UtilConfig) {
        var util = new DbUtil<IDBDatabase>("IndexedDB", "[object IDBDatabase]", utilSettings);

        // Create IndexedDB wrapper from native Database or by opening 'name' DB
        var pOpen: Q.Promise<IDBDatabase>;
        if (util.isDatabase(name)) {
            var dfd = util.defer<IDBDatabase>();
            dfd.resolve(name);
            pOpen = dfd.promise;
        }
        else {
            pOpen = IndexedDbSpi.openDatabase(util, name, version);
        }

        return pOpen.then((dbInst) => new IndexedDbSpi(dbInst, util));
    }

}

module IndexedDbSpi {

    export interface CreateStoreRequest extends IDBObjectStoreParameters {
        name: string;
    }

    export interface DeleteStoreRequest {
        name: string;
    }

    export interface InsertRequest {
        name: string;
        overwrite?: boolean;
        clear?: boolean;
        records?: any[];
        keyGetter?: (record: any) => IDBValidKey | IDBKeyRange;
    }

    export interface InsertResult {
        name: string;
        added: number;
        removed: number;
    }

    export interface InsertExceptions {
        name: string;
        errors: DOMException[];
    }

    export interface StoreError {
        name: string;
        error: Error;
    }

    export interface DbChangeResults {
        createdStores: IDBObjectStore[];
        createErrors: StoreError[];
        deletedStores: { name: string }[];
        deleteErrors: StoreError[];
        inserts: InsertResult[];
        insertErrors: InsertExceptions[];
    }

}


function isOpenDbRequest(dbReq: IDBRequest<any>): dbReq is IDBOpenDBRequest {
    return "onupgradeneeded" in dbReq;
}


function wrapRequest<T = any>(
    dbReq: IDBRequest<T>,
    onsuccess: Exclude<IDBRequest["onsuccess"], null>,
    onerror: Exclude<IDBRequest["onerror"], null>,
    onupgradeneeded?: Exclude<IDBOpenDBRequest["onupgradeneeded"], null>
) {
    dbReq.onsuccess = onsuccess;
    dbReq.onerror = onerror;

    if (isOpenDbRequest(dbReq)) {
        if (onupgradeneeded == null) {
            throw new Error("must provide an onupgradeneeded handler for open DB requests");
        }
        dbReq.onupgradeneeded = <Exclude<typeof onupgradeneeded, undefined>>onupgradeneeded;
        dbReq.onblocked = onerror;
    }
    return dbReq;
}


export = IndexedDbSpi;