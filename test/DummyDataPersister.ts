
/** A DataPersister implementation for testing purposes
 * @author TeamworkGuy2
 * @since 2015-12-17
 */
class DummyDataPersister implements DataPersister {
    private getDataSources: () => LokiCollection<any>[];
    private getItemSaveConverter: (collName: string) => ((item: any) => any);
    private getItemLoadConverter: (collName: string) => ((item: any) => any);


    /**
     * @param getDataSources: returns a list of data collections that contain the data to persist/restore to
     * @param saveItemTransformation: a conversion function to pass items from getDataSources()
     * through before persisting them
     * @param restoreItemTransformation: a conversion function to pass items through
     * after restoring them and before storing them in getDataSources()
     */
    constructor(getDataSources: () => LokiCollection<any>[], getSaveItemTransformFunc?: (collName: string) => ((item: any) => any), getRestoreItemTransformFunc?: (collName: string) => ((item: any) => any)) {
        this.getDataSources = getDataSources;
        this.getItemSaveConverter = getSaveItemTransformFunc;
        this.getItemLoadConverter = getRestoreItemTransformFunc;
    }


    /** Get a list of collections in this data persister */
    public getCollectionNames(): Q.Promise<string[]> {
        return null;
    }


    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    public persist(defaultOptions?: DataPersister.WriteOptions, getCollectionSpecificOptions?: ((collName: string) => DataPersister.WriteOptions)): Q.Promise<DataPersister.PersistResult> {
        return null;
    }


    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    public restore(defaultOptions?: DataPersister.ReadOptions, getCollectionSpecificOptions ?: ((collName: string) => DataPersister.ReadOptions)): Q.Promise<DataPersister.RestoreResult> {
        return null;
    }


    /** Get all data from a specific collection */
    public getCollectionRecords(collectionName: string, options?: DataPersister.ReadOptions): Q.Promise<any[]> {
        return null;
    }


    /** Add data to a specific collection */
    public addCollectionRecords(collectionName: string, options: DataPersister.WriteOptions, records: any[], removeExisting?: boolean): Q.Promise<{ size: number; dataSizeBytes: number; }> {
        return null;
    }


    /** Remove all data from a specific collection */
    public clearCollections(collectionNames: string[]): Q.Promise<void> {
        return null;
    }


    /** Delete all data related this database from persistent storage
     */
    public clearPersistentDb(): Q.Promise<void> {
        throw new Error("DummyDataPersister.clearPersistenceDb() not yet implemented");
    }

}

export = DummyDataPersister;