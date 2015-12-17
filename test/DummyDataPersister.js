"use strict";
/**
 * @author TeamworkGuy2
 * @since 2015-12-17
 */
var DummyDataPersister = (function () {
    function DummyDataPersister(createDataStoreOnSet) {
        this.createDataStoreOnSet = createDataStoreOnSet;
    }
    /**
     * @param getDataStore: get the current data store, if this
     * function returns null, then {@code setDataStore} is called with a new data store instance
     * @param setDataStore: set a new data store, which will be returned by the next call to {@code getDataStore}
     * @param createDataStore: create a new data store with the specified parameters
     */
    DummyDataPersister.prototype.setDataStoreInterface = function (getDataStore, setDataStore, createDataStore) {
        this.getDataStore = getDataStore;
        this.setDataStore = setDataStore;
        this.createDataStore = createDataStore;
        if (this.createDataStoreOnSet) {
            var newDbStore = this.createDataStore({});
            this.setDataStore(newDbStore);
        }
    };
    /**
     * @param getDataSources: returns a list of data collections that contain the data to persist/restore to
     */
    DummyDataPersister.prototype.setDataSources = function (getDataSources) {
        this.getDataSources = getDataSources;
    };
    /**
     * @param saveItemTransformation: a conversion function to pass items from {@code #getDataSources()}
     * through before persisting them
     * @param restoreItemTransformation: a conversion function to pass items through
     * after restoring them and before storing them in {@code #getDataSources()}
     */
    DummyDataPersister.prototype.setDataConverters = function (saveItemTransformation, restoreItemTransformation) {
        this.itemSaveConverter = saveItemTransformation;
        this.itemLoadConverter = restoreItemTransformation;
    };
    // Persistence methods =================
    DummyDataPersister.prototype.save = function (callback) {
        throw new Error("DummyDataPersister.save() not yet implemented");
    };
    DummyDataPersister.prototype.load = function (options, callback) {
        throw new Error("DummyDataPersister.load() not yet implemented");
    };
    // Persist in-memory database to disk
    // Removes tables from store that don't exist in in-memory db
    DummyDataPersister.prototype.persist = function (options) {
        return null;
    };
    // Restore in-memory database from persistent store
    // All in memory tables are dropped and re-added
    DummyDataPersister.prototype.restore = function (options) {
        return null;
    };
    DummyDataPersister.prototype.clearPersistenceDb = function () {
        throw new Error("DummyDataPersister.clearPersistenceDb() not yet implemented");
    };
    return DummyDataPersister;
})();
module.exports = DummyDataPersister;
