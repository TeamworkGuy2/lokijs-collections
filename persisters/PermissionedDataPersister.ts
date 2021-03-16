import Defer = require("ts-promises/Defer");

/** DataPersister wrapper that checks permissions before reading/writing data
 * @author TeamworkGuy2
 */
class PermissionedDataPersisterAdapter implements DataPersister {
    private persister: DataPersister;
    private syncSettings: ReadWritePermission;
    private storeSettings: StorageFormatSettings;


    constructor(persister: DataPersister, syncSettings: ReadWritePermission, storeSettings: StorageFormatSettings) {
        this.syncSettings = syncSettings;
        this.storeSettings = storeSettings;
        this.persister = persister;
    }


    public getCollectionNames(): PsPromise<string[], any> {
        if (this.syncSettings.readAllow) {
            return this.persister.getCollectionNames();
        }
        else {
            var dfd = Defer.newDefer<any, string>();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    }


    public persist(): PsPromise<DataPersister.PersistResult, any> {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Defer.newDefer<any, string>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }


    public restore(): PsPromise<DataPersister.RestoreResult, any> {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Defer.newDefer<any, string>();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    }


    public getCollectionRecords(collectionName: string, options?: DataPersister.ReadOptions): PsPromise<any[], any> {
        if (this.syncSettings.readAllow) {
            return this.persister.getCollectionRecords(collectionName, { decompress: (options != null ? options.decompress : this.storeSettings.compressLocalStores) });
        }
        else {
            var dfd = Defer.newDefer<any, any>();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    }


    public addCollectionRecords(collectionName: string, options: DataPersister.WriteOptions, records: any[], removeExisting?: boolean): PsPromise<DataPersister.CollectionRawStats, any> {
        if (this.syncSettings.writeAllow) {
            return this.persister.addCollectionRecords(collectionName, {
                compress: (options != null ? options.compress : this.storeSettings.compressLocalStores),
                maxObjectsPerChunk: (options != null ? options.maxObjectsPerChunk : <undefined><any>null)
            }, records, removeExisting);
        }
        else {
            var dfd = Defer.newDefer<any, string>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }


    public clearCollections(collectionNames: string[]): PsPromise<void, any> {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearCollections(collectionNames);
        }
        else {
            var dfd = Defer.newDefer<any, string>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }


    public clearPersistentDb(): PsPromise<void, any> {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistentDb();
        }
        else {
            var dfd = Defer.newDefer<any, string>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }

}

export = PermissionedDataPersisterAdapter;