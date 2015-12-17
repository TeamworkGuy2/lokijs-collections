"use strict";

/**
 * @author TeamworkGuy2
 * @since 2015-12-17
 */
class DummyDataPersister implements DataPersister.Adapter {
    private getDataSources: () => LokiCollection<any>[];
    private getDataStore: () => Loki;
    private setDataStore: (newStore: Loki) => void;
    private createDataStore: (options: LokiConfigureOptions) => Loki;
    private itemSaveConverter: (item) => any;
    private itemLoadConverter: (item) => any;

    private createDataStoreOnSet: boolean;


    constructor(createDataStoreOnSet: boolean) {
        this.createDataStoreOnSet = createDataStoreOnSet;
    }


    /**
     * @param getDataStore: get the current data store, if this
     * function returns null, then {@code setDataStore} is called with a new data store instance
     * @param setDataStore: set a new data store, which will be returned by the next call to {@code getDataStore}
     * @param createDataStore: create a new data store with the specified parameters
     */
    public setDataStoreInterface(getDataStore: () => Loki, setDataStore: (newStore: Loki) => void, createDataStore: (options: LokiConfigureOptions) => Loki) {
        this.getDataStore = getDataStore;
        this.setDataStore = setDataStore;
        this.createDataStore = createDataStore;

        if (this.createDataStoreOnSet) {
            var newDbStore = this.createDataStore({});
            this.setDataStore(newDbStore);
        }
    }


    /**
     * @param getDataSources: returns a list of data collections that contain the data to persist/restore to
     */
    public setDataSources(getDataSources: () => LokiCollection<any>[]) {
        this.getDataSources = getDataSources;
    }


    /**
     * @param saveItemTransformation: a conversion function to pass items from {@code #getDataSources()}
     * through before persisting them
     * @param restoreItemTransformation: a conversion function to pass items through
     * after restoring them and before storing them in {@code #getDataSources()}
     */
    public setDataConverters(saveItemTransformation?: (item) => any, restoreItemTransformation?: (item) => any) {
        this.itemSaveConverter = saveItemTransformation;
        this.itemLoadConverter = restoreItemTransformation;
    }


    // Persistence methods =================
    public save(callback?: (err) => void) {
        throw new Error("DummyDataPersister.save() not yet implemented");
    }

    public load(options, callback?: (err) => void) {
        throw new Error("DummyDataPersister.load() not yet implemented");
    }


    // Persist in-memory database to disk
    // Removes tables from store that don't exist in in-memory db
    persist(options?: { maxObjectsPerChunk?: number; compress?: boolean; }): Q.Promise<DataPersister.PersistResult> {
        return null;
    }

    // Restore in-memory database from persistent store
    // All in memory tables are dropped and re-added
    public restore(options?: { decompress?: boolean; }): Q.Promise<DataPersister.RestoreResult> {
        return null;
    }


    public clearPersistenceDb(): Q.Promise<void> {
        throw new Error("DummyDataPersister.clearPersistenceDb() not yet implemented");
    }

}

export = DummyDataPersister;