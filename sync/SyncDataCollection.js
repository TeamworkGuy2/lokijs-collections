var Arrays = require("../lib/ts-mortar/utils/Arrays");
var Defer = require("../lib/ts-mortar/promises/Defer");
/**
 * @since 2016-1-29
 */
var SyncDataCollection = (function () {
    function SyncDataCollection(getLastSyncDate, updateLastSyncDate, isDeletedPropName, isSynchedPropName, lastModifiedPropName) {
        this.getLastSyncDate = getLastSyncDate;
        this.updateLastSyncDate = updateLastSyncDate;
        this.isDeletedPropName = isDeletedPropName;
        this.isSynchedPropName = isSynchedPropName;
        this.lastModifiedPropName = lastModifiedPropName;
    }
    /** Sync down a set of data collections
     * @param params: parameters to pass to the sync function
     * @param syncSettingsAry: an array of SyncSettings object to sync
     * @param [clearData=true]: true to clear the existing psData collection before syncing, false to leave it as-is
     * @return a map of {@code syncSettingsAry} collection names to the promises that will complete when they finish syncing
     */
    SyncDataCollection.prototype.syncDownCollections = function (params, syncSettingsAry, syncDownOp) {
        var promises = {};
        // sync each of the tables based on the settings in the passed in array
        for (var i = 0, size = syncSettingsAry.length; i < size; i++) {
            var dataSetConfig = syncSettingsAry[i];
            // wrap the 'dataSetConfig' because function is called back async
            var addItemsFunc = SyncDataCollection.createAddUpdateOrRemoveItemsFunc(dataSetConfig, this.isDeletedPropName, syncDownOp);
            var syncTablePromise = this.syncDownCollection(params, dataSetConfig.localCollection, dataSetConfig.syncDownFunc, addItemsFunc);
            promises[dataSetConfig.localCollection.getName()] = syncTablePromise;
        }
        return promises;
    };
    /** Sync down data from a server to a single local data collection
     * @param <E> the local collection data model. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param <F> the local collection data model with optional properties. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param <S> the remote data model. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     */
    SyncDataCollection.prototype.syncDownCollection = function (params, table, syncDownFunc, processResultItemsCallback) {
        var self = this;
        var dfd = Defer.newDefer();
        function syncFailure(msg) {
            dfd.reject({
                collectionName: table.getName(),
                error: msg
            });
        }
        function saveData() {
            // update the last sync time for this table to right now
            self.updateLastSyncDate(table);
            dfd.resolve(null);
        }
        syncDownFunc(params).done(function (items) {
            var promise = processResultItemsCallback(items);
            if (promise != null && promise["then"]) {
                promise.then(saveData, syncFailure);
            }
            else {
                saveData();
            }
        }, syncFailure);
        return dfd.promise;
    };
    /** Using the URL, data collection, and other settings from 'syncSettings', synchronize data from a local data collection to a remove server
     * @param <E> the local collection data model. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param <F> the local collection data model with optional properties. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param <S> the remote data model. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param syncSetting: a sync settings objects containing the URL, data collection, and conversion functions needed to sync
     * only contains one record and send that one record as an object, rather than sending an
     * array of objects to the service call, false or undefined sends an array of any data in the collection
     */
    SyncDataCollection.prototype.syncUpCollection = function (params, syncSetting, copyItemFunc) {
        var self = this;
        var primaryKeys = syncSetting.primaryKeys;
        var primaryKey = Arrays.getIfOneItem(primaryKeys);
        var localColl = syncSetting.localCollection;
        return this.syncAndUpdateCollection(localColl, copyItemFunc, primaryKey, primaryKeys, function convertAndSendItemsToServer(items) {
            var toServiceConverter = syncSetting.convertToSvcObjectFunc;
            var data = null;
            if (primaryKey) {
                data = SyncDataCollection.checkAndConvertSingleKeyItems(localColl.getName(), items, primaryKey, toServiceConverter);
            }
            else {
                data = SyncDataCollection.checkAndConvertMultiKeyItems(localColl.getName(), items, primaryKeys, toServiceConverter);
            }
            return syncSetting.syncUpFunc(params, data).then(function (res) {
                return res;
            }, function (err) {
                return {
                    collectionName: localColl.getName(),
                    syncingToServer: true,
                    error: err
                };
            });
        });
    };
    /** A wrapper around an {@code syncAction} function that syncs data to some destination.
     * This function loads the items from storage for {@code syncAction} and is called back if the data transfer is successful or not.
     * If the transfer is successful, the items in storage are updated to reflect that a sync has occurred.
     * @param <E> the local collection data model. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param <F> the local collection data model with optional properties. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param <S> the remote data model. This type should contain deleted, synched, and last modified properties corresponding to the prop names passed to the constructor
     * @param dfd deferred object to reject or resolve once {@code syncAction} has completed or failed
     * @param table the data source where data can be updated or retrieved
     * @param primaryKey the table data model's primary key, this or 'primaryKeys' must not be null, 'primaryKey' takes recedence
     * @param primaryKeys the table data model's primary keys, this or 'primaryKey' must not be null
     * @param syncAction the action which performs the data sync
     */
    SyncDataCollection.prototype.syncAndUpdateCollection = function (table, copyItemFunc, primaryKey, primaryKeys, syncAction) {
        var self = this;
        var dfd = Defer.newDefer();
        var synchedProp = {};
        synchedProp[this.isSynchedPropName] = false;
        var items = table.data(synchedProp);
        // if no items require syncing, resolve and return immediately
        if (items.length === 0) {
            dfd.resolve(null);
            return dfd.promise;
        }
        var itemsData = items.map(copyItemFunc);
        syncAction(itemsData).done(function (res) {
            if (primaryKey) {
                self.updateSinglePrimaryKeyItems(table, items, primaryKey);
            }
            else {
                self.updateMultiPrimaryKeyItems(table, items, primaryKeys);
            }
            dfd.resolve(null);
        }, function (err) {
            dfd.reject(err);
        });
        return dfd.promise;
    };
    SyncDataCollection.prototype.updateMultiPrimaryKeyItems = function (table, items, primaryKeys) {
        // set each item's synched flag to true once the items have been synched with the server
        var synchedProp = {};
        synchedProp[this.isSynchedPropName] = true;
        var whereFilter = {};
        whereFilter[this.lastModifiedPropName] = { $lte: null };
        whereFilter[this.isSynchedPropName] = false;
        for (var k = 0, keyCount = primaryKeys.length; k < keyCount; k++) {
            whereFilter[primaryKeys[k]] = null;
        }
        for (var i = 0; i < items.length; ++i) {
            var item = items[i];
            whereFilter[this.lastModifiedPropName].$lte = item[this.lastModifiedPropName] + 50;
            for (var k = 0, keyCount = primaryKeys.length; k < keyCount; k++) {
                whereFilter[primaryKeys[k]] = item[primaryKeys[k]];
            }
            table.updateWhere(whereFilter, synchedProp);
        }
    };
    SyncDataCollection.prototype.updateSinglePrimaryKeyItems = function (table, items, primaryKey) {
        // set each item's synched flag to true once the items have been synched with the server
        var synchedProp = {};
        synchedProp[this.isSynchedPropName] = true;
        var whereFilter = {};
        whereFilter[this.lastModifiedPropName] = { $lte: null };
        whereFilter[this.isSynchedPropName] = false;
        whereFilter[primaryKey] = null;
        for (var i = 0; i < items.length; ++i) {
            var item = items[i];
            whereFilter[this.lastModifiedPropName].$lte = item[this.lastModifiedPropName] + 50;
            whereFilter[primaryKey] = item[primaryKey];
            table.updateWhere(whereFilter, synchedProp);
        }
    };
    /** remove items marked for deletion and add new items or update existing items depending on parameters
     */
    SyncDataCollection.createAddUpdateOrRemoveItemsFunc = function (syncSettings, isDeletedPropName, syncDownOp) {
        return function addUpdateOrRemoveItemsFunc(items) {
            var table = syncSettings.localCollection;
            if (syncDownOp.removeAll) {
                table.clearCollection();
            }
            if (items && items.length) {
                var removeDeletedData = syncDownOp.removeDeleted;
                // use DataCollection.addOrUpdateWhere(...) to update existing items
                if (syncDownOp.merge) {
                    for (var i = 0, size = items.length; i < size; i++) {
                        var item = items[i];
                        if (isDeletedPropName != null && item[isDeletedPropName]) {
                            if (removeDeletedData) {
                                var query = syncSettings.findFilterFunc(item);
                                table.removeWhere(query);
                            }
                        }
                        else {
                            var convertedItem = syncSettings.convertToLocalObjectFunc(item);
                            var query = syncSettings.findFilterFunc(item);
                            table.addOrUpdateWhereNoModify(query, convertedItem);
                        }
                    }
                }
                else {
                    var res = [];
                    for (var i = 0, size = items.length; i < size; i++) {
                        var item = items[i];
                        if (isDeletedPropName != null && item[isDeletedPropName]) {
                            if (removeDeletedData) {
                                var query = syncSettings.findFilterFunc(item);
                                table.removeWhere(query);
                            }
                        }
                        else {
                            var convertedItem = syncSettings.convertToLocalObjectFunc(item);
                            res.push(convertedItem);
                        }
                    }
                    table.addAll(res);
                }
            }
        };
    };
    /** Check if each item in a list contains required primary keys, if not, throw an error.
     * Else convert the item using the provided conversion function
     * @return the 'items' array converted to result objects
     */
    SyncDataCollection.checkAndConvertMultiKeyItems = function (collName, items, primaryKeyFields, itemConverter) {
        var keyCount = primaryKeyFields.length;
        var resultItems = [];
        for (var i = 0, size = items.length; i < size; i++) {
            var item = items[i];
            var hasPrimaryKeys = true;
            for (var k = 0; k < keyCount; k++) {
                if (!item[primaryKeyFields[k]]) {
                    hasPrimaryKeys = false;
                    break;
                }
            }
            if (hasPrimaryKeys) {
                resultItems.push(itemConverter(item));
            }
            else {
                console.error("Error syncing " + collName);
            }
        }
        return resultItems;
    };
    /** Check if each item in a list contains a required primary key, if not, throw an error.
     * Else convert the item using the provided conversion function
     * @return the 'items' array converted to result objects
     */
    SyncDataCollection.checkAndConvertSingleKeyItems = function (collName, items, primaryKeyField, itemConverter) {
        var resultItems = [];
        for (var i = 0, size = items.length; i < size; i++) {
            var item = items[i];
            var hasPrimaryKey = !!item[primaryKeyField];
            if (hasPrimaryKey) {
                resultItems.push(itemConverter(item));
            }
            else {
                console.error("Error syncing " + collName);
            }
        }
        return resultItems;
    };
    return SyncDataCollection;
})();
var SyncDataCollection;
(function (SyncDataCollection) {
    var SyncDownOp = (function () {
        function SyncDownOp(removeAll, removeDeleted, merge) {
            this.removeAll = removeAll;
            this.removeDeleted = removeDeleted;
            this.merge = merge;
        }
        SyncDownOp.REMOVE_DELETED_AND_MERGE_NEW = new SyncDownOp(false, true, true);
        SyncDownOp.REMOVE_NONE_AND_MERGE_NEW = new SyncDownOp(false, false, true);
        SyncDownOp.REMOVE_ALL_AND_ADD_NEW = new SyncDownOp(true, false, false);
        SyncDownOp.REMOVE_DELETED_AND_ADD_NEW = new SyncDownOp(false, true, false);
        SyncDownOp.REMOVE_NONE_AND_ADD_NEW = new SyncDownOp(false, false, false);
        return SyncDownOp;
    })();
    SyncDataCollection.SyncDownOp = SyncDownOp;
    function createSyncDownOp(clearData, removeDeletedData, mergeWithExistingData) {
        if (clearData) {
            return SyncDownOp.REMOVE_ALL_AND_ADD_NEW;
        }
        else {
            if (removeDeletedData) {
                return mergeWithExistingData ? SyncDownOp.REMOVE_DELETED_AND_MERGE_NEW : SyncDownOp.REMOVE_DELETED_AND_ADD_NEW;
            }
            else {
                return mergeWithExistingData ? SyncDownOp.REMOVE_NONE_AND_MERGE_NEW : SyncDownOp.REMOVE_NONE_AND_ADD_NEW;
            }
        }
    }
    SyncDataCollection.createSyncDownOp = createSyncDownOp;
})(SyncDataCollection || (SyncDataCollection = {}));
module.exports = SyncDataCollection;
