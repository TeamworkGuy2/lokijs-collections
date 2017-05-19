"use strict";
/** A DataPersister implementation for testing purposes
 * @author TeamworkGuy2
 * @since 2015-12-17
 */
var DummyDataPersister = (function () {
    /**
     * @param getDataSources: returns a list of data collections that contain the data to persist/restore to
     * @param saveItemTransformation: a conversion function to pass items from getDataSources()
     * through before persisting them
     * @param restoreItemTransformation: a conversion function to pass items through
     * after restoring them and before storing them in getDataSources()
     */
    function DummyDataPersister(getDataSources, getSaveItemTransformFunc, getRestoreItemTransformFunc) {
        this.getDataSources = getDataSources;
        this.getItemSaveConverter = getSaveItemTransformFunc;
        this.getItemLoadConverter = getRestoreItemTransformFunc;
    }
    /** Get a list of collections in this data persister */
    DummyDataPersister.prototype.getCollectionNames = function () {
        return null;
    };
    /** Save this in-memory database to some form of persistent storage
     * Removes tables from store that don't exist in in-memory db
     */
    DummyDataPersister.prototype.persist = function (defaultOptions, getCollectionSpecificOptions) {
        return null;
    };
    /** Restore in-memory database from persistent store
     * All in memory tables are dropped and re-added
     */
    DummyDataPersister.prototype.restore = function (defaultOptions, getCollectionSpecificOptions) {
        return null;
    };
    /** Get all data from a specific collection */
    DummyDataPersister.prototype.getCollectionRecords = function (collectionName, options) {
        return null;
    };
    /** Add data to a specific collection */
    DummyDataPersister.prototype.addCollectionRecords = function (collectionName, options, records, removeExisting) {
        return null;
    };
    /** Remove all data from a specific collection */
    DummyDataPersister.prototype.clearCollections = function (collectionNames) {
        return null;
    };
    /** Delete all data related this database from persistent storage
     */
    DummyDataPersister.prototype.clearPersistentDb = function () {
        throw new Error("DummyDataPersister.clearPersistenceDb() not yet implemented");
    };
    return DummyDataPersister;
}());
module.exports = DummyDataPersister;
