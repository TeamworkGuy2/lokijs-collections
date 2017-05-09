"use strict";
/**
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
    DummyDataPersister.prototype.clearPersistentDb = function () {
        throw new Error("DummyDataPersister.clearPersistenceDb() not yet implemented");
    };
    return DummyDataPersister;
}());
module.exports = DummyDataPersister;
