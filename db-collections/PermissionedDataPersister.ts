import Q = require("q");

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


    public getCollectionNames(): Q.Promise<string[]> {
        if (this.syncSettings.readAllow) {
            return this.persister.getCollectionNames();
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    }


    public persist(): Q.Promise<DataPersister.PersistResult> {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }


    public restore(): Q.Promise<DataPersister.RestoreResult> {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    }


    public getCollectionRecords(collectionName: string, options?: DataPersister.ReadOptions): Q.Promise<any[]> {
        if (this.syncSettings.readAllow) {
            return this.persister.getCollectionRecords(collectionName, { decompress: (options != null ? options.decompress : this.storeSettings.compressLocalStores) });
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    }


    public addCollectionRecords(collectionName: string, options: DataPersister.WriteOptions, records: any[], removeExisting?: boolean): Q.Promise<{ size: number; dataSizeBytes: number; }> {
        if (this.syncSettings.writeAllow) {
            return this.persister.addCollectionRecords(collectionName, {
                compress: (options != null ? options.compress : this.storeSettings.compressLocalStores),
                maxObjectsPerChunk: (options != null ? options.maxObjectsPerChunk : null)
            }, records, removeExisting);
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }


    public clearCollections(collectionNames: string[]): Q.Promise<void> {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearCollections(collectionNames);
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }


    public clearPersistentDb(): Q.Promise<void> {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistentDb();
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    }

}

export = PermissionedDataPersisterAdapter;