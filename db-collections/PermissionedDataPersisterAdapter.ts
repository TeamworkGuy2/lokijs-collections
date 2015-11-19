
/** {@link DataPersister.Adapter} wrapper that checks permissions before reading/writing data
 * @author TeamworkGuy2
 */
class PermissionedDataPersisterAdapter implements DataPersister.Adapter {
    private persister: DataPersister.Adapter;
    private syncSettings: ReadWritePermission;
    private storeSettings: StorageFormatSettings;


    constructor(persister: DataPersister.Adapter, syncSettings: ReadWritePermission, storeSettings: StorageFormatSettings) {
        this.syncSettings = syncSettings;
        this.storeSettings = storeSettings;
        this.persister = persister;
    }


    public setDataStoreInterface(getDataStore: () => Loki, setDataStore: (newStore: Loki) => void, createDataStore: (options: LokiConfigureOptions) => Loki) {
        this.persister.setDataStoreInterface(getDataStore, setDataStore, createDataStore);
    }


    public setDataSources(getDataSources: () => LokiCollection<any>[]) {
        this.persister.setDataSources(getDataSources);
    }


    public setDataConverters(saveItemTransformation?: (item) => any, restoreItemTransformation?: (item) => any) {
        this.persister.setDataConverters(saveItemTransformation, restoreItemTransformation);
    }


    public save(callback?: (err) => void) {
        if (this.syncSettings.writeAllow) {
            this.persister.save(callback);
        }
    }


    public load(options, callback?: (err) => void) {
        if (this.syncSettings.readAllow) {
            this.persister.save(callback);
        }
    }


    public persist(): Q.Promise<DataPersister.PersistResult> {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    }


    public restore(): Q.Promise<DataPersister.RestoreResult> {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister read permission denied due to settings");
            return dfd.promise;
        }
    }


    public clearPersistenceDb(): Q.Promise<void> {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistenceDb();
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    }

}

export = PermissionedDataPersisterAdapter;