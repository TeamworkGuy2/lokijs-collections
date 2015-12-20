"use strict";

/**
 * @author TeamworkGuy2
 * @since 2015-12-17
 */
class DummyDataPersister implements DataPersister.Adapter {
    private getDataSources: () => LokiCollection<any>[];
    private getItemSaveConverter: (collName: string) => ((item) => any);
    private getItemLoadConverter: (collName: string) => ((item) => any);

    private createDataStoreOnSet: boolean;


    /**
     * @param getDataSources: returns a list of data collections that contain the data to persist/restore to
     * @param saveItemTransformation: a conversion function to pass items from {@code #getDataSources()}
     * through before persisting them
     * @param restoreItemTransformation: a conversion function to pass items through
     * after restoring them and before storing them in {@code #getDataSources()}
     */
    constructor(getDataSources: () => LokiCollection<any>[], getSaveItemTransformFunc?: (collName: string) => ((item) => any), getRestoreItemTransformFunc?: (collName: string) => ((item) => any)) {
        this.getDataSources = getDataSources;
        this.getItemSaveConverter = getSaveItemTransformFunc;
        this.getItemLoadConverter = getRestoreItemTransformFunc;
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