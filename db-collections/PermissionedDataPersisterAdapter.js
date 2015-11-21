/** {@link DataPersister.Adapter} wrapper that checks permissions before reading/writing data
 * @author TeamworkGuy2
 */
var PermissionedDataPersisterAdapter = (function () {
    function PermissionedDataPersisterAdapter(persister, syncSettings, storeSettings) {
        this.syncSettings = syncSettings;
        this.storeSettings = storeSettings;
        this.persister = persister;
    }
    PermissionedDataPersisterAdapter.prototype.setDataStoreInterface = function (getDataStore, setDataStore, createDataStore) {
        this.persister.setDataStoreInterface(getDataStore, setDataStore, createDataStore);
    };
    PermissionedDataPersisterAdapter.prototype.setDataSources = function (getDataSources) {
        this.persister.setDataSources(getDataSources);
    };
    PermissionedDataPersisterAdapter.prototype.setDataConverters = function (saveItemTransformation, restoreItemTransformation) {
        this.persister.setDataConverters(saveItemTransformation, restoreItemTransformation);
    };
    PermissionedDataPersisterAdapter.prototype.save = function (callback) {
        if (this.syncSettings.writeAllow) {
            this.persister.save(callback);
        }
    };
    PermissionedDataPersisterAdapter.prototype.load = function (options, callback) {
        if (this.syncSettings.readAllow) {
            this.persister.save(callback);
        }
    };
    PermissionedDataPersisterAdapter.prototype.persist = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.restore = function () {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister read permission denied due to settings");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.clearPersistenceDb = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistenceDb();
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    };
    return PermissionedDataPersisterAdapter;
})();
module.exports = PermissionedDataPersisterAdapter;