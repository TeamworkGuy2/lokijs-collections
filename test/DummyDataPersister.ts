﻿
/** A DataPersister implementation for testing purposes
 * @author TeamworkGuy2
 * @since 2015-12-17
 */
class DummyDataPersister implements DataPersister {
    private getDataSources: (() => MemDbCollection<any>[]) | null;
    private getItemSaveConverter: ((collName: string) => (item: any) => any) | null;
    private getItemLoadConverter: ((collName: string) => (item: any) => any) | null;


    /**
     * @param getDataSources: returns a list of data collections that contain the data to persist/restore to
     * @param saveItemTransformation: a conversion function to pass items from getDataSources()
     * through before persisting them
     * @param restoreItemTransformation: a conversion function to pass items through
     * after restoring them and before storing them in getDataSources()
     */
    constructor(getDataSources: () => MemDbCollection<any>[], getSaveItemTransformFunc: ((collName: string) => (item: any) => any) | null, getRestoreItemTransformFunc: ((collName: string) => (item: any) => any) | null) {
        this.getDataSources = getDataSources;
        this.getItemSaveConverter = getSaveItemTransformFunc;
        this.getItemLoadConverter = getRestoreItemTransformFunc;
    }


    /** Get a list of collections in this data persister */
    public getCollectionNames(): PsPromise<string[], any> {
        return <any>null;
    }


    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    public persist(defaultOptions?: DataPersister.WriteOptions, getCollectionSpecificOptions?: ((collName: string) => DataPersister.WriteOptions)): PsPromise<DataPersister.PersistResult, any> {
        return <any>null;
    }


    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    public restore(defaultOptions?: DataPersister.ReadOptions, getCollectionSpecificOptions ?: ((collName: string) => DataPersister.ReadOptions)): PsPromise<DataPersister.RestoreResult, any> {
        return <any>null;
    }


    /** Get all data from a specific collection */
    public getCollectionRecords(collectionName: string, options?: DataPersister.ReadOptions): PsPromise<any[], any> {
        return <any>null;
    }


    /** Add data to a specific collection */
    public addCollectionRecords(collectionName: string, options: DataPersister.WriteOptions, records: any[], removeExisting?: boolean): PsPromise<DataPersister.CollectionRawStats, any> {
        return <any>null;
    }


    /** Remove all data from a specific collection */
    public clearCollections(collectionNames: string[]): PsPromise<void, any> {
        return <any>null;
    }


    /** Delete all data related this database from persistent storage
     */
    public clearPersistentDb(): PsPromise<void, any> {
        throw new Error("DummyDataPersister.clearPersistenceDb() not yet implemented");
    }

}

export = DummyDataPersister;